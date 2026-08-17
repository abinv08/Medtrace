import React, { useState, useEffect } from 'react';
import {
  IconButton,
  Badge,
  Popover,
  Box,
  Typography,
  Divider,
  Button,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  CircularProgress,
  Tooltip,
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  Medication,
  CalendarMonth,
  WarningAmber,
  Science,
  CheckCircle,
  DoneAll,
  Circle,
} from '@mui/icons-material';
import {
  AppNotification,
  fetchUserNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '../services/notificationService';

interface NotificationBellProps {
  userId: string;
}

const categoryIcons: Record<string, React.ReactElement> = {
  medication: <Medication sx={{ fontSize: 18, color: '#D97706' }} />,
  appointment: <CalendarMonth sx={{ fontSize: 18, color: '#7C3AED' }} />,
  anomaly: <WarningAmber sx={{ fontSize: 18, color: '#DC2626' }} />,
  test_result: <Science sx={{ fontSize: 18, color: '#00838F' }} />,
  doctor_approval: <CheckCircle sx={{ fontSize: 18, color: '#059669' }} />,
  general: <NotificationsIcon sx={{ fontSize: 18, color: '#1565C0' }} />,
};

export const NotificationBell: React.FC<NotificationBellProps> = ({ userId }) => {
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);

  const loadNotifications = async () => {
    if (!userId) return;
    try {
      const data = await fetchUserNotifications(userId);
      setNotifications(data);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadNotifications();
    const timer = setInterval(loadNotifications, 20000);
    return () => clearInterval(timer);
  }, [userId]);

  const handleOpen = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
    loadNotifications();
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleMarkRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await markNotificationRead(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead(userId);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const unreadCount = notifications.filter((n) => !n.read).length;
  const open = Boolean(anchorEl);

  const fmtRelative = (iso: string) => {
    if (!iso) return '';
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  return (
    <>
      <Tooltip title="Notifications">
        <IconButton size="small" onClick={handleOpen} sx={{ color: '#64748B' }}>
          <Badge badgeContent={unreadCount} color="error" max={99}>
            <NotificationsIcon sx={{ fontSize: 22 }} />
          </Badge>
        </IconButton>
      </Tooltip>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{
          sx: {
            width: 380,
            maxHeight: 480,
            borderRadius: 3,
            boxShadow: '0 10px 30px rgba(0,0,0,0.12)',
            border: '1px solid #E2E8F0',
            overflow: 'hidden',
          },
        }}
      >
        {/* Header */}
        <Box
          sx={{
            p: 2,
            backgroundColor: '#F8FAFC',
            borderBottom: '1px solid #E2E8F0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Box display="flex" alignItems="center" gap={1}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#1E293B' }}>
              Notifications
            </Typography>
            {unreadCount > 0 && (
              <Chip
                label={`${unreadCount} new`}
                size="small"
                sx={{
                  backgroundColor: '#EF4444',
                  color: '#fff',
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  height: 20,
                }}
              />
            )}
          </Box>
          {unreadCount > 0 && (
            <Button
              size="small"
              startIcon={<DoneAll sx={{ fontSize: 16 }} />}
              onClick={handleMarkAllRead}
              sx={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'none', py: 0 }}
            >
              Mark all read
            </Button>
          )}
        </Box>

        {/* Notifications List */}
        <List sx={{ p: 0, maxHeight: 400, overflowY: 'auto' }}>
          {notifications.length === 0 ? (
            <Box py={6} textAlign="center" color="#94A3B8">
              <NotificationsIcon sx={{ fontSize: 40, opacity: 0.3, mb: 1 }} />
              <Typography variant="body2">No notifications right now.</Typography>
            </Box>
          ) : (
            notifications.map((n) => (
              <ListItem
                key={n.id}
                alignItems="flex-start"
                onClick={() => markNotificationRead(n.id)}
                sx={{
                  p: 1.75,
                  cursor: 'pointer',
                  backgroundColor: n.read ? '#FFFFFF' : '#EFF6FF',
                  borderBottom: '1px solid #F1F5F9',
                  transition: 'background-color 0.15s',
                  '&:hover': { backgroundColor: n.read ? '#F8FAFC' : '#E0E7FF' },
                }}
              >
                <ListItemIcon sx={{ minWidth: 32, mt: 0.5 }}>
                  {categoryIcons[n.category] || categoryIcons.general}
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Box display="flex" alignItems="center" justifyContent="space-between" mb={0.25}>
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: n.read ? 600 : 800,
                          color: '#1E293B',
                          fontSize: '0.82rem',
                          lineHeight: 1.3,
                        }}
                      >
                        {n.title}
                      </Typography>
                      {!n.read && (
                        <Circle sx={{ fontSize: 8, color: '#3B82F6', ml: 1 }} />
                      )}
                    </Box>
                  }
                  secondary={
                    <Box>
                      <Typography
                        variant="caption"
                        sx={{ color: '#64748B', display: 'block', fontSize: '0.75rem', mb: 0.5 }}
                      >
                        {n.message}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{ color: '#94A3B8', fontSize: '0.68rem', fontWeight: 600 }}
                      >
                        {fmtRelative(n.createdAt)}
                      </Typography>
                    </Box>
                  }
                />
              </ListItem>
            ))
          )}
        </List>
      </Popover>
    </>
  );
};
