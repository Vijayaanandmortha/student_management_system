import React, { useState } from 'react';
import {
  Container,
  Paper,
  Typography,
  Box,
  Tabs,
  Tab,
  Button,
  AppBar,
  Toolbar,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { auth } from '../../firebase/config';

// Import admin components
import AddStudent from '../../components/admin/AddStudent';
import ManageExams from '../../components/admin/ManageExams';
import ViewStudents from '../../components/admin/ViewStudents';

function Dashboard() {
  const [tab, setTab] = useState(0);
  const navigate = useNavigate();

  const handleTabChange = (event, newValue) => {
    setTab(newValue);
  };

  const handleLogout = async () => {
    try {
      await auth.signOut();
      navigate('/');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  return (
    <Box sx={{ flexGrow: 1 }}>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Admin Dashboard
          </Typography>
          <Button color="inherit" onClick={handleLogout}>
            Logout
          </Button>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Paper elevation={3} sx={{ p: 3 }}>
          <Tabs value={tab} onChange={handleTabChange} centered sx={{ mb: 3 }}>
            <Tab label="Add Student" />
            <Tab label="Manage Exams" />
            <Tab label="View Students" />
          </Tabs>

          {tab === 0 && <AddStudent />}
          {tab === 1 && <ManageExams />}
          {tab === 2 && <ViewStudents />}
        </Paper>
      </Container>
    </Box>
  );
}

export default Dashboard;
