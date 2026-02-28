import React from 'react'
import { Link } from 'react-router-dom';
import { SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/clerk-react';
import './Navbar.css';

const Navbar = () => {
  return (
    <nav className="navbar">
      <div className="navbar-links">
        <Link to="/">Home</Link>
        <Link to="/chat">Alfred</Link>
        <Link to="/music">Music</Link>
      </div>
      <div className="navbar-profile">
        <SignedIn><UserButton /></SignedIn>
        <SignedOut><SignInButton /></SignedOut>
      </div>
    </nav>
  )
}

export default Navbar