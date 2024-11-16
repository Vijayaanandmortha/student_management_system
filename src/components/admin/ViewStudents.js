import React, { useState, useEffect } from 'react';
import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  TextField,
  InputAdornment,
  IconButton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import EditIcon from '@mui/icons-material/Edit';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import FilterListIcon from '@mui/icons-material/FilterList';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { format } from 'date-fns';
import { useFormik } from 'formik';
import * as yup from 'yup';
import { 
  CLASS_OPTIONS, 
  SECTION_OPTIONS, 
  GROUP_OPTIONS,
  YEAR_OF_STUDY_OPTIONS 
} from '../../constants/formOptions';

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
  password: yup
    .string()
    .min(6, 'Password must be at least 6 characters')
    .required('Password is required'),
});

function ViewStudents() {
  const [students, setStudents] = useState([]);
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    class: '',
    section: '',
    group: '',
  });
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [adharSearch, setAdharSearch] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const formik = useFormik({
    initialValues: {
      name: '',
      mobileNumber: '',
      class: '',
      section: '',
      adharNumber: '',
      yearOfStudy: '',
      group: '',
      password: '',
    },
    validationSchema: validationSchema,
    onSubmit: async (values) => {
      try {
        const studentRef = doc(db, 'students', selectedStudent.id);
        await updateDoc(studentRef, values);
        
        // Update local state
        setStudents(students.map(student => 
          student.id === selectedStudent.id 
            ? { ...student, ...values }
            : student
        ));
        
        handleCloseDialog();
      } catch (error) {
        console.error('Error updating student:', error);
      }
    },
  });

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'students'));
        const studentsData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setStudents(studentsData);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching students:', error);
        setLoading(false);
      }
    };

    fetchStudents();
  }, []);

  useEffect(() => {
    // Apply filters and search
    let result = [...students];
    
    // Apply filters
    if (filters.class) {
      result = result.filter(student => student.class === filters.class);
    }
    if (filters.section) {
      result = result.filter(student => student.section === filters.section);
    }
    if (filters.group) {
      result = result.filter(student => student.group === filters.group);
    }
    
    // Apply search query
    if (searchQuery) {
      result = result.filter(student =>
        student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.mobileNumber.includes(searchQuery) ||
        student.adharNumber.includes(searchQuery)
      );
    }
    
    setFilteredStudents(result);
  }, [students, filters, searchQuery]);

  const handleFilterChange = (event) => {
    const { name, value } = event.target;
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const clearFilters = () => {
    setFilters({
      class: '',
      section: '',
      group: '',
    });
  };

  const handleEditClick = (student) => {
    setSelectedStudent(student);
    formik.setValues({
      name: student.name || '',
      mobileNumber: student.mobileNumber || '',
      class: student.class || '',
      section: student.section || '',
      adharNumber: student.adharNumber || '',
      yearOfStudy: student.yearOfStudy || '',
      group: student.group || '',
      password: student.password || '',
    });
    setEditDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setEditDialogOpen(false);
    setSelectedStudent(null);
    formik.resetForm();
  };

  return (
    <Paper elevation={3} sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        View Students
      </Typography>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            placeholder="Search by name, mobile, or class..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            placeholder="Search by Aadhar number..."
            value={adharSearch}
            onChange={(e) => setAdharSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
        </Grid>
      </Grid>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6}>
          <FormControl fullWidth>
            <InputLabel>Class</InputLabel>
            <Select
              name="class"
              value={filters.class}
              onChange={handleFilterChange}
              label="Class"
            >
              <MenuItem value="">All</MenuItem>
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
              name="section"
              value={filters.section}
              onChange={handleFilterChange}
              label="Section"
            >
              <MenuItem value="">All</MenuItem>
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
              name="group"
              value={filters.group}
              onChange={handleFilterChange}
              label="Group"
            >
              <MenuItem value="">All</MenuItem>
              {GROUP_OPTIONS.map((option) => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} sm={6}>
          <Button onClick={clearFilters} startIcon={<FilterListIcon />}>
            Clear Filters
          </Button>
        </Grid>
      </Grid>

      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Mobile Number</TableCell>
              <TableCell>Class</TableCell>
              <TableCell>Section</TableCell>
              <TableCell>Group</TableCell>
              <TableCell>Aadhar Number</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredStudents.map((student) => (
              <TableRow key={student.id}>
                <TableCell>{student.name}</TableCell>
                <TableCell>{student.mobileNumber}</TableCell>
                <TableCell>{student.class}</TableCell>
                <TableCell>{student.section}</TableCell>
                <TableCell>{student.group}</TableCell>
                <TableCell>{student.adharNumber}</TableCell>
                <TableCell>
                  <IconButton
                    color="primary"
                    onClick={() => handleEditClick(student)}
                  >
                    <EditIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={editDialogOpen} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <form onSubmit={formik.handleSubmit}>
          <DialogTitle>Edit Student Details</DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
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
                  name="mobileNumber"
                  label="Mobile Number"
                  value={formik.values.mobileNumber}
                  onChange={formik.handleChange}
                  error={formik.touched.mobileNumber && Boolean(formik.errors.mobileNumber)}
                  helperText={formik.touched.mobileNumber && formik.errors.mobileNumber}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Class</InputLabel>
                  <Select
                    name="class"
                    value={formik.values.class}
                    onChange={formik.handleChange}
                    error={formik.touched.class && Boolean(formik.errors.class)}
                    label="Class"
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
                    name="section"
                    value={formik.values.section}
                    onChange={formik.handleChange}
                    error={formik.touched.section && Boolean(formik.errors.section)}
                    label="Section"
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
                <TextField
                  fullWidth
                  name="adharNumber"
                  label="Aadhar Number"
                  value={formik.values.adharNumber}
                  onChange={formik.handleChange}
                  error={formik.touched.adharNumber && Boolean(formik.errors.adharNumber)}
                  helperText={formik.touched.adharNumber && formik.errors.adharNumber}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Year of Study</InputLabel>
                  <Select
                    name="yearOfStudy"
                    value={formik.values.yearOfStudy}
                    onChange={formik.handleChange}
                    error={formik.touched.yearOfStudy && Boolean(formik.errors.yearOfStudy)}
                    label="Year of Study"
                  >
                    {YEAR_OF_STUDY_OPTIONS.map((option) => (
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
                    name="group"
                    value={formik.values.group}
                    onChange={formik.handleChange}
                    error={formik.touched.group && Boolean(formik.errors.group)}
                    label="Group"
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
                  name="password"
                  label="Password"
                  type={showPassword ? 'text' : 'password'}
                  value={formik.values.password}
                  onChange={formik.handleChange}
                  error={formik.touched.password && Boolean(formik.errors.password)}
                  helperText={formik.touched.password && formik.errors.password}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowPassword(!showPassword)}
                          edge="end"
                        >
                          {showPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>Cancel</Button>
            <Button type="submit" variant="contained">Save Changes</Button>
          </DialogActions>
        </form>
      </Dialog>
    </Paper>
  );
}

export default ViewStudents;
