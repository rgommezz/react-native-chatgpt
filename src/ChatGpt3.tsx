import React, {
  ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Animated, Platform, StyleSheet, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import type { WebView as RNWebView } from 'react-native-webview';
import type { ChatGpt3Response } from './types';
import type { ChatGPTError } from './types';
import { ChatGpt3Provider } from './Context';
import { usePrevious, useWebViewAnimation } from './hooks';
import WebView from './WebView';

export default function ChatGpt3({
  children,
}: {
  children?: ReactNode | undefined;
}) {
  const webviewRef = useRef<RNWebView>(null);
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
            ref={webviewRef}
            accessToken={accessToken}
            status={status}
            onLoginSuccess={() => setStatus('animating')}
            onAccessTokenChange={setAccessToken}
            onPartialResponse={(result) => callbackRef.current?.(result)}
            onStreamError={(error) => errorCallbackRef.current?.(error)}
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
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
  },
});
