import './Chatinput.css'
import { useState } from 'react'

const Chatinput = ({ onSend }: { onSend: (text: string) => void }) => {

  const [inputText, setInputText] = useState('')
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()

      //executes the handleMessage 
      if (inputText.trim()) {
        onSend(inputText.trim())
        setInputText('')
      }
    }
  }

  //run the haandler that was passed in 
  return (
    <div className="input-container">
      <span className="prompt-symbol">{'>'}</span>
      <textarea
        value={inputText}
        onChange={(e) => setInputText(e.target.value)}
        onKeyDown={handleKeyDown}
        className="terminal-input"
        placeholder="Ask Alfred..."
        rows={1}
      />

      {/* add a new handler for  */}
      <span className="send-hint">enter ↵</span>
    </div>
  )
}

export default Chatinput
