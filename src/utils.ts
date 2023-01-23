import uuid from 'react-native-uuid';
import { Platform } from 'react-native';

export interface ChatGpt3Response {
  message: string;
  messageId: string;
  conversationId: string;
  isDone?: boolean;
}

export const HOST_URL = 'https://chat.openai.com';
export const CHAT_PAGE = `${HOST_URL}/chat`;
export const LOGIN_PAGE = `${HOST_URL}/auth/login`;
export const PROMPT_ENDPOINT = `${HOST_URL}/backend-api/conversation`;
export const LOGIN_SUCCESS_PAGE = `${HOST_URL}/api/auth/callback`;

// We have to set a user agent to bypass Google security. Google login is not supported by webviews.
// By setting the user agent we trick Google into thinking we are using the Chrome mobile browser.
// The user agent is obtained from https://user-agents.net/string/mozilla-5-0-iphone-cpu-iphone-os-10-3-like-mac-os-x-applewebkit-602-1-50-khtml-like-gecko-crios-90-0-2924-75-mobile-14e5239e-safari-602-1
// https://github.com/react-native-webview/react-native-webview/issues/162
export const USER_AGENT =
  Platform.OS === 'ios'
    ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 10_3 like Mac OS X) AppleWebKit/602.1.50 (KHTML, like Gecko) CriOS/90.0.2924.75 Mobile/14E5239e Safari/602.1'
    : 'Mozilla/5.0 (Linux; Android 13; SM-N981B Build/TP1A.220624.014) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/108.0.5359.128 Mobile Safari/537.36 [FB_IAB/Orca-Android;FBAV/392.0.0.12.106;]';

/**
 * @see https://stackoverflow.com/a/1144788/4642844
 * @param string
 */
function escapeRegExp(string: string) {
  // The $& at the end means the whole matched string
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * @see https://stackoverflow.com/a/1144788/4642844
 * @param str the original string
 * @param find the string to replace
 * @param replace the replacement string
 */
function replaceAll(str: string, find: string, replace: string) {
  return str.replace(new RegExp(escapeRegExp(find), 'g'), replace);
}

function getHeaders(accessToken: string) {
  return {
    'accept': 'application/json',
    'x-openai-assistant-app-id': '',
    'authorization': accessToken,
    'content-type': 'application/json',
    'origin': HOST_URL,
    'referrer': CHAT_PAGE,
    ['sec-fetch-mode']: 'cors',
    ['sec-fetch-site']: 'same-origin',
    'x-requested-with': 'com.chatgpt3auth',
    'user-agent': USER_AGENT,
  };
}

/**
 * Parses the response from the https://chat.openai.com/backend-api/conversation endpoint
 * The response is of content-type: text/event-stream and not JSON.
 * That's why we need to get the raw text from the response first and parse it manually.
 * The final response is the last chunk of the stream.
 * @param data
 */
export function parseStreamBasedResponse(data: string) {
  const chunks = data.split('data: ');
  const sanitizedChunks = chunks
    .map((c) => replaceAll(c, '\n', ''))
    .filter((c) => !!c && c !== '[DONE]');
  if (!sanitizedChunks.length) {
    return null;
  }
  // @ts-ignore
  const response = JSON.parse(sanitizedChunks[sanitizedChunks.length - 1]);
  return {
    message: response.message.content.parts[0],
    messageId: response.message.id,
    conversationId: response.conversation_id,
    isDone: response.message?.end_turn === true,
  };
}

interface SendMessageParams {
  accessToken: string;
  message: string;
  messageId?: string;
  conversationId?: string;
}

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
  const rawText = await res.text();
  const parsedData = parseStreamBasedResponse(rawText);

  if (!parsedData) {
    throw new Error('Error: could not parse response');
  }

  return parsedData;
}
