import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Container,
  Typography,
  TextField,
  Button,
  Grid,
  FormControlLabel,
  Checkbox,
  Divider,
  Alert,
  CircularProgress,
  Snackbar,
  MenuItem,
} from '@mui/material';
import {
  PersonOutlined,
  ShieldOutlined,
  Google as GoogleIcon,
  LockRounded,
  MedicalServices,
} from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import * as yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { MedTraceLogo } from '../components/Logo';

// ─── Role definitions ─────────────────────────────────────────────────────────
interface RoleDefinition {
  value: string;
  label: string;
  description: string;
  icon: React.ReactElement;
}

const ROLE_DEFINITIONS: RoleDefinition[] = [
  {
    value: 'Patient',
    label: 'Patient',
    description: 'Personal health records',
    icon: <PersonOutlined sx={{ fontSize: 22 }} />,
  },
  {
    value: 'Guardian',
    label: 'Guardian',
    description: 'Dependent oversight',
    icon: <ShieldOutlined sx={{ fontSize: 22 }} />,
  },
  {
    value: 'Doctor',
    label: 'Doctor',
    description: 'Requires admin approval',
    icon: <LockRounded sx={{ fontSize: 22 }} />,
  },
  {
    value: 'Nurse',
    label: 'Nurse',
    description: 'Ward monitoring access',
    icon: <ShieldOutlined sx={{ fontSize: 22 }} />,
  },
];

export const COMMON_SPECIALIZATIONS = [
  'General Medicine',
  'Cardiology',
  'Neurology',
  'Pediatrics',
  'Orthopedics',
  'Dermatology',
  'Oncology',
  'Radiology',
  'Obstetrics & Gynecology',
  'Psychiatry',
  'General Surgery',
  'Anesthesiology',
  'Emergency Medicine',
  'Pathology',
  'Endocrinology',
  'Gastroenterology',
  'Pulmonology',
  'Nephrology',
  'Ophthalmology',
  'ENT (Otolaryngology)',
  'Nursing & Clinical Care',
  'Other Specialization',
];

// ─── Validation schema ───────────────────────────────────────────────────────
const registerSchema = yup.object().shape({
  name: yup.string().required('Full Name is required'),
  email: yup.string().email('Enter a valid email address').required('Email is required'),
  phone: yup
    .string()
    .matches(/^\+?[0-9\s-]{7,15}$/, 'Enter a valid phone number')
    .required('Phone number is required'),
  password: yup
    .string()
    .min(8, 'Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Must contain 1 uppercase, 1 lowercase & 1 number')
    .required('Password is required'),
  role: yup.string().required('Role selection is required'),
  specialization: yup.string().when('role', {
    is: (val: string) => val === 'Doctor' || val === 'Nurse',
    then: (schema) => schema.required('Specialization is required for medical practitioners'),
    otherwise: (schema) => schema.notRequired(),
  }),
  licenseNumber: yup.string().when('role', {
    is: (val: string) => val === 'Doctor' || val === 'Nurse',
    then: (schema) => schema.required('Medical License number is required'),
    otherwise: (schema) => schema.notRequired(),
  }),
  registeredDate: yup.string().when('role', {
    is: (val: string) => val === 'Doctor' || val === 'Nurse',
    then: (schema) => schema.required('Registered Date is required'),
    otherwise: (schema) => schema.notRequired(),
  }),
  agreeToTerms: yup
    .boolean()
    .oneOf([true], 'You must agree to the Privacy Policy')
    .required(),
});

// ─── Role Tile component ─────────────────────────────────────────────────────
interface RoleTileProps {
  role: RoleDefinition;
  selected: boolean;
  onSelect: () => void;
}

