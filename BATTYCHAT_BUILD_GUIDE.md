# BattyChat — Step-by-Step Build Guide

> A Batman-universe ChatGPT wrapper. Terminal-style chat UI, JWT auth, SSE streaming, MongoDB conversation history, and a Batman RAG knowledge base injected server-side.

---

## Stack Recap

| Layer | Tech |
|---|---|
| Frontend | React + Vite, useState (no Zustand), fetch (no Axios), custom CSS |
| Backend | Node.js + Express |
| Database | MongoDB + Mongoose |
| Auth | JWT in HTTP-only cookies |
| AI Streaming | Server-Sent Events (SSE) |
| AI | OpenAI API |

---

## Project Structure (end goal)

```
battychat/
├── backend/
│   ├── src/
│   │   ├── controllers/
│   │   │   ├── auth.controller.js
│   │   │   ├── conversation.controller.js
│   │   │   └── chat.controller.js
│   │   ├── data/
│   │   │   └── batman-context.js        ← Batman RAG knowledge base
│   │   ├── lib/
│   │   │   ├── db.js
│   │   │   └── utils.js                 ← generateToken helper
│   │   ├── middleware/
│   │   │   └── auth.middleware.js
│   │   ├── models/
│   │   │   ├── User.js
│   │   │   ├── Conversation.js
│   │   │   └── Message.js
│   │   ├── routes/
│   │   │   ├── auth.route.js
│   │   │   ├── conversation.route.js
│   │   │   └── chat.route.js
│   │   └── server.js
│   ├── .env
│   └── package.json
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── Sidebar.jsx
    │   │   ├── ChatWindow.jsx
    │   │   ├── MessageBubble.jsx
    │   │   └── Navbar.jsx
    │   ├── pages/
    │   │   ├── LoginPage.jsx
    │   │   ├── SignupPage.jsx
    │   │   └── ChatPage.jsx
    │   ├── api/
    │   │   └── conversation.api.ts  ← plain fetch calls, no state
    │   ├── App.jsx
    │   └── main.jsx
    ├── .env
    └── package.json
```

---

## Section 1 — Scaffold the Project

### 1.1 Create folders and initialise

```bash
mkdir battychat && cd battychat
mkdir backend frontend
```

**Frontend — React + Vite:**

```bash
cd frontend
npm create vite@latest . -- --template react
npm install
cd ..
```

**Backend — Node.js:**

```bash
cd backend
npm init -y
```

In `backend/package.json`, add `"type": "module"` so you can use ES module `import/export` syntax:

```json
{
  "name": "battychat-backend",
  "type": "module",
  "scripts": {
    "dev": "node --watch src/server.js",
    "start": "node src/server.js"
  }
}
```

> **Why `--watch`?** It's built into Node 18+ and restarts the server on file saves without needing nodemon.

### 1.2 Install backend dependencies

```bash
cd backend
npm install express mongoose jsonwebtoken bcryptjs dotenv cookie-parser openai
```

| Package | Purpose |
|---|---|
| express | HTTP framework |
| mongoose | MongoDB ODM |
| jsonwebtoken | JWT creation + verification |
| bcryptjs | Password hashing |
| dotenv | Read `.env` file |
| cookie-parser | Parse JWT cookie from requests |
| openai | Official OpenAI SDK (handles streaming) |

### 1.3 Install frontend dependencies

```bash
cd frontend
npm install react-router-dom
```

State is managed with plain `useState` inside components. No Zustand, no Axios — use the native `fetch` API.

### 1.4 Create `.env` in `backend/`

```
PORT=3000
NODE_ENV=development
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_secret_here_make_it_long
OPENAI_API_KEY=sk-...
CLIENT_URL=http://localhost:5173
```

### 1.4b Create `.env` in `frontend/`

```
VITE_API_URL=http://localhost:3000
```

> Vite exposes any variable prefixed with `VITE_` to the browser bundle. In production, set `VITE_API_URL` to your deployed backend URL (e.g. `https://battychat-api.onrender.com`).

### 1.4c Create `.gitignore` files

**`backend/.gitignore`:**
```
node_modules/
.env
```

**`frontend/.gitignore`:**
```
node_modules/
.env
dist/
```

> Vite scaffolds a `.gitignore` in the frontend automatically, but verify `.env` is listed. The `dist/` folder is your build output — no need to commit it since your host builds it from source.

### 1.5 Create `backend/src/server.js`

This is the entry point — wires everything together.

```js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import { connectDB } from './lib/db.js';
import authRoutes from './routes/auth.route.js';
import conversationRoutes from './routes/conversation.route.js';
import chatRoutes from './routes/chat.route.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// CORS — allow requests from the deployed frontend
app.use(cors({
  origin: process.env.CLIENT_URL,
  credentials: true, // allows the JWT cookie to be sent cross-origin
}));

// Middleware
app.use(express.json());
app.use(cookieParser());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/chat', chatRoutes);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  connectDB();
});
```

> **Pattern note:** `express.json()` lets you read `req.body`. `cookieParser()` lets you read `req.cookies.jwt` — both are essential middleware, registered before routes.

---

## Section 2 — Database Connection

### 2.1 Create `backend/src/lib/db.js`

```js
import mongoose from 'mongoose';

export const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
    process.exit(1); // 1 = failure, 0 = success
  }
};
```

