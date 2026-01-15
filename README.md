# NextPrompt - AI Chatbot with Gemini

A modern chatbot application featuring Gemini AI with multimodal support (text + images), dynamic prompt options (Promptions-style), and intelligent next-prompt suggestions.

## 🌟 Features

- **Multimodal Chat**: Text and image support via Gemini API
- **Dynamic Options**: Promptions-style customization (tone, length, audience, format)
- **Next-Prompt Suggestions**: AI-powered follow-up question recommendations
- **Context Memory**: Conversation summarization and context retention
- **Intent Detection**: Smart clarification and out-of-scope handling
- **Image Storage**: Google Drive integration for private image storage
- **Device-Based Authentication**: No signup required, device-bound sessions

## 🏗️ Architecture

### Tech Stack
- **Frontend**: Next.js 14, TypeScript, Tailwind CSS
- **Backend**: FastAPI (Python), SQLAlchemy
- **Database**: Neon Postgres (serverless)
- **AI**: Google Gemini API
- **Storage**: Google Drive API
- **Deployment**: Render (Free Tier)

### Project Structure
```
NextPrompts/
├── api/                 # FastAPI backend
│   ├── alembic/         # Database migrations
│   ├── services/        # Business logic (chat, options, etc.)
│   ├── models.py        # SQLAlchemy models
│   ├── database.py      # Database connection
│   └── main.py          # FastAPI app
├── web/                 # Next.js frontend
│   └── src/
│       ├── app/         # App router pages
│       └── components/  # React components
└── README.md
```

## 🚀 Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- Gemini API Key ([Get it here](https://aistudio.google.com/app/apikey))
- Neon Postgres database ([Create free account](https://neon.tech))

### Backend Setup

1. Navigate to API directory:
```bash
cd api
```

2. Create virtual environment:
```bash
python -m venv venv
venv\Scripts\activate  # Windows
# source venv/bin/activate  # Linux/Mac
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Configure environment:
```bash
cp .env.example .env
# Edit .env with your credentials
```

5. Run migrations:
```bash
alembic upgrade head
```

6. Start server:
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend Setup

1. Navigate to web directory:
```bash
cd web
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment:
```bash
cp .env.local.example .env.local
# Edit .env.local with API URL
```

4. Start dev server:
```bash
npm run dev
```

5. Open browser: http://localhost:3000

## 📊 Database Schema

### Core Tables
- `users` - Device-based user sessions
- `conversations` - Chat sessions
- `messages` - Individual messages with options and metadata
- `images` - Image references (Google Drive)
- `suggestions` - Next-prompt suggestions
- `conversation_summaries` - Context summaries
- `token_usage` - Cost tracking

## 🔐 Security & Privacy

- No PII storage
- Device-bound sessions (no account signup)
- Private image storage on Google Drive
- HTTPS only in production
- Rate limiting and input sanitization
- Environment-based secrets management

## 📈 Development Roadmap

- [x] Day 1: Infrastructure & Core Setup
- [ ] Day 2: Chat & Options Module
- [ ] Day 3: Next-Prompt Suggestions
- [ ] Day 4: Intent Guard & OOS Handling
- [ ] Day 5: Context Memory & Summarization
- [ ] Day 6: Google Drive Integration & Security
- [ ] Day 7: Deployment & Documentation

## 🛠️ API Endpoints

- `GET /health` - Health check
- `POST /auth/device` - Device authentication
- `POST /chat` - Send message (text/image)
- `POST /options` - Get dynamic options schema
- `POST /next-prompts` - Get suggestion prompts
- `POST /intent` - Intent detection & clarification
- `POST /upload-image` - Upload image to Drive
- `GET /metrics` - Usage statistics

## 📝 License

MIT License - Feel free to use for learning and personal projects.

## 🤝 Contributing

This is a learning project. Contributions and suggestions are welcome!

---

**Built with ❤️ using Gemini AI**
