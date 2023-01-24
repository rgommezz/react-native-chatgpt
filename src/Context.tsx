import type {
  ChatGpt3Response,
  SendMessageOptions,
  StreamMessageParams,
} from './types';
import React, {
  createContext,
  PropsWithChildren,
  useContext,
  useMemo,
} from 'react';

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
  sendMessage: ChatGpt3ContextInterface['sendMessage'];
}

export const ChatGpt3Provider = ({
  accessToken,
  login,
  sendMessage,
  children,
}: PropsWithChildren<Props>) => {
  const contextValue = useMemo(
    () => ({
      accessToken,
      login,
      sendMessage,
    }),
    [accessToken, login, sendMessage]
  );

  return (
    <ChatGpt3Context.Provider value={contextValue}>
      {children}
    </ChatGpt3Context.Provider>
  );
};

export const useChatGpt3 = () => useContext(ChatGpt3Context);
