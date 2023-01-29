import * as React from 'react';
import {
  forwardRef,
  ReactNode,
  useCallback,
  useEffect,
  useImperativeHandle,
  useState,
} from 'react';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useBackHandler, useAppState } from '@react-native-community/hooks';
import { Animated, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import {
  checkFullCapacity,
  createGlobalFunctionsInWebviewContext,
  init,
  navigateToLoginPage,
  reloadWebView,
  removeThemeSwitcher,
  retryLogin,
} from '../api';
import { WebView as RNWebView } from 'react-native-webview';
import { CHAT_PAGE, LOGIN_PAGE, USER_AGENT } from '../constants';
import { ChatGptError, ChatGptResponse, WebViewEvents } from '../types';
import useWebViewAnimation from '../hooks/useWebViewAnimation';
import parseStreamedGptResponse from '../utils/parseStreamedGptResponse';
import { getStatusText } from '../utils/httpCodes';

interface PassedProps {
  accessToken: string;
  onLoginCompleted: () => void;
  onAccessTokenChange: (newAccessToken: string) => void;
  onAccumulatedResponse: (response: ChatGptResponse) => void;
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
      onLoginCompleted,
      onAccessTokenChange,
      onAccumulatedResponse,
      onStreamError,
      containerStyles,
      backdropStyles,
      renderCustomCloseIcon,
    },
    ref
  ) => {
    const appState = useAppState();
    const [status, setStatus] = useState<'hidden' | 'animating' | 'visible'>(
      'hidden'
    );

    const { animatedStyles, animateWebView } = useWebViewAnimation({
      onAnimationStart: () => setStatus('animating'),
      onAnimationEnd: (mode) =>
        setStatus(mode === 'show' ? 'visible' : 'hidden'),
    });

    const onWebviewRefChange = useCallback((webviewRef: RNWebView) => {
      if (webviewRef) {
        init(webviewRef);
      }
    }, []);

    useImperativeHandle(ref, () => ({
      open: () => {
        animateWebView('show');
      },
    }));

    useEffect(() => {
      if (status === 'visible') {
        // Check if the page shown is ChatGPT is at full capacity.
        // If it is, we can reload the page at intervals to check if it's available again.
        checkFullCapacity();
      }
    }, [status]);

    const getCurrentStatus = () => status;

    useEffect(() => {
      const currentStatus = getCurrentStatus();
      if (appState === 'active' && currentStatus === 'hidden') {
        // Proactively reload the webview when the app is foregrounded
        // to refresh the CloudFare session cookies.
        reloadWebView();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [appState]);

    useBackHandler(() => {
      if (status !== 'hidden') {
        // Handle it
        closeModal();
        return true;
      }
      // Let the default thing happen
      return false;
    });

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
            injectedJavaScript={createGlobalFunctionsInWebviewContext()}
            ref={onWebviewRefChange}
            onLoad={async (event) => {
              const { url, loading } = event.nativeEvent;
              if (
                url.startsWith(LOGIN_PAGE) &&
                status === 'visible' &&
                !loading
              ) {
                removeThemeSwitcher();
              }
            }}
            style={styles.webview}
            source={{ uri: LOGIN_PAGE }}
            onNavigationStateChange={(event) => {
              if (
                event.url.startsWith(CHAT_PAGE) &&
                event.loading &&
                status === 'visible'
              ) {
                // We have successfully logged in. We can hide the webview now.
                onLoginCompleted();
                animateWebView('hide');
              }
            }}
            userAgent={USER_AGENT}
            sharedCookiesEnabled
            onContentProcessDidTerminate={() => {
              reloadWebView();
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
                        navigateToLoginPage();
                      }
                    }
                  }
                }
                if (type === 'RAW_ACCUMULATED_RESPONSE') {
                  const result = parseStreamedGptResponse(payload);
                  if (result) {
                    onAccumulatedResponse(result);
                  }
                }
                if (type === 'CHAT_GPT_FULL_CAPACITY' && status === 'visible') {
                  // Reload the page to check if it's available again.
                  retryLogin();
                }
                if (type === 'STREAM_ERROR') {
                  const error = new ChatGptError(
                    getStatusText(payload?.status as any)
                  );
                  error.statusCode = payload?.status;
                  if (error.statusCode === 401) {
                    // Token expired, notifying
                    onAccessTokenChange('');
                  } else if (error.statusCode === 403) {
                    // CloudFare Session expired, reloading Web View
                    reloadWebView();
                  }
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
