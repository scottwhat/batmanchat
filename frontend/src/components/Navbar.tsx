import React from 'react'
import { Link } from 'react-router-dom';
import './Navbar.css';

const Navbar = () => {
  return (
    <nav className="navbar">
      <div className="navbar-links">
        <Link to="/">Home</Link>
        <Link to="/chat">Alfred</Link>
        <Link to="/music">Music</Link>
        <Link to="/">Duties</Link>
        <Link to="/">Get Riddled</Link>
      </div>
      <div className="navbar-profile">
        <Link to="/profile">Profile</Link>
      </div>
    </nav>
  )
}

export default Navbar