# react-native-chatgpt

[![npm](https://img.shields.io/npm/v/react-native-chatgpt?color=brightgreen)](https://www.npmjs.com/package/react-native-chatgpt)
[![npm bundle size](https://img.shields.io/bundlephobia/min/react-native-chatgpt)](https://bundlephobia.com/result?p=react-native-chatgpt)
![platforms: ios, android, web](https://img.shields.io/badge/platform-ios%2C%20android-blue)
[![license MIT](https://img.shields.io/badge/license-MIT-brightgreen)](https://github.com/rgommezz/react-native-chatgpt/blob/master/LICENSE)
[![runs with expo](https://img.shields.io/badge/Runs%20with%20Expo-4630EB.svg?style=flat-square&logo=EXPO&labelColor=f3f3f3&logoColor=000)](https://snack.expo.dev/@rgommezz/react-native-chatgpt)

 <p><i>A React Native wrapper around <a href="https://openai.com/blog/chatgpt">ChatGPT</a> by <a href="https://openai.com">OpenAI</a> to seamlessly integrate it with your applications. <b>It handles authentication, streamed responses, and keeping track of conversations.</b> Fully serverless.</i></p>

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

- **:fire: Serverless**: you can easily integrate a powerful chatbot into your app without the need for a custom backend
- **:zap: Streaming support**: experience lightning-fast responses as soon as they are available, similar to the ChatGPT web playground
- **:robot: Conversational**: ChatGPT remembers what you said earlier. Keep the conversation going by sending the `conversationId` and `messageId` along with the message
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

You also need to install `react-native-webview` and `expo-secure-store`

```sh
npx expo install react-native-webview expo-secure-store
```

No additional steps are needed.

### Bare React Native apps

You also need to install `react-native-webview`, `react-native-vector-icons` and `expo-secure-store`

```sh
npm install react-native-webview react-native-vector-icons expo-secure-store
```

After the installation completes, you should also follow some additional instructions to set up the libraries:

- [react-native-webview](https://github.com/react-native-webview/react-native-webview/blob/master/docs/Getting-Started.md)
- [react-native-vector-icons](https://github.com/oblador/react-native-vector-icons#installation)
- [expo-secure-store](https://github.com/expo/expo/tree/sdk-47/packages/expo-secure-store#installation-in-bare-react-native-projects)

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

The following `ChatGptProvider` props allow you to customize the appearance of the modal that handles the authentication with ChatGPT, and timeouts for the chatbot requests.

| Name                     | Required | Type                                     | Description                                                                                                                                                                                                                             |
| ------------------------ | -------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `children`               | yes      | `React.Node`                             | Your application component tree                                                                                                                                                                                                         |
| `containerStyles`        | no       | `StyleProp<ViewStyle>`                   | Extra style applied to the webview container                                                                                                                                                                                            |
| `backdropStyles`         | no       | `StyleProp<ViewStyle>`                   | Extra style applied to the backdrop view. By default it uses a semi-transparent background color `rgba(0, 0, 0, 0.5)`                                                                                                                   |
| `renderCustomCloseIcon`  | no       | `(closeModal: () => void) => React.Node` | A custom close button renderer to be placed on top of the webview. By default, it renders a black cross (X) on the top right corner. Don't forget to **hook up the closeModal function** provided as argument with your `onPress` event |
| `requestTimeout`         | no       | `number`                                 | The maximum amount of time in ms you are willing to wait for a **normal** request before cancelling it, it defaults to 30000 ms                                                                                                         |
| `streamedRequestTimeout` | no       | `number`                                 | The maximum amount of time in ms you are willing to wait for a **streamed-based** request before cancelling it, it defaults to 15000 ms                                                                                                 |

### `useChatGpt`

The hook returns an object with the following properties:

#### `status`

```ts
status: 'initializing' | 'logged-out' | 'getting_auth_token' | 'authenticated';
```

- `initializing`: indicates the library is starting up. You shouldn't assume anything regarding the authentication state and wait until this value changes to either `logged-out` or `authenticated`.
- `logged-out` reflects you either haven't authenticated yet or that your ChatGPT access token has expired
- `getting_auth_token`: transitory state that lasts for a few seconds right after the login modal is dismissed. It reflects the fact that the library is getting a ChatGPT auth token in the background. You can use this status to render a loading indicator.
- `authenticated`: signals you are logged in. Only under this status you will be able to interact with the chat bot.

ChatGPT issues JWT tokens that expire in 7 days, so you would have to reauthenticate approximately once per week. The library will report that by changing the status from `authenticated` to `logged-out`.

#### `login`

```ts
function login(): void;
```

A function that, when executed, opens the modal and triggers the ChatGPT auth flow.

After successful completion, `status` will change from `logged-out` to `getting_auth_token` (for a few seconds) and finally to `authenticated`

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

If the server rejects the request or the timeout fires, a `ChatGptError` will be thrown.

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
        // Handle error accordingly
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

If an error occurs, the `onError` callback is called with a `ChatGptError`.

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
      onError: (e) => {
        // Handle error accordingly
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

:warning: Be aware that ChatGPT backend implements rate limiting. That means if you send too many messages in a row, you may get errors with a 429 status code.

## Contributing

See the [contributing guide](CONTRIBUTING.md) to learn how to contribute to the repository and the development workflow.

## Credits

- The unofficial [node.js client](https://github.com/transitive-bullshit/chatgpt-api), which served as inspiration.
- [OpenAI](https://openai.com) for creating [ChatGPT](https://openai.com/blog/chatgpt/) 🔥

## License

MIT © [Raul Gomez Acuna](https://raulgomez.io/)

If you found this project interesting, please consider following me on [twitter](https://twitter.com/rgommezz)
