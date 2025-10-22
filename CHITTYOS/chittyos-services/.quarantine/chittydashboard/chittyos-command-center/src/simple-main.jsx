import React from 'react'
import ReactDOM from 'react-dom/client'

ReactDOM.createRoot(document.getElementById('root')).render(
  <div style={{ padding: '40px', backgroundColor: '#111', color: 'white', minHeight: '100vh' }}>
    <h1>ChittyOS Command Center</h1>
    <p>React is working! ✅</p>
    <p>Time: {new Date().toLocaleString()}</p>
  </div>
)