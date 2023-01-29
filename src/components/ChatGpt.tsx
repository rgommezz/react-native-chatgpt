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
import usePersistAccessToken from '../hooks/usePersistAccessToken';
import {
  REQUEST_DEFAULT_TIMEOUT,
  STREAMED_REQUEST_DEFAULT_TIMEOUT,
} from '../constants';

interface TimeoutProps {
  requestTimeout?: number;
  streamedRequestTimeout?: number;
}

export default function ChatGpt({
  containerStyles,
  backdropStyles,
  renderCustomCloseIcon,
  requestTimeout = REQUEST_DEFAULT_TIMEOUT,
  streamedRequestTimeout = STREAMED_REQUEST_DEFAULT_TIMEOUT,
  children,
}: PropsWithChildren<PublicProps & TimeoutProps>) {
  const modalRef = useRef<ModalWebViewMethods>(null);
  const callbackRef = useRef<(arg: ChatGptResponse) => void>(() => null);
  const errorCallbackRef = useRef<(arg: ChatGptError) => void>(() => null);
  const [isWaitingForJWT, setIsWaitingForJWT] = useState(false);
  const { isLoaded, setAccessToken, accessToken } = usePersistAccessToken();

  const status = (() => {
    if (!isLoaded) return 'initializing';

    if (isWaitingForJWT) return 'getting_auth_token';

    if (!accessToken && !isWaitingForJWT) return 'logged-out';

    return 'authenticated';
  })();

  const login = useCallback(() => {
    modalRef?.current?.open();
  }, []);

  const flush = useCallback(() => {
    setAccessToken('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        timeout: requestTimeout,
        onTokenExpired: () => setAccessToken(''),
      });
    }

    const { message, options, onAccumulatedResponse, onError } = args[0];

    if (!onAccumulatedResponse) {
      throw new ChatGptError(
        'onAccumulatedResponse is required for stream based responses.'
      );
    }

    // Assigning success and error callbacks to the refs so that they can be called from the webview.
    callbackRef.current = onAccumulatedResponse;
    errorCallbackRef.current = onError || (() => null);

    return postStreamedMessage({
      accessToken,
      message,
      conversationId: options?.conversationId,
      messageId: options?.messageId,
      timeout: streamedRequestTimeout,
    });
  }

  // Memoize sendMessage to avoid unnecessary re-renders
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const memoizedSendMessage = useCallback(sendMessage, [accessToken]);

  return (
    <ChatGptProvider
      status={status}
      login={login}
      flush={flush}
      sendMessage={memoizedSendMessage}
    >
      {children}
      <ModalWebView
        ref={modalRef}
        accessToken={accessToken}
        onLoginCompleted={() => setIsWaitingForJWT(true)}
        onAccessTokenChange={(token) => {
          setIsWaitingForJWT(false);
          setAccessToken(token);
        }}
        onAccumulatedResponse={(result) => callbackRef.current?.(result)}
        onStreamError={(error) => errorCallbackRef.current?.(error)}
        containerStyles={containerStyles}
        backdropStyles={backdropStyles}
        renderCustomCloseIcon={renderCustomCloseIcon}
      />
    </ChatGptProvider>
  );
}
