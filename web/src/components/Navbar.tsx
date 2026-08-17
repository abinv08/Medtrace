import React, { useState } from 'react';
import {
  AppBar,
  Toolbar,
  Box,
  Button,
  Container,
  Chip,
  Avatar,
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Typography,
} from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Logout,
  Menu as MenuIcon,
  Close as CloseIcon,
  Dashboard as DashboardIcon,
  Home as HomeIcon,
  Info as InfoIcon,
  Star as FeaturesIcon,
  ContactSupport as ContactIcon,
} from '@mui/icons-material';
import { MedTraceLogo } from './Logo';
import { useAuth } from '../contexts/AuthContext';

export const Navbar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const getDashboardPath = () => {
    if (!user?.role) return '/dashboard/patient';
    return `/dashboard/${user.role.toLowerCase().replace(/\s+/g, '-')}`;
  };

  const dashboardPath = getDashboardPath();

  const navItems = user
    ? [
        { label: 'Home', path: '/', isHome: true, icon: <HomeIcon fontSize="small" /> },
        { label: 'Dashboard', path: dashboardPath, isDashboard: true, icon: <DashboardIcon fontSize="small" /> },
        { label: 'About', path: '/#about', icon: <InfoIcon fontSize="small" /> },
        { label: 'Features', path: '/#features', icon: <FeaturesIcon fontSize="small" /> },
        { label: 'Contact', path: '/#contact', icon: <ContactIcon fontSize="small" /> },
      ]
    : [
        { label: 'Home', path: '/', isHome: true, icon: <HomeIcon fontSize="small" /> },
        { label: 'About', path: '/#about', icon: <InfoIcon fontSize="small" /> },
        { label: 'Features', path: '/#features', icon: <FeaturesIcon fontSize="small" /> },
        { label: 'Contact', path: '/#contact', icon: <ContactIcon fontSize="small" /> },
      ];

  const isCurrent = (item: (typeof navItems)[0]) => {
    if (item.isHome) {
      return location.pathname === '/' && !location.hash;
    }
    if (item.isDashboard) {
      return location.pathname.startsWith('/dashboard');
    }
    if (item.path.startsWith('/#')) {
      return location.pathname === '/' && location.hash === item.path.substring(1);
    }
    return location.pathname === item.path;
  };

  const handleNavClick = (item: (typeof navItems)[0]) => {
    setMobileOpen(false);
    if (item.isHome) {
      if (location.pathname === '/') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        navigate('/');
      }
    } else if (item.isDashboard) {
      navigate(item.path);
    } else if (item.path.startsWith('/#')) {
      const targetId = item.path.substring(2);
      if (location.pathname === '/') {
        const element = document.getElementById(targetId);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
        } else {
          window.location.hash = targetId;
        }
      } else {
        navigate(item.path);
      }
    } else {
      navigate(item.path);
    }
  };

  const handleSignOut = () => {
    setMobileOpen(false);
    logout();
    navigate('/login');
  };

  return (
    <AppBar
      position="sticky"
      elevation={0}
      sx={{
        backgroundColor: 'rgba(255, 255, 255, 0.85)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid #E2E8F0',
        color: '#0F172A',
        zIndex: 1100,
      }}
    >
      <Container maxWidth="xl">
        <Toolbar disableGutters sx={{ justifyContent: 'space-between', height: 72 }}>
          <Box sx={{ cursor: 'pointer' }} onClick={() => navigate('/')}>
            <MedTraceLogo variant="full" size="medium" />
          </Box>

          {/* Desktop Nav items — shown with Dashboard after Home when logged in */}
          {user && (
            <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 3, alignItems: 'center' }}>
              {navItems.map((item) => {
                const active = isCurrent(item);
                return (
                  <Button
                    key={item.label}
                    onClick={() => handleNavClick(item)}
                    sx={{
                      color: active ? '#2563EB' : '#475569',
                      fontWeight: active ? 700 : 600,
                      fontSize: '0.95rem',
                      px: 1.5,
                      py: 0.8,
                      borderRadius: '10px',
                      backgroundColor: active ? 'rgba(37, 99, 235, 0.08)' : 'transparent',
                      '&:hover': {
                        color: '#2563EB',
                        backgroundColor: 'rgba(37, 99, 235, 0.06)',
                      },
                      transition: 'all 0.2s ease',
                    }}
                  >
                    {item.label}
                  </Button>
                );
              })}
            </Box>
          )}

          {/* Right-side actions */}
          <Box display="flex" gap={1.5} alignItems="center">
            {user ? (
              <>
                {/* User identity chip */}
                <Chip
                  avatar={
                    <Avatar sx={{ backgroundColor: '#2563EB', color: '#fff !important', fontSize: '0.75rem', fontWeight: 700 }}>
                      {user.name?.charAt(0).toUpperCase() || 'U'}
                    </Avatar>
                  }
                  label={
                    <Box display="flex" alignItems="center" gap={0.5}>
                      <span>{user.name?.split(' ')[0] || 'User'}</span>
                      {user.role && (
                        <Box
                          component="span"
                          sx={{
                            fontSize: '0.7rem',
                            color: '#2563EB',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                          }}
                        >
                          ({user.role})
                        </Box>
                      )}
                    </Box>
                  }
                  sx={{
                    backgroundColor: 'rgba(37, 99, 235, 0.08)',
                    color: '#1E293B',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    height: 36,
                    borderRadius: '999px',
                    border: '1px solid rgba(37, 99, 235, 0.15)',
                    display: { xs: 'none', sm: 'inline-flex' },
                  }}
                />

                {/* Sign Out button */}
                <Button
                  variant="outlined"
                  onClick={handleSignOut}
                  startIcon={<Logout sx={{ fontSize: '1rem !important' }} />}
                  sx={{
                    borderRadius: '999px',
                    borderColor: '#EF4444',
                    color: '#EF4444',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    px: 2.5,
                    py: 0.8,
                    display: { xs: 'none', sm: 'inline-flex' },
                    '&:hover': {
                      borderColor: '#DC2626',
                      backgroundColor: 'rgba(239, 68, 68, 0.06)',
                    },
                  }}
                >
                  Sign Out
                </Button>

                {/* Mobile Hamburger Menu button */}
                <IconButton
                  onClick={() => setMobileOpen(true)}
                  sx={{ display: { xs: 'flex', md: 'none' }, color: '#1E293B' }}
                >
                  <MenuIcon />
                </IconButton>
              </>
            ) : (
              <>
                {/* Login + Get Started for unauthenticated users */}
                <Button
                  variant="text"
                  onClick={() => navigate('/login')}
                  sx={{ fontWeight: 600, color: '#2563EB' }}
                >
                  Login
                </Button>
                <Button
                  variant="contained"
                  onClick={() => navigate('/register')}
                  sx={{
                    borderRadius: 12,
                    background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
                    fontWeight: 600,
                  }}
                >
                  Get Started
                </Button>
              </>
            )}
          </Box>
        </Toolbar>
      </Container>

      {/* Mobile Navigation Drawer */}
      <Drawer
        anchor="right"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        PaperProps={{
          sx: { width: 280, p: 2, backgroundColor: '#FFFFFF' },
        }}
      >
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <MedTraceLogo variant="icon" size="small" />
          <IconButton onClick={() => setMobileOpen(false)} size="small">
            <CloseIcon />
          </IconButton>
        </Box>

        {user && (
          <Box
            sx={{
              p: 2,
              mb: 2,
              borderRadius: 2,
              backgroundColor: '#EFF6FF',
              border: '1px solid rgba(37, 99, 235, 0.15)',
            }}
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#1E293B' }}>
              {user.name || 'User'}
            </Typography>
            <Typography variant="caption" sx={{ color: '#2563EB', fontWeight: 600 }}>
              {user.role || 'Patient'}
            </Typography>
          </Box>
        )}

        <List disablePadding>
          {navItems.map((item) => {
            const active = isCurrent(item);
            return (
              <ListItem key={item.label} disablePadding sx={{ mb: 0.5 }}>
                <ListItemButton
                  onClick={() => handleNavClick(item)}
                  sx={{
                    borderRadius: 2,
                    backgroundColor: active ? 'rgba(37, 99, 235, 0.08)' : 'transparent',
                    color: active ? '#2563EB' : '#334155',
                    fontWeight: active ? 700 : 500,
                  }}
                >
                  <ListItemIcon sx={{ color: active ? '#2563EB' : '#64748B', minWidth: 36 }}>
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={item.label}
                    primaryTypographyProps={{
                      fontSize: '0.95rem',
                      fontWeight: active ? 700 : 500,
                    }}
                  />
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>

        {user && (
          <>
            <Divider sx={{ my: 2 }} />
            <Button
              fullWidth
              variant="outlined"
              onClick={handleSignOut}
              startIcon={<Logout />}
              sx={{
                borderRadius: 2,
                borderColor: '#EF4444',
                color: '#EF4444',
                fontWeight: 600,
                py: 1,
                '&:hover': {
                  borderColor: '#DC2626',
                  backgroundColor: 'rgba(239, 68, 68, 0.06)',
                },
              }}
            >
              Sign Out
            </Button>
          </>
        )}
      </Drawer>
    </AppBar>
  );
};
