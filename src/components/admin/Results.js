import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Paper, 
  Typography, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow,
  TablePagination,
  CircularProgress,
  Alert,
  Chip,
  Grid,
  TextField,
  MenuItem
} from '@mui/material';
import { collection, query, getDocs, orderBy, where } from 'firebase/firestore';
import { db } from '../../firebase';

const Results = () => {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [exams, setExams] = useState([]);
  const [selectedExam, setSelectedExam] = useState('all');

  useEffect(() => {
    fetchExamsAndResults();
  }, []);

  const fetchExamsAndResults = async () => {
    try {
      setLoading(true);
      console.log('Fetching exams and results...');
      
      // Get all exams first
      const examsRef = collection(db, 'exams');
      const examsQuery = query(examsRef);
      const examsSnapshot = await getDocs(examsQuery);
      const examsData = {};
      const examsList = [];
      
      examsSnapshot.docs.forEach(doc => {
        console.log('Found exam:', doc.data().title);
        examsData[doc.id] = doc.data().title;
        examsList.push({
          id: doc.id,
          title: doc.data().title
        });
      });
      setExams(examsList);
      console.log('Total exams found:', examsList.length);

      // Get all results from both active and completed exams
      const resultsPromises = [
        // Get results from examResults collection (active exams)
        getDocs(query(collection(db, 'examResults'), orderBy('timestamp', 'desc'))),
        // Get results from results collection (completed exams)
        getDocs(query(collection(db, 'results'), orderBy('timestamp', 'desc')))
      ];

      const [activeResults, completedResults] = await Promise.all(resultsPromises);
      console.log('Found active results:', activeResults.size);
      console.log('Found completed results:', completedResults.size);
      
      // Combine and process all results
      const allResultDocs = [...activeResults.docs, ...completedResults.docs];
      console.log('Total combined results:', allResultDocs.length);

      const resultsData = await Promise.all(allResultDocs.map(async doc => {
        const data = doc.data();
        console.log('Processing result for exam:', data.examId);
        
        // Get student details using both uid and mobile number
        let studentName = 'Unknown';
        try {
          const usersRef = collection(db, 'users');
          const userQuery = query(usersRef, 
            where('uid', '==', data.studentId)
          );
          const userSnapshot = await getDocs(userQuery);
          
          if (!userSnapshot.empty) {
            const userData = userSnapshot.docs[0].data();
            studentName = userData.name || userData.email || 'Unknown';
            console.log('Found student:', studentName);
          } else {
            // Try finding by mobile number as fallback
            const studentRef = collection(db, 'students');
            const studentQuery = query(studentRef, 
              where('mobileNumber', '==', data.studentId)
            );
            const studentSnapshot = await getDocs(studentQuery);
            
            if (!studentSnapshot.empty) {
              const studentData = studentSnapshot.docs[0].data();
              studentName = studentData.name || 'Unknown';
              console.log('Found student by mobile:', studentName);
            }
          }
        } catch (err) {
          console.error('Error fetching student details:', err);
        }

        const resultObj = {
          id: doc.id,
          ...data,
          studentName,
          examTitle: examsData[data.examId] || 'Unknown Exam',
          timestamp: data.timestamp?.toDate().toLocaleString() || 'N/A',
          percentage: ((data.score / data.totalQuestions) * 100).toFixed(1),
          status: doc.ref.parent.id === 'results' ? 'Completed' : 'Active'
        };
        console.log('Processed result:', resultObj);
        return resultObj;
      }));
      
      console.log('Total processed results:', resultsData.length);
      // Sort combined results by timestamp
      const sortedResults = resultsData.sort((a, b) => 
        new Date(b.timestamp) - new Date(a.timestamp)
      );
      setResults(sortedResults);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching results:', err);
      setError('Failed to load results. Please try again later.');
      setLoading(false);
    }
  };

  const handleExamChange = (event) => {
    setSelectedExam(event.target.value);
    setPage(0);
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const getScoreColor = (percentage) => {
    if (percentage >= 75) return 'success';
    if (percentage >= 50) return 'warning';
    return 'error';
  };

  const filteredResults = selectedExam === 'all' 
    ? results 
    : results.filter(result => {
        console.log('Filtering result:', result.examId, 'Selected exam:', selectedExam);
        return result.examId === selectedExam;
      });

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
    <Paper sx={{ p: 2, m: 2 }}>
      <Grid container spacing={2} alignItems="center" sx={{ mb: 2 }}>
        <Grid item xs={12} sm={6}>
          <Typography variant="h6">
            All Test Results
          </Typography>
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            select
            fullWidth
            size="small"
            label="Filter by Exam"
            value={selectedExam}
            onChange={handleExamChange}
          >
            <MenuItem value="all">All Exams</MenuItem>
            {exams.map((exam) => (
              <MenuItem key={exam.id} value={exam.id}>
                {exam.title}
              </MenuItem>
            ))}
          </TextField>
        </Grid>
      </Grid>
      
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Student Name</TableCell>
              <TableCell>Test Title</TableCell>
              <TableCell align="center">Score</TableCell>
              <TableCell align="center">Percentage</TableCell>
              <TableCell align="center">Status</TableCell>
              <TableCell>Date & Time</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredResults
              .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
              .map((result) => (
                <TableRow key={result.id}>
                  <TableCell>{result.studentName}</TableCell>
                  <TableCell>{result.examTitle}</TableCell>
                  <TableCell align="center">
                    {result.score}/{result.totalQuestions}
                  </TableCell>
                  <TableCell align="center">
                    <Chip 
                      label={`${result.percentage}%`}
                      color={getScoreColor(parseFloat(result.percentage))}
                      size="small"
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell align="center">
                    <Chip 
                      label={result.status}
                      color={result.status === 'Completed' ? 'success' : 'warning'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>{result.timestamp}</TableCell>
                </TableRow>
            ))}
            {filteredResults.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  <Typography variant="body2" color="text.secondary">
                    No test results found
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      
      <TablePagination
        rowsPerPageOptions={[5, 10, 25, 50]}
        component="div"
        count={filteredResults.length}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={handleChangePage}
        onRowsPerPageChange={handleChangeRowsPerPage}
      />
    </Paper>
  );
};

export default Results;
