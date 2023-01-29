import uuid from 'react-native-uuid';
import { ChatGptError, ChatGptResponse, SendMessageParams } from '../types';
import {
  CHAT_PAGE,
  HOST_URL,
  LOGIN_PAGE,
  PROMPT_ENDPOINT,
  REQUEST_DEFAULT_TIMEOUT,
  STREAMED_REQUEST_DEFAULT_TIMEOUT,
} from '../constants';
import parseStreamedGptResponse from '../utils/parseStreamedGptResponse';
import getChatGptConversationHeaders from '../utils/getChatGptConversationHeaders';
import type { RefObject } from 'react';
import type WebView from 'react-native-webview';
import wait from '../utils/wait';
import { getStatusText } from '../utils/httpCodes';

let webview: RefObject<WebView>['current'];

export const init = (webviewRef: RefObject<WebView>['current']) => {
  webview = webviewRef;
};

/**
 * Monkey patches fetch to intercept ChatGPT requests and read the JWT
 * It also injects 2 methods in the global scope to accomplish the following:
 * 1. Sending messages to the ChatGPT backend directly from the Webview and stream the response back to RN
 * 2. Removing the theme switcher button from the webview when GPT shows it's at full capacity
 *
 * Note: It'd be cool to define the function in normal JS and
 * use fn.toString() or`${fn}` and wrap it in a IIFE,
 * but babel messes up the transformations of async/await and breaks the injected code.
 */
export const createGlobalFunctionsInWebviewContext = () => {
  return `
    const { fetch: originalFetch } = window;
    window.fetch = async (...args) => {
      const [resource, config] = args;
      window.ReactNativeWebView.postMessage(JSON.stringify({type: 'REQUEST_INTERCEPTED_CONFIG', payload: config}));
      const response = await originalFetch(resource, config);
      return response;
    };

    window.removeThemeSwitcher = () => {
      const svgIcon = document.querySelector("button > svg");
      if (!svgIcon) {
        return;
      }
      const themeSwitchButton = svgIcon.closest('button');
      if (themeSwitchButton) {
        themeSwitchButton.style.display = 'none';
      }
    };

    window.sendGptMessage = async ({
      accessToken,
      message,
      messageId,
      newMessageId,
      conversationId,
      timeout
    }) => {

      async function* streamAsyncIterable(stream) {
        const reader = stream.getReader()
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) {
              return
            }
            yield value
          }
        } finally {
          reader.releaseLock()
        }
      }

      function getHeaders(accessToken) {
        return {
          accept: "text/event-stream",
          "x-openai-assistant-app-id": "",
          authorization: accessToken,
          "content-type": "application/json",
          origin: "${HOST_URL}",
          referrer: "${CHAT_PAGE}",
          "sec-fetch-mode": "cors",
          "sec-fetch-site": "same-origin",
          "x-requested-with": "com.chatgpt3auth"
        };
      }

      const url = "${PROMPT_ENDPOINT}";
      const body = {
        action: "next",
        messages: [
          {
            id: newMessageId,
            role: "user",
            content: {
              content_type: "text",
              parts: [message],
            },
          },
        ],
        model: "text-davinci-002-render",
        parent_message_id: messageId,
      };

      if (conversationId) {
        body.conversation_id = conversationId;
      }

      const headers = getHeaders(accessToken);

      try {

        const controller = new AbortController();

        const timeoutId = setTimeout(() => {
          // Notifying RN that the request timed out
          window.ReactNativeWebView.postMessage(JSON.stringify({type: 'STREAM_ERROR', payload: {status: 408, statusText: 'Request timed out'}}));
          controller.abort();
        }, timeout);

        const res = await fetch(url, {
          method: "POST",
          body: JSON.stringify(body),
          headers: headers,
          mode: "cors",
          credentials: "include",
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (res.status >= 400 && res.status < 600) {
          window.ReactNativeWebView.postMessage(JSON.stringify({type: 'STREAM_ERROR', payload: {status: res.status}}));
          return true;
        }

        for await (const chunk of streamAsyncIterable(res.body)) {
          const str = new TextDecoder().decode(chunk);
          window.ReactNativeWebView.postMessage(JSON.stringify({type: 'RAW_ACCUMULATED_RESPONSE', payload: str}));
        }
      } catch (e) {
        // Nothing to do here
      }
    };

    true;
  `;
};

/**
 * Calls a global function in the Webview window object to send a streamed message
 */
