import React, { PropsWithChildren, useCallback, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { WebView as RNWebView } from 'react-native-webview';
import type {
  ChatGptResponse,
  ChatGptError,
  SendMessageOptions,
  StreamMessageParams,
} from './types';
import { ChatGptProvider } from './Context';
import ModalWebView, { ModalWebViewMethods, PublicProps } from './ModalWebView';
import { getPostMessageWithStreamScript, postMessage } from './api';

export default function ChatGpt({
  containerStyles,
  backdropStyles,
  renderCustomCloseIcon,
  children,
}: PropsWithChildren<PublicProps>) {
  const webviewRef = useRef<RNWebView>(null);
  const modalRef = useRef<ModalWebViewMethods>(null);
  const callbackRef = useRef<(arg: ChatGptResponse) => void>(() => null);
  const errorCallbackRef = useRef<(arg: ChatGptError) => void>(() => null);

  const [accessToken, setAccessToken] = useState('');

  const login = useCallback(() => {
    modalRef?.current?.open();
  }, []);

  function sendMessage(
    message: string,
    options?: SendMessageOptions
  ): Promise<ChatGptResponse>;
  function sendMessage(args: StreamMessageParams): void;
  function sendMessage(
    ...args: [StreamMessageParams] | [string, SendMessageOptions?]
  ) {
    if (typeof args[0] === 'string') {
      const message = args[0];
      const options = args[1];
      return postMessage({
        accessToken,
        message,
        conversationId: options?.conversationId,
        messageId: options?.messageId,
      });
    }

    const { message, options, onPartialResponse, onError } = args[0];

    // Stream based response.
    if (onPartialResponse) {
      // Assigning success and error callbacks to the ref so that they can be called from the webview.
      callbackRef.current = onPartialResponse;
      errorCallbackRef.current = onError || (() => null);

      const postMessageWithStreamScript = getPostMessageWithStreamScript(
        accessToken,
        message,
        options
      );

      webviewRef.current?.injectJavaScript(postMessageWithStreamScript);
      return undefined;
    }

    return;
  }

  // Memoize sendMessage to avoid unnecessary re-renders
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const memoizedSendMessage = useCallback(sendMessage, [accessToken]);

  return (
    <View style={styles.flex}>
      <ChatGptProvider
        accessToken={accessToken}
        login={login}
        sendMessage={memoizedSendMessage}
      >
        <ModalWebView
          ref={modalRef}
          webviewRef={webviewRef}
          accessToken={accessToken}
          onAccessTokenChange={setAccessToken}
          onPartialResponse={(result) => callbackRef.current?.(result)}
          onStreamError={(error) => errorCallbackRef.current?.(error)}
          containerStyles={containerStyles}
          backdropStyles={backdropStyles}
          renderCustomCloseIcon={renderCustomCloseIcon}
        />
        {children}
      </ChatGptProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
});
