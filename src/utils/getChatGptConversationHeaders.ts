import { CHAT_PAGE, HOST_URL, USER_AGENT } from '../constants';

/**
 * Returns proper headers for the https://chat.openai.com/backend-api/conversation endpoint
 * @param accessToken
 */
export default function getChatGptConversationHeaders(accessToken: string) {
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
