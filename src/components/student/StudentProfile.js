import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Avatar,
  Chip,
  CircularProgress,
  Fade,
  Card,
  CardContent,
  useTheme,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Alert,
} from '@mui/material';
import {
  School,
  Class,
  Group,
  CalendarToday,
  Phone,
  Badge,
  Assignment,
  Edit as EditIcon,
} from '@mui/icons-material';
import { styled, keyframes } from '@mui/material/styles';
import { auth, db } from '../../firebase/config';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { updateProfile, updatePassword, updateEmail, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';

// Styled components
const StyledPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(3),
  borderRadius: theme.spacing(2),
  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
  background: 'rgba(255, 255, 255, 0.9)',
  backdropFilter: 'blur(10px)',
  transition: 'transform 0.3s ease-in-out',
  '&:hover': {
    transform: 'translateY(-5px)',
  },
}));

const ProfileAvatar = styled(Avatar)(({ theme }) => ({
  width: theme.spacing(20),
  height: theme.spacing(20),
  margin: '0 auto',
  border: `4px solid ${theme.palette.primary.main}`,
  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
  transition: 'transform 0.3s ease-in-out',
  '&:hover': {
    transform: 'scale(1.05)',
  },
}));

const InfoCard = styled(Card)(({ theme }) => ({
  height: '100%',
  transition: 'all 0.3s ease-in-out',
  '&:hover': {
    transform: 'translateY(-5px)',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
  },
}));

const slideIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

const AnimatedBox = styled(Box)(({ delay = 0 }) => ({
  animation: `${slideIn} 0.5s ease-out forwards`,
  animationDelay: `${delay}s`,
  opacity: 0,
}));

