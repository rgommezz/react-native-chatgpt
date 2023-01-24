import uuid from 'react-native-uuid';
import { ChatGpt3Response, ChatGPTError, SendMessageParams } from './types';
import { CHAT_PAGE, HOST_URL, PROMPT_ENDPOINT } from './constants';
import { getHeaders, parseStreamBasedResponse } from './utils';

export const injectJavaScriptIntoWebViewBeforeIsLoaded = () => {
  return `
    const { fetch: originalFetch } = window;
    window.fetch = async (...args) => {
      const [resource, config] = args;
      window.ReactNativeWebView.postMessage(JSON.stringify({type: 'REQUEST_INTERCEPTED_CONFIG', payload: config}));
      const response = await originalFetch(resource, config);
      return response;
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
          return window.ReactNativeWebView.postMessage(JSON.stringify({type: 'STREAM_ERROR', payload: {status: res.status, message: res.statusText}}));
        }

        for await (const chunk of streamAsyncIterable(res.body)) {
          const str = new TextDecoder().decode(chunk);
          window.ReactNativeWebView.postMessage(JSON.stringify({type: 'RAW_PARTIAL_RESPONSE', payload: str}));
        }
      } catch (e) {
        console.log("error", e);
      }
    };

    true;
  `;
};

export async function sendMessage({
  accessToken,
  message,
  messageId = uuid.v4() as string,
  conversationId = uuid.v4() as string,
}: SendMessageParams): Promise<ChatGpt3Response> {
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
    headers: getHeaders(accessToken),
    mode: 'cors',
  });

  if (res.status >= 400 && res.status < 500) {
    const error = new ChatGPTError('Client error');
    error.statusCode = res.status;
    throw error;
  } else if (res.status >= 500) {
    // Server error
    const error = new ChatGPTError('Server error');
    error.statusCode = res.status;
    throw error;
  }

  const rawText = await res.text();
  const parsedData = parseStreamBasedResponse(rawText);

  if (!parsedData) {
    throw new ChatGPTError('ChatGPT raw text response, parse error');
  }

  return parsedData;
}