const RoleTile: React.FC<RoleTileProps> = ({ role, selected, onSelect }) => (
  <Box
    role="radio"
    aria-checked={selected}
    aria-label={`${role.label} — ${role.description}`}
    tabIndex={0}
    onClick={onSelect}
    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect()}
    sx={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 0.75,
      p: 1.75,
      borderRadius: 1.5,
      border: selected ? '2px solid #1565C0' : '1px solid #CFD8DC',
      backgroundColor: selected ? '#EFF6FF' : '#FAFAFA',
      color: selected ? '#1565C0' : '#546E7A',
      cursor: 'pointer',
      transition: 'all 0.15s ease',
      userSelect: 'none',
      '&:hover': {
        borderColor: '#1565C0',
        backgroundColor: '#EFF6FF',
        color: '#1565C0',
      },
      '&:focus-visible': {
        outline: '2px solid #1565C0',
        outlineOffset: '2px',
      },
    }}
  >
    {role.icon}
    <Typography
      variant="caption"
      sx={{
        fontWeight: 600,
        fontSize: '0.7rem',
        textAlign: 'center',
        lineHeight: 1.2,
        color: 'inherit',
      }}
    >
      {role.label}
    </Typography>
  </Box>
);

// ─── Section label ────────────────────────────────────────────────────────────
const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Typography
    variant="caption"
    sx={{
      display: 'block',
      fontWeight: 600,
      fontSize: '0.7rem',
      letterSpacing: '0.08em',
      color: '#90A4AE',
      textTransform: 'uppercase',
      mb: 1.5,
    }}
  >
    {children}
  </Typography>
);

