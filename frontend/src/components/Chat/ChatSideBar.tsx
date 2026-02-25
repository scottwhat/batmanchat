import './ChatSideBar.css'

const ChatSideBar = () => {

  //TODO: add call to backend for new chat, populate the text window with new chat 
  return (
    <div className='sidebar'>
      <div className="top-container">
        <button className="new-chat-btn" onClick={() => {}}><span>New Chat</span><span><img className="batsymbol" src="/batty.png" alt="" /></span></button>
      </div>
      <div className="chat-history">


      <div className="chat-item">1</div>
      <div className="chat-item">2</div>
      <div className="chat-item">3</div>
      </div>
    </div>
  )
}

export default ChatSideBar
