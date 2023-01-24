import type {
  ChatGpt3Response,
  SendMessageOptions,
  StreamMessageParams,
} from './types';
import React, {
  createContext,
  MutableRefObject,
  PropsWithChildren,
  useContext,
  useMemo,
} from 'react';
import { sendMessage } from './api';
import uuid from 'react-native-uuid';

interface ChatGpt3ContextInterface {
  accessToken: string;
  login: () => void;
  sendMessage(
    message: string,
    options?: SendMessageOptions
  ): Promise<ChatGpt3Response>;
  sendMessage(args: StreamMessageParams): void;
}

const ChatGpt3Context = createContext<ChatGpt3ContextInterface>(
  undefined as unknown as ChatGpt3ContextInterface
);

interface Props {
  accessToken: string;
  login: () => void;
  callbackRef: MutableRefObject<undefined | ((data: any) => void)>;
  errorCallbackRef: MutableRefObject<undefined | ((data: any) => void)>;
  webviewRef: MutableRefObject<undefined | any>;
}

export const ChatGpt3Provider = ({
  children,
  accessToken,
  login,
  callbackRef,
  errorCallbackRef,
  webviewRef,
}: PropsWithChildren<Props>) => {
  const contextValue = useMemo(
    () => ({
      accessToken,
      login,
      sendMessage: (
        ...args: [StreamMessageParams] | [string, SendMessageOptions?]
      ) => {
        if (typeof args[0] === 'string') {
          const message = args[0];
          const options = args[1];
          return sendMessage({
            accessToken,
            message,
            conversationId: options?.conversationId,
            messageId: options?.messageId,
          });
        }

        const { message, options, onPartialResponse, onError } = args[0];

        if (onPartialResponse) {
          callbackRef.current = onPartialResponse;
          errorCallbackRef.current = onError || (() => null);

          const runJavaScript = `
            window.sendGptMessage({
              accessToken: "${accessToken}",
              message: "${message}",
              messageId: "${options?.messageId || uuid.v4()}",
              conversationId: "${options?.conversationId || uuid.v4()}"
            });

            true;
          `;

          // Stream based response
          webviewRef.current?.injectJavaScript(runJavaScript);
          return undefined;
        }

        return;
      },
    }),
    [accessToken, callbackRef, errorCallbackRef, login, webviewRef]
  );

  return (
    // @ts-ignore
    <ChatGpt3Context.Provider value={contextValue}>
      {children}
    </ChatGpt3Context.Provider>
  );
};

export const useChatGpt3 = () => useContext(ChatGpt3Context);
