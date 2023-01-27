import * as React from 'react';
import { useChatGpt } from 'react-native-chatgpt';
import Content from './Content';
import Login from './Login';

const Navigator: React.FC = () => {
  const { status } = useChatGpt();

  if (status === 'loading') return null;

  if (status === 'logged-out') {
    return <Login />;
  }

  return <Content />;
};

export default Navigator;
