import express from 'express'
import { streamChat } from '../controllers/chat.controller.js'
import { protectRoute } from '../middleware/auth.middleware.js'
const router = express.Router()

//router handles incoming messages and routes them to the controllers
router.post('/:conversationId', protectRoute, streamChat);

export default router