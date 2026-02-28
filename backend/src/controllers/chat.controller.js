
import OpenAI from 'openai';
import dotenv from 'dotenv'
import { buildBatmanSystemPrompt } from '../data/batman-context.js';
// import Conversation from '../models/Conversation.js';
// import Message from '../models/Message.js';
// import { buildBatmanSystemPrompt } from '../data/batman-context.js';

dotenv.config()

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });


// chatcontroller 
//stream chat is the main controller, accepts request from the front end, fires it off
// awaits a streamed response and 
export const streamChat = async (req, res) => {
  const { message, history = [] } = req.body;

  if (!message?.trim()) {
    return res.status(400).json({ message: 'Message is required' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', process.env.CLIENT_URL);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  // awaits the response from the openai.chat.completions.create chat, with stream set to true 
  // here i need to inject the chat history and the batman instructions + database 

  try {
    const stream = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{role: 'system', content: buildBatmanSystemPrompt() },
          ...history.map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: message.trim() }],
      stream: true,
    });

    for await (const chunk of stream) {
      const token = chunk.choices[0]?.delta?.content || '';
      if (token) {
        res.write(`data: ${JSON.stringify({ token })}\n\n`);
      }
    }

    // 
    res.write(`data: [DONE]\n\n`);
    res.end();
  } catch (error) {
    console.error('streamChat error:', error);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Internal server error' });
    } else {
      res.write(`data: ${JSON.stringify({ error: 'Stream error' })}\n\n`);
      res.end();
    }
  }
};

// ─── FULL PRODUCTION VERSION (restore when auth + DB are wired up) ────────────
/*
export const streamChat = async (req, res) => {
  const { conversationId } = req.params;
  const { message } = req.body;

  if (!message?.trim()) {
    return res.status(400).json({ message: 'Message is required' });
  }

  try {
    // TODO: restore user ownership check once protectRoute is re-enabled
    // const conversation = await Conversation.findOne({
    //   _id: conversationId,
    //   userId: req.user._id,
    // });
    const conversation = await Conversation.findOne({ _id: conversationId });

    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    await Message.create({ conversationId, role: 'user', content: message.trim() });

    const history = await Message.find({ conversationId })
      .sort({ createdAt: 1 })
      .select('role content');

    const systemPrompt = buildBatmanSystemPrompt(conversation.systemPromptOverride);
    const openaiMessages = [
      { role: 'system', content: systemPrompt },
      ...history.map((m) => ({ role: m.role, content: m.content })),
    ];

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', process.env.CLIENT_URL);
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    const stream = await openai.chat.completions.create({
      model: conversation.model || 'gpt-4o-mini',
      messages: openaiMessages,
      stream: true,
    });

    let fullResponse = '';
    for await (const chunk of stream) {
      const token = chunk.choices[0]?.delta?.content || '';
      if (token) {
        fullResponse += token;
        res.write(`data: ${JSON.stringify({ token })}\n\n`);
      }
    }

    res.write(`data: [DONE]\n\n`);
    res.end();

    await Message.create({ conversationId, role: 'assistant', content: fullResponse });

    if (conversation.title === 'New Mission') {
      autoTitleConversation(conversation, message);
    }
  } catch (error) {
    console.error('Error in streamChat:', error);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Internal server error' });
    } else {
      res.write(`data: ${JSON.stringify({ error: 'Stream error' })}\n\n`);
      res.end();
    }
  }
};
*/
