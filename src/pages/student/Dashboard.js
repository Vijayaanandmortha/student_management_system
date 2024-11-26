import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Typography,
  Box,
  Button,
  AppBar,
  Toolbar,
  Grid,
  Dialog,
  DialogContent,
  DialogTitle,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Drawer,
  useTheme,
  useMediaQuery,
  Collapse,
  DialogActions,
} from '@mui/material';
import { Routes, Route, useNavigate, Link } from 'react-router-dom';
import { auth, db } from '../../firebase/config';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import TakeExam from '../../components/student/TakeExam';
import StudentProfile from '../../components/student/StudentProfile';
import AssignmentIcon from '@mui/icons-material/Assignment';
import PersonIcon from '@mui/icons-material/Person';
import LogoutIcon from '@mui/icons-material/Logout';
import HomeIcon from '@mui/icons-material/Home';
import MenuIcon from '@mui/icons-material/Menu';
import CloseIcon from '@mui/icons-material/Close';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import NotificationsIcon from '@mui/icons-material/Notifications';
import NotificationViewer from '../../components/student/NotificationViewer';

function Dashboard() {
  const navigate = useNavigate();
  const [availableExams, setAvailableExams] = useState([]);
  const [completedExams, setCompletedExams] = useState([]);
  const [selectedExam, setSelectedExam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [studentData, setStudentData] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [previewExam, setPreviewExam] = useState(null);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Get current student's data
        const studentQuery = query(
          collection(db, 'students'),
          where('uid', '==', auth.currentUser.uid)
        );
        const studentDocs = await getDocs(studentQuery);
        if (studentDocs.empty) {
          console.error('No student document found');
          setLoading(false);
          return;
        }
        const studentData = studentDocs.docs[0].data();
        setStudentData(studentData);

        // Get completed exams first
        const resultsQuery = query(
          collection(db, 'examResults'),
          where('studentId', '==', studentData.mobileNumber)
        );
        const resultsDocs = await getDocs(resultsQuery);
        const completedExamIds = resultsDocs.docs.map(doc => doc.data().examId);
        const examResults = {};
        resultsDocs.docs.forEach(doc => {
          const data = doc.data();
          examResults[data.examId] = {
            score: data.score,
            answers: data.answers || {},
            submitTime: data.submitTime,
            showToStudent: data.showToStudent || false,
            status: data.status
          };
        });

        // Get all exams for student's class, section and group
        const examsQuery = query(
          collection(db, 'exams'),
          where('class', '==', studentData.class),
          where('section', '==', studentData.section),
          where('group', '==', studentData.group)
        );
        const examsDocs = await getDocs(examsQuery);
        const now = Timestamp.now();
        
        // Process all exams
        const allExams = examsDocs.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        // Filter available exams:
        // 1. Not completed
        // 2. Not expired
        // 3. Has valid endTime
        // 4. Is active
        const available = allExams.filter(exam => {
          const isCompleted = completedExamIds.includes(exam.id);
          const hasValidEndTime = exam.endTime && exam.endTime instanceof Timestamp;
          const isExpired = hasValidEndTime && exam.endTime.toMillis() <= now.toMillis();
          const isActive = exam.status === 'active';
          
          return !isCompleted && hasValidEndTime && !isExpired && isActive;
        });

        // Get completed exams with results
        const completed = allExams
          .filter(exam => {
            const result = examResults[exam.id];
            return completedExamIds.includes(exam.id) && 
                   (exam.status === 'completed' || result?.status === 'completed') &&
                   result?.showToStudent === true;
          })
          .map(exam => ({
            ...exam,
            result: examResults[exam.id]
          }))
          .sort((a, b) => {
            // Sort by submission time, most recent first
            const timeA = a.result?.submitTime?.toDate?.() || new Date(0);
            const timeB = b.result?.submitTime?.toDate?.() || new Date(0);
            return timeB - timeA;
          });

        setAvailableExams(available);
        setCompletedExams(completed);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching data:', error);
        setLoading(false);
      }
    };

    if (auth.currentUser) {
      fetchData();
    }
  }, []);

  const handleLogout = async () => {
    try {
      await auth.signOut();
      navigate('/');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const handleStartExam = (exam) => {
    setSelectedExam(exam);
  };

  const handleExamComplete = () => {
    setSelectedExam(null);
    // Refresh the exams list
    window.location.reload();
  };

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handlePreviewExam = (exam) => {
    generatePDF(exam);
  };

  const generatePDF = (exam) => {
    try {
      // Initialize PDF
      const doc = new jsPDF();
      
      // Add exam details
      doc.setFontSize(20);
      doc.text(exam.title, 20, 20);
      
      doc.setFontSize(12);
      doc.text(`Student Name: ${studentData?.name || 'N/A'}`, 20, 35);
      doc.text(`Class: ${studentData?.class || 'N/A'}`, 20, 42);
      doc.text(`Section: ${studentData?.section || 'N/A'}`, 20, 49);
      doc.text(`Group: ${studentData?.group || 'N/A'}`, 20, 56);
      
      // Calculate correct answers
      let correctCount = 0;
      const studentAnswers = exam.result?.answers || {};
      
      exam.questions.forEach((question, index) => {
        const studentAnswer = studentAnswers[index];
        const correctAnswer = question.answer;
        
        if (studentAnswer === correctAnswer) {
          correctCount++;
        }
      });
      
      // Add exam result details
      doc.text(`Score: ${exam.result.score || 0}%`, 20, 70);
      doc.text(`Status: ${exam.result.score >= 40 ? 'Passed' : 'Failed'}`, 20, 77);
      doc.text(`Submission Time: ${exam.result.submitTime?.toDate?.().toLocaleString() || 'N/A'}`, 20, 84);
      
      // Add questions and answers table
      const tableData = exam.questions.map((question, index) => {
        const studentAnswer = studentAnswers[index] || 'Not answered';
        const correctAnswer = question.answer;

        return [
          `Q${index + 1}: ${question.question}`,
          studentAnswer,
          correctAnswer
        ];
      });

      doc.autoTable({
        startY: 100,
        head: [['Question', 'Your Answer', 'Correct Answer']],
        body: tableData,
        theme: 'grid',
        headStyles: {
          fillColor: [66, 66, 66],
          textColor: [255, 255, 255],
          fontStyle: 'bold'
        },
        columnStyles: {
          0: { cellWidth: 90 },
          1: { cellWidth: 50 },
          2: { cellWidth: 50 }
        },
        styles: {
          overflow: 'linebreak',
          cellPadding: 2,
          fontSize: 10
        }
      });

      // Add footer
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(10);
        doc.text(
          `Page ${i} of ${pageCount}`,
          doc.internal.pageSize.width / 2,
          doc.internal.pageSize.height - 10,
          { align: 'center' }
        );
      }

      // Save the PDF
      const fileName = `${exam.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_results.pdf`;
      doc.save(fileName);

    } catch (error) {
      console.error('Error generating PDF:', error);
      console.error('Error details:', error.message);
      alert('Failed to generate PDF. Please try again.');
    }
  };

  const navigationItems = [
    { text: 'Exams', icon: <HomeIcon />, path: '/student' },
    { text: 'Profile', icon: <PersonIcon />, path: '/student/profile' },
    { text: 'Notifications', icon: <NotificationsIcon />, path: '/student/notifications' },
  ];

  const drawer = (
    <Box sx={{ width: 250 }}>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', p: 1 }}>
        <IconButton onClick={handleDrawerToggle}>
          <CloseIcon />
        </IconButton>
      </Box>
      <List>
        {navigationItems.map((item) => (
          <ListItem
            button
            key={item.text}
            component={Link}
            to={item.path}
            onClick={handleDrawerToggle}
          >
            <ListItemIcon>{item.icon}</ListItemIcon>
            <ListItemText primary={item.text} />
          </ListItem>
        ))}
        <ListItem button onClick={handleLogout}>
          <ListItemIcon>
            <LogoutIcon />
          </ListItemIcon>
          <ListItemText primary="Logout" />
        </ListItem>
      </List>
    </Box>
  );

  const renderExamList = (exams, type = 'available') => (
    <List>
      {exams.map((exam) => (
        <ListItem
          key={exam.id}
          sx={{
            mb: 2,
            backgroundColor: 'background.paper',
            borderRadius: 1,
            boxShadow: 1,
          }}
        >
          <ListItemIcon>
            <AssignmentIcon color="primary" />
          </ListItemIcon>
          <ListItemText
            primary={exam.title}
            secondary={
              <React.Fragment>
                <Typography variant="body2" component="span" display="block">
                  Duration: {exam.duration} minutes
                </Typography>
                {type === 'available' && exam.endTime && (
                  <Typography 
                    variant="body2" 
                    component="span" 
                    display="block"
                    color="text.secondary"
                  >
                    Expires: {exam.endTime.toDate().toLocaleString()}
                  </Typography>
                )}
                {type === 'completed' && exam.result && (
                  <Typography 
                    variant="body2" 
                    component="span" 
                    display="block"
                    color={exam.result.score >= 40 ? 'success.main' : 'error.main'}
                  >
                    Score: {exam.result.score}% ({exam.result.score >= 40 ? 'Passed' : 'Failed'})
                    <Typography 
                      variant="body2" 
                      component="span" 
                      display="block" 
                      color="text.secondary"
                    >
                      Submitted: {exam.result.submitTime?.toDate?.().toLocaleString() || 'N/A'}
                    </Typography>
                  </Typography>
                )}
              </React.Fragment>
            }
          />
          {type === 'available' ? (
            <Button
              variant="contained"
              color="primary"
              onClick={() => handleStartExam(exam)}
              sx={{ ml: 2 }}
            >
              Take Exam
            </Button>
          ) : (
            <IconButton
              color="primary"
              onClick={() => handlePreviewExam(exam)}
              sx={{ ml: 2 }}
              title="Download Result PDF"
            >
              <ArrowForwardIosIcon />
            </IconButton>
          )}
        </ListItem>
      ))}
      {exams.length === 0 && (
        <ListItem>
          <ListItemText
            primary={type === 'available' ? 'No available exams' : 'No completed exams'}
            secondary={type === 'available' ? 'Check back later for new exams' : 'Take some exams to see them here'}
          />
        </ListItem>
      )}
    </List>
  );

  const ExamList = () => (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Available Exams
            </Typography>
            {renderExamList(availableExams)}
          </Paper>
        </Grid>

        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Completed Exams
            </Typography>
            {renderExamList(completedExams, 'completed')}
          </Paper>
        </Grid>
      </Grid>

      <Dialog
        open={Boolean(selectedExam)}
        onClose={() => setSelectedExam(null)}
        maxWidth="md"
        fullWidth
      >
        <DialogContent>
          {selectedExam && (
            <TakeExam
              examId={selectedExam.id}
              onComplete={handleExamComplete}
            />
          )}
        </DialogContent>
      </Dialog>
    </Container>
  );

  return (
    <Box sx={{ flexGrow: 1 }}>
      <AppBar position="static">
        <Toolbar>
          {isMobile && (
            <IconButton
              color="inherit"
              aria-label="open drawer"
              edge="start"
              onClick={handleDrawerToggle}
              sx={{ mr: 2 }}
            >
              <MenuIcon />
            </IconButton>
          )}
          {!isMobile && (
            <>
              {navigationItems.map((item) => (
                <Button
                  key={item.text}
                  color="inherit"
                  component={Link}
                  to={item.path}
                  sx={{ mr: 2 }}
                  startIcon={item.icon}
                >
                  {item.text}
                </Button>
              ))}
              <Button
                color="inherit"
                onClick={handleLogout}
                sx={{ ml: 'auto' }}
                startIcon={<LogoutIcon />}
              >
                Logout
              </Button>
            </>
          )}
        </Toolbar>
      </AppBar>

      <Drawer
        variant="temporary"
        anchor="left"
        open={mobileOpen}
        onClose={handleDrawerToggle}
        ModalProps={{
          keepMounted: true, // Better open performance on mobile.
        }}
      >
        {drawer}
      </Drawer>

      <Routes>
        <Route path="/" element={<ExamList />} />
        <Route
          path="/profile"
          element={<StudentProfile studentData={studentData} />}
        />
        <Route path="/notifications" element={<NotificationViewer />} />
      </Routes>

      {/* Preview Dialog */}
      <Dialog
        open={Boolean(previewExam)}
        onClose={() => setPreviewExam(null)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {previewExam?.title} - Review
        </DialogTitle>
        <DialogContent>
          {previewExam && (
            <List>
              {previewExam.questions.map((question, index) => {
                const studentAnswer = previewExam.result?.answers[index];
                const correctAnswer = previewExam.result?.correctAnswers[index];
                const isCorrect = studentAnswer === correctAnswer;

                return (
                  <ListItem
                    key={index}
                    sx={{
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      borderBottom: '1px solid',
                      borderColor: 'divider',
                      py: 2
                    }}
                  >
                    <Box sx={{ width: '100%', mb: 1 }}>
                      <Typography variant="subtitle1" gutterBottom>
                        Question {index + 1}: {question.question}
                      </Typography>
                      <Grid container spacing={2}>
                        {question.options.map((option, optIndex) => (
                          <Grid item xs={12} sm={6} key={optIndex}>
                            <Box
                              sx={{
                                p: 1,
                                borderRadius: 1,
                                bgcolor: 
                                  option === correctAnswer
                                    ? 'success.light'
                                    : option === studentAnswer && !isCorrect
                                    ? 'error.light'
                                    : 'background.paper',
                                display: 'flex',
                                alignItems: 'center'
                              }}
                            >
                              <Typography variant="body2">
                                {option}
                              </Typography>
                              {option === correctAnswer && (
                                <CheckCircleIcon 
                                  color="success" 
                                  sx={{ ml: 1, fontSize: 20 }} 
                                />
                              )}
                              {option === studentAnswer && !isCorrect && (
                                <CancelIcon 
                                  color="error" 
                                  sx={{ ml: 1, fontSize: 20 }} 
                                />
                              )}
                            </Box>
                          </Grid>
                        ))}
                      </Grid>
                    </Box>
                    <Box sx={{ width: '100%', mt: 1 }}>
                      <Typography 
                        variant="body2" 
                        color={isCorrect ? 'success.main' : 'error.main'}
                      >
                        {isCorrect ? '✓ Correct' : '✗ Incorrect'} - 
                        Your answer: {studentAnswer || 'Not answered'}
                      </Typography>
                      {!isCorrect && (
                        <Typography variant="body2" color="success.main">
                          Correct answer: {correctAnswer}
                        </Typography>
                      )}
                    </Box>
                  </ListItem>
                );
              })}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewExam(null)} color="primary">
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default Dashboard;
