import { useState } from 'react'
import './ChatContainer.css'
import type { Message } from '../../types'

import ChatSideBar from './ChatSideBar'
import Chatinput from './Chatinput'
import Chatoutput from './Chatoutput'


// keep state in components, not pages they are just layouts

const ChatContainer = () => {
  const [messages, setMessages] = useState<Message[]>([])
  const [streamingMessage, setStreamingMessage] = useState('')
  // how to know 

  //
  const handleSendMessage = async (text: string) => {

    // set up the message to be sent 
    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: text }
    setMessages(prev => [...prev, userMsg])
    setStreamingMessage('')
    //streamingmessage set to blank here 

    const response = await fetch('http://localhost:3000/api/chat/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text }),
    })

    const reader = response.body!.getReader()
    const decoder = new TextDecoder()
    let fullResponse = ''

    // how to process the message that has come in

    // need to see the data
    console.log()
    while (true) {
      const { done, value } = await reader.read()
      console.log(value)
      if (done) break
      const chunk = decoder.decode(value)
      console.log(`decoded chunk: `, chunk)
      for (const line of chunk.split('\n')) {
        if (!line.startsWith('data: ')) continue
        const data = line.slice(6)
        if (data === '[DONE]') {
          setMessages(prev => [...prev, {
            id: crypto.randomUUID(), role: 'assistant', content: fullResponse
          }])
          setStreamingMessage('')
        } else {
          try {
            const { token } = JSON.parse(data)
            fullResponse += token
            setStreamingMessage(fullResponse)
          } catch {}
        }
      }
    }
  }

  return (
    <div className="container">
      <div className="left-container">
        <ChatSideBar />
      </div>
      <div className="right-container">
        <Chatoutput messages={messages} streamingMessage={streamingMessage} />
        <Chatinput onSend={handleSendMessage} />
      </div>
    </div>
  )
}

export default ChatContainer
