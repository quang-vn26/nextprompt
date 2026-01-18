# Promptions Chat

A modern chat interface built with React, Vite, Fluent UI, and OpenAI streaming responses.

## Features

- 🎨 Beautiful UI with Microsoft Fluent UI components
- 💬 Real-time streaming responses from OpenAI
- ⚡ Fast development with Vite
- 📱 Responsive design
- ⌨️ Keyboard shortcuts (Enter to send, Shift+Enter for new line)

## Getting Started

### Prerequisites

- Node.js 18+
- Yarn (workspace package manager)
- OpenAI API key

### Installation

1. From the workspace root, install dependencies:

    ```bash
    yarn install
    ```

2. Navigate to the chat app directory:

    ```bash
    cd apps/promptions-chat
    ```

3. Copy the environment file and add your OpenAI API key:

    ```bash
    cp .env.example .env
    ```

    Edit `.env` and add your OpenAI API key:

    ```
    VITE_OPENAI_API_KEY=your_api_key_here
    ```

### Development

Start the development server:

```bash
yarn dev
```

The app will be available at `http://localhost:3003`

### Building

Build the application for production:

```bash
yarn build
```

### Type Checking

Run TypeScript type checking:

```bash
yarn typecheck
```

## Architecture

- **React 18** - Modern React with hooks
- **Vite** - Fast build tool and dev server
- **Fluent UI** - Microsoft's design system
- **OpenAI API** - GPT-3.5-turbo with streaming
- **TypeScript** - Full type safety

## Security Notes

⚠️ **Important**: This demo uses `dangerouslyAllowBrowser: true` for the OpenAI client, which exposes your API key in the browser. In a production application, you should:

1. Move OpenAI API calls to a backend server
2. Implement proper authentication
3. Use environment variables on the server side
4. Add rate limiting and other security measures

## Contributing

This is part of the promptions monorepo. Please see the main README for contribution guidelines.
