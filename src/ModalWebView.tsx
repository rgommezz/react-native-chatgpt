import * as React from 'react';
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { Animated, Platform, StyleSheet, View } from 'react-native';
import { injectJavaScriptIntoWebViewBeforeIsLoaded } from './api';
import { WebView as RNWebView } from 'react-native-webview';
import { CHAT_PAGE, LOGIN_PAGE, USER_AGENT } from './constants';
import { ChatGpt3Response, ChatGPTError, WebViewEvents } from './types';
import { parseStreamBasedResponse } from './utils';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { usePrevious, useWebViewAnimation } from './hooks';

interface Props {
  accessToken: string;
  webviewRef: React.RefObject<RNWebView>;
  onAccessTokenChange: (newAccessToken: string) => void;
  onPartialResponse: (response: ChatGpt3Response) => void;
  onStreamError: (error: ChatGPTError) => void;
}

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
    },
    ref
  ) => {
    const [status, setStatus] = useState<'hidden' | 'animating' | 'visible'>(
      'hidden'
    );
    const prevStatus = usePrevious(status);

    const { animatedStyles, animateWebView } = useWebViewAnimation({
      onAnimationStart: () => setStatus('animating'),
      onAnimationEnd: (mode) =>
        setStatus(mode === 'show' ? 'visible' : 'hidden'),
    });

    useImperativeHandle(ref, () => ({
      open: () => {
        setStatus('animating');
      },
    }));

    useEffect(() => {
      if (prevStatus === 'hidden' && status === 'animating') {
        animateWebView('show');
      } else if (prevStatus === 'visible' && status === 'animating') {
        animateWebView('hide');
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [prevStatus, status]);

    return (
      <Animated.View style={[styles.container, animatedStyles]}>
        <RNWebView
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
        <View style={styles.closeButton}>
          <Icon
            name="close"
            color="black"
            size={24}
            onPress={() => setStatus('animating')}
          />
        </View>
      </Animated.View>
    );
  }
);

const styles = StyleSheet.create({
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
