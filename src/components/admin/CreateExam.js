import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Grid,
  IconButton,
  Alert,
  CircularProgress,
  Divider,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';

const CreateExam = () => {
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState('');
  const [class_, setClass] = useState('');
  const [section, setSection] = useState('');
  const [group, setGroup] = useState('');
  const [questions, setQuestions] = useState([{ 
    question: '', 
    options: ['', '', '', ''], 
    answer: '' 
  }]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleQuestionChange = (index, value) => {
    const newQuestions = [...questions];
    newQuestions[index].question = value;
    setQuestions(newQuestions);
  };

  const handleOptionChange = (questionIndex, optionIndex, value) => {
    const newQuestions = [...questions];
    newQuestions[questionIndex].options[optionIndex] = value;
    setQuestions(newQuestions);
  };

  const handleAnswerChange = (index, value) => {
    const newQuestions = [...questions];
    newQuestions[index].answer = value;
    setQuestions(newQuestions);
  };

  const addQuestion = () => {
    setQuestions([
      ...questions,
      { question: '', options: ['', '', '', ''], answer: '' }
    ]);
  };

  const removeQuestion = (index) => {
    const newQuestions = questions.filter((_, i) => i !== index);
    setQuestions(newQuestions);
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const jsonData = JSON.parse(e.target.result);
          if (Array.isArray(jsonData)) {
            // Validate the JSON structure
            const isValid = jsonData.every(q => 
              q.question && 
              Array.isArray(q.options) && 
              q.options.length === 4 &&
              q.answer &&
              q.options.includes(q.answer)
            );

            if (isValid) {
              setQuestions(jsonData);
              setSuccess('Questions imported successfully!');
              setTimeout(() => setSuccess(false), 3000);
            } else {
              setError('Invalid JSON format. Please check the file structure.');
            }
          } else {
            setError('Invalid JSON format. File must contain an array of questions.');
          }
        } catch (err) {
          setError('Error parsing JSON file. Please check the file format.');
        }
      };
      reader.readAsText(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      // Validate inputs
      if (!title.trim()) throw new Error('Please enter an exam title');
      if (!duration || duration <= 0) throw new Error('Please enter a valid duration');
      if (!class_) throw new Error('Please enter a class');
      if (!section) throw new Error('Please enter a section');
      if (!group) throw new Error('Please enter a group');
      if (questions.length === 0) throw new Error('Please add at least one question');

      // Validate all questions
      questions.forEach((q, index) => {
        if (!q.question.trim()) throw new Error(`Question ${index + 1} is empty`);
        if (q.options.some(opt => !opt.trim())) throw new Error(`All options in question ${index + 1} must be filled`);
        if (!q.answer.trim()) throw new Error(`Please select an answer for question ${index + 1}`);
        if (!q.options.includes(q.answer)) throw new Error(`Answer for question ${index + 1} must match one of the options`);
      });

      // Add to Firestore
      await addDoc(collection(db, 'exams'), {
        title,
        duration: Number(duration),
        class: class_,
        section,
        group,
        questions,
        timestamp: serverTimestamp(),
        status: 'active',
        endTime: new Date(Date.now() + duration * 60 * 1000)
      });

      // Reset form
      setTitle('');
      setDuration('');
      setClass('');
      setSection('');
      setGroup('');
      setQuestions([{ question: '', options: ['', '', '', ''], answer: '' }]);
      setSuccess('Exam created successfully!');
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: 2 }}>
      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>
          Create New Exam
        </Typography>

        <form onSubmit={handleSubmit}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Exam Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                size="small"
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Duration (minutes)"
                type="number"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                size="small"
                required
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="Class"
                value={class_}
                onChange={(e) => setClass(e.target.value)}
                size="small"
                required
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="Section"
                value={section}
                onChange={(e) => setSection(e.target.value)}
                size="small"
                required
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="Group"
                value={group}
                onChange={(e) => setGroup(e.target.value)}
                size="small"
                required
              />
            </Grid>
          </Grid>

          <Box sx={{ mt: 4, mb: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
            <Button
              component="label"
              variant="contained"
              color="primary"
              startIcon={<UploadFileIcon />}
              sx={{ mr: 2 }}
            >
              Import Questions (JSON)
              <input
                type="file"
                accept=".json"
                style={{ display: 'none' }}
                onChange={handleFileUpload}
              />
            </Button>
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={addQuestion}
            >
              Add Question Manually
            </Button>
          </Box>

          {error && (
            <Alert severity="error" sx={{ my: 2 }}>
              {error}
            </Alert>
          )}

          {success && (
            <Alert severity="success" sx={{ my: 2 }}>
              {success}
            </Alert>
          )}

          <Divider sx={{ my: 2 }} />

          {questions.map((q, questionIndex) => (
            <Paper key={questionIndex} sx={{ p: 2, mb: 2, bgcolor: 'background.default' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="subtitle1">
                  Question {questionIndex + 1}
                </Typography>
                <IconButton 
                  size="small" 
                  onClick={() => removeQuestion(questionIndex)}
                  disabled={questions.length === 1}
                >
                  <DeleteIcon />
                </IconButton>
              </Box>

              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Question"
                    value={q.question}
                    onChange={(e) => handleQuestionChange(questionIndex, e.target.value)}
                    size="small"
                  />
                </Grid>
                {q.options.map((option, optionIndex) => (
                  <Grid item xs={12} sm={6} key={optionIndex}>
                    <TextField
                      fullWidth
                      label={`Option ${optionIndex + 1}`}
                      value={option}
                      onChange={(e) => handleOptionChange(questionIndex, optionIndex, e.target.value)}
                      size="small"
                    />
                  </Grid>
                ))}
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    select
                    label="Correct Answer"
                    value={q.answer}
                    onChange={(e) => handleAnswerChange(questionIndex, e.target.value)}
                    size="small"
                    SelectProps={{
                      native: true,
                    }}
                  >
                    <option value="">Select correct answer</option>
                    {q.options.map((option, index) => (
                      option && (
                        <option key={index} value={option}>
                          {option}
                        </option>
                      )
                    ))}
                  </TextField>
                </Grid>
              </Grid>
            </Paper>
          ))}

          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              type="submit"
              variant="contained"
              disabled={loading}
            >
              {loading ? <CircularProgress size={24} /> : 'Create Exam'}
            </Button>
          </Box>
        </form>
      </Paper>
    </Box>
  );
};

export default CreateExam;
