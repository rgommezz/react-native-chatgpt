import React, {
  createContext,
  PropsWithChildren,
  useContext,
  useMemo,
} from 'react';
import type {
  ChatGptResponse,
  SendMessageOptions,
  StreamMessageParams,
} from '../types';

interface ChatGptContextInterface {
  status:
    | 'initializing'
    | 'getting_auth_token'
    | 'logged-out'
    | 'authenticated';
  login: () => void;
  flush: () => void;
  sendMessage(
    message: string,
    options?: SendMessageOptions
  ): Promise<ChatGptResponse>;
  sendMessage(args: StreamMessageParams): void;
}

const ChatGptContext = createContext<ChatGptContextInterface>(
  undefined as unknown as ChatGptContextInterface
);

export const ChatGptProvider = ({
  status,
  login,
  flush,
  sendMessage,
  children,
}: PropsWithChildren<ChatGptContextInterface>) => {
  const contextValue = useMemo(
    () => ({
      status,
      login,
      sendMessage,
      flush,
    }),
    [status, login, sendMessage, flush]
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
