import { useState } from 'react'
import './ChatContainer.css'

import ChatSideBar from './ChatSideBar'
import Chatinput from './Chatinput'
import Chatoutput from './Chatoutput'


// keep state in components, not pages they are just layouts

const ChatContainer = () => {
  const [messageState, setMessageState] = useState([[]])

  // 1. SendMessage build a function to pass into chatinput as a prop
  // this will take in the text string, 
  // let it mutate up here in the controller

  // store state in chatcontainer
  // 


  //2.Update the chat output ui with the new message 

  //. save the full response to the DB under the correct conversation

  //3. await the resonse and stream it in

  //3. update the ui on each stream connection 

  return (
    <div className="container">
      <div className="left-container">
        <ChatSideBar />
      </div>
      <div className="right-container">
        <Chatoutput />
        <Chatinput />

      </div>
    </div>
  )
}

export default ChatContainer
