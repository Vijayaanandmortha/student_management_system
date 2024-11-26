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
  Checkbox,
  Fade,
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
import { styled } from '@mui/material/styles';
import { useNavigate } from 'react-router-dom';

const StyledDialog = styled(Dialog)(({ theme }) => ({
  '& .MuiDialog-paper': {
    borderRadius: 16,
    padding: theme.spacing(2),
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
    background: 'rgba(255, 255, 255, 0.95)',
    backdropFilter: 'blur(10px)',
  },
}));

const SubmitButton = styled(Button)(({ theme }) => ({
  borderRadius: 8,
  padding: theme.spacing(1, 4),
  transition: 'all 0.3s ease',
  '&:hover': {
    transform: 'translateY(-2px)',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
  },
}));

function TakeExam({ examId, onComplete }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [examData, setExamData] = useState(null);
  const [shuffledQuestions, setShuffledQuestions] = useState([]);
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
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [showInstructions, setShowInstructions] = useState(true);
  const [acceptedInstructions, setAcceptedInstructions] = useState(false);

  // Fisher-Yates shuffle algorithm
  const shuffleQuestions = (questions) => {
    const shuffled = [...questions];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

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
        
        // Shuffle questions when exam is loaded
        const shuffled = shuffleQuestions(exam.questions);
        setShuffledQuestions(shuffled);
        
        // Create a mapping of shuffled indices to original indices
        const answerMapping = {};
        shuffled.forEach((question, index) => {
          const originalIndex = exam.questions.findIndex(q => q === question);
          answerMapping[index] = originalIndex;
        });
        
        setExamData({
          ...exam,
          questions: shuffled,
          answerMapping
        });
        
        setTimeLeft(exam.duration * 60);
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
    const originalIndex = examData.answerMapping[questionIndex];
    const question = examData.questions[questionIndex];
    const processedValue = question.type === 'text_input' ? value.toLowerCase().trim() : value;
    
    setAnswers(prev => ({
      ...prev,
      [originalIndex]: processedValue // Store answer with original question index
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
    const unansweredQuestions = examData.questions.filter((_, index) => !answers[examData.answerMapping[index]]);
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
        
        // Use original question order for scoring
        examData.questions.forEach((question, shuffledIndex) => {
          const originalIndex = examData.answerMapping[shuffledIndex];
          const studentAnswer = answers[originalIndex];
          if (!studentAnswer) {
            throw new Error(`Missing answer for question ${shuffledIndex + 1}`);
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
        setIsSubmitting(false);
        if (onComplete) {
          onComplete();
        }
        // Redirect to profile page after successful submission
        navigate('/student/profile');
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

  const allQuestionsAnswered = examData?.questions?.every((_, index) => answers[examData.answerMapping[index]] !== undefined) || false;

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

  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      .exam-content {
        user-select: none !important;
        -webkit-user-select: none !important;
        -moz-user-select: none !important;
        -ms-user-select: none !important;
      }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  const handleStartExam = () => {
    if (acceptedInstructions) {
      setShowInstructions(false);
      setExamStartTime(Date.now());
    }
  };

  const renderQuestionContent = () => {
    if (!examData || !examData.questions || examData.questions.length === 0) return null;

    const currentQuestion = examData.questions[currentQuestionIndex];
    const currentAnswer = answers[examData.answerMapping[currentQuestionIndex]] || '';

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

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  if (showInstructions) {
    return (
      <Box sx={{ 
        p: { xs: 2, sm: 3 }, 
        maxWidth: 800, 
        mx: 'auto',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center'
      }}>
        <Paper 
          elevation={3} 
          sx={{ 
            p: { xs: 2, sm: 3, md: 4 },
            borderRadius: { xs: 1, sm: 2 },
            background: 'rgba(255, 255, 255, 0.9)',
            backdropFilter: 'blur(10px)',
            width: '100%'
          }}
        >
          <Typography 
            variant="h4" 
            color="primary" 
            gutterBottom 
            fontWeight="600" 
            align="center"
            sx={{
              fontSize: { xs: '1.5rem', sm: '2rem' },
              mb: { xs: 2, sm: 3 }
            }}
          >
            Exam Instructions
          </Typography>
          
          <Box sx={{ my: { xs: 2, sm: 4 } }}>
            <Typography 
              variant="h6" 
              gutterBottom 
              color="primary"
              sx={{ fontSize: { xs: '1.1rem', sm: '1.25rem' } }}
            >
              Important Guidelines:
            </Typography>
            
            <Grid container spacing={2} sx={{ mb: { xs: 2, sm: 3 } }}>
              <Grid item xs={12}>
                <Alert 
                  severity="info" 
                  sx={{ 
                    mb: 2,
                    '& .MuiAlert-message': {
                      width: '100%'
                    }
                  }}
                >
                  <Typography 
                    variant="subtitle1" 
                    gutterBottom
                    sx={{ fontSize: { xs: '0.9rem', sm: '1rem' } }}
                  >
                    Exam Details:
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={4}>
                      <Typography 
                        variant="body2"
                        sx={{ fontSize: { xs: '0.875rem', sm: '0.9rem' } }}
                      >
                        • Duration: {examData.duration} minutes
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <Typography 
                        variant="body2"
                        sx={{ fontSize: { xs: '0.875rem', sm: '0.9rem' } }}
                      >
                        • Total Questions: {examData.questions.length}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <Typography 
                        variant="body2"
                        sx={{ fontSize: { xs: '0.875rem', sm: '0.9rem' } }}
                      >
                        • Total Marks: {examData.questions.reduce((sum, q) => sum + (q.points || 1), 0)}
                      </Typography>
                    </Grid>
                  </Grid>
                </Alert>
              </Grid>
              
              <Grid item xs={12}>
                <Box sx={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: { xs: 1, sm: 1.5 } 
                }}>
                  {[
                    'Do not refresh or close the browser window during the exam.',
                    'Ensure stable internet connectivity throughout the exam.',
                    'Answer all questions before submitting the exam.',
                    'You can navigate between questions using the navigation panel.',
                    'The exam will auto-submit when the time expires.',
                    'Copying or pasting text during the exam is not allowed.'
                  ].map((instruction, index) => (
                    <Typography 
                      key={index}
                      variant="body1" 
                      sx={{ 
                        fontSize: { xs: '0.875rem', sm: '1rem' },
                        display: 'flex',
                        alignItems: 'flex-start',
                        '&:before': {
                          content: '"•"',
                          marginRight: '8px',
                          color: 'primary.main'
                        }
                      }}
                    >
                      {instruction}
                    </Typography>
                  ))}
                </Box>
              </Grid>
            </Grid>

            <Divider sx={{ my: { xs: 2, sm: 3 } }} />

            <Box sx={{ mt: { xs: 2, sm: 4 } }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={acceptedInstructions}
                    onChange={(e) => setAcceptedInstructions(e.target.checked)}
                    color="primary"
                    sx={{ 
                      '& .MuiSvgIcon-root': { 
                        fontSize: { xs: 20, sm: 24 } 
                      }
                    }}
                  />
                }
                label={
                  <Typography 
                    variant="body1"
                    sx={{ 
                      fontSize: { xs: '0.875rem', sm: '1rem' },
                      lineHeight: 1.5
                    }}
                  >
                    I have read and understood all the instructions, and I agree to follow them.
                  </Typography>
                }
                sx={{ 
                  alignItems: 'flex-start',
                  mr: 0
                }}
              />
            </Box>

            <Box sx={{ 
              mt: { xs: 3, sm: 4 }, 
              display: 'flex', 
              justifyContent: 'center'
            }}>
              <Button
                variant="contained"
                color="primary"
                size="large"
                disabled={!acceptedInstructions}
                onClick={handleStartExam}
                sx={{
                  px: { xs: 3, sm: 4 },
                  py: { xs: 1, sm: 1.5 },
                  borderRadius: { xs: 1, sm: 2 },
                  fontSize: { xs: '0.9rem', sm: '1.1rem' },
                  transition: 'all 0.3s ease',
                  width: { xs: '100%', sm: 'auto' },
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: '0 6px 20px rgba(0, 0, 0, 0.15)',
                  },
                }}
              >
                Start Exam
              </Button>
            </Box>
          </Box>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ 
      p: { xs: 0.5, sm: 1 }, 
      minHeight: '100vh',
      backgroundColor: '#f5f5f5'
    }} className="exam-content">
      <Box sx={{ width: '100%' }}>
        {/* Exam Header */}
        <Paper 
          elevation={1} 
          sx={{ 
            p: { xs: 1, sm: 1.5 }, 
            mb: { xs: 0.5, sm: 1 },
            borderRadius: 0
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
            mb: { xs: 0.5, sm: 1 },
            borderRadius: 0
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
                    color={answers[examData.answerMapping[index]] ? "success" : "primary"}
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
        <Box sx={{ display: 'flex', gap: { xs: 0.5, sm: 1 }, flexDirection: { xs: 'column', md: 'row' } }}>
          {/* Questions List */}
          <Box sx={{ flex: 1 }}>
            <Paper 
              elevation={1} 
              sx={{ 
                p: { xs: 1.5, sm: 2 },
                borderRadius: 0,
                height: '100%',
                backgroundColor: '#ffffff'
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
          </Box>

          {/* Question Overview Panel */}
          <Box sx={{ 
            width: { xs: '100%', md: '300px' },
            height: { md: 'calc(100vh - 140px)' }
          }}>
            <Paper 
              elevation={1} 
              sx={{ 
                p: { xs: 1.5, sm: 2 }, 
                position: { md: 'sticky' }, 
                top: 16,
                borderRadius: 0,
                height: '100%',
                backgroundColor: '#ffffff'
              }}
            >
              <Typography variant="body2" gutterBottom sx={{ fontSize: '0.85rem' }}>
                Questions Overview
              </Typography>
              <Grid container spacing={1} sx={{ mb: 1.5 }}>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: '0.7rem' }}>
                    Total
                  </Typography>
                  <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>
                    {examData.questions.length}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: '0.7rem' }}>
                    Answered
                  </Typography>
                  <Typography variant="body2" color="success.main" sx={{ fontSize: '0.85rem' }}>
                    {Object.keys(answers).length}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
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
                      color={answers[examData.answerMapping[index]] ? "success" : "primary"}
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
          </Box>
        </Box>
      </Box>

      {errorMessage && (
        <Alert severity="error" sx={{ mt: 2, mb: 2 }}>
          {errorMessage}
        </Alert>
      )}

      <StyledDialog
        open={confirmDialogOpen}
        onClose={handleConfirmDialogClose}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Typography variant="h5" color="primary" align="center" fontWeight="600">
            Confirm Exam Submission
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ py: 2 }}>
            <Alert severity="info" sx={{ mb: 3 }}>
              <Typography variant="body1">
                Please review your answers before submitting. Once submitted, you cannot modify your answers.
              </Typography>
            </Alert>
            
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle1" gutterBottom color="text.secondary">
                Exam Summary:
              </Typography>
              <Grid container spacing={2} sx={{ pl: 2 }}>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">
                    Total Questions:
                  </Typography>
                  <Typography variant="body1" fontWeight="500">
                    {examData?.questions?.length || 0}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">
                    Answered Questions:
                  </Typography>
                  <Typography variant="body1" fontWeight="500">
                    {Object.keys(answers).length}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">
                    Time Remaining:
                  </Typography>
                  <Typography variant="body1" fontWeight="500">
                    {Math.floor(timeLeft / 60)}m {timeLeft % 60}s
                  </Typography>
                </Grid>
              </Grid>
            </Box>

            <Divider sx={{ my: 2 }} />

            <FormControlLabel
              control={
                <Checkbox
                  checked={confirmChecked}
                  onChange={(e) => setConfirmChecked(e.target.checked)}
                  color="primary"
                />
              }
              label={
                <Typography variant="body2">
                  I confirm that I have reviewed all my answers and want to submit the exam
                </Typography>
              }
              sx={{ mt: 1 }}
            />

            {errorMessage && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {errorMessage}
              </Alert>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, justifyContent: 'center', gap: 2 }}>
          <SubmitButton
            onClick={handleConfirmDialogClose}
            variant="outlined"
            color="primary"
          >
            Review Answers
          </SubmitButton>
          <SubmitButton
            onClick={handleSubmit}
            variant="contained"
            color="primary"
            disabled={!confirmChecked || isSubmitting}
            endIcon={isSubmitting && <CircularProgress size={20} color="inherit" />}
          >
            {isSubmitting ? 'Submitting...' : 'Submit Exam'}
          </SubmitButton>
        </DialogActions>
      </StyledDialog>
    </Box>
  );
}

export default TakeExam;
