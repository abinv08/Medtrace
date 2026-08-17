import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Container,
  Grid,
  Typography,
  TextField,
  Button,
  FormControlLabel,
  Checkbox,
  Divider,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
  Chip,
} from '@mui/material';
import { useForm, Controller } from 'react-hook-form';
import * as yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
import { useNavigate, Link } from 'react-router-dom';
import {
  Google as GoogleIcon,
  LockOutlined,
  EmailOutlined,
  MonitorHeart,
  DocumentScanner,
  Sensors,
  LockRounded,
  VerifiedUser,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { MedTraceLogo } from '../components/Logo';
import { authService } from '../services/authService';

// ─── Validation schema (unchanged) ───────────────────────────────────────────
const loginSchema = yup.object().shape({
  email: yup.string().email('Please enter a valid email address').required('Email is required'),
  password: yup.string().min(6, 'Password must be at least 6 characters').required('Password is required'),
  rememberMe: yup.boolean().default(false),
});

// ─── Capability list rendered in the left panel ──────────────────────────────
const CAPABILITIES = [
  {
    icon: <MonitorHeart sx={{ fontSize: 18, color: '#1565C0' }} />,
    label: 'Real-time IoT Respiratory Monitoring',
  },
  {
    icon: <DocumentScanner sx={{ fontSize: 18, color: '#1565C0' }} />,
    label: 'AI-Powered Medical Report Analysis',
  },
  {
    icon: <Sensors sx={{ fontSize: 18, color: '#1565C0' }} />,
    label: 'Wi-Fi CSI Contactless Ward Sensing',
  },
  {
    icon: <VerifiedUser sx={{ fontSize: 18, color: '#1565C0' }} />,
    label: 'HIPAA-Compliant Data Handling',
  },
];

// ─── Component ────────────────────────────────────────────────────────────────
export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, googleLogin } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSubmitting, setForgotSubmitting] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: yupResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
      rememberMe: false,
    },
  });

  // ─── Handlers (hardened logic) ─────────────────────────────────────────────
  const onSubmit = async (data: any) => {
    setSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await login(data);
      if (res.success && res.user) {
        setSnackbarMessage('Login successful! Redirecting...');
        const userRole = res.user?.role || 'patient';
        const roleSlug = userRole.toLowerCase().replace(/\s+/g, '-');
        setTimeout(() => navigate(`/dashboard/${roleSlug}`), 800);
      } else {
        setErrorMessage(res.message || 'Login failed. Please check your credentials.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'An unexpected error occurred during login');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await googleLogin();
      if (res.success && res.user) {
        setSnackbarMessage('Google Authentication Successful!');
        const userRole = res.user?.role || 'patient';
        const roleSlug = userRole.toLowerCase().replace(/\s+/g, '-');
        setTimeout(() => navigate(`/dashboard/${roleSlug}`), 800);
      } else {
        setErrorMessage(res.message || 'Google Login failed');
      }
    } catch (e: any) {
      setErrorMessage(e?.message || 'Google Login failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotPasswordSubmit = async () => {
    if (!forgotEmail) return;
    setForgotSubmitting(true);
    try {
      const res = await authService.forgotPassword(forgotEmail);
      setSnackbarMessage(res.message || 'Password reset email sent!');
    } catch (err: any) {
      setSnackbarMessage(err?.message || 'Failed to send reset email.');
    } finally {
      setForgotSubmitting(false);
      setForgotOpen(false);
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F0F4F8',
        p: 2,
      }}
    >
      <Container maxWidth="lg" sx={{ maxWidth: '1020px !important' }}>
        <Card
          sx={{
            borderRadius: 3,
            boxShadow: '0px 2px 8px rgba(21,101,192,0.08), 0px 8px 32px rgba(21,101,192,0.06)',
            overflow: 'hidden',
            border: '1px solid #CFD8DC',
          }}
        >
          <Grid container>
            {/* ── Left informational panel (desktop only) ───────────────────── */}
            <Grid
              item
              xs={12}
              md={5}
              sx={{
                backgroundColor: '#EFF6FF',
                borderRight: '1px solid #CFD8DC',
                p: { xs: 4, md: 5 },
                display: { xs: 'none', md: 'flex' },
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              {/* Top: logo + headline */}
              <Box>
                <MedTraceLogo variant="full" size="medium" />

                <Box sx={{ mt: 5, mb: 4 }}>
                  <Typography
                    variant="h5"
                    sx={{ fontWeight: 700, color: '#1A2B4A', lineHeight: 1.35, mb: 1 }}
                  >
                    AI Clinical Intelligence
                    <br />& Patient Monitoring
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#546E7A', lineHeight: 1.7 }}>
                    Designed for hospital professionals. Trusted in clinical environments.
                  </Typography>
                </Box>

                {/* Capabilities list */}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                  {CAPABILITIES.map((cap) => (
                    <Box key={cap.label} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                      <Box
                        sx={{
                          mt: '2px',
                          p: 0.75,
                          borderRadius: 1.5,
                          backgroundColor: '#DBEAFE',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        {cap.icon}
                      </Box>
                      <Typography variant="body2" sx={{ color: '#374151', fontWeight: 500, lineHeight: 1.5 }}>
                        {cap.label}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Box>

              {/* Bottom: system note */}
              <Box
                sx={{
                  mt: 4,
                  pt: 3,
                  borderTop: '1px solid #BFDBFE',
                }}
              >
                <Typography variant="caption" sx={{ color: '#546E7A', fontWeight: 500, letterSpacing: '0.03em' }}>
                  CENTRAL AUTHENTICATION
                </Typography>
                <Typography variant="body2" sx={{ color: '#546E7A', mt: 0.5, lineHeight: 1.6 }}>
                  Single sign-on shared across the React web portal and Flutter mobile application.
                </Typography>
              </Box>
            </Grid>

            {/* ── Right: login form ─────────────────────────────────────────── */}
            <Grid item xs={12} md={7}>
              {/* Secure portal header strip */}
              <Box
                sx={{
                  px: { xs: 3, sm: 5 },
                  py: 1.5,
                  backgroundColor: '#F8FAFC',
                  borderBottom: '1px solid #CFD8DC',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <Box sx={{ display: { md: 'none' } }}>
                  <MedTraceLogo variant="full" size="small" />
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 'auto' }}>
                  <LockRounded sx={{ fontSize: 13, color: '#546E7A' }} />
                  <Typography variant="caption" sx={{ color: '#546E7A', fontWeight: 500, letterSpacing: '0.03em' }}>
                    SECURE CLINICAL PORTAL
                  </Typography>
                </Box>
              </Box>

              {/* Form body */}
              <Box sx={{ p: { xs: 3, sm: 5 } }}>
                <CardContent sx={{ p: 0 }}>
                  <Box mb={3}>
                    <Typography variant="h5" sx={{ fontWeight: 700, color: '#1A2B4A', mb: 0.5 }}>
                      Sign In
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#546E7A' }}>
                      Access your MedTrace clinical workspace
                    </Typography>
                  </Box>

                  {errorMessage && (
                    <Alert severity="error" sx={{ mb: 3 }}>
                      {errorMessage}
                    </Alert>
                  )}

                  <form onSubmit={handleSubmit(onSubmit)} noValidate>
                    {/* Email */}
                    <Controller
                      name="email"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          id="login-email"
                          fullWidth
                          label="Email Address"
                          placeholder="doctor@hospital.org"
                          margin="normal"
                          error={Boolean(errors.email)}
                          helperText={errors.email?.message}
                          autoComplete="email"
                          InputProps={{
                            startAdornment: <EmailOutlined sx={{ color: '#90A4AE', mr: 1, fontSize: 20 }} />,
                          }}
                        />
                      )}
                    />

                    {/* Password */}
                    <Controller
                      name="password"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          id="login-password"
                          fullWidth
                          type="password"
                          label="Password"
                          placeholder="••••••••"
                          margin="normal"
                          error={Boolean(errors.password)}
                          helperText={errors.password?.message}
                          autoComplete="current-password"
                          InputProps={{
                            startAdornment: <LockOutlined sx={{ color: '#90A4AE', mr: 1, fontSize: 20 }} />,
                          }}
                        />
                      )}
                    />

                    {/* Remember me / Forgot password row */}
                    <Box display="flex" justifyContent="space-between" alignItems="center" mt={1} mb={0.5}>
                      <Controller
                        name="rememberMe"
                        control={control}
                        render={({ field: { value, onChange } }) => (
                          <FormControlLabel
                            control={
                              <Checkbox
                                checked={value}
                                onChange={onChange}
                                color="primary"
                                size="small"
                              />
                            }
                            label={
                              <Typography variant="body2" sx={{ color: '#546E7A' }}>
                                Remember me
                              </Typography>
                            }
                          />
                        )}
                      />

                      <Typography
                        variant="body2"
                        component="span"
                        onClick={() => setForgotOpen(true)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => e.key === 'Enter' && setForgotOpen(true)}
                        sx={{
                          color: '#1565C0',
                          cursor: 'pointer',
                          fontWeight: 500,
                          '&:hover': { textDecoration: 'underline' },
                          '&:focus-visible': {
                            outline: '2px solid #1565C0',
                            outlineOffset: '2px',
                            borderRadius: '2px',
                          },
                        }}
                      >
                        Forgot password?
                      </Typography>
                    </Box>

                    {/* Primary CTA */}
                    <Button
                      type="submit"
                      fullWidth
                      variant="contained"
                      size="large"
                      disabled={submitting}
                      sx={{
                        py: 1.4,
                        mt: 2.5,
                        mb: 1,
                        fontSize: '0.9375rem',
                        fontWeight: 600,
                        backgroundColor: '#1565C0',
                        '&:hover': { backgroundColor: '#0D47A1' },
                      }}
                    >
                      {submitting ? <CircularProgress size={22} color="inherit" /> : 'Sign In to MedTrace'}
                    </Button>

                    {/* Trust caption */}
                    <Box display="flex" alignItems="center" justifyContent="center" gap={0.75} mb={2}>
                      <LockRounded sx={{ fontSize: 12, color: '#90A4AE' }} />
                      <Typography variant="caption" sx={{ color: '#90A4AE' }}>
                        HIPAA-compliant · End-to-end encrypted
                      </Typography>
                    </Box>

                    {/* Divider */}
                    <Divider sx={{ my: 2 }}>
                      <Typography variant="caption" sx={{ color: '#90A4AE', fontWeight: 500 }}>
                        OR
                      </Typography>
                    </Divider>

                    {/* Google SSO */}
                    <Button
                      fullWidth
                      variant="outlined"
                      onClick={handleGoogleSignIn}
                      disabled={submitting}
                      startIcon={<GoogleIcon sx={{ color: '#DB4437' }} />}
                      sx={{
                        py: 1.3,
                        borderColor: '#CFD8DC',
                        color: '#374151',
                        fontWeight: 500,
                        backgroundColor: '#FFFFFF',
                        '&:hover': {
                          borderColor: '#1565C0',
                          backgroundColor: '#EFF6FF',
                        },
                      }}
                    >
                      Sign in with Google
                    </Button>
                  </form>

                  {/* Switch to register */}
                  <Box mt={4} pt={3} borderTop="1px solid #CFD8DC" textAlign="center">
                    <Typography variant="body2" sx={{ color: '#546E7A' }}>
                      Need a new account?{' '}
                      <Link
                        to="/register"
                        style={{ color: '#1565C0', fontWeight: 600, textDecoration: 'none' }}
                      >
                        Register here
                      </Link>
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#90A4AE', display: 'block', mt: 1 }}>
                      Contact your Hospital Administrator to create an account.
                    </Typography>
                  </Box>
                </CardContent>
              </Box>
            </Grid>
          </Grid>
        </Card>
      </Container>

      {/* ── Forgot Password dialog ─────────────────────────────────────────── */}
      <Dialog
        open={forgotOpen}
        onClose={() => setForgotOpen(false)}
        maxWidth="xs"
        fullWidth
        aria-labelledby="forgot-password-title"
      >
        <DialogTitle id="forgot-password-title" sx={{ fontWeight: 700, color: '#1A2B4A', pb: 1 }}>
          Reset Password
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: '#546E7A', mb: 2.5 }}>
            Enter your registered hospital email address and we will send you a password reset link.
          </Typography>
          <TextField
            autoFocus
            fullWidth
            id="forgot-email"
            label="Email Address"
            placeholder="doctor@hospital.org"
            value={forgotEmail}
            onChange={(e) => setForgotEmail(e.target.value)}
            autoComplete="email"
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setForgotOpen(false)} color="inherit" sx={{ color: '#546E7A' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleForgotPasswordSubmit}
            disabled={forgotSubmitting || !forgotEmail}
            sx={{ backgroundColor: '#1565C0', '&:hover': { backgroundColor: '#0D47A1' } }}
          >
            {forgotSubmitting ? <CircularProgress size={18} color="inherit" /> : 'Send Reset Link'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Snackbar ──────────────────────────────────────────────────────── */}
      <Snackbar
        open={Boolean(snackbarMessage)}
        autoHideDuration={4000}
        onClose={() => setSnackbarMessage(null)}
        message={snackbarMessage}
      />
    </Box>
  );
};
