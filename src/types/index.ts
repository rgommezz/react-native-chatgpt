export interface ChatGptResponse {
  message: string;
  messageId: string;
  conversationId: string;
  isDone?: boolean;
}

export class ChatGptError extends Error {
  statusCode?: number;
  originalError?: Error;
}

export interface StreamMessageParams {
  message: string;
  onAccumulatedResponse: (arg: ChatGptResponse) => void;
  options?: SendMessageOptions;
  onError?: (arg: ChatGptError) => void;
}

export type SendMessageOptions = {
  conversationId?: string;
  messageId?: string;
};

export interface SendMessageParams extends SendMessageOptions {
  message: string;
  accessToken: string;
  timeout?: number;
  onTokenExpired?: () => void;
}

export type WebViewEvents =
  | {
      type: 'REQUEST_INTERCEPTED_CONFIG';
      payload: RequestInit;
    }
  | {
      type: 'RAW_ACCUMULATED_RESPONSE';
      payload: string;
    }
  | {
      type: 'STREAM_ERROR';
      payload: {
        status: number;
        statusText: string;
      };
    }
  | { type: 'CHAT_GPT_FULL_CAPACITY'; payload: null };
