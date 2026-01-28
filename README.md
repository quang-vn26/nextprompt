# Promptions Chat

Ứng dụng chat AI hiện đại được xây dựng với React, Vite, Fluent UI và hỗ trợ đa AI providers với streaming responses.

## 🎯 Tổng Quan

Promptions Chat là một giao diện chat thông minh tích hợp nhiều mô hình AI với cơ chế fallback tự động:

```
Phi-4 (Azure AI) → OpenAI (GPT-4.1-mini) → Gemini (gemini-2.5-flash)
```

## ✨ Tính Năng

- 🎨 **UI hiện đại** với Microsoft Fluent UI và dark theme
- 💬 **Streaming responses** - Phản hồi theo thời gian thực
- 🔄 **Multi-provider fallback** - Tự động chuyển đổi khi API lỗi
- ⚡ **Vite** - Build nhanh và hot module replacement
- 📱 **Responsive** - Tương thích mọi kích thước màn hình
- ⌨️ **Keyboard shortcuts** - Enter gửi tin, Shift+Enter xuống dòng
- 🎛️ **Options Panel** - Tùy chỉnh các tham số prompt

## 📁 Cấu Trúc Dự Án

```
promptions-chat/
├── src/                      # Frontend source code
│   ├── App.tsx               # Component chính, quản lý state và UI
│   ├── components/           # React components
│   │   ├── ChatInput.tsx     # Input box để gửi tin nhắn
│   │   ├── ChatHistory.tsx   # Hiển thị lịch sử chat
│   │   ├── ChatOptionsPanel.tsx  # Panel tùy chỉnh options
│   │   ├── AssistantMessage.tsx  # Render tin nhắn AI
│   │   ├── UserMessage.tsx   # Render tin nhắn người dùng
│   │   └── MarkdownRenderer.tsx  # Render markdown với syntax highlighting
│   ├── services/             # Business logic
│   │   ├── ChatService.ts    # Xử lý gọi AI APIs với fallback
│   │   └── PromptionsService.ts  # Xử lý prompt options/templates
│   ├── lib/                  # Utilities và shared code
│   └── types.ts              # TypeScript type definitions
├── api/                      # Vercel serverless functions
│   ├── chat/route.ts         # API endpoint cho chat
│   └── lib/                  # Shared backend utilities
│       ├── ai-provider.ts    # Abstract AI provider
│       ├── mongodb.ts        # MongoDB connection
│       └── types.ts          # Backend types
├── index.html                # Entry point HTML
├── vite.config.ts            # Vite configuration
├── vercel.json               # Vercel deployment config
└── package.json              # Dependencies và scripts
```

## 🏗️ Kiến Trúc

### Frontend (`src/`)

| File | Mô tả |
|------|-------|
| `App.tsx` | Component root, quản lý chat history, options state và auto-scroll |
| `ChatService.ts` | Class xử lý streaming chat với retry logic và provider fallback |
| `PromptionsService.ts` | Tạo và quản lý dynamic prompt options |

### Backend (`api/`)

| File | Mô tả |
|------|-------|
| `chat/route.ts` | Vercel serverless endpoint, xử lý POST requests và streaming |
| `ai-provider.ts` | Factory pattern cho AI providers (Azure OpenAI, Phi-4) |
| `mongodb.ts` | Kết nối và thao tác với MongoDB |

### Luồng Hoạt Động

```
User Input → ChatInput → App.tsx (state update)
    ↓
ChatService.streamChat() 
    ↓
[Phi-4] --fail→ [OpenAI] --fail→ [Gemini]
    ↓
Streaming chunks → ChatHistory (render)
```

## 🚀 Cài Đặt

### Yêu Cầu

- Node.js 18+
- npm hoặc yarn
- API keys (ít nhất 1 trong 3: Phi-4/OpenAI/Gemini)

### Bước 1: Clone và cài dependencies

```bash
npm install
```

### Bước 2: Cấu hình environment

```bash
cp .env.example .env
```

Chỉnh sửa file `.env`:

```bash
# Frontend API Keys
VITE_GEMINI_API_KEY=your-gemini-key
VITE_OPENAI_API_KEY=your-openai-key
VITE_PHI4_ENDPOINT=https://your-resource.services.ai.azure.com/openai/v1/
VITE_PHI4_API_KEY=your-phi4-key

# Backend (Vercel serverless)
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
AZURE_OPENAI_API_KEY=your-azure-key
MONGODB_URI=mongodb+srv://...
```

### Bước 3: Chạy development server

```bash
npm run dev
```

Ứng dụng sẽ chạy tại `http://localhost:3003`

## 📜 Scripts

| Script | Mô tả |
|--------|-------|
| `npm run dev` | Khởi chạy dev server (port 3003) |
| `npm run build` | Build production bundle |
| `npm run preview` | Preview production build |
| `npm run typecheck` | Kiểm tra TypeScript types |
| `npm run clean` | Xóa thư mục dist |

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| **UI Framework** | React 18 |
| **Build Tool** | Vite 7 |
| **Design System** | Microsoft Fluent UI |
| **Markdown** | react-markdown + rehype-highlight |
| **AI Clients** | @google/generative-ai, openai SDK |
| **State Management** | Immer |
| **Validation** | Zod |
| **Database** | MongoDB |
| **Deployment** | Vercel |

## ⚠️ Lưu Ý Bảo Mật

> **Quan trọng**: Phiên bản demo sử dụng `dangerouslyAllowBrowser: true` cho OpenAI client, API key sẽ hiển thị trong browser. Với production:

1. Di chuyển API calls sang backend (đã có trong `/api`)
2. Sử dụng environment variables phía server
3. Implement authentication và rate limiting

## 📄 License

MIT License

