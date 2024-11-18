import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Avatar,
  Grid,
  Divider,
  CircularProgress,
  Alert
} from '@mui/material';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db, auth } from '../../firebase';

const Profile = () => {
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const user = auth.currentUser;
      if (!user) {
        setError('User not authenticated');
        setLoading(false);
        return;
      }

      // Fetch student profile
      const studentsRef = collection(db, 'students');
      const studentQuery = query(studentsRef, where('uid', '==', user.uid));
      const studentSnapshot = await getDocs(studentQuery);
      
      if (studentSnapshot.empty) {
        setError('Student profile not found');
        setLoading(false);
        return;
      }

      const studentData = studentSnapshot.docs[0].data();
      setUserProfile(studentData);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching profile:', err);
      setError('Failed to load profile. Please try again later.');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        {error}
      </Alert>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Avatar 
                sx={{ width: 64, height: 64, mr: 2 }}
                src={userProfile?.photoURL}
              >
                {userProfile?.displayName?.charAt(0) || userProfile?.email?.charAt(0)}
              </Avatar>
              <Box>
                <Typography variant="h6">
                  {userProfile?.displayName || 'Student'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {userProfile?.email}
                </Typography>
              </Box>
            </Box>
            <Divider sx={{ my: 2 }} />
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Student Information
            </Typography>
            <Grid container spacing={1}>
              <Grid item xs={12}>
                <Typography variant="body2">
                  <strong>ID:</strong> {userProfile?.studentId || 'N/A'}
                </Typography>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="body2">
                  <strong>Department:</strong> {userProfile?.department || 'N/A'}
                </Typography>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="body2">
                  <strong>Year:</strong> {userProfile?.year || 'N/A'}
                </Typography>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="body2">
                  <strong>Class:</strong> {userProfile?.class || 'N/A'}
                </Typography>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="body2">
                  <strong>Section:</strong> {userProfile?.section || 'N/A'}
                </Typography>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="body2">
                  <strong>Group:</strong> {userProfile?.group || 'N/A'}
                </Typography>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="body2">
                  <strong>Mobile:</strong> {userProfile?.mobileNumber || 'N/A'}
                </Typography>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="body2">
                  <strong>Aadhar:</strong> {userProfile?.adharNumber || 'N/A'}
                </Typography>
              </Grid>
            </Grid>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Profile;
