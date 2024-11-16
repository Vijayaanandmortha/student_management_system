import React, { useState, useEffect } from 'react';
import {
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormControl,
  TextField,
  Button,
  Box,
  Alert,
  LinearProgress,
  Chip,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { db } from '../../firebase/config';
import { doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';

function ExamView({ examId, studentId }) {
  const navigate = useNavigate();
  const [exam, setExam] = useState(null);
  const [student, setStudent] = useState(null);
  const [answers, setAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [examStarted, setExamStarted] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch exam details
        const examDoc = await getDoc(doc(db, 'exams', examId));
        if (!examDoc.exists()) {
          setError('Exam not found');
          return;
        }

        const examData = examDoc.data();
        const now = Timestamp.now();

        // Check if exam is active and not expired
        if (examData.status !== 'active' || examData.endTime.toMillis() <= now.toMillis()) {
          setError('This exam is no longer available');
          return;
        }

        // Fetch student details
        const studentDoc = await getDoc(doc(db, 'students', studentId));
        if (!studentDoc.exists()) {
          setError('Student not found');
          return;
        }

        const studentData = studentDoc.data();
        // Check if student is eligible for this exam
        if (studentData.class !== examData.class || 
            studentData.section !== examData.section || 
            studentData.group !== examData.group) {
          setError('You are not eligible for this exam');
          return;
        }

        setExam(examData);
        setStudent(studentData);
        // Calculate time left based on exam duration
        const timeLeftInSeconds = Math.min(
          examData.duration * 60,
          Math.floor((examData.endTime.toMillis() - now.toMillis()) / 1000)
        );
        setTimeLeft(timeLeftInSeconds);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching data:', error);
        setError('Failed to load exam');
      }
    };

    fetchData();
  }, [examId, studentId]);

  useEffect(() => {
    if (!examStarted || timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft((prevTime) => {
        if (prevTime <= 1) {
          clearInterval(timer);
          handleSubmit(true); // Auto submit when time is up
          return 0;
        }
        return prevTime - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [examStarted, timeLeft]);

  const handleStartExam = async () => {
    try {
      // Record exam start time
      await updateDoc(doc(db, 'exam_results', `${examId}_${studentId}`), {
        startTime: Timestamp.now(),
        status: 'in_progress'
      });
      setExamStarted(true);
    } catch (error) {
      console.error('Error starting exam:', error);
      setError('Failed to start exam');
    }
  };

  const handleAnswerChange = (questionIndex, value) => {
    setAnswers(prev => ({
      ...prev,
      [questionIndex]: value
    }));
  };

  const handleSubmit = async (autoSubmit = false) => {
    try {
      const score = exam.questions.reduce((total, question, index) => {
        if (answers[index] === question.answer) {
          return total + question.points;
        }
        return total;
      }, 0);

      await updateDoc(doc(db, 'exam_results', `${examId}_${studentId}`), {
        answers,
        score,
        submitTime: Timestamp.now(),
        status: 'completed',
        autoSubmitted: autoSubmit
      });

      navigate('/student/dashboard');
    } catch (error) {
      console.error('Error submitting exam:', error);
      setError('Failed to submit exam');
    }
  };

  if (loading) {
    return (
      <Paper sx={{ p: 3 }}>
        <LinearProgress />
      </Paper>
    );
  }

  if (error) {
    return (
      <Paper sx={{ p: 3 }}>
        <Alert severity="error">{error}</Alert>
      </Paper>
    );
  }

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Student Details
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography>Name: {student.name}</Typography>
                  <Typography>Class: {student.class}</Typography>
                  <Typography>Section: {student.section}</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography>Group: {student.group}</Typography>
                  <Typography>Mobile: {student.mobileNumber}</Typography>
                  <Typography>Aadhar: {student.adharNumber}</Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h5">{exam.title}</Typography>
            <Chip 
              label={`Time Left: ${formatTime(timeLeft)}`}
              color={timeLeft < 300 ? 'error' : 'primary'}
            />
          </Box>

          {!examStarted ? (
            <Box sx={{ textAlign: 'center', my: 3 }}>
              <Typography variant="body1" gutterBottom>
                Duration: {exam.duration} minutes
              </Typography>
              <Button
                variant="contained"
                color="primary"
                onClick={handleStartExam}
              >
                Start Exam
              </Button>
            </Box>
          ) : (
            <>
              {exam.questions.map((question, index) => (
                <Card key={index} sx={{ mb: 2 }}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Question {index + 1} ({question.points} points)
                    </Typography>
                    <Typography variant="body1" gutterBottom>
                      {question.question}
                    </Typography>

                    {question.type === 'multiple_choice' ? (
                      <FormControl component="fieldset">
                        <RadioGroup
                          value={answers[index] || ''}
                          onChange={(e) => handleAnswerChange(index, e.target.value)}
                        >
                          {question.options.map((option, optionIndex) => (
                            <FormControlLabel
                              key={optionIndex}
                              value={option}
                              control={<Radio />}
                              label={option}
                            />
                          ))}
                        </RadioGroup>
                      </FormControl>
                    ) : (
                      <TextField
                        fullWidth
                        value={answers[index] || ''}
                        onChange={(e) => handleAnswerChange(index, e.target.value)}
                        placeholder="Enter your answer"
                        variant="outlined"
                      />
                    )}
                  </CardContent>
                </Card>
              ))}

              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={() => handleSubmit(false)}
                >
                  Submit Exam
                </Button>
              </Box>
            </>
          )}
        </Grid>
      </Grid>
    </Paper>
  );
}

export default ExamView;
