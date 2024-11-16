import React from 'react';
import {
  Paper,
  Typography,
  Grid,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Divider,
} from '@mui/material';

function PrintExamResult({ student, exam, result }) {
  // Calculate total points possible
  const totalPossiblePoints = exam.questions.reduce((sum, q) => sum + q.points, 0);
  
  // Calculate percentage score
  const percentageScore = Math.round((result.score / totalPossiblePoints) * 100);

  return (
    <Box sx={{ p: 4, '@media print': { p: 2 } }}>
      <Typography variant="h4" align="center" gutterBottom>
        Exam Result Certificate
      </Typography>
      
      <Divider sx={{ my: 3 }} />

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Typography variant="h6" gutterBottom>
            Student Information
          </Typography>
          <Typography><strong>Name:</strong> {student.name}</Typography>
          <Typography><strong>Class:</strong> {student.class}</Typography>
          <Typography><strong>Section:</strong> {student.section}</Typography>
          <Typography><strong>Group:</strong> {student.group}</Typography>
          <Typography><strong>Mobile:</strong> {student.mobileNumber}</Typography>
          <Typography><strong>Aadhar:</strong> {student.adharNumber}</Typography>
        </Grid>

        <Grid item xs={12} md={6}>
          <Typography variant="h6" gutterBottom>
            Exam Information
          </Typography>
          <Typography><strong>Exam Title:</strong> {exam.title}</Typography>
          <Typography><strong>Date:</strong> {result.submitTime.toDate().toLocaleDateString()}</Typography>
          <Typography><strong>Duration:</strong> {exam.duration} minutes</Typography>
          <Typography><strong>Total Questions:</strong> {exam.questions.length}</Typography>
          <Typography><strong>Score:</strong> {result.score} / {totalPossiblePoints}</Typography>
          <Typography><strong>Percentage:</strong> {percentageScore}%</Typography>
        </Grid>
      </Grid>

      <Box sx={{ mt: 4 }}>
        <Typography variant="h6" gutterBottom>
          Question-wise Analysis
        </Typography>
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Question</TableCell>
                <TableCell>Your Answer</TableCell>
                <TableCell>Correct Answer</TableCell>
                <TableCell>Points</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {exam.questions.map((question, index) => {
                const userAnswer = result.answers[index];
                const isCorrect = userAnswer === question.answer;
                return (
                  <TableRow key={index}>
                    <TableCell>{question.question}</TableCell>
                    <TableCell>{userAnswer || 'Not answered'}</TableCell>
                    <TableCell>{question.answer}</TableCell>
                    <TableCell>{isCorrect ? question.points : 0} / {question.points}</TableCell>
                    <TableCell>
                      {isCorrect ? '✓ Correct' : '✗ Incorrect'}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>

      <Box sx={{ mt: 4, textAlign: 'center' }}>
        <Typography variant="body2" color="textSecondary">
          This is a computer-generated result and does not require a signature.
        </Typography>
        <Typography variant="body2" color="textSecondary">
          Generated on: {new Date().toLocaleString()}
        </Typography>
      </Box>
    </Box>
  );
}

export default PrintExamResult;
