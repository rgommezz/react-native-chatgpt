import type {
  ChatGptResponse,
  SendMessageOptions,
  StreamMessageParams,
} from './types';
import React, {
  createContext,
  PropsWithChildren,
  useContext,
  useMemo,
} from 'react';

interface ChatGptContextInterface {
  accessToken: string;
  login: () => void;
  sendMessage(
    message: string,
    options?: SendMessageOptions
  ): Promise<ChatGptResponse>;
  sendMessage(args: StreamMessageParams): void;
}

const ChatGptContext = createContext<ChatGptContextInterface>(
  undefined as unknown as ChatGptContextInterface
);

interface Props {
  accessToken: string;
  login: () => void;
  sendMessage: ChatGptContextInterface['sendMessage'];
}

export const ChatGptProvider = ({
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
    <ChatGptContext.Provider value={contextValue}>
      {children}
    </ChatGptContext.Provider>
  );
};

export const useChatGpt = () => {
  const context = useContext(ChatGptContext);
  if (!context) {
    throw new Error('useChatGpt must be used within a ChatGptProvider');
  }
  return context;
};
