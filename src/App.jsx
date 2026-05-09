// Import necessary components
import { BrowserRouter as Router, Switch, Route } from 'react-router-dom';
import Home from './components/Home';  // Component for home page
import Beaches from './components/Beaches';  // Component for beaches list
import Details from './components/Details';  // Component for beach details

function App() {
  return (
    <Router/* Reset & Base Styles */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body, html, #root {
  height: 100%;
  width: 100%;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
}

.app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  background-color: #1a1a1a;
}

/* Header & Glassmorphism Effect */
.app-header {
  padding: 20px;
  z-index: 1000;
  background: rgba(30, 30, 30, 0.7);
  backdrop-filter: blur(15px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  flex-direction: column;
  align-items: center;
  box-shadow: 0 4px 30px rgba(0, 0, 0, 0.5);
}

.app-title {
  color: #ffffff;
  font-size: 1.5rem;
  margin-bottom: 15px;
  letter-spacing: 1px;
  text-transform: uppercase;
}

/* Search Bar Styles */
.search-container {
  display: flex;
  gap: 10px;
  width: 100%;
  max-width: 400px;
}

.search-input {
  flex-grow: 1;
  padding: 12px 20px;
  border-radius: 30px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.1);
  color: white;
  font-size: 1rem;
  outline: none;
  transition: all 0.3s ease;
}

.search-input:focus {
  background: rgba(255, 255, 255, 0.2);
  border-color: #007bff;
  box-shadow: 0 0 10px rgba(0, 123, 255, 0.5);
}

.search-input::placeholder {
  color: rgba(255, 255, 255, 0.5);
}

.search-button {
  padding: 12px 25px;
  border-radius: 30px;
  border: none;
  background-color: #007bff;
  color: white;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.3s ease, transform 0.2s ease;
}

.search-button:hover {
  background-color: #0056b3;
  transform: scale(1.05);
}

.search-button:active {
  transform: scale(0.95);
}

/* Map Container */
.map-container {
  flex-grow: 1;
  width: 100%;
  height: 100%;
  position: relative;
}>
      <Switch>
        <Route exact path="/">
          <Home />
        </R<|fim_suffix|>ndex.js` is the entry point where React's `ReactDOM.render` function renders our root component, the `App`, into the DOM element with an ID of "root".

```javascript src/index.jsx
import React from 'react';
import ReactDOM from 'react-dom';  // Library for rendering components to the DOM

// Import our main app component
import App from './components/App';

// Render the App component in the HTML element with id="root"
ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById('root')
);