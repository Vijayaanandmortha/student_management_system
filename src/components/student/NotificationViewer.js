import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Badge,
  Divider,
  List,
  ListItem,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  useTheme,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { getAuth } from 'firebase/auth';
import DOMPurify from 'dompurify';

function NotificationViewer() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const theme = useTheme();
  const auth = getAuth();

  useEffect(() => {
    const q = query(
      collection(db, 'notifications'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notificationsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate().toLocaleString() || 'Unknown date'
      }));
      
      setNotifications(notificationsData);
      setLoading(false);
      
      // Calculate unread notifications
      const currentUserId = auth.currentUser?.uid;
      if (currentUserId) {
        const unreadNotifications = notificationsData.filter(
          notification => !notification.read?.includes(currentUserId)
        );
        setUnreadCount(unreadNotifications.length);
      }
    });

    return () => unsubscribe();
  }, [auth.currentUser]);

  const handleNotificationClick = async (notification) => {
    setSelectedNotification(notification);
    
    // Mark as read
    const currentUserId = auth.currentUser?.uid;
    if (currentUserId && !notification.read?.includes(currentUserId)) {
      try {
        await updateDoc(doc(db, 'notifications', notification.id), {
          read: arrayUnion(currentUserId)
        });
      } catch (error) {
        console.error('Error marking notification as read:', error);
      }
    }
  };

  const handleClose = () => {
    setSelectedNotification(null);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', p: 2 }}>
      <Card>
        <CardContent>
          <Box display="flex" alignItems="center" mb={2}>
            <Typography variant="h5">
              Notifications
            </Typography>
            {unreadCount > 0 && (
              <Badge
                badgeContent={unreadCount}
                color="error"
                sx={{ ml: 2 }}
              />
            )}
          </Box>

          <List>
            {notifications.map((notification, index) => {
              const isUnread = !notification.read?.includes(auth.currentUser?.uid);
              return (
                <React.Fragment key={notification.id}>
                  <ListItem
                    button
                    onClick={() => handleNotificationClick(notification)}
                    sx={{
                      backgroundColor: isUnread ? theme.palette.action.hover : 'inherit',
                      '&:hover': {
                        backgroundColor: theme.palette.action.selected,
                      },
                    }}
                  >
                    <ListItemText
                      primary={
                        <Typography
                          variant="subtitle1"
                          sx={{
                            fontWeight: isUnread ? 'bold' : 'normal',
                          }}
                        >
                          {notification.title}
                        </Typography>
                      }
                      secondary={notification.createdAt}
                    />
                  </ListItem>
                  {index < notifications.length - 1 && <Divider />}
                </React.Fragment>
              );
            })}
          </List>
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(selectedNotification)}
        onClose={handleClose}
        maxWidth="md"
        fullWidth
      >
        {selectedNotification && (
          <>
            <DialogTitle>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                {selectedNotification.title}
                <IconButton onClick={handleClose}>
                  <CloseIcon />
                </IconButton>
              </Box>
            </DialogTitle>
            <DialogContent>
              <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                Posted on: {selectedNotification.createdAt}
              </Typography>
              <Box mt={2}>
                <div
                  dangerouslySetInnerHTML={{
                    __html: DOMPurify.sanitize(selectedNotification.content)
                  }}
                />
              </Box>
            </DialogContent>
          </>
        )}
      </Dialog>
    </Box>
  );
}

export default NotificationViewer;