> **MongoDB Atlas setup:** Go to mongodb.com → create a free cluster → copy the connection string → paste it into your `.env` as `MONGODB_URI`. Add your IP (or `0.0.0.0/0` for open access) under Network Access.

---

## Section 3 — Data Models

### 3.1 User model — `backend/src/models/User.js`

Identical to the Chatify tutorial pattern:

```js
import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true },
    fullName: { type: String, required: true },
    password: { type: String, required: true, minlength: 6 },
    profilePic: { type: String, default: '' },
  },
  { timestamps: true }
);

const User = mongoose.model('User', userSchema);
export default User;
```

### 3.2 Conversation model — `backend/src/models/Conversation.js`

A conversation belongs to one user and can have a custom Batman persona prompt:

```js
import mongoose from 'mongoose';

const conversationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, default: 'New Mission' },
    model: { type: String, default: 'gpt-4o-mini' },
    // Allows overriding the default Batman persona per conversation
    systemPromptOverride: { type: String, default: '' },
  },
  { timestamps: true }
);

const Conversation = mongoose.model('Conversation', conversationSchema);
export default Conversation;
```

### 3.3 Message model — `backend/src/models/Message.js`

Each message belongs to a conversation and has a role (OpenAI standard):

```js
import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
    },
    role: {
      type: String,
      enum: ['user', 'assistant', 'system'],
      required: true,
    },
    content: { type: String, required: true },
    tokens: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const Message = mongoose.model('Message', messageSchema);
export default Message;
```

---

## Section 4 — Batman RAG Context

This is the Batman-specific feature. We keep a knowledge base of Batman universe facts and inject it into the OpenAI system prompt on every request.

### 4.1 Create `backend/src/data/batman-context.js`

```js
// Batman universe knowledge base — injected into every AI request as RAG context.
// Extend this with more characters, locations, lore, storylines etc.

export const BATMAN_UNIVERSE = {
  characters: {
    bruce_wayne: `Bruce Wayne is Batman. Billionaire, orphan, peak human athlete, detective.
      Parents Thomas and Martha Wayne were murdered by Joe Chill in Crime Alley when Bruce was 8.
      He trained for years across the world in martial arts, forensics, and criminology.
      Secret identity known to: Alfred Pennyworth, Dick Grayson, Barbara Gordon, and a few others.`,

    alfred: `Alfred Pennyworth — Bruce Wayne's butler, father figure, and confidant.
      Former British military and intelligence. Manages Wayne Manor and the Batcave.
      Dry wit, unwavering loyalty, occasional disapproval of reckless plans.`,

    joker: `The Joker — Batman's archnemesis. Agent of chaos. No confirmed real name or origin.
      Possibly former failed comedian (The Killing Joke). Obsessed with proving anyone can break.
      Has died and come back multiple times. The one villain Batman will not kill.`,

    robin_dick: `Dick Grayson — first Robin, then Nightwing. Former circus acrobat, parents killed by
      Tony Zucco. Taken in by Bruce Wayne. Went independent as Nightwing (based in Blüdhaven).
      Leader of the Teen Titans and Titans.`,

    barbara_gordon: `Barbara Gordon — daughter of Commissioner Gordon. Was Batgirl until Joker shot
      her and left her paralysed (The Killing Joke). Became Oracle, the world's greatest
      information broker and tech support for the Bat-family.`,

    catwoman: `Selina Kyle — Catwoman. Thief, antiheroine, and Bruce Wayne's love interest.
      Morally grey. Has allied with and against Batman depending on circumstances.
      Briefly engaged to Bruce Wayne.`,

    commissioner_gordon: `James Gordon — Gotham City Police Commissioner. One of the few honest
      cops in Gotham. Knows Batman's identity (implied in many storylines). Uses the Bat-Signal
      on the GCPD roof to summon Batman.`,

    two_face: `Harvey Dent — former Gotham DA. Scarred by acid thrown by gangster Sal Maroni.
      Obsessed with duality and chance. Makes decisions by flipping a two-headed coin,
      one side scarred.`,

    ra_s_al_ghul: `Ra's al Ghul — immortal eco-terrorist, leader of the League of Shadows.
      Uses Lazarus Pits to resurrect himself. Has a daughter, Talia al Ghul, with whom
      Batman has a son: Damian Wayne.`,
  },

  locations: {
    gotham: `Gotham City — fictional, corrupt, crime-ridden city. Often depicted as New York-esque.
      Architecture is gothic and dark. High crime, powerful organised crime families,
      and an endless supply of supervillains.`,

    batcave: `The Batcave — Batman's base of operations beneath Wayne Manor. Contains the Batcomputer,
      vehicles (Batmobile, Batwing, Batboat), trophy room, medical bay, training areas.
      Accessible via secret passages from the Manor.`,

    wayne_manor: `Wayne Manor — stately mansion on the outskirts of Gotham. Publicly Bruce Wayne's
      residence. Conceals the entrance to the Batcave.`,

    arkham_asylum: `Arkham Asylum — Gotham's institution for the criminally insane. Houses Batman's
      rogues gallery. Security is notoriously inadequate — villains escape constantly.`,
  },

  lore: {
    no_kill_rule: `Batman has an absolute rule: he does not kill. Even the Joker. He believes
      killing would make him no better than criminals and would start him down a path
      he couldn't return from.`,

    detective: `Batman is considered the World's Greatest Detective. He frequently out-thinks
      the Justice League and has contingency plans (stored in the "Brother Eye" satellite)
      to take down every hero if they go rogue.`,

    prep_time: `"Batman with prep time" — given sufficient preparation, Batman can defeat
      virtually anyone. He has defeated Superman, the Hulk, and numerous godlike beings
      through intellect, strategy, and gadgets.`,

    bat_family: `The Bat-Family includes: Batman (Bruce Wayne), Alfred, Robin I/Nightwing (Dick Grayson),
      Robin II/Red Hood (Jason Todd — killed by Joker, resurrected via Lazarus Pit, now antihero),
      Robin III/Red Robin (Tim Drake), Robin IV (Stephanie Brown/Spoiler),
      Robin V/Batman (Damian Wayne — Bruce's son with Talia al Ghul), Batgirl/Oracle (Barbara Gordon),
      Batwoman (Kate Kane), Batwing, Orphan (Cassandra Cain).`,
  },
};

