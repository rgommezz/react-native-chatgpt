import { Platform } from 'react-native';

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

export const REQUEST_DEFAULT_TIMEOUT = 30000;
export const STREAMED_REQUEST_DEFAULT_TIMEOUT = 15000;
