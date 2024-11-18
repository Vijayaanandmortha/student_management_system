import React, { useState, useEffect } from 'react';
import {
  Paper,
  TextField,
  Button,
  Box,
  Typography,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Dialog,
  Tab,
  Tabs,
  Alert,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import StopIcon from '@mui/icons-material/Stop';
import EditIcon from '@mui/icons-material/Edit';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { useFormik } from 'formik';
import * as yup from 'yup';
import { db } from '../../firebase/config';
import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  updateDoc,
  doc,
  deleteDoc,
  Timestamp,
  onSnapshot,
  writeBatch
} from 'firebase/firestore';
import { 
  CLASS_OPTIONS, 
  SECTION_OPTIONS, 
  GROUP_OPTIONS 
} from '../../constants/formOptions';
import PrintExamResult from './PrintExamResult';

const validationSchema = yup.object({
  title: yup.string().required('Exam title is required'),
  class: yup.string().required('Class is required'),
  section: yup.string().required('Section is required'),
  group: yup.string().required('Group is required'),
  duration: yup
    .number()
    .required('Duration is required')
    .positive('Duration must be positive'),
  expiryDate: yup
    .date()
    .required('Expiry date is required')
    .min(new Date(), 'Expiry date must be in the future'),
});

const questionTypes = [
  { value: 'multiple_choice', label: 'Multiple Choice' },
  { value: 'text_input', label: 'Text Input' },
];

