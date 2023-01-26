# react-native-chatgpt

[![npm](https://img.shields.io/npm/v/react-native-chatgpt?color=brightgreen)](https://www.npmjs.com/package/react-native-chatgpt)
[![npm bundle size](https://img.shields.io/bundlephobia/min/react-native-chatgpt)](https://bundlephobia.com/result?p=react-native-chatgpt)
![platforms: ios, android, web](https://img.shields.io/badge/platform-ios%2C%20android-blue)
[![license MIT](https://img.shields.io/badge/license-MIT-brightgreen)](https://github.com/rgommezz/react-native-chatgpt/blob/master/LICENSE)
[![runs with expo](https://img.shields.io/badge/Runs%20with%20Expo-4630EB.svg?style=flat-square&logo=EXPO&labelColor=f3f3f3&logoColor=000)](https://snack.expo.dev/@rgommezz/react-native-chatgpt)

 <p><i>This library allows you to access <a href="https://openai.com/blog/chatgpt">ChatGPT</a> by <a href="https://openai.com">OpenAI</a> from React Native to integrate it with your applications. <b>It handles authentication, streamed responses, and contextual conversations.</b> Fully serverless.</i></p>

- [Features](#features)
- [Disclaimer](#disclaimer)
- [Try it out](#try-it-out)
- [Installation](#installation)
- [API](#api)
  - [`ChatGptProvider`](#chatgptprovider)
  - [`useChatGpt`](#usechatgpt)
- [Contributing](#contributing)
- [Credits](#credits)
- [License](#license)


## Features

- **:fire: Serverless**: no need to use a custom backend to send messages to the chatbot
- **:zap: Streaming support**: get a response as soon as it's available, similar to the ChatGPT web playground
- **:speaking_head: Contextual**: keep track of the conversation by sending the `conversationId` and `messageId` along with the message
- **:atom_symbol: Cross platform**: works on iOS, Android and Web
- **:iphone: Expo compatible**: no need to eject to enjoy this component
- **:hammer_and_wrench: Type safe**: fully written in TS
- **:computer: Snack example**: a snack link is provided, so you can try it out in your browser

## Disclaimer

This is not an official ChatGPT library. It's an effort to make it easier to integrate ChatGPT with React Native applications. As such, please treat it as experimental and use it with caution in production :wink:.

## Try it out

🧑‍💻 Run the snack [example app](https://snack.expo.dev/@rgommezz/react-native-chatgpt) to see it in action. The source code for the example is under the [/example](/example) folder.

## Installation

```sh
npm install react-native-chatgpt
```

### Expo

You also need to install `react-native-webview`

```sh
npx expo install react-native-webview
```

No additional steps are needed.

### Bare React Native apps

You also need to install `react-native-webview` and `react-native-vector-icons`

```sh
npm install react-native-webview react-native-vector-icons
```

After the installation completes, you should also follow some additional instructions to set up `react-native-webview` and `react-native-vector-icons` properly.

- [react-native-webview](https://github.com/react-native-webview/react-native-webview/blob/master/docs/Getting-Started.md)
- [react-native-vector-icons](https://github.com/oblador/react-native-vector-icons#installation)

## API

This library exports a provider component and a hook as its main API.

### `ChatGptProvider`

The provider component should be placed **at the root of your React Native application** as shown in the example below:

```jsx
import { ChatGptProvider } from 'react-native-chatgpt';
import App from './App';

const Root = () => {
  return (
    <ChatGptProvider>
      <App />
    </ChatGptProvider>
  );
};
```

#### Props

The following `ChatGptProvider` props allow you to customize the appearance of the modal that handles the authentication with ChatGPT. They are all optional.

| Name                    | Required | Type                                     | Description                                                                                                                                                                                                                          |
| ----------------------- | -------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `containerStyles`       | no       | `StyleProp<ViewStyle>`                                 | Extra style applied to the webview container                                                                                                                                                                                         |
| `backdropStyles`        | no       | `StyleProp<ViewStyle>`                                 | Extra style applied to the backdrop view. By default it uses a semi-transparent background color `rgba(0, 0, 0, 0.5)`                                                                                                               |
| `renderCustomCloseIcon` | no       | `(closeModal: () => void) => React.Node` | A custom close button renderer to be placed on top of the webview. By default, it renders a black cross (X) on the top right corner. Don't forget to **hook up the closeModal function** provided as argument with your `onPress` event |

### `useChatGpt`

The hook returns an object with the following properties:

#### `login`

```ts
function login(): void;
```

A function that, when executed, opens the modal and triggers the ChatGPT auth flow.

After completion, you will get a JWT access token. This access token has an expiration date of 7 days since it was issued.

It's important to note that this library has no control over the token expiration, and no refresh token is available.

The simplest way to proceed is to listen to `401` or `403` server errors when sending messages and call `login` again once that happens to restart the authentication flow and get a new JWT token.

#### `accessToken`

```ts
accessToken: string;
```

The ChatGPT JWT access token. It has an expiration date of 7 days since it was issued.

It will be an empty string until the login flow is completed.

There is no need to send this value along with the messages. It's handled internally by the library. It's exposed here, so you can indicate to your application code whether the authentication flow was successfully completed.

If the application is restarted, the library will restore the token automatically.

#### `sendMessage`

This is the core function of the library. It sends a message to the chatbot and returns the response. It can be used in two different ways depending on the arguments passed:

#### Standard

```ts
function sendMessage(
  message: string,
  options?: {
    conversationId?: string;
    messageId?: string;
  }
): Promise<{
  message: string;
  messageId: string;
  conversationId: string;
}>;
```

It returns a promise with the response. This is the simplest way to use it, but it will be slower to process the response as it waits for the full response to be available.

If you want to track the conversation, use the `conversationId` and `messageId` in the response object, and pass them to `sendMessage` again.

If the server rejects the request, a `ChatGptError` will be thrown. A status code of `401` or `403` indicates that the token has expired, and you must re-authenticate.

```jsx
import React from 'react';
import { Button } from 'react-native';
import { useChatGpt, ChatGptError } from 'react-native-chatgpt';

const Example = () => {
  const { sendMessage } = useChatGpt();

  const handleSendMessage = async () => {
    try {
      const { message, conversationId, messageId } = await sendMessage(
        'Outline possible topics for an SEO article'
      );

      // After the user has read the response, send another message
      const { message: followUp } = await sendMessage(
        'Elaborate on the first suggestion',
        {
          conversationId,
          messageId,
        }
      );
    } catch (error) {
      if (error instanceof ChatGptError) {
        // If you get a status code of 401 or 40
        , your token has expired and you have to call login again
        console.log(error.message, error.statusCode);
      }
    }
  };

  return <Button onPress={handleSendMessage} title="Send message" />;
};
```

#### Streaming

```ts
function sendMessage(args: {
  message: string;
  options?: {
    conversationId?: string;
    messageId?: string;
  };
  onAccumulatedResponse?: (response: {
    message: string;
    messageId: string;
    conversationId: string;
    isDone?: boolean;
  }) => void;
  onError?: (err: ChatGptError) => void;
}): void;
```

It accepts a callback function that will be constantly invoked with response updates.
This version is useful for scenarios where the response needs to be displayed as soon as it becomes available, similar to the way the ChatGPT API works on the web playground.

If you want to track the conversation, use the `conversationId` and `messageId` in the response object, and pass them to `sendMessage` again.

Check the `isDone` property in the response object to detect when the response is complete.

If an error occurs, the `onError` callback is called with a `ChatGptError`. A status code of `401` or `403` indicates that the token has expired, and you must re-authenticate.

```jsx
import React, { useState } from 'react';
import { Button } from 'react-native';
import { useChatGpt, ChatGptError } from 'react-native-chatgpt';

const StreamExample = () => {
  const { sendMessage } = useChatGpt();
  const [response, setResponse] = useState('');

  const handleSendMessage = () => {
    sendMessage({
      message: 'Outline possible topics for an SEO article',
      onAccumulatedResponse: ({ message, isDone }) => {
        setResponse(message);
        if (isDone) {
          // The response is complete, you can send another message
        }
      },
    });
  };

  return (
    <View style={{ flex: 1 }}>
      <Button onPress={handleSendMessage} title="Get streamed response" />
      <Text>{response}</Text>
    </View>
  );
};
```

## Contributing

See the [contributing guide](CONTRIBUTING.md) to learn how to contribute to the repository and the development workflow.

## Credits

- The unofficial [node.js client](https://github.com/transitive-bullshit/chatgpt-api), which served as inspiration.
- [OpenAI](https://openai.com) for creating [ChatGPT](https://openai.com/blog/chatgpt/) 🔥

## License

MIT © [Raul Gomez Acuna](https://raulgomez.io/)

If you found this project interesting, please consider following me on [twitter](https://twitter.com/rgommezz)

