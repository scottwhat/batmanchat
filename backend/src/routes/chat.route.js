import express from 'express'
import { streamChat } from '../controllers/chat.controller.js'
// import { protectRoute } from '../middleware/auth.middleware.js' // TODO: re-enable auth
const router = express.Router()

//router handles incoming messages and routes them to the controllers
// TODO: add protectRoute back before protectRoute: router.post('/:conversationId', protectRoute, streamChat)
router.post('/:conversationId', streamChat);

export default router