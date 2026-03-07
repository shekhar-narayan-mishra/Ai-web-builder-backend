# AI Web Builder - Backend

The core API service for the AI Web Builder platform, responsible for orchestrating AI interactions and managing project templates.

## Features

- **Groq AI Integration**: Leverages Groq SDK for lightning-fast AI text generation and processing.
- **RESTful API**: Clean and efficient API endpoints for communication with the frontend.
- **Project Bootstrapping**: Automated generation of initial project structures and constants.
- **CORS Enabled**: Configured for secure cross-origin resource sharing with the frontend.
- **TypeScript Core**: Built with TypeScript for enhanced type safety and maintainability.

## Tech Stack

- **Runtime**: [Node.js](https://nodejs.org/)
- **Framework**: [Express.js](https://expressjs.com/)
- **AI SDK**: [Groq SDK](https://github.com/groq/groq-sdk-nodejs)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Environment Management**: [dotenv](https://github.com/motdotla/dotenv)
- **Development Tools**: nodemon, ts-node

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Groq API Key

### Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/shekhar-narayan-mishra/Ai-web-builder-backend.git
    cd Ai-web-builder-backend
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

3.  Environment Configuration:
    Create a `.env` file in the root directory and add your Groq API key:
    ```env
    GROQ_API_KEY=your_api_key_here
    PORT=3000
    ```

4.  Start the development server:
    ```bash
    npm run dev
    ```

5.  The server will be running at `http://localhost:3000`.

## Project Structure

```text
src/
├── defaults/       # Initial project templates and configurations
├── constants.ts    # Global constants and project settings
├── gemini-config.ts # AI model configurations (Gemini/Groq)
├── index.ts        # Main Express server entry point
├── prompts.ts      # System prompts for AI generation
└── stripindents.ts # Utility for cleaning up AI-generated responses
```
