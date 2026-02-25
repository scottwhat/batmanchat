import React from 'react'
import './MusicPage.css'

const MusicPage = () => {
  return (
    <div className="music-page">
      <div className="video-container">
        <iframe
          width="560"
          height="315"
          src="https://www.youtube.com/embed/s7BZrP8vuHo"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    </div>
  )
}

export default MusicPage