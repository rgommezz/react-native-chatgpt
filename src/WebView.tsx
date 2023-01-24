import * as React from 'react';
import { forwardRef } from 'react';
import { StyleSheet } from 'react-native';
import { injectJavaScriptIntoWebViewBeforeIsLoaded } from './api';
import { WebView as RNWebView } from 'react-native-webview';
import { CHAT_PAGE, LOGIN_PAGE, USER_AGENT } from './constants';
import { ChatGpt3Response, ChatGPTError, WebViewEvents } from './types';
import { parseStreamBasedResponse } from './utils';

interface Props {
  accessToken: string;
  status: 'hidden' | 'animating' | 'visible';
  onLoginSuccess: () => void;
  onAccessTokenChange: (newAccessToken: string) => void;
  onPartialResponse: (response: ChatGpt3Response) => void;
  onStreamError: (error: ChatGPTError) => void;
}

const WebView = forwardRef<RNWebView, Props>(
  (
    {
      status,
      accessToken,
      onAccessTokenChange,
      onLoginSuccess,
      onPartialResponse,
      onStreamError,
    },
    ref
  ) => {
    return (
      <RNWebView
        injectedJavaScriptBeforeContentLoaded={injectJavaScriptIntoWebViewBeforeIsLoaded()}
        ref={ref}
        style={styles.webview}
        source={{ uri: status === 'hidden' ? CHAT_PAGE : LOGIN_PAGE }}
        onNavigationStateChange={(event) => {
          if (event.url.startsWith(CHAT_PAGE) && event.loading) {
            // We have successfully logged in, or we were already logged in.
            // We can hide the webview now.
            if (status === 'visible') {
              onLoginSuccess();
            }
          }
        }}
        userAgent={USER_AGENT}
        sharedCookiesEnabled
        onMessage={(event) => {
          try {
            const { payload, type } = JSON.parse(
              event.nativeEvent.data
            ) as WebViewEvents;
            if (type === 'REQUEST_INTERCEPTED_CONFIG') {
              if (Object.keys(payload)) {
                // We have headers
                const { headers } = payload;
                if (headers && 'Authorization' in headers) {
                  const newAuthToken = headers?.Authorization;
                  if (!!newAuthToken && newAuthToken !== accessToken) {
                    onAccessTokenChange(newAuthToken);
                  }
                }
              }
            }
            if (type === 'RAW_PARTIAL_RESPONSE') {
              const result = parseStreamBasedResponse(payload);
              if (result) {
                onPartialResponse(result);
              }
            }
            if (type === 'STREAM_ERROR') {
              const error = new ChatGPTError(
                payload?.statusText || 'Unknown error'
              );
              error.statusCode = payload?.status;
              onStreamError(error);
            }
          } catch (e) {
            console.log('error', e);
          }
        }}
      />
    );
  }
);

const styles = StyleSheet.create({
  webview: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 16,
  },
});

export default WebView;
