import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './styles/base.css'
import './styles/topbar.css'
import './styles/library.css'
import './styles/collections.css'
import './styles/spaces.css'
import './styles/detail.css'
import './styles/panel.css'
import './styles/menu.css'
import './styles/settings.css'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