// Builds the full system prompt injected before every OpenAI request.
export function buildBatmanSystemPrompt(overridePrompt = '') {
  if (overridePrompt) return overridePrompt;

  const contextDump = Object.entries(BATMAN_UNIVERSE)
    .map(([category, entries]) => {
      const lines = Object.entries(entries)
        .map(([key, val]) => `- ${key.replace(/_/g, ' ')}: ${val.trim()}`)
        .join('\n');
      return `### ${category.toUpperCase()}\n${lines}`;
    })
    .join('\n\n');

  return `You are Alfred Pennyworth — Batman's trusted butler and confidant.
You speak with dry wit, impeccable loyalty, and occasional gentle disapproval of reckless plans.
You address the user as "Master [name]" or simply "sir/ma'am" when their name is unknown.
You have deep knowledge of the Batman universe and bring it into your responses naturally
when relevant. You are helpful, sharp, and always composed.

When the user asks about Batman, Gotham, or the Bat-Family, draw on this knowledge:

${contextDump}

Speak in character at all times. If the question has nothing to do with Batman,
answer it helpfully but with Alfred's characteristic tone and perhaps a subtle
Batman-universe reference if appropriate.`;
}
```

> **How this works:** `buildBatmanSystemPrompt()` returns a string that gets prepended to every OpenAI call as the `system` role message. This is your RAG injection — no vector database needed at this scale. For a larger knowledge base you could chunk and embed, but for a Batman persona this in-context approach is clean and fast.

---

## Section 5 — Auth Utilities

### 5.1 JWT helper — `backend/src/lib/utils.js`

```js
import jwt from 'jsonwebtoken';

export const generateToken = (userId, res) => {
  const token = jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: '7d',
  });

  res.cookie('jwt', token, {
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
    httpOnly: true,     // prevents XSS — JS can't read this cookie
    sameSite: process.env.NODE_ENV === 'development' ? 'lax' : 'none',
    // 'none' required for cross-origin cookies (separate frontend/backend deployments)
    // 'none' requires secure: true or browsers will reject it
    secure: process.env.NODE_ENV !== 'development',
  });

  return token;
};
```

> **Why cookies instead of localStorage?** `httpOnly` cookies can't be read by JavaScript at all, making XSS attacks ineffective. `sameSite: strict` blocks CSRF. This is the recommended pattern for storing JWTs.

---

## Section 6 — Auth Controller & Routes

### 6.1 Create `backend/src/controllers/auth.controller.js`

```js
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { generateToken } from '../lib/utils.js';