function ManageExams() {
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [tabValue, setTabValue] = useState(0);
  const [examResults, setExamResults] = useState([]);
  const [exams, setExams] = useState([]);
  const [activeExams, setActiveExams] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedExam, setSelectedExam] = useState('');
  const [questions, setQuestions] = useState([
    { type: 'multiple_choice', question: '', options: [''], answer: '', points: 1 },
  ]);
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [selectedResult, setSelectedResult] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch all students
        const studentsSnapshot = await getDocs(collection(db, 'students'));
        const studentsData = studentsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setStudents(studentsData);

        // Fetch all exams
        fetchExams();

        // Set up real-time listener for exam results
        const resultsQuery = query(collection(db, 'examResults'));
        const unsubscribe = onSnapshot(resultsQuery, (snapshot) => {
          const resultsData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            submitTime: doc.data().submitTime || null // Ensure submitTime exists
          }));
          setExamResults(resultsData);
        });

        return () => unsubscribe();
      } catch (error) {
        console.error('Error fetching data:', error);
        setError('Failed to fetch data');
      }
    };

    fetchData();
  }, []);

  const fetchExams = async () => {
    try {
      // Fetch all exams
      const examsSnapshot = await getDocs(collection(db, 'exams'));
      const examsData = examsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Split exams into active and all exams
      const active = examsData.filter(exam => exam.status === 'active');
      setActiveExams(active);
      setExams(examsData);
    } catch (error) {
      console.error('Error fetching exams:', error);
      setError('Failed to fetch exams');
    }
  };

  // Fetch active exams - Split into two queries to avoid composite index requirement
  useEffect(() => {
    const fetchData = async () => {
      try {
        const now = Timestamp.now();
        const activeExamsQuery = query(
          collection(db, 'exams'),
          where('status', '==', 'active')
        );
        const activeExamsSnapshot = await getDocs(activeExamsQuery);
        const activeExamsData = activeExamsSnapshot.docs
          .map(doc => ({
            id: doc.id,
            ...doc.data()
          }))
          .filter(exam => {
            // Check if endTime exists and is a valid Timestamp
            if (!exam.endTime || !(exam.endTime instanceof Timestamp)) {
              return false;
            }
            return exam.endTime.toMillis() > now.toMillis();
          });
        
        setActiveExams(activeExamsData);
      } catch (error) {
        console.error('Error fetching active exams:', error);
        setError('Failed to fetch active exams');
      }
    };
    fetchData();
  }, []);

  // Set up interval to check for exam end times
  useEffect(() => {
    const interval = setInterval(async () => {
      const currentTime = Timestamp.now();
      activeExams.forEach(async (exam) => {
        if (exam.endTime.toMillis() <= currentTime.toMillis()) {
          try {
            const examRef = doc(db, 'exams', exam.id);
            await updateDoc(examRef, {
              status: 'completed'
            });
            // Update local state
            setActiveExams(prev => prev.filter(e => e.id !== exam.id));
          } catch (error) {
            console.error('Error updating exam status:', error);
          }
        }
      });
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [activeExams]);

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const handleAddQuestion = () => {
    setQuestions([
      ...questions,
      { type: 'multiple_choice', question: '', options: [''], answer: '', points: 1 },
    ]);
  };

  const handleRemoveQuestion = (index) => {
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const handleQuestionChange = (index, field, value) => {
    const newQuestions = [...questions];
    newQuestions[index][field] = value;
    setQuestions(newQuestions);
  };

  const handleAddOption = (questionIndex) => {
    const newQuestions = [...questions];
    newQuestions[questionIndex].options.push('');
    setQuestions(newQuestions);
  };

  const handleRemoveOption = (questionIndex, optionIndex) => {
    const newQuestions = [...questions];
    newQuestions[questionIndex].options = newQuestions[questionIndex].options.filter(
      (_, i) => i !== optionIndex
    );
    setQuestions(newQuestions);
  };

  const handleOptionChange = (questionIndex, optionIndex, value) => {
    const newQuestions = [...questions];
    newQuestions[questionIndex].options[optionIndex] = value;
    setQuestions(newQuestions);
  };

  const handleStopExam = async (examId) => {
    try {
      const examRef = doc(db, 'exams', examId);
      await updateDoc(examRef, {
        status: 'completed',
        endTime: Timestamp.now()
      });
      
      // Update local state
      setActiveExams(prev => prev.filter(exam => exam.id !== examId));
      setSuccess('Exam stopped successfully');
    } catch (error) {
      console.error('Error stopping exam:', error);
      setError('Failed to stop exam');
    }
  };

  const handleDeleteExam = async (examId) => {
    try {
      await deleteDoc(doc(db, 'exams', examId));
      
      // Update local state
      setExams(prev => prev.filter(exam => exam.id !== examId));
      setSuccess('Exam deleted successfully');
    } catch (error) {
      console.error('Error deleting exam:', error);
      setError('Failed to delete exam');
    }
  };

  const handlePrint = (student) => {
    const result = examResults.find(r => 
      r.studentId === student.id && 
      r.examId === selectedExam
    );
    if (result) {
      setSelectedResult({
        student,
        exam: exams.find(e => e.id === selectedExam),
        result
      });
      setPrintDialogOpen(true);
    }
  };

  const handleClosePrintDialog = () => {
    setPrintDialogOpen(false);
    setSelectedResult(null);
  };

  const formik = useFormik({
    initialValues: {
      title: '',
      class: '',
      section: '',
      group: '',
      duration: '',
      expiryDate: '',
    },
    validationSchema: validationSchema,
    onSubmit: async (values) => {
      try {
        setError('');
        setSuccess('');

        // Validate questions
        if (questions.length === 0) {
          setError('Please add at least one question');
          return;
        }

        // Calculate end time based on expiry date
        const expiryTimestamp = Timestamp.fromDate(new Date(values.expiryDate));

        const examData = {
          title: values.title,
          class: values.class,
          section: values.section,
          group: values.group,
          duration: Number(values.duration),
          questions: questions,
          status: 'active',
          createdAt: Timestamp.now(),
          endTime: expiryTimestamp, // Use expiry date as end time
        };

        await addDoc(collection(db, 'exams'), examData);
        setSuccess('Exam created successfully');
        formik.resetForm();
        setQuestions([
          { type: 'multiple_choice', question: '', options: [''], answer: '', points: 1 },
        ]);
      } catch (error) {
        console.error('Error creating exam:', error);
        setError('Failed to create exam');
      }
    },
  });

  const renderQuestionFields = (question, index) => (
    <Paper key={index} elevation={2} sx={{ p: 2, mb: 2 }}>
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <Typography variant="h6">Question {index + 1}</Typography>
        </Grid>
        <Grid item xs={11}>
          <FormControl fullWidth>
            <InputLabel>Question Type</InputLabel>
            <Select
              value={question.type}
              onChange={(e) => handleQuestionChange(index, 'type', e.target.value)}
              label="Question Type"
            >
              {questionTypes.map((type) => (
                <MenuItem key={type.value} value={type.value}>
                  {type.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={1}>
          <IconButton
            color="error"
            onClick={() => handleRemoveQuestion(index)}
            disabled={questions.length === 1}
          >
            <DeleteIcon />
          </IconButton>
        </Grid>
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Question"
            value={question.question}
            onChange={(e) => handleQuestionChange(index, 'question', e.target.value)}
          />
        </Grid>
        {question.type === 'multiple_choice' && (
          <Grid item xs={12}>
            {question.options.map((option, optionIndex) => (
              <Grid container spacing={1} key={optionIndex} sx={{ mb: 1 }}>
                <Grid item xs={11}>
                  <TextField
                    fullWidth
                    label={`Option ${optionIndex + 1}`}
                    value={option}
                    onChange={(e) =>
                      handleOptionChange(index, optionIndex, e.target.value)
                    }
                  />
                </Grid>
                <Grid item xs={1}>
                  <IconButton
                    color="error"
                    onClick={() => handleRemoveOption(index, optionIndex)}
                    disabled={question.options.length === 1}
                  >
                    <DeleteIcon />
                  </IconButton>
                </Grid>
              </Grid>
            ))}
            <Button
              startIcon={<AddIcon />}
              onClick={() => handleAddOption(index)}
              sx={{ mt: 1 }}
            >
              Add Option
            </Button>
          </Grid>
        )}
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Correct Answer"
            value={question.answer}
            onChange={(e) => handleQuestionChange(index, 'answer', e.target.value)}
          />
        </Grid>
        <Grid item xs={12}>
          <TextField
            fullWidth
            type="number"
            label="Points"
            value={question.points}
            onChange={(e) => handleQuestionChange(index, 'points', parseInt(e.target.value))}
          />
        </Grid>
      </Grid>
    </Paper>
  );

  const renderActiveExams = () => (
    <Box sx={{ mt: 3 }}>
      <Typography variant="h6" gutterBottom>
        Currently Running Exams
      </Typography>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Exam Title</TableCell>
              <TableCell>Class</TableCell>
              <TableCell>Section</TableCell>
              <TableCell>Group</TableCell>
              <TableCell>Start Time</TableCell>
              <TableCell>End Time</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {activeExams && activeExams.map((exam) => (
              <TableRow key={exam.id}>
                <TableCell>{exam.title || 'N/A'}</TableCell>
                <TableCell>{exam.class || 'N/A'}</TableCell>
                <TableCell>{exam.section || 'N/A'}</TableCell>
                <TableCell>{exam.group || 'N/A'}</TableCell>
                <TableCell>
                  {exam?.startTime?.toDate ? exam.startTime.toDate().toLocaleString() : 'Not set'}
                </TableCell>
                <TableCell>
                  {exam?.endTime?.toDate ? exam.endTime.toDate().toLocaleString() : 'Not set'}
                </TableCell>
                <TableCell>
                  <IconButton
                    color="error"
                    onClick={() => handleStopExam(exam.id)}
                    title="Stop Exam"
                  >
                    <StopIcon />
                  </IconButton>
                  <IconButton
                    color="error"
                    onClick={() => handleDeleteExam(exam.id)}
                    title="Delete Exam"
                  >
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {(!activeExams || activeExams.length === 0) && (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  No active exams
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );

  const getFilteredStudents = () => {
    if (!selectedExam) return { attendedStudents: [], notAttendedStudents: [] };

    const selectedExamData = exams.find(exam => exam.id === selectedExam);
    if (!selectedExamData) return { attendedStudents: [], notAttendedStudents: [] };

    // Get eligible students based on class, section, and group
    const eligibleStudents = students.filter(student =>
      student.class === selectedExamData.class &&
      student.section === selectedExamData.section &&
      student.group === selectedExamData.group
    );

    // Get students who have attempted the exam
    const attemptedStudentIds = examResults
      .filter(result => result.examId === selectedExam)
      .map(result => result.studentId);

    // Split students into attended and not attended
    const attended = eligibleStudents.filter(student =>
      attemptedStudentIds.includes(student.mobileNumber)
    );
    const notAttended = eligibleStudents.filter(student =>
      !attemptedStudentIds.includes(student.mobileNumber)
    );

    return {
      attendedStudents: attended,
      notAttendedStudents: notAttended
    };
  };

  const renderExamMonitoring = () => {
    const { attendedStudents, notAttendedStudents } = getFilteredStudents();
    const allStudents = [...attendedStudents, ...notAttendedStudents];

    return (
      <>
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12}>
            <FormControl fullWidth>
              <InputLabel>Select Exam</InputLabel>
              <Select
                value={selectedExam || ''}
                onChange={(e) => setSelectedExam(e.target.value)}
                label="Select Exam"
              >
                {exams.map((exam) => (
                  <MenuItem key={exam.id} value={exam.id}>
                    {exam.title}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        </Grid>

        {selectedExam && (
          <>
            <Typography variant="h6" gutterBottom>
              Exam Details
            </Typography>
            <Paper sx={{ p: 2, mb: 3 }}>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Typography variant="body1">
                    Title: {exams.find(exam => exam.id === selectedExam)?.title}
                  </Typography>
                  <Typography variant="body1">
                    Class: {exams.find(exam => exam.id === selectedExam)?.class} | 
                    Section: {exams.find(exam => exam.id === selectedExam)?.section} | 
                    Group: {exams.find(exam => exam.id === selectedExam)?.group}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="body1">
                    Total Students: {allStudents.length}
                  </Typography>
                  <Typography variant="body1">
                    Attempted: {attendedStudents.length} | 
                    Not Attempted: {notAttendedStudents.length}
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
                    {activeExams.some(exam => exam.id === selectedExam) ? (
                      <Button
                        variant="contained"
                        color="warning"
                        disabled
                      >
                        Exam is going now
                      </Button>
                    ) : (
                      <>
                        <Button
                          variant="contained"
                          color="primary"
                          startIcon={<EditIcon />}
                          onClick={() => handleEditTest(selectedExam)}
                        >
                          Edit Test Details
                        </Button>
                        <Button
                          variant="contained"
                          color="secondary"
                          startIcon={<RestartAltIcon />}
                          onClick={() => handleReconductTest(selectedExam)}
                        >
                          Reconduct Test
                        </Button>
                      </>
                    )}
                  </Box>
                </Grid>
              </Grid>
            </Paper>

            {/* Student Status */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Student Status
              </Typography>
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Mobile Number</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Submit Time</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {allStudents.map((student) => {
                      const result = examResults.find(r => 
                        r.studentId === student.mobileNumber && 
                        r.examId === selectedExam
                      );
                      const hasAttempted = Boolean(result);

                      return (
                        <TableRow key={student.id}>
                          <TableCell>{student.name}</TableCell>
                          <TableCell>{student.mobileNumber}</TableCell>
                          <TableCell>
                            <Chip 
                              label={hasAttempted ? 'Attempted' : 'Not Attempted'} 
                              color={hasAttempted ? 'success' : 'error'}
                              sx={{ minWidth: '100px' }}
                            />
                          </TableCell>
                          <TableCell>
                            {result?.submitTime?.toDate ? new Date(result.submitTime.toDate()).toLocaleString() : 'N/A'}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
              <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={printNotSubmittedStudents}
                  disabled={!selectedExam}
                >
                  Print Not-Submitted Students
                </Button>
              </Box>
            </Box>
          </>
        )}
      </>
    );
  };

  const printNotSubmittedStudents = () => {
    const selectedExamData = exams.find(exam => exam.id === selectedExam);
    if (!selectedExamData) return;

    const { notAttendedStudents } = getFilteredStudents();
    
    // Create a new window for printing
    const printWindow = window.open('', '_blank');
    
    // Generate the HTML content
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Not Submitted Students List</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 20px;
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
            }
            .exam-details {
              margin-bottom: 20px;
              padding: 10px;
              border-bottom: 1px solid #ccc;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 20px;
            }
            th, td {
              border: 1px solid #ddd;
              padding: 8px;
              text-align: left;
            }
            th {
              background-color: #f4f4f4;
            }
            .print-date {
              margin-top: 30px;
              text-align: right;
              font-size: 0.9em;
              color: #666;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>Not Submitted Students List</h2>
          </div>
          <div class="exam-details">
            <h3>Exam Details:</h3>
            <p><strong>Exam Title:</strong> ${selectedExamData.title}</p>
            <p><strong>Class:</strong> ${selectedExamData.class} | <strong>Section:</strong> ${selectedExamData.section} | <strong>Group:</strong> ${selectedExamData.group}</p>
            <p><strong>Total Not Submitted:</strong> ${notAttendedStudents.length}</p>
          </div>
          <table>
            <thead>
              <tr>
                <th>Sl. No</th>
                <th>Student Name</th>
                <th>Mobile Number</th>
              </tr>
            </thead>
            <tbody>
              ${notAttendedStudents.map((student, index) => `
                <tr>
                  <td>${index + 1}</td>
                  <td>${student.name}</td>
                  <td>${student.mobileNumber}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div class="print-date">
            <p>Generated on: ${new Date().toLocaleString()}</p>
          </div>
        </body>
      </html>
    `;

    // Write the content and print
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    
    // Wait for content to load before printing
    printWindow.onload = function() {
      printWindow.print();
    };
  };

  const renderResults = () => {
    const filteredResults = examResults
      .filter(result => result.examId === selectedExam)
      .map(result => ({
        ...result,
        submitTime: result.submitTime || null,
        score: result.score || 0
      }));

    return (
      <>
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12}>
            <FormControl fullWidth>
              <InputLabel>Select Exam</InputLabel>
              <Select
                value={selectedExam || ''}
                onChange={(e) => setSelectedExam(e.target.value)}
                label="Select Exam"
              >
                {exams.map((exam) => (
                  <MenuItem key={exam.id} value={exam.id}>
                    {exam.title}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        </Grid>

        {selectedExam && (
          <>
            <Paper sx={{ p: 2, mb: 3 }}>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Typography variant="h6" gutterBottom>
                    Exam Details
                  </Typography>
                  <Typography variant="body1">
                    Title: {exams.find(exam => exam.id === selectedExam)?.title || 'N/A'}
                  </Typography>
                  <Typography variant="body1">
                    Class: {exams.find(exam => exam.id === selectedExam)?.class || 'N/A'} | 
                    Section: {exams.find(exam => exam.id === selectedExam)?.section || 'N/A'} | 
                    Group: {exams.find(exam => exam.id === selectedExam)?.group || 'N/A'}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="h6" gutterBottom>
                    Results Summary
                  </Typography>
                  <Typography variant="body1">
                    Total Students: {filteredResults.length}
                  </Typography>
                  <Typography variant="body1">
                    Average Score: {
                      filteredResults.length > 0
                        ? Math.round(
                            filteredResults.reduce((sum, r) => sum + (r.score || 0), 0) / 
                            filteredResults.length
                          )
                        : 0
                    }%
                  </Typography>
                </Grid>
              </Grid>
            </Paper>

            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Student Name</TableCell>
                    <TableCell>Score</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Submit Time</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredResults.map((result) => (
                    <TableRow key={result.id}>
                      <TableCell>{result.studentName || 'N/A'}</TableCell>
                      <TableCell>{result.score || 0}%</TableCell>
                      <TableCell>
                        <Chip 
                          label={result.score >= 40 ? 'Passed' : 'Failed'}
                          color={result.score >= 40 ? 'success' : 'error'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        {result.submitTime?.toDate ? 
                          new Date(result.submitTime.toDate()).toLocaleString() 
                          : 'N/A'}
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredResults.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} align="center">
                        <Typography color="text.secondary">
                          No results available for this exam
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}>
              <Button
                variant="contained"
                color="primary"
                onClick={async () => {
                  try {
                    // Get all results for this exam with validation
                    const examResultsToUpdate = filteredResults.filter(r => r.id);
                    
                    if (examResultsToUpdate.length === 0) {
                      setError('No valid results to update');
                      return;
                    }

                    // Create a batch for atomic updates
                    const batch = writeBatch(db);

                    // First update the exam document to mark it as completed and released
                    const examRef = doc(db, 'exams', selectedExam);
                    batch.update(examRef, {
                      status: 'completed',
                      resultsReleased: true,
                      releaseDate: Timestamp.now()
                    });

                    // Then update all individual results
                    examResultsToUpdate.forEach(result => {
                      const resultRef = doc(db, 'examResults', result.id);
                      batch.update(resultRef, {
                        showToStudent: true,
                        releaseDate: Timestamp.now(),
                        status: 'completed'
                      });
                    });

                    // Commit the batch
                    await batch.commit();

                    setSuccess('Results released successfully');
                  } catch (error) {
                    console.error('Error releasing results:', error);
                    setError('Failed to release results. Please try again.');
                  }
                }}
              >
                Release Results
              </Button>
            </Box>
          </>
        )}
      </>
    );
  };

  const handleEditTest = async (examId) => {
    try {
      const examToEdit = exams.find(exam => exam.id === examId);
      if (!examToEdit) {
        setError('Exam not found');
        return;
      }

      // Set form values for editing
      formik.setValues({
        title: examToEdit.title,
        class: examToEdit.class,
        section: examToEdit.section,
        group: examToEdit.group,
        duration: examToEdit.duration,
        expiryDate: examToEdit.endTime.toDate().toISOString().split('T')[0],
      });
      setQuestions(examToEdit.questions);
      
      // Switch to create exam tab for editing
      setTabValue(0);
      setSuccess('Loaded exam details for editing. Make your changes and save.');
    } catch (error) {
      console.error('Error loading exam for edit:', error);
      setError('Failed to load exam for editing');
    }
  };

  const handleReconductTest = async (examId) => {
    try {
      const examToReconduct = exams.find(exam => exam.id === examId);
      if (!examToReconduct) {
        setError('Exam not found');
        return;
      }

      // Create a new exam with the same details but new timestamps
      const newExamData = {
        ...examToReconduct,
        status: 'active',
        createdAt: Timestamp.now(),
        endTime: Timestamp.fromDate(new Date(Date.now() + 24 * 60 * 60 * 1000)), // 24 hours from now
      };

      // Remove the id to create a new document
      delete newExamData.id;

      // Add the new exam to Firebase
      await addDoc(collection(db, 'exams'), newExamData);
      setSuccess('Exam reconducted successfully. The new exam is now active.');

      // Refresh the exams list
      fetchExams();
    } catch (error) {
      console.error('Error reconducting exam:', error);
      setError('Failed to reconduct exam');
    }
  };

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tabValue} onChange={handleTabChange}>
          <Tab label="Create Exam" />
          <Tab label="Monitor Exams" />
          <Tab label="Active Exams" />
          <Tab label="Results" />
        </Tabs>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}

      {tabValue === 0 ? (
        <Paper elevation={3} sx={{ p: 3 }}>
          <Typography variant="h5" gutterBottom>
            Create New Exam
          </Typography>

          <form onSubmit={formik.handleSubmit}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  id="title"
                  name="title"
                  label="Exam Title"
                  value={formik.values.title}
                  onChange={formik.handleChange}
                  error={formik.touched.title && Boolean(formik.errors.title)}
                  helperText={formik.touched.title && formik.errors.title}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Class</InputLabel>
                  <Select
                    id="class"
                    name="class"
                    value={formik.values.class}
                    onChange={formik.handleChange}
                    error={formik.touched.class && Boolean(formik.errors.class)}
                  >
                    {CLASS_OPTIONS.map((option) => (
                      <MenuItem key={option} value={option}>
                        {option}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Section</InputLabel>
                  <Select
                    id="section"
                    name="section"
                    value={formik.values.section}
                    onChange={formik.handleChange}
                    error={formik.touched.section && Boolean(formik.errors.section)}
                  >
                    {SECTION_OPTIONS.map((option) => (
                      <MenuItem key={option} value={option}>
                        {option}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Group</InputLabel>
                  <Select
                    id="group"
                    name="group"
                    value={formik.values.group}
                    onChange={formik.handleChange}
                    error={formik.touched.group && Boolean(formik.errors.group)}
                  >
                    {GROUP_OPTIONS.map((option) => (
                      <MenuItem key={option} value={option}>
                        {option}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  id="duration"
                  name="duration"
                  label="Duration (minutes)"
                  type="number"
                  value={formik.values.duration}
                  onChange={formik.handleChange}
                  error={formik.touched.duration && Boolean(formik.errors.duration)}
                  helperText={formik.touched.duration && formik.errors.duration}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  id="expiryDate"
                  name="expiryDate"
                  label="Exam Expiry Date"
                  type="datetime-local"
                  value={formik.values.expiryDate}
                  onChange={formik.handleChange}
                  error={formik.touched.expiryDate && Boolean(formik.errors.expiryDate)}
                  helperText={formik.touched.expiryDate && formik.errors.expiryDate}
                  InputLabelProps={{
                    shrink: true,
                  }}
                />
              </Grid>
            </Grid>

            <Typography variant="h6" sx={{ mt: 4, mb: 2 }}>
              Questions
            </Typography>

            {questions.map((question, index) => renderQuestionFields(question, index))}

            <Button
              startIcon={<AddIcon />}
              onClick={handleAddQuestion}
              sx={{ mt: 2, mb: 3 }}
            >
              Add Question
            </Button>

            <Button type="submit" variant="contained" fullWidth>
              Create Exam
            </Button>
          </form>
        </Paper>
      ) : tabValue === 1 ? (
        renderExamMonitoring()
      ) : tabValue === 2 ? (
        renderActiveExams()
      ) : (
        renderResults()
      )}
      <Dialog
        open={printDialogOpen}
        onClose={handleClosePrintDialog}
        maxWidth="md"
        fullWidth
      >
        {selectedResult && (
          <PrintExamResult
            student={selectedResult.student}
            exam={selectedResult.exam}
            result={selectedResult.result}
          />
        )}
      </Dialog>
    </Box>
  );
}

export default ManageExams;
