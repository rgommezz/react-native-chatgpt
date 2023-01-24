import React, {
  ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Animated, Platform, StyleSheet, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { WebView } from 'react-native-webview';
import type { ChatGpt3Response, WebViewEvents } from './types';
import { ChatGPTError } from './types';
import { injectJavaScriptIntoWebViewBeforeIsLoaded } from './api';
import { CHAT_PAGE, LOGIN_PAGE, USER_AGENT } from './constants';
import { parseStreamBasedResponse } from './utils';
import { ChatGpt3Provider } from './Context';
import { usePrevious, useWebViewAnimation } from './hooks';

export default function ChatGpt3({
  children,
}: {
  children?: ReactNode | undefined;
}) {
  const webviewRef = useRef<WebView>(null);
  const callbackRef = useRef<(arg: ChatGpt3Response) => void>(() => null);
  const errorCallbackRef = useRef<(arg: ChatGPTError) => void>(() => null);

  const [accessToken, setAccessToken] = useState('');
  const [status, setStatus] = useState<'hidden' | 'animating' | 'visible'>(
    'hidden'
  );
  const prevStatus = usePrevious(status);

  const { animatedStyles, animateWebView } = useWebViewAnimation({
    onAnimationStart: () => setStatus('animating'),
    onAnimationEnd: (mode) => setStatus(mode === 'show' ? 'visible' : 'hidden'),
  });

  useEffect(() => {
    if (prevStatus === 'hidden' && status === 'animating') {
      animateWebView('show');
    } else if (prevStatus === 'visible' && status === 'animating') {
      animateWebView('hide');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prevStatus, status]);

  const login = useCallback(() => {
    setStatus('animating');
  }, []);

  return (
    <View style={styles.flex}>
      <ChatGpt3Provider
        accessToken={accessToken}
        login={login}
        callbackRef={callbackRef}
        webviewRef={webviewRef}
        errorCallbackRef={errorCallbackRef}
      >
        <Animated.View style={[styles.container, animatedStyles]}>
          <WebView
            injectedJavaScriptBeforeContentLoaded={injectJavaScriptIntoWebViewBeforeIsLoaded()}
            ref={webviewRef}
            style={styles.webview}
            source={{ uri: status === 'hidden' ? CHAT_PAGE : LOGIN_PAGE }}
            onNavigationStateChange={(event) => {
              if (event.url.startsWith(CHAT_PAGE) && event.loading) {
                // We have successfully logged in, or we were already logged in.
                // We can hide the webview now.
                if (status === 'visible') {
                  setStatus('animating');
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
                      const authToken = headers?.Authorization;
                      if (!!authToken && authToken !== accessToken) {
                        setAccessToken(authToken);
                      }
                    }
                  }
                }
                if (type === 'RAW_PARTIAL_RESPONSE') {
                  const result = parseStreamBasedResponse(payload);
                  if (result) {
                    callbackRef.current?.(result);
                  }
                }
                if (type === 'STREAM_ERROR') {
                  const error = new ChatGPTError(
                    payload?.statusText || 'Unknown error'
                  );
                  error.statusCode = payload?.status;
                  errorCallbackRef.current?.(error);
                }
              } catch (e) {
                console.log('error', e);
              }
            }}
          />
          <View style={styles.closeButton}>
            <Icon
              name="close"
              color="black"
              size={24}
              onPress={() => setStatus('animating')}
            />
          </View>
        </Animated.View>
        {children}
      </ChatGpt3Provider>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    position: 'absolute',
    // Needed for Android to be on top of everything else
    elevation: 8,
    zIndex: 100,
    top: 96,
    left: 16,
    right: 16,
    bottom: 96,
    borderRadius: 16,
    overflow: Platform.OS === 'android' ? 'hidden' : 'visible',
    flex: 1,
    shadowColor: 'black',
    shadowOffset: {
      width: 4,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
  webview: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 16,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
  },
});