export const signup = async (req, res) => {
  const { fullName, email, password } = req.body;
  try {
    if (!fullName || !email || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({ fullName, email, password: hashedPassword });
    await newUser.save();
    generateToken(newUser._id, res);

    res.status(201).json({
      _id: newUser._id,
      fullName: newUser.fullName,
      email: newUser.email,
      profilePic: newUser.profilePic,
    });
  } catch (error) {
    console.error('Error in signup controller:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    generateToken(user._id, res);

    res.status(200).json({
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      profilePic: user.profilePic,
    });
  } catch (error) {
    console.error('Error in login controller:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const logout = (req, res) => {
  try {
    res.cookie('jwt', '', { maxAge: 0 });
    res.status(200).json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Error in logout controller:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const checkAuth = (req, res) => {
  try {
    // req.user is set by protectRoute middleware
    res.status(200).json(req.user);
  } catch (error) {
    console.error('Error in checkAuth controller:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
```

### 6.2 Auth middleware — `backend/src/middleware/auth.middleware.js`

Runs before any protected route. Reads JWT from cookie, verifies it, attaches the user to `req.user`.

```js
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const protectRoute = async (req, res, next) => {
  try {
    const token = req.cookies.jwt;

    if (!token) {
      return res.status(401).json({ message: 'Unauthorized - no token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded) {
      return res.status(401).json({ message: 'Unauthorized - invalid token' });
    }

    const user = await User.findById(decoded.userId).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    req.user = user; // attach user so controllers can access it via req.user
    next();          // proceed to the actual controller
  } catch (error) {
    console.error('Error in protectRoute middleware:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
```

### 6.3 Auth routes — `backend/src/routes/auth.route.js`

```js
import express from 'express';
import { signup, login, logout, checkAuth } from '../controllers/auth.controller.js';
import { protectRoute } from '../middleware/auth.middleware.js';

const router = express.Router();

router.post('/signup', signup);
router.post('/login', login);
router.post('/logout', logout);
router.get('/check', protectRoute, checkAuth); // protectRoute runs first

export default router;
```

> **Test it:** Run `npm run dev` in the backend folder, then use a tool like Postman (or curl) to POST `http://localhost:3000/api/auth/signup` with `{ "fullName": "Bruce Wayne", "email": "bruce@wayne.com", "password": "batman123" }`. You should get a 201 and a JWT cookie.

---

## Section 7 — Conversation Controller & Routes

### 7.1 `backend/src/controllers/conversation.controller.js`

```js
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';

// GET /api/conversations — list all conversations for the logged-in user
export const getConversations = async (req, res) => {
  try {
    const conversations = await Conversation.find({ userId: req.user._id })
      .sort({ updatedAt: -1 }); // most recently active first
    res.status(200).json(conversations);
  } catch (error) {
    console.error('Error in getConversations:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// POST /api/conversations — create a new conversation
export const createConversation = async (req, res) => {
  try {
    const { title, model, systemPromptOverride } = req.body;
    const conversation = new Conversation({
      userId: req.user._id,
      title: title || 'New Mission',
      model: model || 'gpt-4o-mini',
      systemPromptOverride: systemPromptOverride || '',
    });
    await conversation.save();
    res.status(201).json(conversation);
  } catch (error) {
    console.error('Error in createConversation:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// DELETE /api/conversations/:id — delete a conversation and all its messages
export const deleteConversation = async (req, res) => {
  try {
    const conversation = await Conversation.findOne({
      _id: req.params.id,
      userId: req.user._id, // ensure user owns it
    });

    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    await Message.deleteMany({ conversationId: conversation._id });
    await conversation.deleteOne();

    res.status(200).json({ message: 'Conversation deleted' });
  } catch (error) {
    console.error('Error in deleteConversation:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// PATCH /api/conversations/:id — update title, model, or systemPromptOverride
export const updateConversation = async (req, res) => {
  try {
    const { title, model, systemPromptOverride } = req.body;
    const conversation = await Conversation.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { title, model, systemPromptOverride },
      { new: true }
    );

    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    res.status(200).json(conversation);
  } catch (error) {
    console.error('Error in updateConversation:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// GET /api/conversations/:id/messages — fetch message history for a conversation
export const getMessages = async (req, res) => {
  try {
    const conversation = await Conversation.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    const messages = await Message.find({ conversationId: conversation._id })
      .sort({ createdAt: 1 }); // oldest first for display

    res.status(200).json(messages);
  } catch (error) {
    console.error('Error in getMessages:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
```

### 7.2 Conversation routes — `backend/src/routes/conversation.route.js`

```js
import express from 'express';
import {
  getConversations,
  createConversation,
  deleteConversation,
  updateConversation,
  getMessages,
} from '../controllers/conversation.controller.js';
import { protectRoute } from '../middleware/auth.middleware.js';

const router = express.Router();

// All conversation routes require auth
router.use(protectRoute);

router.get('/', getConversations);
router.post('/', createConversation);
router.delete('/:id', deleteConversation);
router.patch('/:id', updateConversation);
router.get('/:id/messages', getMessages);

export default router;
```

---

## Section 8 — OpenAI Chat Controller (SSE Streaming)

This is the core of BattyChat. The user sends a message, we save it, fetch the full history, inject the Batman system prompt, stream back the OpenAI response token-by-token via SSE, then save the complete assistant reply.

### 8.1 `backend/src/controllers/chat.controller.js`

```js
import OpenAI from 'openai';
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import { buildBatmanSystemPrompt } from '../data/batman-context.js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// POST /api/chat/:conversationId
// Body: { message: "..." }
// Response: Server-Sent Events stream
export const streamChat = async (req, res) => {
  const { conversationId } = req.params;
  const { message } = req.body;

  if (!message?.trim()) {
    return res.status(400).json({ message: 'Message is required' });
  }

  try {
    // 1. Verify the conversation belongs to this user
    const conversation = await Conversation.findOne({
      _id: conversationId,
      userId: req.user._id,
    });

    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    // 2. Save the user's message to the database
    await Message.create({
      conversationId,
      role: 'user',
      content: message.trim(),
    });

    // 3. Fetch full conversation history (for context)
    const history = await Message.find({ conversationId })
      .sort({ createdAt: 1 })
      .select('role content');

    // 4. Build the messages array for OpenAI:
    //    [system prompt (Batman RAG)] + [all history messages]
    const systemPrompt = buildBatmanSystemPrompt(conversation.systemPromptOverride);
    const openaiMessages = [
      { role: 'system', content: systemPrompt },
      ...history.map((m) => ({ role: m.role, content: m.content })),
    ];

    // 5. Set SSE headers — opens a persistent streaming HTTP response
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    // CORS for SSE — must match CLIENT_URL since the cors() middleware
    // doesn't automatically apply to streaming responses in all setups
    res.setHeader('Access-Control-Allow-Origin', process.env.CLIENT_URL);
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    // 6. Call OpenAI with streaming enabled
    const stream = await openai.chat.completions.create({
      model: conversation.model || 'gpt-4o-mini',
      messages: openaiMessages,
      stream: true,
    });

    // 7. Stream each token to the frontend as SSE events
    let fullResponse = '';

    for await (const chunk of stream) {
      const token = chunk.choices[0]?.delta?.content || '';
      if (token) {
        fullResponse += token;
        // SSE format: "data: <json>\n\n"
        res.write(`data: ${JSON.stringify({ token })}\n\n`);
      }
    }

    // 8. Signal the end of the stream
    res.write(`data: [DONE]\n\n`);
    res.end();

    // 9. Save the complete assistant reply to the database
    await Message.create({
      conversationId,
      role: 'assistant',
      content: fullResponse,
    });

    // 10. Auto-title the conversation from the first user message
    if (conversation.title === 'New Mission') {
      // Fire-and-forget — don't await this, don't block the stream
      autoTitleConversation(conversation, message);
    }
  } catch (error) {
    console.error('Error in streamChat:', error);
    // If headers already sent (stream started), we can't send a JSON error
    if (!res.headersSent) {
      res.status(500).json({ message: 'Internal server error' });
    } else {
      res.write(`data: ${JSON.stringify({ error: 'Stream error' })}\n\n`);
      res.end();
    }
  }
};

// Auto-generate a short title from the first message using OpenAI
async function autoTitleConversation(conversation, firstMessage) {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: `Generate a short (max 5 words) mission title for a Batman-themed conversation that starts with: "${firstMessage}". Reply with ONLY the title, no punctuation.`,
        },
      ],
      max_tokens: 20,
    });

    const title = response.choices[0]?.message?.content?.trim();
    if (title) {
      await conversation.updateOne({ title });
    }
  } catch {
    // Non-critical — swallow errors silently
  }
}
```

### 8.2 Chat routes — `backend/src/routes/chat.route.js`

```js
import express from 'express';
import { streamChat } from '../controllers/chat.controller.js';
import { protectRoute } from '../middleware/auth.middleware.js';

const router = express.Router();

router.post('/:conversationId', protectRoute, streamChat);

export default router;
```

> **SSE explained:** Instead of a normal response, you set `Content-Type: text/event-stream` and keep the connection open. Each time you call `res.write('data: ...\n\n')` the browser receives a new event. The frontend's `EventSource` or `ReadableStream` API reads these in real time — you see the AI typing.

---

## Section 9 — Frontend Setup

### 9.1 Tailwind + DaisyUI config

In `frontend/tailwind.config.js`:

```js
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: { extend: {} },
  plugins: [require('daisyui')],
  daisyui: {
    themes: ['night'], // dark Batman-appropriate theme
  },
};
```

In `frontend/src/index.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

### 9.2 Axios config — `frontend/src/lib/axios.js`

```js
import axios from 'axios';

export const axiosInstance = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL}/api`,
  withCredentials: true, // CRITICAL: sends the JWT cookie with every request
});
```

> **`VITE_API_URL`** is the only env variable the frontend needs. It points to the backend regardless of environment — in dev it's `http://localhost:3000`, in production it's your deployed backend URL. Vite injects it at build time via `import.meta.env`.
>
> **Why `withCredentials: true`?** Without this, the browser won't attach cookies to cross-origin requests. The JWT cookie won't be sent and every request will be "unauthorized".

---

## Section 10 — Frontend State Management

No Zustand. State lives in `ChatContainer.tsx` using plain `useState`. API calls are plain `fetch` in `src/api/conversation.api.ts`.

### 10.1 API layer — `frontend/src/api/conversation.api.ts`

Pure functions, no React, no state — just fetch calls:

```ts
const BASE = 'http://localhost:3000/api';

export const getConversations = async () => {
  const res = await fetch(`${BASE}/conversations`, { credentials: 'include' });
  return res.json();
};

export const createConversation = async () => {
  const res = await fetch(`${BASE}/conversations`, {
    method: 'POST',
    credentials: 'include',
  });
  return res.json();
};

export const getMessages = async (conversationId: string) => {
  const res = await fetch(`${BASE}/conversations/${conversationId}/messages`, {
    credentials: 'include',
  });
  return res.json();
};

export const deleteConversation = async (conversationId: string) => {
  await fetch(`${BASE}/conversations/${conversationId}`, {
    method: 'DELETE',
    credentials: 'include',
  });
};
```

### 10.2 ChatContainer.tsx — owns all chat state

```tsx
import { useState, useEffect } from 'react';
import { getConversations, createConversation, getMessages, deleteConversation } from '../api/conversation.api';
import ChatSideBar from './ChatSideBar';
import Chatoutput from './Chatoutput';
import Chatinput from './Chatinput';

const ChatContainer = () => {
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isStreaming, setIsStreaming] = useState(false);

  useEffect(() => {
    getConversations().then(setConversations);
  }, []);

  const handleSelectConversation = async (conv) => {
    setActiveConversation(conv);
    const msgs = await getMessages(conv._id);
    setMessages(msgs);
  };

  const handleNewConversation = async () => {
    const conv = await createConversation();
    setConversations(prev => [conv, ...prev]);
    setActiveConversation(conv);
    setMessages([]);
  };

  const handleSend = async (text) => {
    // add user message optimistically, call backend, stream response
  };

  return (
    <div className="container">
      <div className="left-container">
        <ChatSideBar
          conversations={conversations}
          activeConversation={activeConversation}
          onSelect={handleSelectConversation}
          onNew={handleNewConversation}
        />
      </div>
      <div className="right-container">
        <Chatoutput messages={messages} isStreaming={isStreaming} />
        <Chatinput onSend={handleSend} disabled={isStreaming} />
      </div>
    </div>
  );
};

export default ChatContainer;
```

---

## Section 11 — Frontend Pages & Components

### 11.1 App.jsx — routing and auth guard

```jsx
import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/useAuthStore';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import ChatPage from './pages/ChatPage';

export default function App() {
  const { authUser, isCheckingAuth, checkAuth } = useAuthStore();

  useEffect(() => {
    checkAuth(); // runs on mount — checks if the JWT cookie is valid
  }, [checkAuth]);

  if (isCheckingAuth) {
    return (
      <div className="flex items-center justify-center h-screen bg-base-300">
        <span className="loading loading-spinner loading-lg text-warning" />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={authUser ? <ChatPage /> : <Navigate to="/login" />} />
      <Route path="/login" element={!authUser ? <LoginPage /> : <Navigate to="/" />} />
      <Route path="/signup" element={!authUser ? <SignupPage /> : <Navigate to="/" />} />
    </Routes>
  );
}
```

In `frontend/src/main.jsx`:

```jsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import './index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);
```

Don't forget: `npm install react-router-dom` in the frontend.

### 11.2 SignupPage.jsx

```jsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';

export default function SignupPage() {
  const [formData, setFormData] = useState({ fullName: '', email: '', password: '' });
  const [error, setError] = useState('');
  const { signup } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await signup(formData);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Signup failed');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-base-300">
      <div className="card w-96 bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title text-warning text-2xl justify-center mb-4">
            🦇 BattyChat
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="text"
              placeholder="Full Name"
              className="input input-bordered w-full"
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
            />
            <input
              type="email"
              placeholder="Email"
              className="input input-bordered w-full"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
            <input
              type="password"
              placeholder="Password (min 6 chars)"
              className="input input-bordered w-full"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            />
            {error && <p className="text-error text-sm">{error}</p>}
            <button type="submit" className="btn btn-warning w-full">
              Create Account
            </button>
          </form>
          <p className="text-center text-sm mt-2">
            Already have an account?{' '}
            <Link to="/login" className="link link-warning">
              Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
```

### 11.3 LoginPage.jsx

Same structure as SignupPage — just different fields and calls `login`:

```jsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';

export default function LoginPage() {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const { login } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await login(formData);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-base-300">
      <div className="card w-96 bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title text-warning text-2xl justify-center mb-4">
            🦇 BattyChat
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="email"
              placeholder="Email"
              className="input input-bordered w-full"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
            <input
              type="password"
              placeholder="Password"
              className="input input-bordered w-full"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            />
            {error && <p className="text-error text-sm">{error}</p>}
            <button type="submit" className="btn btn-warning w-full">
              Enter the Cave
            </button>
          </form>
          <p className="text-center text-sm mt-2">
            No account?{' '}
            <Link to="/signup" className="link link-warning">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
```

### 11.4 ChatPage.jsx — main layout

```jsx
import Sidebar from '../components/Sidebar';
import ChatWindow from '../components/ChatWindow';
import Navbar from '../components/Navbar';

export default function ChatPage() {
  return (
    <div className="flex flex-col h-screen bg-base-300">
      <Navbar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <ChatWindow />
      </div>
    </div>
  );
}
```

### 11.5 Navbar.jsx

```jsx
import { useAuthStore } from '../store/useAuthStore';

export default function Navbar() {
  const { authUser, logout } = useAuthStore();

  return (
    <nav className="navbar bg-base-100 border-b border-base-300 px-4">
      <div className="flex-1">
        <span className="text-xl font-bold text-warning">🦇 BattyChat</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm text-base-content/60">{authUser?.fullName}</span>
        <button onClick={logout} className="btn btn-ghost btn-sm">
          Logout
        </button>
      </div>
    </nav>
  );
}
```

### 11.6 Sidebar.jsx — conversation list

```jsx
import { useEffect } from 'react';
import { useChatStore } from '../store/useChatStore';

export default function Sidebar() {
  const {
    conversations,
    activeConversation,
    fetchConversations,
    createConversation,
    selectConversation,
    deleteConversation,
  } = useChatStore();

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  return (
    <div className="w-64 bg-base-100 border-r border-base-300 flex flex-col">
      <div className="p-3 border-b border-base-300">
        <button onClick={createConversation} className="btn btn-warning btn-sm w-full">
          + New Mission
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 && (
          <p className="text-center text-base-content/40 text-sm mt-8 px-4">
            No missions yet. Start one above.
          </p>
        )}

        {conversations.map((conv) => (
          <div
            key={conv._id}
            onClick={() => selectConversation(conv)}
            className={`group flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-base-200 transition-colors ${
              activeConversation?._id === conv._id ? 'bg-base-200 border-l-2 border-warning' : ''
            }`}
          >
            <span className="text-sm truncate flex-1">{conv.title}</span>
            <button
              onClick={(e) => {
                e.stopPropagation(); // don't trigger selectConversation
                deleteConversation(conv._id);
              }}
              className="btn btn-ghost btn-xs opacity-0 group-hover:opacity-100 text-error"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### 11.7 MessageBubble.jsx — renders markdown

```jsx
import ReactMarkdown from 'react-markdown';

export default function MessageBubble({ message }) {
  const isUser = message.role === 'user';

  return (
    <div className={`chat ${isUser ? 'chat-end' : 'chat-start'}`}>
      <div className="chat-image avatar placeholder">
        <div className="bg-base-300 rounded-full w-8">
          <span className="text-xs">{isUser ? '👤' : '🦇'}</span>
        </div>
      </div>

      <div
        className={`chat-bubble max-w-prose ${
          isUser
            ? 'chat-bubble-warning text-warning-content'
            : 'chat-bubble-neutral prose prose-sm prose-invert'
        }`}
      >
        {isUser ? (
          message.content
        ) : (
          <ReactMarkdown>{message.content}</ReactMarkdown>
        )}
      </div>
    </div>
  );
}
```

### 11.8 ChatWindow.jsx — message list + input + streaming indicator

```jsx
import { useState, useRef, useEffect } from 'react';
import { useChatStore } from '../store/useChatStore';
import MessageBubble from './MessageBubble';
import ReactMarkdown from 'react-markdown';

export default function ChatWindow() {
  const { activeConversation, messages, isStreaming, streamingContent, sendMessage } =
    useChatStore();
  const [input, setInput] = useState('');
  const bottomRef = useRef(null);

  // Auto-scroll to bottom whenever messages or streaming content changes
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  const handleSend = async () => {
    if (!input.trim() || isStreaming) return;
    const text = input;
    setInput('');
    await sendMessage(text);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!activeConversation) {
    return (
      <div className="flex-1 flex items-center justify-center bg-base-300">
        <div className="text-center text-base-content/40">
          <p className="text-4xl mb-3">🦇</p>
          <p className="text-lg">Select a mission or start a new one</p>
          <p className="text-sm mt-1">Alfred is standing by</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-base-300">
      {/* Header */}
      <div className="px-4 py-2 bg-base-100 border-b border-base-300">
        <h2 className="font-semibold text-warning">{activeConversation.title}</h2>
        <p className="text-xs text-base-content/40">Model: {activeConversation.model}</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.length === 0 && !isStreaming && (
          <p className="text-center text-base-content/30 text-sm mt-8">
            Send a message to begin the mission
          </p>
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg._id} message={msg} />
        ))}

        {/* Live streaming message */}
        {isStreaming && streamingContent && (
          <div className="chat chat-start">
            <div className="chat-image avatar placeholder">
              <div className="bg-base-300 rounded-full w-8">
                <span className="text-xs">🦇</span>
              </div>
            </div>
            <div className="chat-bubble chat-bubble-neutral prose prose-sm prose-invert max-w-prose">
              <ReactMarkdown>{streamingContent}</ReactMarkdown>
            </div>
          </div>
        )}

        {/* Typing indicator (before first token arrives) */}
        {isStreaming && !streamingContent && (
          <div className="chat chat-start">
            <div className="chat-bubble chat-bubble-neutral">
              <span className="loading loading-dots loading-sm" />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-4 bg-base-100 border-t border-base-300">
        <div className="flex gap-2">
          <textarea
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message Alfred... (Enter to send, Shift+Enter for newline)"
            disabled={isStreaming}
            className="textarea textarea-bordered flex-1 resize-none text-sm"
          />
          <button
            onClick={handleSend}
            disabled={isStreaming || !input.trim()}
            className="btn btn-warning"
          >
            {isStreaming ? <span className="loading loading-spinner loading-sm" /> : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

## Section 12 — CORS Configuration

CORS is configured in `server.js` using the `CLIENT_URL` environment variable (set up in Section 1.4). This works for both dev and production — just make sure:

- `backend/.env` has `CLIENT_URL=http://localhost:5173` in development
- Your production host (Render, Railway etc.) has `CLIENT_URL=https://your-frontend.vercel.app`

Install the cors package:

```bash
cd backend && npm install cors
```

---

## Section 13 — Separate Deployment

With frontend and backend deployed independently, each has its own build/start commands and its own set of environment variables.

### Backend — deploy to Render / Railway / Fly.io

| Setting | Value |
|---|---|
| Build command | `npm install` |
| Start command | `node src/server.js` |
| Root directory | `backend/` |

**Environment variables to set on the host:**

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | (set by host automatically, or `3000`) |
| `MONGODB_URI` | your MongoDB Atlas connection string |
| `JWT_SECRET` | a long random secret |
| `OPENAI_API_KEY` | `sk-...` |
| `CLIENT_URL` | your deployed frontend URL, e.g. `https://battychat.vercel.app` |

### Frontend — deploy to Vercel / Netlify / Cloudflare Pages

| Setting | Value |
|---|---|
| Build command | `npm run build` |
| Output directory | `dist` |
| Root directory | `frontend/` |

**Environment variables to set on the host:**

| Variable | Value |
|---|---|
| `VITE_API_URL` | your deployed backend URL, e.g. `https://battychat-api.onrender.com` |

> **That's the only env variable the frontend needs.** Vite bakes it into the production bundle at build time. If you change it, you must redeploy the frontend.

### Why cookies still work cross-origin

The JWT cookie is set with `sameSite: 'none'` and `secure: true` in production. `sameSite: 'none'` explicitly permits the cookie to be sent in cross-site requests. `secure: true` is required by browsers whenever `sameSite: 'none'` is used (HTTPS only). Both the Axios `withCredentials: true` and the fetch `credentials: 'include'` flags tell the browser to attach this cookie on outgoing requests to the backend.

---

## Section 14 — Running the App Locally

Open two terminals:

**Terminal 1 — Backend:**
```bash
cd backend
npm run dev
# Server running on port 3000, MongoDB connected
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
# Vite dev server on http://localhost:5173
```

Visit `http://localhost:5173` → sign up → create a new mission → start chatting with Alfred.

---

## Section 15 — Extending the Batman RAG

To add more Batman universe knowledge, just extend the `BATMAN_UNIVERSE` object in `backend/src/data/batman-context.js`:

```js
// Add more characters
villains: {
  bane: `Bane — mercenary, tactical genius, used Venom steroid to break Batman's back
    in Knightfall. Born in prison (Pena Duro). Has since reformed in some continuities.`,

  poison_ivy: `Pamela Isley / Poison Ivy — eco-terrorist with plant manipulation powers.
    Has a complex alliance with Harley Quinn.`,

  // etc.
},

// Add storylines
storylines: {
  knightfall: `Knightfall — Bane systematically breaks every villain out of Arkham,
    exhausting Batman, then breaks his back. Jean-Paul Valley (Azrael) temporarily
    takes the mantle.`,

  // etc.
},
```

The `buildBatmanSystemPrompt()` function automatically picks up any new keys you add.

---

## Section 16 — Per-Conversation Persona Override

Each conversation has a `systemPromptOverride` field. If set, it replaces the default Batman/Alfred prompt entirely. This lets users create different "modes":

```
"You are Batman himself. You are terse, intimidating, and speak in short sentences.
 You answer questions but always tie them back to justice and protecting Gotham."
```

Expose this in the UI later with a settings panel (model selector + prompt editor), following the `PATCH /api/conversations/:id` endpoint.

---

## Section 17 — Context Window Management (important)

As conversations grow, the OpenAI `messages` array grows with them. This costs more tokens and eventually hits the context limit. Add a simple truncation in `chat.controller.js`:

```js
// After fetching history, keep only the last N messages
const MAX_HISTORY_MESSAGES = 20;
const recentHistory = history.slice(-MAX_HISTORY_MESSAGES);

const openaiMessages = [
  { role: 'system', content: systemPrompt },
  ...recentHistory.map((m) => ({ role: m.role, content: m.content })),
];
```

This keeps the system prompt + last 20 messages — enough context without burning through your API budget.

---

## Build Order Checklist

Follow this order — each section depends on the previous:

- [ ] **1. Scaffold** — folder structure, `package.json`, `.env`, `server.js`
- [ ] **2. DB** — `db.js`, MongoDB Atlas cluster connected
- [ ] **3. Models** — `User.js`, `Conversation.js`, `Message.js`
- [ ] **4. Batman context** — `batman-context.js` with `buildBatmanSystemPrompt()`
- [ ] **5. Auth utils** — `utils.js` (generateToken)
- [ ] **6. Auth** — controller, middleware, routes — test signup/login/logout with Postman
- [ ] **7. Conversations** — CRUD controller + routes — test with Postman
- [ ] **8. Chat/SSE** — streaming controller + route — test with curl or Postman
- [ ] **9. Frontend scaffold** — Vite, react-router-dom, custom CSS
- [ ] **10. API layer** — `conversation.api.ts` with plain fetch calls
- [ ] **11. Auth pages** — `LoginPage.jsx`, `SignupPage.jsx`
- [ ] **12. App.jsx** — routing + auth guard
- [ ] **13. Chat layout** — `ChatPage.jsx`, `Navbar.jsx`, `Sidebar.jsx`
- [ ] **14. Messages** — `MessageBubble.jsx`, `ChatWindow.jsx` with SSE stream reader
- [ ] **15. CORS** — configure for dev
- [ ] **16. Test end-to-end** — full flow in browser
- [ ] **17. Deploy backend** — Render / Railway / Fly.io — set `NODE_ENV`, `MONGODB_URI`, `JWT_SECRET`, `OPENAI_API_KEY`, `CLIENT_URL`
- [ ] **18. Deploy frontend** — Vercel / Netlify — set `VITE_API_URL` to the backend URL, redeploy

---

## Common Gotchas

| Issue | Fix |
|---|---|
| JWT cookie not sent in production | `sameSite: 'none'` + `secure: true` required for cross-origin cookies; also needs `withCredentials: true` on Axios/fetch and CORS `credentials: true` |
| JWT cookie not sent in development | `sameSite: 'lax'` is fine locally; just ensure `withCredentials: true` and CORS allows `http://localhost:5173` |
| `req.body` is undefined | Add `app.use(express.json())` before routes in `server.js` |
| `req.cookies` is undefined | Add `app.use(cookieParser())` before routes |
| SSE stream not received | Ensure `Content-Type: text/event-stream` and `Cache-Control: no-cache` headers |
| OpenAI error mid-stream | Check if `res.headersSent` before sending error response |
| Context window exceeded | Truncate history to last 20 messages before sending to OpenAI |
| `.env` variables undefined | Call `dotenv.config()` at the very top of `server.js` before any other imports |
| ES module import errors | Make sure `"type": "module"` is in `backend/package.json` and all local imports end in `.js` |
