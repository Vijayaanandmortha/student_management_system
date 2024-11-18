import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Typography,
  Box,
  Button,
  RadioGroup,
  FormControlLabel,
  Radio,
  IconButton,
  Grid,
  Stack,
  CircularProgress,
  Alert,
  Divider,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import InfoIcon from '@mui/icons-material/Info';
import { 
  doc, 
  getDoc, 
  addDoc, 
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
  runTransaction,
  Timestamp
} from 'firebase/firestore';
import { auth, db } from '../../firebase/config';

function TakeExam({ examId, onComplete }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [examData, setExamData] = useState(null);
  const [answers, setAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [examStartTime, setExamStartTime] = useState(null);
  const [examSubmitted, setExamSubmitted] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [showProgress, setShowProgress] = useState(false);
  const [attemptCount, setAttemptCount] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const fetchExamData = async () => {
      try {
        const examDoc = await getDoc(doc(db, 'exams', examId));
        if (!examDoc.exists()) {
          setError('Exam not found');
          setLoading(false);
          return;
        }

        const exam = { id: examDoc.id, ...examDoc.data() };
        setExamData(exam);
        setTimeLeft(exam.duration * 60);
        setExamStartTime(Date.now());
        setLoading(false);
      } catch (error) {
        console.error('Error fetching exam:', error);
        setError('Failed to load exam');
        setLoading(false);
      }
    };

    fetchExamData();
  }, [examId]);

  useEffect(() => {
    if (!timeLeft || !examStartTime || examSubmitted) return;

    const timer = setInterval(() => {
      const now = Date.now();
      const elapsed = Math.floor((now - examStartTime) / 1000);
      const remaining = examData.duration * 60 - elapsed;

      if (remaining <= 0) {
        clearInterval(timer);
        handleSubmit();
      } else {
        setTimeLeft(remaining);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, examStartTime, examSubmitted]);

  const handleAnswerChange = (questionIndex, value) => {
    const question = examData.questions[questionIndex];
    const processedValue = question.type === 'text_input' ? value.toLowerCase().trim() : value;
    
    setAnswers(prev => ({
      ...prev,
      [questionIndex]: processedValue
    }));
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < examData.questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  };

  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };

  const handleConfirmSubmit = () => {
    setConfirmDialogOpen(true);
  };

  const handleConfirmDialogClose = () => {
    setConfirmDialogOpen(false);
  };

  const validateAnswers = () => {
    const unansweredQuestions = examData.questions.filter((_, index) => !answers[index]);
    if (unansweredQuestions.length > 0) {
      setErrorMessage(`Please answer all questions. ${unansweredQuestions.length} questions remaining.`);
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    try {
      if (examSubmitted || isSubmitting) return;
      
      if (!validateAnswers()) return;

      setIsSubmitting(true);
      const endTime = Date.now();
      const timeTaken = Math.floor((endTime - examStartTime) / 1000);

      const lockRef = doc(db, 'examLocks', `${examId}_${auth.currentUser.uid}`);
      
      await runTransaction(db, async (transaction) => {
        const lockDoc = await transaction.get(lockRef);
        if (lockDoc.exists()) {
          throw new Error('Exam is already being submitted');
        }

        const studentQuery = query(
          collection(db, 'students'),
          where('uid', '==', auth.currentUser.uid)
        );
        const studentSnapshot = await getDocs(studentQuery);
        if (studentSnapshot.empty) {
          throw new Error('Student data not found');
        }
        const student = studentSnapshot.docs[0].data();

        let score = 0;
        let totalPoints = 0;
        
        examData.questions.forEach((question, index) => {
          const studentAnswer = answers[index];
          if (!studentAnswer) {
            throw new Error(`Missing answer for question ${index + 1}`);
          }

          const points = question.points || 1;
          totalPoints += points;

          const correctAnswer = question.type === 'text_input' 
            ? question.answer.toLowerCase().trim()
            : question.answer;

          if (studentAnswer === correctAnswer) {
            score += points;
          }
        });

        if (totalPoints === 0) {
          throw new Error('Invalid exam configuration: total points cannot be 0');
        }

        // Calculate percentage
        const percentage = Math.round((score / totalPoints) * 100);

        // Save result with proper timestamp
        const resultData = {
          examId,
          studentId: student.mobileNumber,
          studentName: student.name,
          studentClass: student.class,
          studentSection: student.section,
          studentGroup: student.group,
          answers,
          score: percentage,
          timeTaken,
          submitTime: Timestamp.now(),  // Using Firestore Timestamp
          examTitle: examData.title,
        };

        transaction.set(lockRef, {
          timestamp: serverTimestamp(),
          studentId: student.mobileNumber
        });

        await addDoc(collection(db, 'examResults'), resultData);

        setExamSubmitted(true);
        if (onComplete) {
          onComplete();
        }

      });

    } catch (error) {
      console.error('Error submitting exam:', error);
      setErrorMessage(error.message || 'Failed to submit exam. Please try again.');
      
      if (error.code === 'failed-precondition' || error.code === 'unavailable') {
        setTimeout(() => {
          setIsSubmitting(false);
          handleSubmit();
        }, 3000);
      } else {
        setIsSubmitting(false);
      }
    }
  };

  const allQuestionsAnswered = examData?.questions?.every((_, index) => answers[index] !== undefined) || false;

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (!examSubmitted && attemptCount < 3) {
        e.preventDefault();
        e.returnValue = '';
        setAttemptCount(prev => prev + 1);
        
        if (attemptCount === 2) {
          handleSubmit();
        }
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [examSubmitted, attemptCount]);

  useEffect(() => {
    const handlePopState = (e) => {
      if (!examSubmitted) {
        window.history.pushState(null, null, window.location.pathname);
        if (attemptCount < 3) {
          setAttemptCount(prev => prev + 1);
          alert(`Warning: You have ${3 - attemptCount} attempts remaining before the exam is auto-submitted.`);
          
          if (attemptCount === 2) {
            handleSubmit();
          }
        }
      }
    };

    window.history.pushState(null, null, window.location.pathname);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [examSubmitted, attemptCount]);

  const renderQuestionContent = () => {
    if (!examData || !examData.questions || examData.questions.length === 0) return null;

    const currentQuestion = examData.questions[currentQuestionIndex];
    const currentAnswer = answers[currentQuestionIndex] || '';

    return (
      <Box sx={{ mb: 1.5 }}>
        <Typography variant="caption" color="text.secondary" gutterBottom display="block">
          Question {currentQuestionIndex + 1} of {examData.questions.length}
        </Typography>
        <Typography variant="body2" sx={{ mb: 1.5, fontWeight: 500, fontSize: '0.9rem' }}>
          {currentQuestion.question}
        </Typography>

        {currentQuestion.type === 'text_input' ? (
          <TextField
            fullWidth
            variant="outlined"
            value={currentAnswer}
            onChange={(e) => handleAnswerChange(currentQuestionIndex, e.target.value)}
            disabled={examSubmitted}
            placeholder="Type your answer here..."
            size="small"
            sx={{
              mt: 1,
              '& .MuiOutlinedInput-root': {
                backgroundColor: 'background.paper',
                fontSize: '0.9rem',
              }
            }}
          />
        ) : (
          <RadioGroup
            value={currentAnswer}
            onChange={(e) => handleAnswerChange(currentQuestionIndex, e.target.value)}
          >
            <Grid container spacing={1}>
              {currentQuestion.options.map((option, index) => (
                <Grid item xs={12} key={index}>
                  <FormControlLabel
                    value={option}
                    control={<Radio size="small" />}
                    label={option}
                    disabled={examSubmitted}
                    sx={{
                      width: '100%',
                      m: 0,
                      p: 0.75,
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 1,
                      '&:hover': {
                        backgroundColor: 'action.hover',
                      },
                    }}
                  />
                </Grid>
              ))}
            </Grid>
          </RadioGroup>
        )}
      </Box>
    );
  };

  return (
    <Box 
      sx={{ 
        minHeight: '100vh',
        bgcolor: 'background.default',
        pt: { xs: 1, sm: 2 },
        pb: { xs: 2, sm: 3 }
      }}
    >
      <Container 
        maxWidth={false} 
        sx={{ 
          maxWidth: '1400px',
          px: { xs: 1, sm: 2, md: 3 }
        }}
      >
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 1 }}>
            <CircularProgress size={24} />
          </Box>
        ) : error ? (
          <Alert severity="error" sx={{ mt: 1 }}>
            {error}
          </Alert>
        ) : (
          <>
            {/* Exam Header */}
            <Paper 
              elevation={1} 
              sx={{ 
                p: { xs: 1.5, sm: 2 }, 
                mb: { xs: 1, sm: 2 },
                borderRadius: 1
              }}
            >
              <Box sx={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 0.5
              }}>
                <Typography variant="body1" sx={{ fontSize: '0.9rem', fontWeight: 500 }}>
                  {examData.title}
                </Typography>
                <Typography 
                  variant="body2" 
                  color={timeLeft < 300 ? 'error' : 'primary'}
                  sx={{ fontWeight: 500, fontSize: '0.9rem' }}
                >
                  Time Left: {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
                </Typography>
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                Progress: {Object.keys(answers).length} of {examData.questions.length} questions answered
              </Typography>
            </Paper>

            {/* Question Progress Bar */}
            <Paper 
              elevation={1} 
              sx={{ 
                p: 1, 
                mb: { xs: 1, sm: 2 },
                borderRadius: 1
              }}
            >
              <Box sx={{ overflowX: 'auto', py: 0.5 }}>
                <Grid 
                  container 
                  spacing={0.5} 
                  wrap="nowrap" 
                  sx={{ minWidth: { xs: 'max-content', sm: 'auto' } }}
                >
                  {examData.questions.map((_, index) => (
                    <Grid item key={index}>
                      <Button
                        variant={currentQuestionIndex === index ? "contained" : "outlined"}
                        color={answers[index] ? "success" : "primary"}
                        onClick={() => setCurrentQuestionIndex(index)}
                        sx={{ 
                          minWidth: '26px',
                          height: '26px',
                          p: 0,
                          borderRadius: '50%',
                          fontSize: '0.7rem'
                        }}
                      >
                        {index + 1}
                      </Button>
                    </Grid>
                  ))}
                </Grid>
              </Box>
            </Paper>

            {/* Questions Section */}
            <Grid container spacing={{ xs: 1, sm: 2 }}>
              {/* Questions List */}
              <Grid item xs={12} md={8}>
                <Paper 
                  elevation={1} 
                  sx={{ 
                    p: { xs: 1.5, sm: 2 },
                    borderRadius: 1,
                    height: '100%'
                  }}
                >
                  {renderQuestionContent()}
                  <Box sx={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    mt: 2,
                    gap: 0.5
                  }}>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={handlePreviousQuestion}
                      disabled={currentQuestionIndex === 0}
                      startIcon={<NavigateBeforeIcon sx={{ fontSize: '1rem' }} />}
                      sx={{ fontSize: '0.8rem', py: 0.5 }}
                    >
                      Prev
                    </Button>
                    {currentQuestionIndex === examData.questions.length - 1 ? (
                      <Button
                        size="small"
                        variant="contained"
                        color="primary"
                        onClick={handleConfirmSubmit}
                        disabled={examSubmitted || !allQuestionsAnswered}
                        sx={{ fontSize: '0.8rem', py: 0.5 }}
                      >
                        Submit Exam
                      </Button>
                    ) : (
                      <Button
                        size="small"
                        variant="contained"
                        onClick={handleNextQuestion}
                        endIcon={<NavigateNextIcon sx={{ fontSize: '1rem' }} />}
                        sx={{ fontSize: '0.8rem', py: 0.5 }}
                      >
                        Next
                      </Button>
                    )}
                  </Box>
                </Paper>
              </Grid>

              {/* Question Overview Panel */}
              <Grid item xs={12} md={4}>
                <Paper 
                  elevation={1} 
                  sx={{ 
                    p: { xs: 1.5, sm: 2 }, 
                    position: { md: 'sticky' }, 
                    top: 16,
                    height: 'fit-content',
                    borderRadius: 1
                  }}
                >
                  <Typography variant="body2" gutterBottom sx={{ fontSize: '0.85rem' }}>
                    Questions Overview
                  </Typography>
                  <Grid container spacing={1} sx={{ mb: 1.5 }}>
                    <Grid item xs={4}>
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: '0.7rem' }}>
                        Total
                      </Typography>
                      <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>
                        {examData.questions.length}
                      </Typography>
                    </Grid>
                    <Grid item xs={4}>
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: '0.7rem' }}>
                        Answered
                      </Typography>
                      <Typography variant="body2" color="success.main" sx={{ fontSize: '0.85rem' }}>
                        {Object.keys(answers).length}
                      </Typography>
                    </Grid>
                    <Grid item xs={4}>
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: '0.7rem' }}>
                        Remaining
                      </Typography>
                      <Typography variant="body2" color="error.main" sx={{ fontSize: '0.85rem' }}>
                        {examData.questions.length - Object.keys(answers).length}
                      </Typography>
                    </Grid>
                  </Grid>

                  <Divider sx={{ my: 1.5 }} />

                  <Typography 
                    variant="caption" 
                    color="text.secondary" 
                    display="block" 
                    gutterBottom 
                    sx={{ fontSize: '0.7rem' }}
                  >
                    Quick Navigation
                  </Typography>
                  <Grid container spacing={0.5}>
                    {examData.questions.map((_, index) => (
                      <Grid item xs={2} key={index}>
                        <Button
                          size="small"
                          variant={currentQuestionIndex === index ? "contained" : "outlined"}
                          color={answers[index] ? "success" : "primary"}
                          onClick={() => setCurrentQuestionIndex(index)}
                          sx={{ 
                            minWidth: '24px',
                            height: '24px',
                            p: 0,
                            fontSize: '0.7rem'
                          }}
                        >
                          {index + 1}
                        </Button>
                      </Grid>
                    ))}
                  </Grid>

                  {!allQuestionsAnswered && (
                    <Alert 
                      severity="info" 
                      sx={{ mt: 1.5 }}
                      icon={<InfoIcon sx={{ fontSize: '0.9rem' }} />}
                    >
                      <Typography variant="caption" sx={{ fontSize: '0.75rem' }}>
                        Please answer all questions before submitting.
                      </Typography>
                    </Alert>
                  )}
                </Paper>
              </Grid>
            </Grid>
          </>
        )}
      </Container>

      {errorMessage && (
        <Alert severity="error" sx={{ mt: 2, mb: 2 }}>
          {errorMessage}
        </Alert>
      )}

      <Dialog
        open={confirmDialogOpen}
        onClose={handleConfirmDialogClose}
      >
        <DialogTitle>Submit Exam</DialogTitle>
        <DialogContent>
          Are you sure you want to submit your exam? This action cannot be undone.
        </DialogContent>
        <DialogActions>
          <Button onClick={handleConfirmDialogClose}>Cancel</Button>
          <Button 
            onClick={() => {
              handleConfirmDialogClose();
              handleSubmit();
            }} 
            color="primary"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Submitting...' : 'Submit'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default TakeExam;
