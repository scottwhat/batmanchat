# ChatGPT Wrapper — System Design

Based on the Chatify stack: React + Node.js + MongoDB + JWT Auth.

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | React + Vite, Zustand, Axios, Tailwind + DaisyUI |
| Backend | Node.js + Express |
| Database | MongoDB + Mongoose |
| Auth | JWT in HTTP-only cookies (identical to Chatify) |
| Real-time streaming | Server-Sent Events (SSE) — replaces Socket.io for AI responses |
| AI | OpenAI API (or compatible, e.g. Groq, Together) |

---

## Core Features

### 1. Auth (copy directly from Chatify)
- Signup / Login / Logout
- `protectRoute` middleware on all AI endpoints
- Same JWT cookie pattern — zero changes needed

### 2. Conversation Management
Unlike Chatify (1-to-1 messages), you need **conversations** (threads):
```
User → has many Conversations
Conversation → has many Messages (role: "user" | "assistant" | "system")
```
Each conversation maintains its own history sent to OpenAI on every request.

### 3. AI Chat (the core difference from Chatify)
- User sends a message → backend appends it to the conversation history → sends full history to OpenAI → streams response back → saves assistant reply to DB

### 4. Streaming Responses
Instead of Socket.io, use **SSE (Server-Sent Events)**:
- Backend opens a persistent HTTP response and flushes OpenAI stream chunks to the frontend in real time
- Frontend reads the stream and appends tokens to the UI as they arrive
- Much simpler than Socket.io for this use case — no bidirectional communication needed


### 5. System Prompt / Persona
- Each conversation (or user account) can have a configurable system prompt
- Stored in the Conversation document, prepended to every OpenAI request

### 6. Model Selection
- Let users pick model per conversation: `gpt-4o`, `gpt-4o-mini`, `gpt-3.5-turbo`, etc.
- Stored on the Conversation document

---

## Scott thoughts mapping out core features
# users 
# main data transaction is from front end to chatgpt + received the responses 
## Data Models

```js
// User — same as Chatify, no changes
User { email, fullName, password, profilePic }

// Conversation (new)
Conversation {
  userId: ObjectId,           // owner
  title: String,              // auto-generated from first message
  model: String,              // "gpt-4o-mini" default
  systemPrompt: String,       // optional persona
  createdAt, updatedAt
}

// Message (new — replaces Chatify's Message)
Message {
  conversationId: ObjectId,
  role: "user" | "assistant" | "system",
  content: String,
  tokens: Number,             // for usage tracking (optional)
  createdAt
}
```

---

## API Endpoints

```
// Auth — identical to Chatify
POST   /api/auth/signup
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/check

// Conversations
GET    /api/conversations              → list all user's conversations
POST   /api/conversations              → create new conversation
DELETE /api/conversations/:id          → delete conversation
PATCH  /api/conversations/:id          → update title/model/systemPrompt

// Messages
GET    /api/conversations/:id/messages → fetch history
POST   /api/conversations/:id/chat     → send message + stream AI response (SSE)
```

---

## Streaming Flow

```
Frontend                         Backend                        OpenAI
   |                                |                              |
   | POST /api/conversations/:id/chat                             |
   |──────── { message: "..." } ──>|                              |
   |                                | 1. Save user message to DB  |
   |                                | 2. Fetch conversation history|
   |                                | 3. Call openai.chat.stream() |
   |                                |─────────────────────────────>|
   |                                |<── chunk ── chunk ── chunk ──|
   |<── SSE: data: {"token":"Hi"} ──|                              |
   |<── SSE: data: {"token":" how"}─|                              |
   |<── SSE: data: [DONE] ──────────|                              |
   |                                | 4. Save full assistant reply |
```

### Backend SSE Handler

```js
res.setHeader('Content-Type', 'text/event-stream')
res.setHeader('Cache-Control', 'no-cache')

const stream = await openai.chat.completions.create({ stream: true, ... })

for await (const chunk of stream) {
  const token = chunk.choices[0]?.delta?.content || ''
  res.write(`data: ${JSON.stringify({ token })}\n\n`)
}

res.write('data: [DONE]\n\n')
res.end()
// then save full response to DB
```

### Frontend Stream Reader (Zustand action)

```js
const response = await fetch('/api/conversations/:id/chat', { method: 'POST', ... })
const reader = response.body.getReader()
// decode chunks and append tokens to message in state
```

---

## Frontend Structure

```
src/
├── pages/
│   ├── LoginPage.jsx
│   ├── SignupPage.jsx
│   └── ChatPage.jsx                ← main layout
├── components/
│   ├── Sidebar.jsx                 ← conversation list + new chat button
│   ├── ChatWindow.jsx              ← message history + input box
│   ├── MessageBubble.jsx           ← renders markdown (use react-markdown)
│   ├── ConversationSettings.jsx    ← model picker, system prompt
│   └── StreamingMessage.jsx        ← shows token-by-token output
├── store/
│   ├── useAuthStore.js             ← copy from Chatify
│   └── useChatStore.js             ← conversations + streaming state
└── lib/
    └── axios.js                    ← copy from Chatify
```

---

## Key Additional Dependencies

```bash
# Backend
openai                  # official SDK (handles streaming)
express-rate-limit      # or keep Arcjet like Chatify

# Frontend
react-markdown          # render markdown in AI responses
highlight.js            # syntax highlighting in code blocks
```

---

## Build Steps (in order)

1. **Scaffold** — copy the Chatify project structure, strip out the chat-specific models/routes/components
2. **Auth** — paste auth controller, middleware, and routes verbatim; test signup/login/logout
3. **DB models** — create `Conversation` and `Message` models
4. **Conversations CRUD** — build REST endpoints to create/list/delete conversations
5. **OpenAI integration** — connect the OpenAI SDK, build the `/chat` endpoint with SSE streaming
6. **Frontend: sidebar** — list conversations, create/delete, select active one
7. **Frontend: chat window** — fetch history, render messages with `react-markdown`
8. **Frontend: streaming** — wire up the `ReadableStream` reader in Zustand, show live token output
9. **Settings panel** — model selector and system prompt editor per conversation
10. **Polish** — auto-title conversations from first message (call OpenAI to summarize), loading states, error handling

---

## Main Considerations

| Concern | Decision |
|---|---|
| API key security | Store `OPENAI_API_KEY` server-side only, never expose to frontend |
| Cost control | Add per-user rate limiting (Arcjet or `express-rate-limit`) |
| Context window | Truncate old messages or summarize when history gets long |
| Markdown rendering | AI responses are markdown — use `react-markdown` + `highlight.js` |
| Token usage | Log tokens per message for usage dashboards later |
| Error handling | Stream can fail mid-response — handle partial messages gracefully |
| CORS | Same config as Chatify — `withCredentials: true` on Axios |
