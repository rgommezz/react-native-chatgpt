import * as React from 'react';
import { Button, StyleSheet, Text, View } from 'react-native';
import { useChatGpt3 } from 'react-native-chatgpt3';
import { useState } from 'react';

const Content = () => {
  const { login, sendMessage, accessToken } = useChatGpt3();
  const [response, setResponse] = useState('');

  const postMessage = async () => {
    setResponse('...');
    const gpt3Response = await sendMessage('Who is Elon Musk?');
    setResponse(gpt3Response.message);
  };

  const postStreamBasedMessage = async () => {
    setResponse('...');
    sendMessage({
      message: 'Who is Jeff Bezos?',
      onPartialResponse: (partial) => {
        setResponse(partial.message);
      },
    });
  };
  return (
    <View style={styles.container}>
      <Text style={{ marginBottom: 24 }}>ChatGPT3 Sandbox</Text>
      <Text numberOfLines={3} style={{ marginBottom: 24 }}>
        Access Token: {accessToken}
      </Text>
      <View style={{ marginBottom: 24 }}>
        <Button title={'Login'} onPress={() => login()} />
      </View>
      <View
        style={{ marginBottom: 24, flexDirection: 'row', alignItems: 'center' }}
      >
        <View style={{ marginRight: 32 }}>
          <Button
            title={'Normal Message'}
            onPress={postMessage}
            disabled={response === '...'}
          />
        </View>
        <Button
          title={'Stream message'}
          onPress={postStreamBasedMessage}
          disabled={response === '...'}
        />
      </View>
      <Text style={{ marginBottom: 24 }}>Response: {response}</Text>
    </View>
  );
};

export default Content;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  box: {
    width: 60,
    height: 60,
    marginVertical: 20,
  },
});