// ─── Main component ───────────────────────────────────────────────────────────
export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { register: registerUser, googleLogin } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm({
    resolver: yupResolver(registerSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      password: '',
      role: 'Patient',
      specialization: '',
      licenseNumber: '',
      registeredDate: '',
      agreeToTerms: false,
    },
  });

  const currentRole = watch('role');
  const isDoctorRole = currentRole === 'Doctor' || currentRole === 'Nurse';

  // ─── Handlers ───────────────────────────────────────────────────────────────
  const onSubmit = async (data: any) => {
    setSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await registerUser({
        name: data.name,
        email: data.email,
        phone: data.phone,
        password: data.password,
        role: data.role,
        specialization: data.specialization,
        licenseNumber: data.licenseNumber,
        registeredDate: data.registeredDate,
        registrationDate: data.registeredDate,
        yearsExperience: (data as any).yearsExperience ? Number((data as any).yearsExperience) : undefined,
        qualifications: (data as any).qualifications,
      });

      if (res.success) {
        const userRole = res.user?.role || data.role || 'patient';
        const roleSlug = userRole.toLowerCase().replace(/\s+/g, '-');
        if (data.role === 'Doctor' || data.role === 'Nurse') {
          setSnackbarMessage('Account created! Pending admin approval — you will be notified once approved.');
          setTimeout(() => navigate(`/dashboard/${roleSlug}`), 1200);
        } else {
          setSnackbarMessage('Registration Successful! Redirecting to Dashboard...');
          setTimeout(() => navigate(`/dashboard/${roleSlug}`), 800);
        }
      } else {
        setErrorMessage(res.message || 'Registration failed. Please try again.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'An unexpected error occurred during registration');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignUp = async () => {
    setSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await googleLogin('Patient');
      if (res.success && res.user) {
        setSnackbarMessage('Google Registration Successful!');
        const userRole = res.user?.role || 'patient';
        const role = userRole.toLowerCase().replace(/\s+/g, '-');
        setTimeout(() => navigate('/'), 800);
      } else {
        setErrorMessage(res.message || 'Google Sign-Up failed');
      }
    } catch (e: any) {
      setErrorMessage(e?.message || 'Google Sign-Up failed');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <Box
      sx={{
        minHeight: '100vh',
        backgroundColor: '#F0F4F8',
        py: { xs: 3, md: 6 },
        px: 2,
      }}
    >
      <Container maxWidth="md">
        <Card
          sx={{
            borderRadius: 3,
            boxShadow: '0px 2px 8px rgba(21,101,192,0.08), 0px 8px 32px rgba(21,101,192,0.06)',
            border: '1px solid #CFD8DC',
            overflow: 'hidden',
          }}
        >
          {/* ── Page header ─────────────────────────────────────────────────── */}
          <Box
            sx={{
              px: { xs: 3, md: 4 },
              py: 2,
              backgroundColor: '#F8FAFC',
              borderBottom: '1px solid #CFD8DC',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 1,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <MedTraceLogo variant="full" size="small" />
            </Box>

          </Box>

          {/* ── Form body ───────────────────────────────────────────────────── */}
          <CardContent sx={{ p: { xs: 3, md: 4 } }}>
            <Box mb={3}>
              <Typography variant="h5" sx={{ fontWeight: 700, color: '#1A2B4A', mb: 0.5 }}>
                Create Your Account
              </Typography>
              <Typography variant="body2" sx={{ color: '#546E7A' }}>
                Join the MedTrace clinical intelligence network. Already registered?{' '}
                <Link to="/login" style={{ color: '#1565C0', fontWeight: 600, textDecoration: 'none' }}>
                  Sign in
                </Link>
              </Typography>
            </Box>

            {errorMessage && (
              <Alert severity="error" sx={{ mb: 3 }}>
                {errorMessage}
              </Alert>
            )}

            <form onSubmit={handleSubmit(onSubmit)} noValidate>
              {/* ── Section 1: Role selector ─────────────────────────────── */}
              <Box mb={3.5}>
                <SectionLabel>Select Your Role</SectionLabel>
                <Controller
                  name="role"
                  control={control}
                  render={({ field }) => (
                    <>
                      <Box
                        role="radiogroup"
                        aria-label="Clinical role selection"
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(2, 1fr)',
                          gap: 1,
                        }}
                      >
                        {ROLE_DEFINITIONS.map((role) => (
                          <RoleTile
                            key={role.value}
                            role={role}
                            selected={field.value === role.value}
                            onSelect={() => field.onChange(role.value)}
                          />
                        ))}
                      </Box>
                      {errors.role && (
                        <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.75 }}>
                          {errors.role.message}
                        </Typography>
                      )}
                    </>
                  )}
                />
              </Box>

              <Divider sx={{ mb: 3 }} />

              {/* ── Firebase notice ──────────────────────────────────────── */}
              <Box
                mb={3}
                sx={{
                  p: 2,
                  borderRadius: 2,
                  backgroundColor: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                }}
              >
                <LockRounded sx={{ fontSize: 16, color: '#1565C0' }} />
                <Box>
                  <Typography variant="caption" sx={{ color: '#90A4AE', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', mb: 0.25 }}>
                    Secured by Firebase
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#546E7A', fontSize: '0.8rem' }}>
                    Your account ID is automatically assigned upon registration.
                  </Typography>
                </Box>
              </Box>

              <Divider sx={{ mb: 3 }} />

              {/* ── Section 2: Personal details ───────────────────────────── */}
              <Box mb={3.5}>
                <SectionLabel>Professional Identity</SectionLabel>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <Controller
                      name="name"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          id="reg-name"
                          fullWidth
                          label="Full Name"
                          placeholder="Dr. Alexander Wright"
                          error={Boolean(errors.name)}
                          helperText={errors.name?.message}
                          autoComplete="name"
                          inputProps={{ 'aria-required': true }}
                        />
                      )}
                    />
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <Controller
                      name="email"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          id="reg-email"
                          fullWidth
                          label="Email Address"
                          placeholder="wright@cityhospital.org"
                          error={Boolean(errors.email)}
                          helperText={errors.email?.message}
                          autoComplete="email"
                          inputProps={{ 'aria-required': true }}
                        />
                      )}
                    />
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <Controller
                      name="phone"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          id="reg-phone"
                          fullWidth
                          label="Phone Number"
                          placeholder="+1 (555) 234-5678"
                          error={Boolean(errors.phone)}
                          helperText={errors.phone?.message}
                          autoComplete="tel"
                          inputProps={{ 'aria-required': true }}
                        />
                      )}
                    />
                  </Grid>
                </Grid>
              </Box>

              {/* ── Section: Medical Practitioner Credentials (Doctor/Nurse) ── */}
              {isDoctorRole && (
                <>
                  <Divider sx={{ mb: 3 }} />
                  <Box mb={3.5}>
                    <Box display="flex" alignItems="center" gap={1} mb={1}>
                      <MedicalServices sx={{ fontSize: 18, color: '#1565C0' }} />
                      <SectionLabel>Medical Practitioner Credentials</SectionLabel>
                    </Box>
                    <Alert severity="info" sx={{ mb: 2.5, borderRadius: 2, fontSize: '0.82rem' }}>
                      Doctor accounts require admin verification and approval before clinical workspace access is enabled.
                    </Alert>
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6}>
                        <Controller
                          name="specialization"
                          control={control}
                          render={({ field }) => (
                            <TextField
                              {...field}
                              id="reg-specialization"
                              select
                              fullWidth
                              label="Specialization"
                              error={Boolean(errors.specialization)}
                              helperText={errors.specialization?.message || 'Select your clinical department / specialty'}
                              inputProps={{ 'aria-required': isDoctorRole }}
                            >
                              {COMMON_SPECIALIZATIONS.map((spec) => (
                                <MenuItem key={spec} value={spec}>
                                  {spec}
                                </MenuItem>
                              ))}
                            </TextField>
                          )}
                        />
                      </Grid>

                      <Grid item xs={12} sm={6}>
                        <Controller
                          name="licenseNumber"
                          control={control}
                          render={({ field }) => (
                            <TextField
                              {...field}
                              id="reg-license"
                              fullWidth
                              label="Medical License Number"
                              placeholder="e.g. MED-REG-109283"
                              error={Boolean(errors.licenseNumber)}
                              helperText={errors.licenseNumber?.message || 'State / National Medical Council License'}
                              inputProps={{ 'aria-required': isDoctorRole }}
                            />
                          )}
                        />
                      </Grid>

                      <Grid item xs={12} sm={6}>
                        <Controller
                          name="registeredDate"
                          control={control}
                          render={({ field }) => (
                            <TextField
                              {...field}
                              id="reg-registered-date"
                              fullWidth
                              type="date"
                              label="Registered Date"
                              InputLabelProps={{ shrink: true }}
                              error={Boolean(errors.registeredDate)}
                              helperText={errors.registeredDate?.message || 'Date of medical council registration'}
                              inputProps={{ 'aria-required': isDoctorRole }}
                            />
                          )}
                        />
                      </Grid>
                    </Grid>
                  </Box>
                </>
              )}

              <Divider sx={{ mb: 3 }} />

              {/* ── Section 3: Security credentials ─────────────────────── */}
              <Box mb={3}>
                <SectionLabel>Security Credentials</SectionLabel>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <Controller
                      name="password"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          id="reg-password"
                          fullWidth
                          type="password"
                          label="Password"
                          placeholder="••••••••"
                          error={Boolean(errors.password)}
                          helperText={errors.password?.message || 'Min. 8 chars · 1 uppercase · 1 number'}
                          autoComplete="new-password"
                          inputProps={{ 'aria-required': true }}
                        />
                      )}
                    />
                  </Grid>
                </Grid>
              </Box>

              {/* ── HIPAA agreement ──────────────────────────────────────── */}
              <Box
                sx={{
                  p: 2,
                  borderRadius: 1.5,
                  backgroundColor: '#F0F9FF',
                  border: '1px solid #BFDBFE',
                  mb: 3,
                }}
              >
                <Controller
                  name="agreeToTerms"
                  control={control}
                  render={({ field: { value, onChange } }) => (
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={value}
                          onChange={onChange}
                          color="primary"
                          size="small"
                          id="reg-agree-terms"
                        />
                      }
                      label={
                        <Typography variant="body2" sx={{ color: '#374151', lineHeight: 1.5 }}>
                          I agree to the MedTrace{' '}
                          <Box component="span" sx={{ color: '#1565C0', fontWeight: 600 }}>
                            Privacy Policy
                          </Box>{' '}
                          and{' '}
                          <Box component="span" sx={{ color: '#1565C0', fontWeight: 600 }}>
                            HIPAA Compliance Data Handling Terms
                          </Box>
                        </Typography>
                      }
                    />
                  )}
                />
                {errors.agreeToTerms && (
                  <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.5, ml: 4 }}>
                    {errors.agreeToTerms.message}
                  </Typography>
                )}
              </Box>

              {/* ── Submit ───────────────────────────────────────────────── */}
              <Button
                type="submit"
                fullWidth
                variant="contained"
                size="large"
                disabled={submitting}
                sx={{
                  py: 1.4,
                  mb: 1,
                  fontSize: '0.9375rem',
                  fontWeight: 600,
                  backgroundColor: '#1565C0',
                  '&:hover': { backgroundColor: '#0D47A1' },
                }}
              >
                {submitting ? <CircularProgress size={22} color="inherit" /> : 'Create Account'}
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
                onClick={handleGoogleSignUp}
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
                Sign Up with Google
              </Button>
            </form>
          </CardContent>
        </Card>
      </Container>

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
