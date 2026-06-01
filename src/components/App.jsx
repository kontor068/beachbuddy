import React, { useEffect } from 'react';
import { BrowserRouter as Router, Switch, Route } from 'react-router-dom';  // Importing routing components from react-router
import Home from './Home';  // Component for home page
import Beaches from './Beaches';  // Component for beaches list
import Details from './Details';  // Component for beach details
import { initializeAnalytics } from '../../services/analyticsService';

function App() {
  useEffect(() => {
    initializeAnalytics();
  }, []);

  return (
    <Router>
      ...
    </Router>
  );
}

export default App;
