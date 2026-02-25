import './HomePage.css'
import { useNavigate } from 'react-router-dom'

  function HomePage() {
    const navigate = useNavigate()

    const handleEnter = () => {
      navigate('/chat')
    }

    //put a 1 second batman loading transition after enter
    return (
      <div className="home-page">
        <div className="login-container">
          <div className="welcome-title">Hello Mr. Wayne</div>

            <button onClick={handleEnter}>Enter</button>
        </div>
      </div>
    )
    }

export default HomePage
