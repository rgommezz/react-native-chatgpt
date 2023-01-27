import * as React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { GiftedChat, IMessage } from 'react-native-gifted-chat';
import { useChatGpt } from 'react-native-chatgpt';
import { Snackbar } from 'react-native-paper';

const CHAT_GPT_THUMBNAIL_URL =
  'https://styles.redditmedia.com/t5_7hqomg/styles/communityIcon_yyc98alroh5a1.jpg?width=256&s=cb48e1046acd79d1cc52b59b34ae56b0c1a9b4b8';
const CHAT_GPT_ID = 'CHAT_GPT_ID';

const createBotMessage = (text: string) => {
  return {
    _id: String(Date.now()),
    text,
    createdAt: new Date(),
    user: {
      _id: CHAT_GPT_ID,
      name: 'react-native-chatgpt',
      avatar: CHAT_GPT_THUMBNAIL_URL,
    },
  };
};

const Content = () => {
  const { sendMessage } = useChatGpt();
  const [messages, setMessages] = useState<IMessage[]>([]);
  const messageId = useRef('');
  const conversationId = useRef('');

  const [isSnackbarVisible, setSnackbarVisible] = useState(false);

  const onToggleSnackBar = () => setSnackbarVisible(!isSnackbarVisible);

  const onDismissSnackBar = () => setSnackbarVisible(false);

  useEffect(() => {
    setMessages([createBotMessage('Ask me anything')]);
  }, []);

  useEffect(() => {
    if (messages.length) {
      const lastMessage = messages[0];
      if (!lastMessage || lastMessage.user._id === CHAT_GPT_ID) return;

      setMessages((prevMessages) => [createBotMessage('...'), ...prevMessages]);
    }
  }, [messages]);

  useEffect(() => {
    const lastMessage = messages[0];
    if (
      lastMessage &&
      lastMessage.user._id === CHAT_GPT_ID &&
      lastMessage.text === '...'
    ) {
      sendMessage({
        message: messages[1]?.text as string,
        options:
          messageId.current && conversationId.current
            ? {
                messageId: messageId.current,
                conversationId: conversationId.current,
              }
            : undefined,
        onAccumulatedResponse: (accumulatedResponse) => {
          messageId.current = accumulatedResponse.messageId;
          conversationId.current = accumulatedResponse.conversationId;
          // Attach to last message
          setMessages((previousMessages) => {
            const newMessages = [...previousMessages];
            // @ts-ignore
            newMessages[0] = {
              ...previousMessages[0],
              text: accumulatedResponse.message,
            };
            return newMessages;
          });
        },
        onError: (e) => {
          console.log('error', e);
          onToggleSnackBar();
        },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  const onSend = useCallback((msgs: IMessage[] = []) => {
    setMessages((previousMessages) =>
      GiftedChat.append(previousMessages, msgs)
    );
  }, []);

  return (
    <>
      <GiftedChat
        messages={messages}
        onSend={onSend}
        user={{
          _id: 1,
        }}
      />
      <Snackbar
        visible={isSnackbarVisible}
        onDismiss={onDismissSnackBar}
        style={{ backgroundColor: 'red' }}
        duration={3000}
      >
        Sorry, an error occurred
      </Snackbar>
    </>
  );
};

export default Content;
