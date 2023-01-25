import React, { PropsWithChildren, useCallback, useRef, useState } from 'react';
import type {
  ChatGptResponse,
  SendMessageOptions,
  StreamMessageParams,
} from '../types';
import { ChatGptError } from '../types';
import { ChatGptProvider } from '../contexts/ChatGptContext';
import ModalWebView, { ModalWebViewMethods, PublicProps } from './ModalWebView';
import { postMessage, postStreamedMessage } from '../api';

export default function ChatGpt({
  containerStyles,
  backdropStyles,
  renderCustomCloseIcon,
  children,
}: PropsWithChildren<PublicProps>) {
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

    if (!onPartialResponse) {
      throw new ChatGptError(
        'onPartialResponse is required for stream based responses.'
      );
    }

    // Assigning success and error callbacks to the refs so that they can be called from the webview.
    callbackRef.current = onPartialResponse;
    errorCallbackRef.current = onError || (() => null);

    return postStreamedMessage({
      accessToken,
      message,
      conversationId: options?.conversationId,
      messageId: options?.messageId,
    });
  }

  // Memoize sendMessage to avoid unnecessary re-renders
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const memoizedSendMessage = useCallback(sendMessage, [accessToken]);

  return (
    <ChatGptProvider
      accessToken={accessToken}
      login={login}
      sendMessage={memoizedSendMessage}
    >
      {children}
      <ModalWebView
        ref={modalRef}
        accessToken={accessToken}
        onAccessTokenChange={setAccessToken}
        onPartialResponse={(result) => callbackRef.current?.(result)}
        onStreamError={(error) => errorCallbackRef.current?.(error)}
        containerStyles={containerStyles}
        backdropStyles={backdropStyles}
        renderCustomCloseIcon={renderCustomCloseIcon}
      />
    </ChatGptProvider>
  );
}
