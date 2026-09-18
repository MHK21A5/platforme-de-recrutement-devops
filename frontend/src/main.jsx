import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Apply theme immediately before first render to avoid flash
;(function () {
  const stored = localStorage.getItem("stb-theme");
  const preferred = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  const theme = (stored === "dark" || stored === "light") ? stored : preferred;
  document.documentElement.classList.add(`theme-${theme}`);
})();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
