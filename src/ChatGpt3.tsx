import React, { ReactNode, useCallback, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { WebView as RNWebView } from 'react-native-webview';
import type { ChatGpt3Response, ChatGPTError } from './types';
import { ChatGpt3Provider } from './Context';
import ModalWebView, { ModalWebViewMethods } from './ModalWebView';

export default function ChatGpt3({
  children,
}: {
  children?: ReactNode | undefined;
}) {
  const webviewRef = useRef<RNWebView>(null);
  const modalRef = useRef<ModalWebViewMethods>(null);
  const callbackRef = useRef<(arg: ChatGpt3Response) => void>(() => null);
  const errorCallbackRef = useRef<(arg: ChatGPTError) => void>(() => null);

  const [accessToken, setAccessToken] = useState('');

  const login = useCallback(() => {
    modalRef?.current?.open();
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
        <ModalWebView
          ref={modalRef}
          webviewRef={webviewRef}
          accessToken={accessToken}
          onAccessTokenChange={setAccessToken}
          onPartialResponse={(result) => callbackRef.current?.(result)}
          onStreamError={(error) => errorCallbackRef.current?.(error)}
        />
        {children}
      </ChatGpt3Provider>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
});
