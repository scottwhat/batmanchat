# Node.js Backend Templates

## server.js

```js
import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'

import authRoutes from './routes/auth.js'
import chatRoutes from './routes/chat.js'
import { authMiddleware } from './middleware/authMiddleware.js'

dotenv.config()

const app = express()

// middleware
app.use(cors())
app.use(express.json())

// routes
app.use('/auth', authRoutes)
app.use('/chat', authMiddleware, chatRoutes)  // protected

const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log(`Server running on port ${PORT}`))
```

---

## routes/chat.js

Routes just map URLs to controller functions. No logic here.

```js
import { Router } from 'express'
import { sendMessage, getChatHistory } from '../controllers/chatController.js'

const router = Router()

router.post('/message', sendMessage)
router.get('/history/:chatId', getChatHistory)

export default router
```

---

## controllers/chatController.js

Controllers handle the request and response. Call models/services here.

```js
export const sendMessage = async (req, res) => {
  try {
    const { message, chatId } = req.body
    const userId = req.user.id  // set by authMiddleware

    // TODO: call Claude API, save to DB, return response
    const reply = `Echo: ${message}`

    res.status(200).json({ reply })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

export const getChatHistory = async (req, res) => {
  try {
    const { chatId } = req.params

    // TODO: fetch from DB
    const messages = []

    res.status(200).json({ messages })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
```

---

## routes/auth.js

```js
import { Router } from 'express'
import { signup, login } from '../controllers/authController.js'

const router = Router()

router.post('/signup', signup)
router.post('/login', login)

export default router
```

---

## controllers/authController.js

```js
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'

export const signup = async (req, res) => {
  try {
    const { email, password } = req.body

    const hashed = await bcrypt.hash(password, 10)

    // TODO: save user to DB
    // const user = await User.create({ email, password: hashed })

    const token = jwt.sign({ id: 'user_id_here' }, process.env.JWT_SECRET, {
      expiresIn: '7d'
    })

    res.status(201).json({ token })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

export const login = async (req, res) => {
  try {
    const { email, password } = req.body

    // TODO: find user in DB
    // const user = await User.findOne({ email })
    // const valid = await bcrypt.compare(password, user.password)

    const token = jwt.sign({ id: 'user_id_here' }, process.env.JWT_SECRET, {
      expiresIn: '7d'
    })

    res.status(200).json({ token })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
```

---

## middleware/authMiddleware.js

Runs before protected routes. Verifies the JWT and attaches user to `req`.

```js
import jwt from 'jsonwebtoken'

export const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const token = authHeader.split(' ')[1]

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    req.user = decoded  // now available in controllers as req.user
    next()
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' })
  }
}
```

---

## .env

```
PORT=3000
JWT_SECRET=your_secret_here
```

---

## packages to install

```bash
npm install express cors dotenv bcrypt jsonwebtoken
```

---

## Request flow

```
POST /chat/message
  → authMiddleware (checks JWT, attaches req.user)
  → chatController.sendMessage (reads req.body, calls DB/API, sends res)
```