export function postStreamedMessage({
  accessToken,
  message,
  messageId = uuid.v4() as string,
  conversationId,
  timeout = STREAMED_REQUEST_DEFAULT_TIMEOUT,
}: SendMessageParams) {
  const newMessageId = uuid.v4() as string;
  let script = '';
  if (conversationId) {
    script = `
      window.sendGptMessage({
        accessToken: "${accessToken}",
        message: "${message}",
        messageId: "${messageId}",
        newMessageId: "${newMessageId}",
        conversationId: "${conversationId}",
        timeout: ${timeout}
      });

      true;
    `;
  } else {
    script = `
      window.sendGptMessage({
        accessToken: "${accessToken}",
        message: "${message}",
        messageId: "${messageId}",
        newMessageId: "${newMessageId}",
        timeout: ${timeout}
      });

      true;
    `;
  }

  webview?.injectJavaScript(script);
}

/**
 * Sends a normal message to the ChatGPT conversation backend endpoint
 */
export async function postMessage({
  accessToken,
  message,
  messageId = uuid.v4() as string,
  conversationId,
  timeout = REQUEST_DEFAULT_TIMEOUT,
  onTokenExpired,
}: SendMessageParams): Promise<ChatGptResponse> {
  const controller = new AbortController();
  const newMessageId = uuid.v4() as string;

  const timeoutId = setTimeout(() => {
    controller.abort();
    const error = new ChatGptError(
      'ChatGPTResponseClientError: Request timed out'
    );
    error.statusCode = 408;
    throw error;
  }, timeout);

  const url = PROMPT_ENDPOINT;
  const body = {
    action: 'next',
    messages: [
      {
        id: newMessageId,
        role: 'user',
        content: {
          content_type: 'text',
          parts: [message],
        },
      },
    ],
    model: 'text-davinci-002-render',
    parent_message_id: messageId,
  };

  if (conversationId) {
    // @ts-ignore
    body.conversation_id = conversationId;
  }

  const res = await fetch(url, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: getChatGptConversationHeaders(accessToken),
    mode: 'cors',
    signal: controller.signal,
  });

  clearTimeout(timeoutId);

  if (res.status >= 400 && res.status < 500) {
    if (res.status === 401) {
      // Token expired, notifying
      onTokenExpired?.();
    } else if (res.status === 403) {
      // Session expired, reloading Web View
      reloadWebView();
    }

    const error = new ChatGptError(getStatusText(res.status as any));
    error.statusCode = res.status;
    throw error;
  } else if (res.status >= 500) {
    const error = new ChatGptError(
      `ChatGPTResponseServerError: ${res.status} ${res.statusText}`
    );
    error.statusCode = res.status;
    throw error;
  }

  const rawText = await res.text();
  const parsedData = parseStreamedGptResponse(rawText);

  if (!parsedData) {
    throw new ChatGptError('ChatGPTResponseError: Unable to parse response');
  }

  return parsedData;
}

export function reloadWebView() {
  webview?.reload();
}

/**
 * Removes the icon button in the top right corner of the webview screen when
 * ChatGPT is at full capacity
 */
export async function removeThemeSwitcher() {
  // Apparently the button is not there yet after the page loads, so we wait a bit
  await wait(200);

  const script = `
    (() => {
      const xpath = "//div[contains(text(),'ChatGPT is at capacity right now')]";
      const element = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
      if (element) {
        window.removeThemeSwitcher();
      }
    })();

    true;
  `;

  webview?.injectJavaScript(script);
}

/**
 * Checks if ChatGPT servers are overloaded and the normal login page is not accessible
 */
export function checkFullCapacity() {
  const script = `
    (() => {
      const xpath = "//div[contains(text(),'ChatGPT is at capacity right now')]";
      const element = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
      if (element) {
        window.removeThemeSwitcher();
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'CHAT_GPT_FULL_CAPACITY' }));
      }
    })();

    true;
  `;
  webview?.injectJavaScript(script);
}

/**
 * Refreshes the webview and checks again if the login page is available
 */
export async function retryLogin() {
  reloadWebView();
  // Waiting 3 seconds before checking again
  await wait(3000);
  checkFullCapacity();
}

export function navigateToLoginPage() {
  const script = `
   (() => {
      window.location.replace("${LOGIN_PAGE}");
   })();

   true;
  `;

  webview?.injectJavaScript(script);
}
