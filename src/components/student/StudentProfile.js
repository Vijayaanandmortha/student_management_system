import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  Container
} from '@mui/material';
import { auth, db } from '../../firebase/config';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  getDoc,
  onSnapshot,
  Timestamp 
} from 'firebase/firestore';

const StudentProfile = () => {
  const [student, setStudent] = useState(null);
  const [examResults, setExamResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let unsubscribeResults = null;

    const fetchStudentData = async () => {
      try {
        setLoading(true);
        setError(null);
        const currentUser = auth.currentUser;
        
        if (!currentUser) {
          setError('No authenticated user found');
          return;
        }

        // Fetch student data using query
        const studentQuery = query(
          collection(db, 'students'), 
          where('uid', '==', currentUser.uid)
        );
        const studentSnapshot = await getDocs(studentQuery);
        
        if (studentSnapshot.empty) {
          setError('No student document found');
          return;
        }

        const studentData = studentSnapshot.docs[0].data();
        setStudent(studentData);

        if (!studentData.mobileNumber) {
          setError('Student document does not contain mobile number');
          return;
        }

        // Set up real-time listener for exam results
        const resultsQuery = query(
          collection(db, 'examResults'),
          where('studentId', '==', studentData.mobileNumber)
        );

        unsubscribeResults = onSnapshot(resultsQuery, async (resultsSnapshot) => {
          try {
            // Get all exams for additional details
            const examsSnapshot = await getDocs(collection(db, 'exams'));
            const examsMap = {};
            examsSnapshot.forEach(doc => {
              examsMap[doc.id] = { id: doc.id, ...doc.data() };
            });

            const results = [];
            resultsSnapshot.forEach(doc => {
              const result = doc.data();
              const exam = examsMap[result.examId];
              if (exam) {
                results.push({
                  id: doc.id,
                  ...result,
                  examTitle: exam.title || 'Unknown Exam',
                  resultsReleased: exam.resultsReleased || false,
                  showToStudent: result.showToStudent || false,
                  examEndTime: exam.endTime,
                  examStatus: exam.status
                });
              }
            });

            // Sort results by submission date (newest first)
            results.sort((a, b) => {
              const timeA = a.submitTime?.toDate?.() || new Date(0);
              const timeB = b.submitTime?.toDate?.() || new Date(0);
              return timeB - timeA;
            });

            setExamResults(results);
          } catch (error) {
            console.error('Error processing exam results:', error);
            setError('Error loading exam results');
          }
        }, (error) => {
          console.error('Error in exam results listener:', error);
          setError('Error listening to exam results');
        });

      } catch (error) {
        console.error('Error fetching student data:', error);
        setError('Error loading student data');
      } finally {
        setLoading(false);
      }
    };

    if (auth.currentUser) {
      fetchStudentData();
    }

    // Cleanup listener
    return () => {
      if (unsubscribeResults) {
        unsubscribeResults();
      }
    };
  }, []);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <Typography variant="h6" color="text.secondary">
          {error}
        </Typography>
      </Box>
    );
  }

  if (!student) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <Typography variant="h6" color="text.secondary">
          No student data found
        </Typography>
      </Box>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Paper 
        elevation={3} 
        sx={{ 
          p: 4, 
          mb: 4, 
          borderRadius: 2,
          background: 'linear-gradient(to right bottom, #ffffff, #f8f9fa)'
        }}
      >
        <Box display="flex" alignItems="center" mb={3}>
          <Typography variant="h4" component="h1" fontWeight="500" color="primary">
            Student Profile
          </Typography>
        </Box>
        
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Paper 
              elevation={1} 
              sx={{ 
                p: 3, 
                height: '100%',
                borderRadius: 2,
                backgroundColor: 'rgba(255, 255, 255, 0.8)'
              }}
            >
              <Typography variant="h6" color="primary" gutterBottom>
                Personal Details
              </Typography>
              <Box sx={{ display: 'grid', gap: 2 }}>
                <Box display="flex" alignItems="center">
                  <Typography variant="subtitle1" color="text.secondary" sx={{ width: '120px' }}>
                    Name
                  </Typography>
                  <Typography variant="body1" fontWeight="500">
                    {student.name}
                  </Typography>
                </Box>
                <Box display="flex" alignItems="center">
                  <Typography variant="subtitle1" color="text.secondary" sx={{ width: '120px' }}>
                    Mobile
                  </Typography>
                  <Typography variant="body1" fontWeight="500">
                    {student.mobileNumber}
                  </Typography>
                </Box>
                <Box display="flex" alignItems="center">
                  <Typography variant="subtitle1" color="text.secondary" sx={{ width: '120px' }}>
                    Aadhar
                  </Typography>
                  <Typography variant="body1" fontWeight="500">
                    {student.adharNumber}
                  </Typography>
                </Box>
              </Box>
            </Paper>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Paper 
              elevation={1} 
              sx={{ 
                p: 3, 
                height: '100%',
                borderRadius: 2,
                backgroundColor: 'rgba(255, 255, 255, 0.8)'
              }}
            >
              <Typography variant="h6" color="primary" gutterBottom>
                Academic Details
              </Typography>
              <Box sx={{ display: 'grid', gap: 2 }}>
                <Box display="flex" alignItems="center">
                  <Typography variant="subtitle1" color="text.secondary" sx={{ width: '120px' }}>
                    Class
                  </Typography>
                  <Typography variant="body1" fontWeight="500">
                    {student.class}
                  </Typography>
                </Box>
                <Box display="flex" alignItems="center">
                  <Typography variant="subtitle1" color="text.secondary" sx={{ width: '120px' }}>
                    Section
                  </Typography>
                  <Typography variant="body1" fontWeight="500">
                    {student.section}
                  </Typography>
                </Box>
                <Box display="flex" alignItems="center">
                  <Typography variant="subtitle1" color="text.secondary" sx={{ width: '120px' }}>
                    Group
                  </Typography>
                  <Typography variant="body1" fontWeight="500">
                    {student.group}
                  </Typography>
                </Box>
                <Box display="flex" alignItems="center">
                  <Typography variant="subtitle1" color="text.secondary" sx={{ width: '120px' }}>
                    Year
                  </Typography>
                  <Typography variant="body1" fontWeight="500">
                    {student.yearOfStudy}
                  </Typography>
                </Box>
              </Box>
            </Paper>
          </Grid>
        </Grid>
      </Paper>

      <Paper 
        elevation={3} 
        sx={{ 
          p: 4, 
          borderRadius: 2,
          background: 'linear-gradient(to right bottom, #ffffff, #f8f9fa)'
        }}
      >
        <Typography variant="h5" color="primary" gutterBottom>
          Exam History
        </Typography>
        <TableContainer sx={{ borderRadius: 1 }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold' }}>Exam Title</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Date</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Score</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {examResults.map((result) => {
                const isExamCompleted = result.status === 'completed' || result.examStatus === 'completed';
                const canShowResult = result.showToStudent && isExamCompleted;
                
                return (
                  <TableRow key={result.id} hover>
                    <TableCell>{result.examTitle}</TableCell>
                    <TableCell>
                      {result.submitTime?.toDate ? 
                        new Date(result.submitTime.toDate()).toLocaleDateString() : 
                        'N/A'
                      }
                    </TableCell>
                    <TableCell>
                      {isExamCompleted ? (
                        canShowResult ? (
                          <Chip
                            label={result.score >= 40 ? 'Passed' : 'Failed'}
                            color={result.score >= 40 ? 'success' : 'error'}
                            size="small"
                            sx={{ fontWeight: 500 }}
                          />
                        ) : (
                          <Chip
                            label="Results Coming Soon"
                            color="warning"
                            size="small"
                            sx={{ fontWeight: 500 }}
                          />
                        )
                      ) : (
                        <Chip
                          label="Exam in Progress"
                          color="info"
                          size="small"
                          sx={{ fontWeight: 500 }}
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      {canShowResult ? (
                        <Typography 
                          fontWeight="500" 
                          color={result.score >= 40 ? 'success.main' : 'error.main'}
                        >
                          {result.score}%
                        </Typography>
                      ) : (
                        '---'
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {examResults.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ py: 3 }}>
                    <Typography color="text.secondary">
                      No exam results available
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Container>
  );
};

export default StudentProfile;
