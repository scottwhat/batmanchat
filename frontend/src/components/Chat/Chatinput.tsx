import './Chatinput.css'
import { useState } from 'react'

const Chatinput = () => {

  const [inputText, setInputText] = useState('')
  
  



  return (
    <div className="input-container">
      <span className="prompt-symbol">{'>'}</span>
      <textarea
        onChange={(e) => setInputText(e.target.value)}
        className="terminal-input"
        placeholder="Ask Alfred..."
        rows={1}
      />
      <span className="send-hint">enter ↵</span>
    </div>
  )
}

export default Chatinput
