import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Leitstelle from './pages/Leitstelle.jsx';
import AlarmDisplay from './pages/AlarmDisplay.jsx';
import Setup from './pages/Setup.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Leitstelle />} />
        <Route path="/display" element={<AlarmDisplay />} />
        <Route path="/setup" element={<Setup />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
