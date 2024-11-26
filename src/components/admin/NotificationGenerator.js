import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  TextField,
  Typography,
  CircularProgress,
  Snackbar,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondary,
  Divider,
  Stack,
} from '@mui/material';
import { Delete as DeleteIcon, Edit as EditIcon } from '@mui/icons-material';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { 
  collection, 
  addDoc, 
  serverTimestamp, 
  getDocs,
  doc,
  deleteDoc,
  updateDoc,
  query,
  orderBy
} from 'firebase/firestore';
import { db } from '../../firebase/config';

const modules = {
  toolbar: [
    [{ 'header': '1'}, {'header': '2'}, { 'font': [] }],
    [{size: []}],
    ['bold', 'italic', 'underline', 'strike', 'blockquote'],
    [{'list': 'ordered'}, {'list': 'bullet'}, 
     {'indent': '-1'}, {'indent': '+1'}],
    ['link', 'image'],
    ['clean'],
    [{ 'color': [] }, { 'background': [] }],
    [{ 'align': [] }]
  ],
};

const formats = [
  'header', 'font', 'size',
  'bold', 'italic', 'underline', 'strike', 'blockquote',
  'list', 'bullet', 'indent',
  'link', 'image', 'color', 'background', 'align'
];

function NotificationGenerator() {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [editingNotification, setEditingNotification] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success'
  });

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const q = query(collection(db, 'notifications'), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const notificationsList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setNotifications(notificationsList);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      setSnackbar({
        open: true,
        message: 'Error fetching notifications: ' + error.message,
        severity: 'error'
      });
    }
  };

  const handleSnackbarClose = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      setSnackbar({
        open: true,
        message: 'Please fill in both title and content',
        severity: 'error'
      });
      return;
    }

    setLoading(true);
    try {
      if (editingNotification) {
        await updateDoc(doc(db, 'notifications', editingNotification.id), {
          title,
          content,
          updatedAt: serverTimestamp()
        });
        setSnackbar({
          open: true,
          message: 'Notification updated successfully!',
          severity: 'success'
        });
        setEditingNotification(null);
      } else {
        await addDoc(collection(db, 'notifications'), {
          title,
          content,
          createdAt: serverTimestamp(),
          read: [],
          active: true
        });
        setSnackbar({
          open: true,
          message: 'Notification created successfully!',
          severity: 'success'
        });
      }
      setTitle('');
      setContent('');
      fetchNotifications();
    } catch (error) {
      setSnackbar({
        open: true,
        message: `Error ${editingNotification ? 'updating' : 'creating'} notification: ${error.message}`,
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (notification) => {
    setEditingNotification(notification);
    setTitle(notification.title);
    setContent(notification.content);
  };

  const handleDelete = async () => {
    if (!selectedNotification) return;

    try {
      await deleteDoc(doc(db, 'notifications', selectedNotification.id));
      setSnackbar({
        open: true,
        message: 'Notification deleted successfully!',
        severity: 'success'
      });
      fetchNotifications();
    } catch (error) {
      setSnackbar({
        open: true,
        message: 'Error deleting notification: ' + error.message,
        severity: 'error'
      });
    } finally {
      setDeleteDialogOpen(false);
      setSelectedNotification(null);
    }
  };

  const confirmDelete = (notification) => {
    setSelectedNotification(notification);
    setDeleteDialogOpen(true);
  };

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', p: 2 }}>
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Typography variant="h5" gutterBottom>
            {editingNotification ? 'Edit Notification' : 'Create Notification'}
          </Typography>
          
          <form onSubmit={handleSubmit}>
            <TextField
              fullWidth
              label="Notification Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              margin="normal"
              required
            />
            
            <Box sx={{ mt: 2, mb: 2 }}>
              <ReactQuill
                theme="snow"
                value={content}
                onChange={setContent}
                modules={modules}
                formats={formats}
                style={{ height: '300px', marginBottom: '50px' }}
              />
            </Box>

            <Stack direction="row" spacing={2}>
              <Button
                type="submit"
                variant="contained"
                color="primary"
                disabled={loading}
              >
                {loading ? (
                  <CircularProgress size={24} color="inherit" />
                ) : (
                  editingNotification ? 'Update Notification' : 'Post Notification'
                )}
              </Button>
              
              {editingNotification && (
                <Button
                  variant="outlined"
                  onClick={() => {
                    setEditingNotification(null);
                    setTitle('');
                    setContent('');
                  }}
                >
                  Cancel Edit
                </Button>
              )}
            </Stack>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Existing Notifications
          </Typography>
          <List>
            {notifications.map((notification, index) => (
              <React.Fragment key={notification.id}>
                {index > 0 && <Divider />}
                <ListItem
                  secondaryAction={
                    <Stack direction="row" spacing={1}>
                      <IconButton 
                        edge="end" 
                        aria-label="edit"
                        onClick={() => handleEdit(notification)}
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton 
                        edge="end" 
                        aria-label="delete"
                        onClick={() => confirmDelete(notification)}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Stack>
                  }
                >
                  <ListItemText
                    primary={notification.title}
                    secondary={new Date(notification.createdAt?.seconds * 1000).toLocaleString()}
                  />
                </ListItem>
              </React.Fragment>
            ))}
          </List>
        </CardContent>
      </Card>

      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          Are you sure you want to delete the notification "{selectedNotification?.title}"?
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleSnackbarClose}
      >
        <Alert
          onClose={handleSnackbarClose}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default NotificationGenerator;
