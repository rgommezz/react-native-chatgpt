import React, {
  createContext,
  ReactNode,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import {
  CHAT_PAGE,
  ChatGpt3Response,
  HOST_URL,
  LOGIN_PAGE,
  parseStreamBasedResponse,
  PROMPT_ENDPOINT,
  sendMessage,
  USER_AGENT,
} from './utils';
import uuid from 'react-native-uuid';

type WebViewEvents =
  | {
      type: 'REQUEST_INTERCEPTED_CONFIG';
      payload: RequestInit;
    }
  | {
      type: 'RAW_PARTIAL_RESPONSE';
      payload: string;
    };

type MessageOptions = {
  conversationId?: string;
  messageId?: string;
};

interface PartialResponseArgs {
  message: string;
  options?: MessageOptions;
  onPartialResponse?: (arg: ChatGpt3Response) => void;
}

interface ChatGpt3ContextInterface {
  accessToken: string;
  login: () => void;
  sendMessage(
    message: string,
    options?: MessageOptions
  ): Promise<ChatGpt3Response>;
  sendMessage(args: PartialResponseArgs): void;
}

const ChatGpt3Context = createContext<ChatGpt3ContextInterface>(
  undefined as unknown as ChatGpt3ContextInterface
);

export const useChatGpt3 = () => useContext(ChatGpt3Context);

export default function ChatGpt3({
  children,
}: {
  children?: ReactNode | undefined;
}) {
  const webviewRef = useRef<WebView>(null);
  const [accessToken, setAccessToken] = useState('');
  const [webViewVisible, setWebViewVisible] = useState(false);
  const callbackRef = useRef<(arg: ChatGpt3Response) => void>(() => null);

  const login = () => {
    setWebViewVisible(true);
    setAccessToken('');
  };

  const contextValue = useMemo(
    () => ({
      accessToken,
      login,
      sendMessage: (
        ...args: [PartialResponseArgs] | [string, MessageOptions?]
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

        const { message, options, onPartialResponse } = args[0];

        if (onPartialResponse) {
          callbackRef.current = onPartialResponse;

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
    [accessToken]
  );

  // useDerivedValue(() => {
  //   animatedValue.value = withTiming(webViewVisibility === 'visible' ? 1 : 0, {
  //     duration: 1000,
  //   });
  // }, [webViewVisibility]);
  //
  // const webViewAnimatedStyle = useAnimatedStyle(() => {
  //   const translateY = interpolate(animatedValue.value, [0, 1], [150, 0]);
  //   const opacity = interpolate(animatedValue.value, [0, 0.2, 1], [0, 0, 1]);
  //   const scale = interpolate(animatedValue.value, [0, 0.2, 1], [0, 1, 1]);
  //   return {
  //     opacity,
  //     transform: [{ translateY }, { scale }],
  //   };
  // });

  // Intercept fetch requests to extract the access token
  const runFirst = `
    const { fetch: originalFetch } = window;
    window.fetch = async (...args) => {
      const [resource, config] = args;
      window.ReactNativeWebView.postMessage(JSON.stringify({type: 'REQUEST_INTERCEPTED_CONFIG', payload: config}));
      const response = await originalFetch(resource, config);
      return response;
    };

    window.sendGptMessage = async ({
      accessToken,
      message,
      messageId,
      conversationId
    }) => {

      async function* streamAsyncIterable(stream) {
        const reader = stream.getReader()
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) {
              return
            }
            yield value
          }
        } finally {
          reader.releaseLock()
        }
      }

      function getHeaders(accessToken) {
        return {
          accept: "text/event-stream",
          "x-openai-assistant-app-id": "",
          authorization: accessToken,
          "content-type": "application/json",
          origin: "${HOST_URL}",
          referrer: "${CHAT_PAGE}",
          "sec-fetch-mode": "cors",
          "sec-fetch-site": "same-origin",
          "x-requested-with": "com.chatgpt3auth"
        };
      }

      const url = "${PROMPT_ENDPOINT}";
      const body = {
        action: "next",
        messages: [
          {
            id: conversationId,
            role: "user",
            content: {
              content_type: "text",
              parts: [message],
            },
          },
        ],
        model: "text-davinci-002-render",
        parent_message_id: messageId,
      };

      const headers = getHeaders(accessToken);

      try {
        const res = await fetch(url, {
          method: "POST",
          body: JSON.stringify(body),
          headers: headers,
          mode: "cors",
          credentials: "include"
        });



        for await (const chunk of streamAsyncIterable(res.body)) {
          const str = new TextDecoder().decode(chunk);
          window.ReactNativeWebView.postMessage(JSON.stringify({type: 'RAW_PARTIAL_RESPONSE', payload: str}));
        }
      } catch (e) {
        console.log("error", e);
      }
    };

    true;
  `;

  return (
    <View style={{ flex: 1 }}>
      {/* @ts-ignore */}
      <ChatGpt3Context.Provider value={contextValue}>
        <View
          style={[
            styles.container,
            {
              transform: [
                {
                  scale: webViewVisible ? 1 : 0,
                },
              ],
            },
          ]}
        >
          <WebView
            injectedJavaScriptBeforeContentLoaded={runFirst}
            ref={webviewRef}
            style={{ flex: 1, backgroundColor: 'white' }}
            source={{ uri: webViewVisible ? LOGIN_PAGE : CHAT_PAGE }}
            onNavigationStateChange={(event) => {
              if (event.url === CHAT_PAGE && event.loading) {
                // We have successfully logged in, or we were already logged in.
                // We can hide the webview now.
                setWebViewVisible(false);
              }
            }}
            userAgent={USER_AGENT}
            sharedCookiesEnabled
            onMessage={(event) => {
              try {
                const { payload, type } = JSON.parse(
                  event.nativeEvent.data
                ) as WebViewEvents;
                if (type === 'REQUEST_INTERCEPTED_CONFIG') {
                  if (accessToken) {
                    // We already have the access token, no need to do anything
                    return;
                  }
                  if (Object.keys(payload)) {
                    // We have headers
                    const { headers } = payload;
                    if (headers && 'Authorization' in headers) {
                      const authToken = headers?.Authorization;
                      setAccessToken(authToken as string);
                    }
                  }
                }
                if (type === 'RAW_PARTIAL_RESPONSE') {
                  const result = parseStreamBasedResponse(payload);
                  if (result) {
                    callbackRef.current?.(result);
                  }
                }
              } catch (e) {
                console.log('error', e);
              }
            }}
          />
        </View>
        {children}
      </ChatGpt3Context.Provider>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    // // Needed for Android to be on top of everything else
    elevation: 10000,
    zIndex: 100,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flex: 1,
    backgroundColor: '#fff',
  },
});
