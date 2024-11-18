import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  Tab,
  Tabs,
  Alert,
  useTheme,
  useMediaQuery
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../firebase/config';
import { collection, query, where, getDocs } from 'firebase/firestore';

function Login() {
  const [tab, setTab] = useState(1); // Default to student login (index 1)
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // Set default tab to student login on mobile
  useEffect(() => {
    if (isMobile) {
      setTab(1); // Force student login tab on mobile
    }
  }, [isMobile]);

  const handleTabChange = (event, newValue) => {
    setTab(newValue);
    setError('');
    setUsername('');
    setPassword('');
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    try {
      if (tab === 0) { // Admin Login
        if (username === 'admin' && password === 'admin123') {
          navigate('/admin/dashboard');
          return;
        }
        setError('Invalid admin credentials');
      } else { // Student Login
        const email = `${username}@student.com`;
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Check if user is student
        const studentQuery = query(collection(db, 'students'), where('uid', '==', user.uid));
        const studentDocs = await getDocs(studentQuery);

        if (!studentDocs.empty) {
          navigate('/student/profile');
        } else {
          setError('Not authorized as student');
          await auth.signOut();
        }
      }
    } catch (error) {
      console.error('Login error:', error);
      setError('Invalid credentials');
    }
  };

  return (
    <Container component="main" maxWidth="xs">
      <Box
        sx={{
          marginTop: 8,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <Paper elevation={3} sx={{ p: 4, width: '100%' }}>
          <Typography component="h1" variant="h5" align="center" gutterBottom>
            Student Management System
          </Typography>

          {!isMobile && (
            <Tabs
              value={tab}
              onChange={handleTabChange}
              variant="fullWidth"
              sx={{ mb: 3 }}
            >
              <Tab label="Admin Login" />
              <Tab label="Student Login" />
            </Tabs>
          )}

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <form onSubmit={handleLogin}>
            <TextField
              margin="normal"
              required
              fullWidth
              id="username"
              label={tab === 0 ? "Admin Username" : "Mobile Number"}
              name="username"
              autoComplete="username"
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              sx={{ mb: 2 }}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              name="password"
              label="Password"
              type="password"
              id="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              sx={{ mb: 3 }}
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              sx={{ 
                mt: 1,
                mb: 2,
                py: 1.5,
                backgroundColor: theme.palette.primary.main,
                '&:hover': {
                  backgroundColor: theme.palette.primary.dark,
                }
              }}
            >
              {tab === 0 ? "Admin Login" : "Student Login"}
            </Button>
          </form>
        </Paper>
      </Box>
    </Container>
  );
}

export default Login;
