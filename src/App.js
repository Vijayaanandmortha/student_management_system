import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material';
import CssBaseline from '@mui/material/CssBaseline';
import { initializeApp } from 'firebase/app';

// Import pages
import Login from './pages/Login';
import AdminDashboard from './pages/admin/Dashboard';
import StudentDashboard from './pages/student/Dashboard';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCoOeIFbwBvTSHIQCPn96Wb8By4m0h5NB4",
  authDomain: "smsapp-8a0df.firebaseapp.com",
  projectId: "smsapp-8a0df",
  storageBucket: "smsapp-8a0df.firebasestorage.app",
  messagingSenderId: "1011013462170",
  appId: "1:1011013462170:web:9cf7235c8b25f7111f1723"
};

// Initialize Firebase
initializeApp(firebaseConfig);

// Create theme instance
const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/admin/*" element={<AdminDashboard />} />
          <Route path="/student/*" element={<StudentDashboard />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;
