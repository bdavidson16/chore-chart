import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// #root is Vite's index.html; #chore-app is the Nextcloud template in templates/main.php.
const container = document.getElementById('root') ?? document.getElementById('chore-app')

if (container) {
  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
