import type { Message } from "../../types"
import './Chatoutput.css'

const Chatoutput = ({ messages, streamingMessage }: {
  messages: Message[]
  streamingMessage: string
}) => {


  // chatoutput asccepts messages, maps them into the output container, 
  // the stream message renders seperately underneath. 
  // its remapping over it all but react saves what it can and doenst render it all 
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
