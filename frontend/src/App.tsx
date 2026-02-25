import './App.css'
import { Routes, Route } from 'react-router-dom'
import ChatPage from './pages/ChatPage'
import HomePage from './pages/HomePage'
import MusicPage from './pages/MusicPage'
import Navbar from './components/Navbar'


function App() {
  return (
    <div className="app">
      {/* apply navbar ontop of routes, have routes as the main, it just returns  */}
      <Navbar />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/music" element={<MusicPage />} />
      </Routes>
    </div>
  )
}

export default App


