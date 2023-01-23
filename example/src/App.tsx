import * as React from 'react';
import { ChatGpt3Provider } from 'react-native-chatgpt3';
import Content from './Content';

export default function App() {
  return (
    <ChatGpt3Provider>
      <Content />
    </ChatGpt3Provider>
  );
}
