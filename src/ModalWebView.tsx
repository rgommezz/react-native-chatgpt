import * as React from 'react';
import {
  forwardRef,
  ReactNode,
  useEffect,
  useImperativeHandle,
  useState,
} from 'react';
import { useAppState, useBackHandler } from '@react-native-community/hooks';
import { Animated, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import {
  checkIfChatGptIsAtFullCapacityScript,
  injectJavaScriptIntoWebViewBeforeIsLoaded,
  removeThemeSwitcherScript,
} from './api';
import { WebView as RNWebView } from 'react-native-webview';
import { CHAT_PAGE, LOGIN_PAGE, USER_AGENT } from './constants';
import { ChatGptError, ChatGptResponse, WebViewEvents } from './types';
import { parseStreamBasedResponse, wait } from './utils';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useWebViewAnimation } from './hooks';

interface PassedProps {
  accessToken: string;
  webviewRef: React.RefObject<RNWebView>;
  onAccessTokenChange: (newAccessToken: string) => void;
  onPartialResponse: (response: ChatGptResponse) => void;
  onStreamError: (error: ChatGptError) => void;
}

export interface PublicProps {
  containerStyles?: StyleProp<ViewStyle>;
  backdropStyles?: StyleProp<ViewStyle>;
  renderCustomCloseIcon?: (closeModal: () => void) => ReactNode;
}

type Props = PassedProps & PublicProps;

export interface ModalWebViewMethods {
  open: () => void;
}

const ModalWebView = forwardRef<ModalWebViewMethods, Props>(
  (
    {
      accessToken,
      onAccessTokenChange,
      onPartialResponse,
      onStreamError,
      webviewRef,
      containerStyles,
      backdropStyles,
      renderCustomCloseIcon,
    },
    ref
  ) => {
    const currentAppState = useAppState();
    const [status, setStatus] = useState<'hidden' | 'animating' | 'visible'>(
      'hidden'
    );

    const { animatedStyles, animateWebView } = useWebViewAnimation({
      onAnimationStart: () => setStatus('animating'),
      onAnimationEnd: (mode) =>
        setStatus(mode === 'show' ? 'visible' : 'hidden'),
    });

    useImperativeHandle(ref, () => ({
      open: () => {
        animateWebView('show');
      },
    }));

    useEffect(() => {
      if (status === 'visible') {
        // Check if the page shown is ChatGPT is at full capacity.
        // If it is, we can reload the page at intervals to check if it's available again.
        checkIfChatGptIsAtFullCapacity();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [status]);

    useEffect(() => {
      // Every time the app is brought to the foreground,
      // we reload the webview to avoid 403s from Cloudfare on the chat screen
      if (currentAppState === 'active' && status === 'hidden') {
        webviewRef.current?.reload();
      }
    }, [currentAppState, status, webviewRef]);

    useBackHandler(() => {
      if (status !== 'hidden') {
        // Handle it
        closeModal();
        return true;
      }
      // Let the default thing happen
      return false;
    });

    function checkIfChatGptIsAtFullCapacity() {
      const script = checkIfChatGptIsAtFullCapacityScript();
      webviewRef.current?.injectJavaScript(script);
    }

    async function reloadAndCheckCapacityAgain() {
      await wait(2000);
      webviewRef.current?.reload();
      await wait(3000);
      checkIfChatGptIsAtFullCapacity();
    }

    function closeModal() {
      animateWebView('hide');
    }

    return (
      <>
        <Animated.View
          style={[
            styles.container,
            animatedStyles.webview,
            { display: status === 'hidden' ? 'none' : 'flex' },
            containerStyles,
          ]}
        >
          <RNWebView
            injectedJavaScriptBeforeContentLoaded={injectJavaScriptIntoWebViewBeforeIsLoaded()}
            ref={webviewRef}
            onLoad={async (event) => {
              const { url, loading, navigationType } = event.nativeEvent;
              if (
                url.startsWith(LOGIN_PAGE) &&
                status === 'visible' &&
                !!navigationType &&
                !loading
              ) {
                // Apparently the button is not there yet after this fires, so we wait a bit
                await wait(32);
                const script = removeThemeSwitcherScript();
                webviewRef.current?.injectJavaScript(script);
              }
            }}
            style={styles.webview}
            source={{ uri: status === 'hidden' ? CHAT_PAGE : LOGIN_PAGE }}
            onNavigationStateChange={(event) => {
              if (event.url.startsWith(CHAT_PAGE) && event.loading) {
                // We have successfully logged in, or we were already logged in.
                // We can hide the webview now.
                if (status === 'visible') {
                  animateWebView('hide');
                }
              }
            }}
            userAgent={USER_AGENT}
            sharedCookiesEnabled
            onContentProcessDidTerminate={() => {
              webviewRef.current?.reload();
            }}
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
                if (type === 'CHAT_GPT_FULL_CAPACITY' && status === 'visible') {
                  // Reload the page to check if it's available again.
                  reloadAndCheckCapacityAgain();
                }
                if (type === 'STREAM_ERROR') {
                  const error = new ChatGptError(
                    payload?.statusText ||
                      `ChatGPTResponseStreamError: ${payload?.status}`
                  );
                  error.statusCode = payload?.status;
                  onStreamError(error);
                }
              } catch (e) {
                // Ignore errors here
              }
            }}
          />
          {renderCustomCloseIcon?.(closeModal) || (
            <View style={styles.closeButton}>
              <Icon name="close" color="black" size={32} onPress={closeModal} />
            </View>
          )}
        </Animated.View>
        <Animated.View
          style={[
            styles.backdrop,
            animatedStyles.backdrop,
            { display: status === 'hidden' ? 'none' : 'flex' },
            backdropStyles,
          ]}
          pointerEvents="none"
        />
      </>
    );
  }
);

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
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
    overflow: 'hidden',
    flex: 1,
    shadowColor: 'black',
    shadowOffset: {
      width: 4,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
  },
  webview: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 16,
  },
});

export default ModalWebView;
