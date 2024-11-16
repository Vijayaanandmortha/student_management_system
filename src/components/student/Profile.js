import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Avatar,
  Grid,
  Divider,
  List,
  ListItem,
  ListItemText,
  CircularProgress,
  Alert
} from '@mui/material';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db, auth } from '../../firebase';

const Profile = () => {
  const [userProfile, setUserProfile] = useState(null);
  const [recentResults, setRecentResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchProfileAndResults();
  }, []);

  const fetchProfileAndResults = async () => {
    try {
      const user = auth.currentUser;
      if (!user) {
        setError('User not authenticated');
        setLoading(false);
        return;
      }

      // Fetch user profile
      const usersRef = collection(db, 'users');
      const userQuery = query(usersRef, where('uid', '==', user.uid));
      const userSnapshot = await getDocs(userQuery);
      
      if (!userSnapshot.empty) {
        setUserProfile(userSnapshot.docs[0].data());
      }

      // Fetch recent results
      const resultsRef = collection(db, 'results');
      const resultsQuery = query(
        resultsRef,
        where('studentId', '==', user.uid),
        orderBy('timestamp', 'desc'),
        limit(3)
      );
      const resultsSnapshot = await getDocs(resultsQuery);
      
      const resultsData = resultsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate().toLocaleString() || 'N/A'
      }));
      
      setRecentResults(resultsData);
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
        {/* Profile Information */}
        <Grid item xs={12} md={6}>
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
            </Grid>
          </Paper>
        </Grid>

        {/* Recent Results */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Recent Test Results
            </Typography>
            {recentResults.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No test results available
              </Typography>
            ) : (
              <List>
                {recentResults.map((result) => (
                  <React.Fragment key={result.id}>
                    <ListItem>
                      <ListItemText
                        primary={result.examTitle}
                        secondary={
                          <Box>
                            <Typography variant="body2" color="text.secondary">
                              Score: {result.score}/{result.totalQuestions}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {result.timestamp}
                            </Typography>
                          </Box>
                        }
                      />
                    </ListItem>
                    <Divider />
                  </React.Fragment>
                ))}
              </List>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Profile;
