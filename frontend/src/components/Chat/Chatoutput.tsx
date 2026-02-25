import { useState } from "react"
import type { Message } from "../../types"
import './Chatoutput.css'

const Chatoutput = () => {
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', role: 'user', content: 'What is the Batcave?' },
    { id: '2', role: 'assistant', content: 'The Batcave is Batman\'s secret headquarters located beneath Wayne Manor.' },
    { id: '3', role: 'user', content: 'What equipment is stored there?' },
    { id: '4', role: 'assistant', content: 'It houses the Batmobile, Batcomputer, crime lab, medical bay, and an arsenal of gadgets.' },
  ])
  const [streamingMessage, setStreamingMessage] = useState('')  // current stream

  return (
    <div className="chat-output">
      {/* TODO: chat styling logic, use chat output, msg role. user = left, assistant = right  */}
      {messages.map((msg) => (
        <div key={msg.id} className={`message ${msg.role} ${msg.role}`}>
          {msg.content}
        </div>
      ))}

      {/* streaming message renders separately, below completed ones */}
      {streamingMessage && (
        <div className="message assistant streaming">
          {streamingMessage}
        </div>
      )}
    </div>
  )
}

export default Chatoutput