function StudentProfile() {
  const [studentData, setStudentData] = useState(null);
  const [examResults, setExamResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    name: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [editError, setEditError] = useState('');
  const [editSuccess, setEditSuccess] = useState('');
  const [updating, setUpdating] = useState(false);
  const theme = useTheme();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;

        // Fetch student data
        const studentsRef = collection(db, 'students');
        const q = query(studentsRef, where('uid', '==', user.uid));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          const studentDoc = querySnapshot.docs[0];
          const student = studentDoc.data();
          setStudentData(student);

          // Fetch exam results
          const resultsRef = collection(db, 'examResults');
          const resultsQuery = query(resultsRef, where('studentId', '==', student.mobileNumber));
          const resultsSnapshot = await getDocs(resultsQuery);

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
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleEditClick = () => {
    setEditFormData({
      name: studentData?.name || '',
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    });
    setEditError('');
    setEditSuccess('');
    setEditDialogOpen(true);
  };

  const handleEditClose = () => {
    setEditDialogOpen(false);
    setEditError('');
    setEditSuccess('');
  };

  const handleInputChange = (e) => {
    setEditFormData({
      ...editFormData,
      [e.target.name]: e.target.value,
    });
  };

  const handleUpdateProfile = async () => {
    try {
      setUpdating(true);
      setEditError('');
      setEditSuccess('');

      const user = auth.currentUser;
      if (!user) throw new Error('No user logged in');

      // Validate form data
      if (editFormData.newPassword && editFormData.newPassword !== editFormData.confirmPassword) {
        throw new Error('New passwords do not match');
      }

      if (!editFormData.currentPassword) {
        throw new Error('Current password is required');
      }

      // Re-authenticate user
      const credential = EmailAuthProvider.credential(
        user.email,
        editFormData.currentPassword
      );
      await reauthenticateWithCredential(user, credential);

      // Update name if changed
      if (editFormData.name !== studentData.name) {
        await updateProfile(user, { displayName: editFormData.name });
        
        // Update name in Firestore
        const studentsRef = collection(db, 'students');
        const q = query(studentsRef, where('uid', '==', user.uid));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          const studentDoc = querySnapshot.docs[0];
          await updateDoc(doc(db, 'students', studentDoc.id), {
            name: editFormData.name,
          });
        }

        // Update local state
        setStudentData({
          ...studentData,
          name: editFormData.name,
        });
      }

      // Update password if provided
      if (editFormData.newPassword) {
        await updatePassword(user, editFormData.newPassword);
      }

      setEditSuccess('Profile updated successfully!');
      setTimeout(() => {
        handleEditClose();
      }, 1500);

    } catch (error) {
      console.error('Error updating profile:', error);
      setEditError(error.message || 'Failed to update profile');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="80vh"
      >
        <CircularProgress />
      </Box>
    );
  }

  if (!studentData) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="80vh"
      >
        <Typography variant="h6" color="error">
          No student data found
        </Typography>
      </Box>
    );
  }

  const getInitials = (name) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase();
  };

  return (
    <Box sx={{ p: 3, maxWidth: 1200, margin: '0 auto' }}>
      <Fade in timeout={1000}>
        <Box>
          <StyledPaper sx={{ mb: 3 }}>
            <Grid container spacing={4}>
              {/* Profile Header */}
              <Grid item xs={12}>
                <AnimatedBox delay={0.2}>
                  <Box textAlign="center" mb={4}>
                    <ProfileAvatar>
                      {getInitials(studentData.name)}
                    </ProfileAvatar>
                    <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Typography variant="h4" sx={{ 
                        background: `linear-gradient(45deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                        backgroundClip: 'text',
                        WebkitBackgroundClip: 'text',
                        color: 'transparent',
                        fontWeight: 'bold'
                      }}>
                        {studentData.name}
                      </Typography>
                      <IconButton 
                        onClick={handleEditClick}
                        sx={{ ml: 1, color: theme.palette.primary.main }}
                        size="small"
                      >
                        <EditIcon />
                      </IconButton>
                    </Box>
                    <Typography variant="body1" color="textSecondary" sx={{ mt: 1 }}>
                      Student
                    </Typography>
                  </Box>
                </AnimatedBox>
              </Grid>

              {/* Student Information */}
              <Grid item xs={12}>
                <Grid container spacing={3}>
                  {[
                    {
                      icon: <School />,
                      label: 'Year of Study',
                      value: studentData.yearOfStudy,
                      delay: 0.4,
                    },
                    {
                      icon: <Class />,
                      label: 'Class & Section',
                      value: `${studentData.class} - ${studentData.section}`,
                      delay: 0.5,
                    },
                    {
                      icon: <Group />,
                      label: 'Group',
                      value: studentData.group,
                      delay: 0.6,
                    },
                    {
                      icon: <CalendarToday />,
                      label: 'Date of Birth',
                      value: new Date(studentData.dateOfBirth).toLocaleDateString(),
                      delay: 0.7,
                    },
                    {
                      icon: <Phone />,
                      label: 'Mobile Number',
                      value: studentData.mobileNumber,
                      delay: 0.8,
                    },
                    {
                      icon: <Badge />,
                      label: 'Aadhar Number',
                      value: studentData.adharNumber,
                      delay: 0.9,
                    },
                  ].map((item, index) => (
                    <Grid item xs={12} sm={6} md={4} key={index}>
                      <AnimatedBox delay={item.delay}>
                        <InfoCard>
                          <CardContent>
                            <Box
                              display="flex"
                              alignItems="center"
                              mb={1}
                              color="primary.main"
                            >
                              {item.icon}
                              <Typography
                                variant="subtitle2"
                                sx={{ ml: 1, fontWeight: 600 }}
                              >
                                {item.label}
                              </Typography>
                            </Box>
                            <Typography variant="body1" sx={{ fontWeight: 500 }}>
                              {item.value}
                            </Typography>
                          </CardContent>
                        </InfoCard>
                      </AnimatedBox>
                    </Grid>
                  ))}
                </Grid>
              </Grid>
            </Grid>
          </StyledPaper>

          {/* Exam History Section */}
          <AnimatedBox delay={1.0}>
            <StyledPaper>
              <Box sx={{ p: 2 }}>
                <Box display="flex" alignItems="center" mb={3}>
                  <Assignment color="primary" sx={{ mr: 1 }} />
                  <Typography variant="h5" fontWeight="600">
                    Exam History
                  </Typography>
                </Box>

                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ 
                          fontWeight: 600, 
                          color: theme.palette.primary.main,
                          fontSize: '1rem'
                        }}>
                          Exam Title
                        </TableCell>
                        <TableCell sx={{ 
                          fontWeight: 600, 
                          color: theme.palette.primary.main,
                          fontSize: '1rem'
                        }}>
                          Date
                        </TableCell>
                        <TableCell sx={{ 
                          fontWeight: 600, 
                          color: theme.palette.primary.main,
                          fontSize: '1rem'
                        }}>
                          Status
                        </TableCell>
                        <TableCell sx={{ 
                          fontWeight: 600, 
                          color: theme.palette.primary.main,
                          fontSize: '1rem'
                        }}>
                          Score
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {examResults.map((result) => {
                        const isExamCompleted = result.status === 'completed' || result.examStatus === 'completed';
                        const canShowResult = result.showToStudent && isExamCompleted;
                        
                        return (
                          <TableRow 
                            key={result.id} 
                            hover
                            sx={{
                              transition: 'background-color 0.3s',
                              '&:hover': {
                                backgroundColor: 'rgba(0, 0, 0, 0.04)',
                              }
                            }}
                          >
                            <TableCell sx={{ fontSize: '0.95rem' }}>
                              {result.examTitle}
                            </TableCell>
                            <TableCell sx={{ fontSize: '0.95rem' }}>
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
                                    sx={{ 
                                      fontWeight: 500,
                                      borderRadius: '8px',
                                      transition: 'transform 0.2s',
                                      '&:hover': {
                                        transform: 'scale(1.05)'
                                      }
                                    }}
                                  />
                                ) : (
                                  <Chip
                                    label="Results Coming Soon"
                                    color="warning"
                                    size="small"
                                    sx={{ 
                                      fontWeight: 500,
                                      borderRadius: '8px',
                                      transition: 'transform 0.2s',
                                      '&:hover': {
                                        transform: 'scale(1.05)'
                                      }
                                    }}
                                  />
                                )
                              ) : (
                                <Chip
                                  label="Exam in Progress"
                                  color="info"
                                  size="small"
                                  sx={{ 
                                    fontWeight: 500,
                                    borderRadius: '8px',
                                    transition: 'transform 0.2s',
                                    '&:hover': {
                                      transform: 'scale(1.05)'
                                    }
                                  }}
                                />
                              )}
                            </TableCell>
                            <TableCell>
                              {canShowResult ? (
                                <Typography 
                                  variant="body1"
                                  fontWeight="600" 
                                  color={result.score >= 40 ? 'success.main' : 'error.main'}
                                  sx={{ fontSize: '0.95rem' }}
                                >
                                  {result.score}%
                                </Typography>
                              ) : (
                                <Typography 
                                  variant="body1" 
                                  color="text.secondary"
                                  sx={{ fontSize: '0.95rem' }}
                                >
                                  ---
                                </Typography>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {examResults.length === 0 && (
                        <TableRow>
                          <TableCell 
                            colSpan={4} 
                            align="center" 
                            sx={{ py: 4 }}
                          >
                            <Typography 
                              color="text.secondary"
                              sx={{ 
                                fontSize: '1rem',
                                fontStyle: 'italic'
                              }}
                            >
                              No exam results available
                            </Typography>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            </StyledPaper>
          </AnimatedBox>
        </Box>
      </Fade>

      {/* Edit Profile Dialog */}
      <Dialog 
        open={editDialogOpen} 
        onClose={handleEditClose}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            p: 2,
          }
        }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Typography variant="h5" color="primary" fontWeight="600">
            Edit Profile
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            {editError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {editError}
              </Alert>
            )}
            {editSuccess && (
              <Alert severity="success" sx={{ mb: 2 }}>
                {editSuccess}
              </Alert>
            )}
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Name"
                  name="name"
                  value={editFormData.name}
                  onChange={handleInputChange}
                  variant="outlined"
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Current Password"
                  name="currentPassword"
                  type="password"
                  value={editFormData.currentPassword}
                  onChange={handleInputChange}
                  variant="outlined"
                  required
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="New Password (optional)"
                  name="newPassword"
                  type="password"
                  value={editFormData.newPassword}
                  onChange={handleInputChange}
                  variant="outlined"
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Confirm New Password"
                  name="confirmPassword"
                  type="password"
                  value={editFormData.confirmPassword}
                  onChange={handleInputChange}
                  variant="outlined"
                  disabled={!editFormData.newPassword}
                />
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button 
            onClick={handleEditClose}
            variant="outlined"
            disabled={updating}
          >
            Cancel
          </Button>
          <Button
            onClick={handleUpdateProfile}
            variant="contained"
            disabled={updating || !editFormData.currentPassword}
            sx={{ ml: 2 }}
          >
            {updating ? 'Updating...' : 'Update Profile'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default StudentProfile;
