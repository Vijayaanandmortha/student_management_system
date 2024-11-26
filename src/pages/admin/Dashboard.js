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
import NotificationGenerator from '../../components/admin/NotificationGenerator';

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
        <Paper sx={{ width: '100%', mb: 2 }}>
          <Tabs
            value={tab}
            onChange={handleTabChange}
            indicatorColor="primary"
            textColor="primary"
            variant="scrollable"
            scrollButtons="auto"
          >
            <Tab label="Add Student" />
            <Tab label="View Students" />
            <Tab label="Manage Exams" />
            <Tab label="Notifications" />
          </Tabs>

          <Box sx={{ p: 3 }}>
            {tab === 0 && <AddStudent />}
            {tab === 1 && <ViewStudents />}
            {tab === 2 && <ManageExams />}
            {tab === 3 && <NotificationGenerator />}
          </Box>
        </Paper>
      </Container>
    </Box>
  );
}

export default Dashboard;
