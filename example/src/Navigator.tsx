import * as React from 'react';
import { useChatGpt } from 'react-native-chatgpt';
import Chat from './Chat';
import Login from './Login';

const Navigator: React.FC = () => {
  const { status } = useChatGpt();

  if (status === 'loading') return null;

  if (status === 'logged-out') {
    return <Login />;
  }

  return <Chat />;
};

export default Navigator;
