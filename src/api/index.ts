import uuid from 'react-native-uuid';
import { ChatGptError, ChatGptResponse, SendMessageParams } from '../types';
import { CHAT_PAGE, HOST_URL, PROMPT_ENDPOINT } from '../constants';
import parseStreamedGptResponse from '../utils/parseStreamedGptResponse';
import getChatGptConversationHeaders from '../utils/getChatGptConversationHeaders';
import type { RefObject } from 'react';
import type WebView from 'react-native-webview';
import wait from '../utils/wait';

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
      conversationId
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
            id: conversationId,
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

      const headers = getHeaders(accessToken);

      try {
        const res = await fetch(url, {
          method: "POST",
          body: JSON.stringify(body),
          headers: headers,
          mode: "cors",
          credentials: "include"
        });


        if (res.status >= 400 && res.status < 600) {
          window.ReactNativeWebView.postMessage(JSON.stringify({type: 'STREAM_ERROR', payload: {status: res.status, message: res.statusText}}));
          return true;
        }

        for await (const chunk of streamAsyncIterable(res.body)) {
          const str = new TextDecoder().decode(chunk);
          window.ReactNativeWebView.postMessage(JSON.stringify({type: 'RAW_ACCUMULATED_RESPONSE', payload: str}));
        }
      } catch (e) {
        console.log("error", e);
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
  conversationId = uuid.v4() as string,
}: SendMessageParams) {
  const script = `
    window.sendGptMessage({
      accessToken: "${accessToken}",
      message: "${message}",
      messageId: "${messageId}",
      conversationId: "${conversationId}"
    });

    true;
  `;
  webview?.injectJavaScript(script);
}

/**
 * Sends a normal message to the ChatGPT conversation backend endpoint
 */
export async function postMessage({
  accessToken,
  message,
  messageId = uuid.v4() as string,
  conversationId = uuid.v4() as string,
}: SendMessageParams): Promise<ChatGptResponse> {
  const url = PROMPT_ENDPOINT;
  const body = {
    action: 'next',
    messages: [
      {
        id: conversationId,
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

  const res = await fetch(url, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: getChatGptConversationHeaders(accessToken),
    mode: 'cors',
  });

  if (res.status >= 400 && res.status < 500) {
    const error = new ChatGptError(
      res.status === 403 || res.status === 401
        ? 'ChatGPTResponseClientError: Your access token may have expired. Please login again.'
        : `ChatGPTResponseClientError: ${res.status} ${res.statusText}`
    );
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
      const element = document.evaluate(_xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
      if (element) {
        window.removeThemeSwitcher();
      }
      true;
    })();
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
      true;
    })();
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
