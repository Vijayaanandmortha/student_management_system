import React, { useEffect, useState, useCallback } from 'react';
import { Dialog, DialogTitle, DialogContent, Typography, DialogActions, Button } from '@mui/material';

function ExamMonitor({ onExamClose }) {
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [showWarning, setShowWarning] = useState(false);
  const [warningMessage, setWarningMessage] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);

  const handleTabSwitch = useCallback(() => {
    setTabSwitchCount(prev => {
      const newCount = prev + 1;
      if (newCount <= 3) {
        setShowWarning(true);
        setWarningMessage(`Warning: You have switched tabs or minimized the window ${newCount} time${newCount > 1 ? 's' : ''}. After 3 attempts, your exam will be automatically closed.`);
      }
      if (newCount > 3) {
        onExamClose();
      }
      return newCount;
    });
  }, [onExamClose]);

  // Handle visibility change
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        handleTabSwitch();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [handleTabSwitch]);

  // Handle window blur
  useEffect(() => {
    const handleBlur = () => {
      if (!document.hidden) { // Only count if not already counted by visibilitychange
        handleTabSwitch();
      }
    };

    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('blur', handleBlur);
    };
  }, [handleTabSwitch]);

  // Handle fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = document.fullscreenElement !== null;
      setIsFullscreen(isCurrentlyFullscreen);
      
      if (!isCurrentlyFullscreen && isFullscreen) {
        handleTabSwitch();
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [handleTabSwitch, isFullscreen]);

  // Request fullscreen on component mount
  useEffect(() => {
    const requestFullscreen = async () => {
      try {
        if (!document.fullscreenElement) {
          await document.documentElement.requestFullscreen();
        }
      } catch (error) {
        console.error('Error attempting to enable full-screen mode:', error);
      }
    };
    requestFullscreen();
  }, []);

  // Prevent right-click
  useEffect(() => {
    const handleContextMenu = (e) => {
      e.preventDefault();
    };

    document.addEventListener('contextmenu', handleContextMenu);
    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
    };
  }, []);

  // Prevent keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Prevent Alt+Tab, Windows key, Alt+F4, Ctrl+W, etc.
      if (
        (e.altKey && e.key === 'Tab') ||
        e.key === 'Meta' ||
        (e.altKey && e.key === 'F4') ||
        (e.ctrlKey && e.key === 'w') ||
        (e.ctrlKey && e.key === 't') ||
        (e.altKey && e.key === 'Escape')
      ) {
        e.preventDefault();
        handleTabSwitch();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleTabSwitch]);

  const handleCloseWarning = () => {
    setShowWarning(false);
  };

  return (
    <Dialog 
      open={showWarning} 
      onClose={handleCloseWarning}
      disableEscapeKeyDown
    >
      <DialogTitle sx={{ color: 'error.main', bgcolor: 'error.light', py: 2 }}>
        Warning!
      </DialogTitle>
      <DialogContent sx={{ mt: 2 }}>
        <Typography variant="body1" sx={{ color: 'error.main', fontWeight: 'medium' }}>
          {warningMessage}
        </Typography>
        {tabSwitchCount <= 3 && (
          <Typography sx={{ mt: 2, color: 'warning.main', fontWeight: 'bold' }}>
            Remaining attempts: {3 - tabSwitchCount}
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button 
          onClick={handleCloseWarning} 
          variant="contained" 
          color="primary"
          sx={{ mb: 1, mr: 2 }}
        >
          I Understand
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default ExamMonitor;
