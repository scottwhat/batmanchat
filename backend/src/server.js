// required - express, mongoose, openai, cookie arser, connectDB as a db method from 

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import { clerkMiddleware } from '@clerk/express';
import { connectDB } from './lib/db.js';
// import conversationRoutes from './routes/conversation.route.js';
import chatRoutes from './routes/chat.route.js';

//add authroutes 

dotenv.config()

const app = express()
const PORT = process.env.port || 3000

app.use(cors({
  origin: process.env.CLIENT_URL,
  credentials: true, // allows the JWT cookie to be sent cross-origin
}));

//build up incrementally dont skip/build the 

//middleware
app.use(clerkMiddleware())
app.use(express.json())
app.use(cookieParser())
import OpenAI from "openai";
const client = new OpenAI();

// test route - hit this from the frontend to confirm connection
// confirmed 
// build out attaching the backend and get the frontend to send message 
app.get('/api/ping', (_req, res) => {
  res.json({ message: 'pong' })
})

app.use('/api/chat', chatRoutes)

// test openai route
app.get('/api/batman', async (_req, res) => {
  const response = await client.responses.create({
    model: "gpt-4o",
    input: "Tell me a batman fact"
  });
  res.json({ message: response.output_text })
})

app.listen(PORT, () => {
  console.log("Server listening...")
  connectDB()
})





