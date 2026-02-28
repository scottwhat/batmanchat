import './App.css'
import { Routes, Route } from 'react-router-dom'
import { SignedIn, SignedOut, RedirectToSignIn, SignIn, SignUp } from '@clerk/clerk-react'
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
        <Route path="/chat" element={
          <>
            <SignedIn><ChatPage /></SignedIn>
            <SignedOut><RedirectToSignIn /></SignedOut>
          </>
        } />
        <Route path="/music" element={
          <>
            <SignedIn><MusicPage /></SignedIn>
            <SignedOut><RedirectToSignIn /></SignedOut>
          </>
        } />
        <Route path="/sign-in/*" element={<SignIn routing="path" path="/sign-in" />} />
        <Route path="/sign-up/*" element={<SignUp routing="path" path="/sign-up" />} />
      </Routes>
    </div>
  )
}

export default App


