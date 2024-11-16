import React, { useState } from 'react';
import {
  Paper,
  TextField,
  Button,
  Grid,
  Typography,
  Alert,
  MenuItem,
} from '@mui/material';
import { useFormik } from 'formik';
import * as yup from 'yup';
import { auth, db } from '../../firebase/config';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { collection, addDoc } from 'firebase/firestore';
import { CLASS_OPTIONS, SECTION_OPTIONS, GROUP_OPTIONS, YEAR_OF_STUDY_OPTIONS } from '../../constants/formOptions';

const validationSchema = yup.object({
  name: yup.string().required('Name is required'),
  mobileNumber: yup
    .string()
    .matches(/^[0-9]{10}$/, 'Mobile number must be 10 digits')
    .required('Mobile number is required'),
  class: yup.string().required('Class is required'),
  section: yup.string().required('Section is required'),
  adharNumber: yup
    .string()
    .matches(/^[0-9]{12}$/, 'Aadhar number must be 12 digits')
    .required('Aadhar number is required'),
  yearOfStudy: yup.string().required('Year of study is required'),
  group: yup.string().required('Group is required'),
  dateOfBirth: yup.date().required('Date of birth is required'),
  password: yup
    .string()
    .min(6, 'Password must be at least 6 characters')
    .required('Password is required'),
  confirmPassword: yup
    .string()
    .oneOf([yup.ref('password'), null], 'Passwords must match')
    .required('Confirm password is required'),
});

function AddStudent() {
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const formik = useFormik({
    initialValues: {
      name: '',
      mobileNumber: '',
      class: '',
      section: '',
      adharNumber: '',
      yearOfStudy: '',
      group: '',
      dateOfBirth: '',
      password: '',
      confirmPassword: '',
    },
    validationSchema: validationSchema,
    onSubmit: async (values) => {
      try {
        setError('');
        setSuccess('');

        // Create authentication user
        const userCredential = await createUserWithEmailAndPassword(
          auth,
          `${values.mobileNumber}@student.com`,
          values.password
        );

        // Add student data to Firestore
        await addDoc(collection(db, 'students'), {
          uid: userCredential.user.uid,
          name: values.name,
          mobileNumber: values.mobileNumber,
          class: values.class,
          section: values.section,
          adharNumber: values.adharNumber,
          yearOfStudy: values.yearOfStudy,
          group: values.group,
          dateOfBirth: values.dateOfBirth,
          role: 'student',
          createdAt: new Date().toISOString(),
        });

        setSuccess('Student added successfully!');
        formik.resetForm();
      } catch (err) {
        setError(err.message);
      }
    },
  });

  return (
    <Paper elevation={3} sx={{ p: 3, mt: 3 }}>
      <Typography variant="h5" gutterBottom>
        Add New Student
      </Typography>
      
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

      <form onSubmit={formik.handleSubmit}>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              id="name"
              name="name"
              label="Full Name"
              value={formik.values.name}
              onChange={formik.handleChange}
              error={formik.touched.name && Boolean(formik.errors.name)}
              helperText={formik.touched.name && formik.errors.name}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              id="mobileNumber"
              name="mobileNumber"
              label="Mobile Number"
              value={formik.values.mobileNumber}
              onChange={formik.handleChange}
              error={formik.touched.mobileNumber && Boolean(formik.errors.mobileNumber)}
              helperText={formik.touched.mobileNumber && formik.errors.mobileNumber}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              id="class"
              name="class"
              label="Class"
              select
              value={formik.values.class}
              onChange={formik.handleChange}
              error={formik.touched.class && Boolean(formik.errors.class)}
              helperText={formik.touched.class && formik.errors.class}
            >
              {CLASS_OPTIONS.map((option) => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </TextField>
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              id="section"
              name="section"
              label="Section"
              select
              value={formik.values.section}
              onChange={formik.handleChange}
              error={formik.touched.section && Boolean(formik.errors.section)}
              helperText={formik.touched.section && formik.errors.section}
            >
              {SECTION_OPTIONS.map((option) => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </TextField>
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              id="adharNumber"
              name="adharNumber"
              label="Aadhar Number"
              value={formik.values.adharNumber}
              onChange={formik.handleChange}
              error={formik.touched.adharNumber && Boolean(formik.errors.adharNumber)}
              helperText={formik.touched.adharNumber && formik.errors.adharNumber}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              id="group"
              name="group"
              label="Group"
              select
              value={formik.values.group}
              onChange={formik.handleChange}
              error={formik.touched.group && Boolean(formik.errors.group)}
              helperText={formik.touched.group && formik.errors.group}
            >
              {GROUP_OPTIONS.map((option) => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </TextField>
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              id="yearOfStudy"
              name="yearOfStudy"
              label="Year of Study"
              select
              value={formik.values.yearOfStudy}
              onChange={formik.handleChange}
              error={formik.touched.yearOfStudy && Boolean(formik.errors.yearOfStudy)}
              helperText={formik.touched.yearOfStudy && formik.errors.yearOfStudy}
            >
              {YEAR_OF_STUDY_OPTIONS.map((option) => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </TextField>
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              id="dateOfBirth"
              name="dateOfBirth"
              label="Date of Birth"
              type="date"
              value={formik.values.dateOfBirth}
              onChange={formik.handleChange}
              error={formik.touched.dateOfBirth && Boolean(formik.errors.dateOfBirth)}
              helperText={formik.touched.dateOfBirth && formik.errors.dateOfBirth}
              InputLabelProps={{
                shrink: true,
              }}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              id="password"
              name="password"
              label="Password"
              type="password"
              value={formik.values.password}
              onChange={formik.handleChange}
              error={formik.touched.password && Boolean(formik.errors.password)}
              helperText={formik.touched.password && formik.errors.password}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              id="confirmPassword"
              name="confirmPassword"
              label="Confirm Password"
              type="password"
              value={formik.values.confirmPassword}
              onChange={formik.handleChange}
              error={formik.touched.confirmPassword && Boolean(formik.errors.confirmPassword)}
              helperText={formik.touched.confirmPassword && formik.errors.confirmPassword}
            />
          </Grid>

          <Grid item xs={12}>
            <Button
              type="submit"
              variant="contained"
              color="primary"
              size="large"
              fullWidth
            >
              Add Student
            </Button>
          </Grid>
        </Grid>
      </form>
    </Paper>
  );
}

export default AddStudent;
