import * as React from 'react';
import { ChatGptProvider } from 'react-native-chatgpt';
import Content from './Content';

export default function App() {
  return (
    <ChatGptProvider>
      <Content />
    </ChatGptProvider>
  );
}
