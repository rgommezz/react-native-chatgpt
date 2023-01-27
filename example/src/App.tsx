import * as React from 'react';
import { Provider as PaperProvider } from 'react-native-paper';
import { ChatGptProvider } from 'react-native-chatgpt';
import Navigator from './Navigator';

export default function App() {
  return (
    <PaperProvider>
      <ChatGptProvider>
        <Navigator />
      </ChatGptProvider>
    </PaperProvider>
  );
}
