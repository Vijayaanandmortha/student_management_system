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
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Drawer,
  useTheme,
  useMediaQuery,
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

function Dashboard() {
  const navigate = useNavigate();
  const [availableExams, setAvailableExams] = useState([]);
  const [completedExams, setCompletedExams] = useState([]);
  const [selectedExam, setSelectedExam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [studentData, setStudentData] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);
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

        // Get available exams for student's class, section and group
        const examsQuery = query(
          collection(db, 'exams'),
          where('class', '==', studentData.class),
          where('section', '==', studentData.section),
          where('group', '==', studentData.group),
          where('status', '==', 'active')
        );
        const examsDocs = await getDocs(examsQuery);
        const now = Timestamp.now();
        const examsData = examsDocs.docs
          .map(doc => ({
            id: doc.id,
            ...doc.data()
          }))
          .filter(exam => {
            // Filter out expired exams
            if (!exam.endTime || !(exam.endTime instanceof Timestamp)) {
              return false;
            }
            return exam.endTime.toMillis() > now.toMillis();
          });

        // Get completed exams
        const resultsQuery = query(
          collection(db, 'exam_results'),
          where('studentId', '==', studentData.mobileNumber)
        );
        const resultsDocs = await getDocs(resultsQuery);
        const completedExamIds = resultsDocs.docs.map(doc => doc.data().examId);
        const examResults = {};
        resultsDocs.docs.forEach(doc => {
          const data = doc.data();
          examResults[data.examId] = {
            score: data.score,
            answers: data.answers || {}
          };
        });

        // Filter available exams
        const available = examsData.filter(exam => !completedExamIds.includes(exam.id));
        const completed = examsData.filter(exam => completedExamIds.includes(exam.id))
          .map(exam => ({
            ...exam,
            result: examResults[exam.id]
          }));

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

  const navigationItems = [
    { text: 'Exams', icon: <HomeIcon />, path: '/student' },
    { text: 'Profile', icon: <PersonIcon />, path: '/student/profile' },
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
                    color="text.secondary"
                  >
                    Score: {Object.keys(exam.result.answers).filter(key => 
                      exam.questions[key] && 
                      exam.result.answers[key] === exam.questions[key].answer
                    ).length} / {exam.questions.length}
                  </Typography>
                )}
              </React.Fragment>
            }
          />
          {type === 'available' && (
            <Button
              variant="contained"
              color="primary"
              onClick={() => handleStartExam(exam)}
              sx={{ ml: 2 }}
            >
              Take Exam
            </Button>
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
      </Routes>
    </Box>
  );
}

export default Dashboard;
