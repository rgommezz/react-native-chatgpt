import * as React from 'react';
import { useState } from 'react';
import { Button, StyleSheet, Text, View } from 'react-native';
import { useChatGpt } from 'react-native-chatgpt';

const Content = () => {
  const { login, sendMessage, status } = useChatGpt();
  const [response, setResponse] = useState('');

  const postMessage = async () => {
    setResponse('...');
    const gpt3Response = await sendMessage('Who is Elon Musk?');
    setResponse(gpt3Response.message);
  };

  const postStreamBasedMessage = () => {
    setResponse('...');
    sendMessage({
      message: 'Who is Jeff Bezos?',
      onAccumulatedResponse: (accumulatedResponse) => {
        setResponse(accumulatedResponse.message);
      },
      onError: (e) => {
        console.log(e.statusCode, e.message);
        setResponse('Error');
      },
    });
  };

  return (
    <View style={styles.container}>
      <Text style={{ marginBottom: 24 }}>ChatGPT3 Sandbox</Text>
      <Text numberOfLines={3} style={{ marginBottom: 24 }}>
        Status: {status}
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
    padding: 24,
    paddingTop: 64,
  },
});
