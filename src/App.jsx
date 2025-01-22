import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import SignUp from './SignUp';
import Login from './Login';
import Analyzer from './Analyzer';
import ReportPage from './ReportPage';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<SignUp />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/login" element={<Login />} />
        <Route path="/analyzer" element={<Analyzer />} />
        <Route path="/report" element={<ReportPage />} />
      </Routes>
    </Router>
  );
}

export default App;
