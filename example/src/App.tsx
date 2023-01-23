import * as React from 'react';
import ChatGpt3 from 'react-native-chatgpt3';
import Content from './Content';

export default function App() {
  return (
    <ChatGpt3>
      <Content />
    </ChatGpt3>
  );
}
