export interface ChatGpt3Response {
  message: string;
  messageId: string;
  conversationId: string;
  isDone?: boolean;
}

export class ChatGPTError extends Error {
  statusCode?: number;
  originalError?: Error;
}

export interface StreamMessageParams {
  message: string;
  options?: SendMessageOptions;
  onPartialResponse?: (arg: ChatGpt3Response) => void;
  onError?: (arg: ChatGPTError) => void;
}

export type SendMessageOptions = {
  conversationId?: string;
  messageId?: string;
};

export interface SendMessageParams extends SendMessageOptions {
  message: string;
  accessToken: string;
}

export type WebViewEvents =
  | {
      type: 'REQUEST_INTERCEPTED_CONFIG';
      payload: RequestInit;
    }
  | {
      type: 'RAW_PARTIAL_RESPONSE';
      payload: string;
    }
  | {
      type: 'STREAM_ERROR';
      payload: {
        status: number;
        statusText: string;
      };
    }
  | { type: 'GPT3_FULL_CAPACITY'; payload: null };
