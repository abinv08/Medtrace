import React from 'react';
import {
  Box,
  Container,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  Chip,
  Stack,
  Paper,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import {
  Analytics,
  Timeline,
  Psychology,
  Air,
  WifiTethering,
  SmartToy,
  ArrowForward,
  CheckCircle,
  Security,
  MedicalServices,
  FavoriteBorder,
  WaterDropOutlined,
  Thermostat,
  QueryStats,
} from '@mui/icons-material';
import { Navbar } from '../components/Navbar';
import { MedTraceLogo } from '../components/Logo';
import { useAuth } from '../contexts/AuthContext';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const sampleVitals = [
    {
      label: 'Heart Rate',
      value: '78',
      unit: 'BPM',
      status: 'NORMAL',
      statusBg: '#EAFBF0',
      statusColor: '#16A34A',
      icon: <FavoriteBorder sx={{ color: '#EF4444', fontSize: 28 }} />,
    },
    {
      label: 'Respiratory Rate',
      value: '16',
      unit: 'BPM',
      status: 'NORMAL',
      statusBg: '#EAFBF0',
      statusColor: '#16A34A',
      icon: <Air sx={{ color: '#3B82F6', fontSize: 28 }} />,
    },
    {
      label: 'SpO2',
      value: '98',
      unit: '%',
      status: 'OPTIMAL',
      statusBg: '#EAFBF0',
      statusColor: '#16A34A',
      icon: <WaterDropOutlined sx={{ color: '#0D9488', fontSize: 28 }} />,
    },
    {
      label: 'Temperature',
      value: '98.2',
      unit: '°F',
      status: 'STABLE',
      statusBg: '#EAFBF0',
      statusColor: '#16A34A',
      icon: <Thermostat sx={{ color: '#F97316', fontSize: 28 }} />,
    },
  ];

  const features = [
    {
      title: 'AI Medical Report Analysis',
      desc: 'Automated deep extraction & diagnostic clinical insights from unstructured lab, radiology, and discharge summaries.',
      icon: <Analytics sx={{ fontSize: 40, color: '#2563EB' }} />,
      badge: 'Report Intelligence',
      route: '/report/analysis',
    },
    {
      title: 'Patient Health Timeline',
      desc: 'Unified continuous timeline integrating vital signs, medication logs, and longitudinal patient health metrics.',
      icon: <Timeline sx={{ fontSize: 40, color: '#14B8A6' }} />,
      badge: 'Patient Intelligence',
      route: null,
    },
    {
      title: 'AI Clinical Intelligence',
      desc: 'Real-time triage scoring and AI-assisted clinical decision support for early risk trajectory identification.',
      icon: <Psychology sx={{ fontSize: 40, color: '#8B5CF6' }} />,
      badge: 'Decision Support',
      route: null,
    },
    {
      title: 'Respiratory Monitoring',
      desc: 'Non-invasive continuous breathing pattern algorithm detecting respiratory distress and dyspnea anomalies.',
      icon: <Air sx={{ fontSize: 40, color: '#0EA5E9' }} />,
      badge: 'Contactless Sensing',
      route: '/csi/monitoring',
    },
    {
      title: 'Ward Monitoring using Wi-Fi CSI',
      desc: 'Radar-less contactless Wi-Fi Channel State Information monitoring patient movement, falls, and bed exits.',
      icon: <WifiTethering sx={{ fontSize: 40, color: '#F59E0B' }} />,
      badge: 'CSI Anomaly Sensing',
      route: '/csi/monitoring',
    },
    {
      title: 'AI Assistant',
      desc: 'Clinical Copilot for instant medical record queries, drug interaction alerts, and automated nursing summaries.',
      icon: <SmartToy sx={{ fontSize: 40, color: '#EC4899' }} />,
      badge: 'Clinical Copilot',
      route: null,
    },
  ];

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: '#F8FAFC' }}>
      <Navbar />

      {/* Hero / About Section */}
      <Box
        id="about"
        sx={{
          background: 'radial-gradient(circle at 50% 10%, rgba(37, 99, 235, 0.08) 0%, transparent 60%)',
          pt: { xs: 8, md: 12 },
          pb: { xs: 10, md: 14 },
        }}
      >
        <Container maxWidth="lg">
          <Grid container spacing={6} alignItems="center">
            <Grid item xs={12} md={7}>
              <Chip
                icon={<MedicalServices sx={{ fontSize: '18px !important', color: '#2563EB !important' }} />}
                label="Next-Gen Hospital AI & Contactless Sensing"
                sx={{
                  backgroundColor: 'rgba(37, 99, 235, 0.1)',
                  color: '#2563EB',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  mb: 3,
                  py: 0.5,
                  px: 1,
                  borderRadius: 6,
                }}
              />
              <Typography
                variant="h1"
                sx={{
                  fontSize: { xs: '2.5rem', md: '3.75rem' },
                  lineHeight: 1.15,
                  mb: 3,
                  color: '#0F172A',
                }}
              >
                AI-Powered{' '}
                <Box
                  component="span"
                  sx={{
                    background: 'linear-gradient(135deg, #2563EB 0%, #14B8A6 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  Clinical Intelligence
                </Box>{' '}
                for Smarter Healthcare
              </Typography>
              <Typography
                variant="h6"
                sx={{
                  color: '#475569',
                  fontWeight: 400,
                  lineHeight: 1.6,
                  mb: 4,
                  maxWidth: 620,
                }}
              >
                Analyze medical reports, monitor patients, and assist clinical decision-making using
                Artificial Intelligence — without invasive wires or manual report overhead.
              </Typography>

              {user ? (
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 4 }}>
                  <Button
                    variant="contained"
                    size="large"
                    onClick={() => {
                      const roleSlug = user.role?.toLowerCase().replace(/\s+/g, '-') || 'patient';
                      navigate(`/dashboard/${roleSlug}`);
                    }}
                    endIcon={<ArrowForward />}
                    sx={{
                      py: 1.8,
                      px: 4,
                      fontSize: '1.05rem',
                      fontWeight: 700,
                      borderRadius: 14,
                      background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
                      boxShadow: '0 8px 24px rgba(37, 99, 235, 0.25)',
                    }}
                  >
                    Go to {user.role ? `${user.role} Dashboard` : 'Dashboard'}
                  </Button>
                </Stack>
              ) : (
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 4 }}>
                  <Button
                    variant="contained"
                    size="large"
                    onClick={() => navigate('/register')}
                    endIcon={<ArrowForward />}
                    sx={{
                      py: 1.8,
                      px: 4,
                      fontSize: '1.05rem',
                      borderRadius: 14,
                      background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
                    }}
                  >
                    Get Started
                  </Button>
                  <Button
                    variant="outlined"
                    size="large"
                    onClick={() => navigate('/login')}
                    sx={{
                      py: 1.8,
                      px: 4,
                      fontSize: '1.05rem',
                      borderRadius: 14,
                      borderColor: '#CBD5E1',
                      color: '#1E293B',
                      '&:hover': { borderColor: '#2563EB', backgroundColor: 'rgba(37, 99, 235, 0.04)' },
                    }}
                  >
                    Login to MedTrace
                  </Button>
                </Stack>
              )}

              <Stack direction="row" spacing={3} alignItems="center">
                {['HIPAA Compliant Data', 'Real-time Wi-Fi CSI', 'Multi-Role Access'].map((text) => (
                  <Box key={text} display="flex" alignItems="center" gap={0.8}>
                    <CheckCircle sx={{ color: '#14B8A6', fontSize: 18 }} />
                    <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600 }}>
                      {text}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </Grid>

            {/* Doctor & AI Dashboard Illustration Card */}
            <Grid item xs={12} md={5}>
              <Paper
                elevation={0}
                sx={{
                  p: 3,
                  borderRadius: 6,
                  background: 'linear-gradient(145deg, #FFFFFF 0%, #F1F5F9 100%)',
                  border: '1px solid #E2E8F0',
                  boxShadow: '0px 20px 40px rgba(37, 99, 235, 0.12)',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {/* Decorative Badge */}
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justify: 'space-between',
                    mb: 3,
                    pb: 2,
                    borderBottom: '1px solid #E2E8F0',
                  }}
                >
                  <MedTraceLogo variant="full" size="small" />
                  <Chip label="AI POWERED" color="primary" size="small" sx={{ fontWeight: 700 }} />
                </Box>

                {/* Feature highlights */}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Box
                    sx={{
                      p: 2,
                      borderRadius: 4,
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #E2E8F0',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
                    }}
                  >
                    <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 700 }}>
                      NON-INVASIVE PATIENT MONITORING
                    </Typography>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mt={1}>
                      <Typography variant="body1" sx={{ color: '#2563EB', fontWeight: 700 }}>
                        Real-time vitals via Wi-Fi sensing
                      </Typography>
                      <Chip label="No Wires" size="small" sx={{ backgroundColor: 'rgba(20, 184, 166, 0.1)', color: '#14B8A6', fontWeight: 700 }} />
                    </Box>
                  </Box>

                  <Box
                    sx={{
                      p: 2,
                      borderRadius: 4,
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #E2E8F0',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
                    }}
                  >
                    <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 700 }}>
                      AI REPORT INTELLIGENCE
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#0F172A', fontWeight: 600, mt: 0.5 }}>
                      Instantly analyze medical reports and surface actionable clinical insights.
                    </Typography>
                  </Box>
                </Box>
              </Paper>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* Authenticated Dashboard Sections */}
      {user && (
        <>
          {/* Current Health Vitals Section */}
          <Container maxWidth="lg" sx={{ pt: { xs: 6, md: 8 }, pb: { xs: 2, md: 4 } }}>
            {/* Vitals Header */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 1.5,
                mb: 3,
              }}
            >
              <Box display="flex" alignItems="center" gap={1.5}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    p: 0.8,
                    borderRadius: '10px',
                    backgroundColor: 'rgba(13, 148, 136, 0.1)',
                    color: '#0D9488',
                  }}
                >
                  <QueryStats sx={{ fontSize: 24, color: '#0D9488' }} />
                </Box>
                <Typography
                  variant="h5"
                  sx={{ fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em' }}
                >
                  Current Health Vitals
                </Typography>
              </Box>
              <Typography variant="body2" sx={{ color: '#64748B', fontWeight: 500 }}>
                Last updated: 5 mins ago
              </Typography>
            </Box>

            {/* Vitals Cards */}
            <Grid container spacing={3}>
              {sampleVitals.map((vital) => (
                <Grid item xs={12} sm={6} md={3} key={vital.label}>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 3,
                      borderRadius: '24px',
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #E2E8F0',
                      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.03)',
                      transition: 'all 0.25s ease',
                      '&:hover': {
                        transform: 'translateY(-3px)',
                        boxShadow: '0 12px 30px rgba(0, 0, 0, 0.06)',
                        borderColor: '#CBD5E1',
                      },
                    }}
                  >
                    {/* Top: Icon + Status */}
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={2.5}>
                      {vital.icon}
                      <Box
                        sx={{
                          px: 1.4,
                          py: 0.4,
                          borderRadius: '8px',
                          backgroundColor: vital.statusBg,
                          color: vital.statusColor,
                          fontWeight: 800,
                          fontSize: '0.72rem',
                          letterSpacing: '0.04em',
                        }}
                      >
                        {vital.status}
                      </Box>
                    </Box>

                    {/* Middle: Label */}
                    <Typography variant="body2" sx={{ color: '#64748B', fontWeight: 500, mb: 1 }}>
                      {vital.label}
                    </Typography>

                    {/* Bottom: Value + Unit */}
                    <Box display="flex" alignItems="baseline" gap={0.8}>
                      <Typography
                        variant="h4"
                        sx={{ fontWeight: 800, color: '#0F172A', lineHeight: 1 }}
                      >
                        {vital.value}
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#64748B', fontWeight: 600 }}>
                        {vital.unit}
                      </Typography>
                    </Box>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </Container>

          {/* Features Section */}
          <Container maxWidth="lg" id="features" sx={{ py: 8 }}>
            <Box textAlign="center" mb={8}>
              <Typography
                variant="h2"
                sx={{ fontSize: { xs: '2rem', md: '2.75rem' }, color: '#0F172A', mb: 2 }}
              >
                Core Clinical Intelligence Capabilities
              </Typography>
              <Typography variant="body1" sx={{ color: '#64748B', maxWidth: 650, mx: 'auto' }}>
                Built specifically for modern hospital wards, intensive care units, and clinical care teams.
              </Typography>
            </Box>

          <Grid container spacing={4}>
            {features.map((f, idx) => (
              <Grid item xs={12} sm={6} md={4} key={idx}>
                <Card
                  onClick={() => f.route && navigate(f.route)}
                  sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    justify: 'space-between',
                    p: 2,
                    cursor: f.route ? 'pointer' : 'default',
                    transition: 'all 0.3s ease',
                    '&:hover': f.route
                      ? {
                          transform: 'translateY(-6px)',
                          boxShadow: '0px 20px 40px rgba(37, 99, 235, 0.18)',
                          borderColor: '#2563EB',
                          background: 'linear-gradient(145deg, #FFFFFF 0%, rgba(37,99,235,0.03) 100%)',
                        }
                      : {
                          transform: 'translateY(-6px)',
                          boxShadow: '0px 16px 32px rgba(37, 99, 235, 0.14)',
                          borderColor: '#2563EB',
                        },
                  }}
                >
                  <CardContent>
                    <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                      <Box
                        sx={{
                          p: 1.5,
                          borderRadius: 4,
                          backgroundColor: 'rgba(37, 99, 235, 0.06)',
                        }}
                      >
                        {f.icon}
                      </Box>
                      <Box display="flex" flexDirection="column" alignItems="flex-end" gap={0.8}>
                        <Chip label={f.badge} size="small" sx={{ fontWeight: 600, fontSize: '0.7rem' }} />
                        {f.route && (
                          <Chip
                            label="Open →"
                            size="small"
                            sx={{
                              backgroundColor: 'rgba(37,99,235,0.1)',
                              color: '#2563EB',
                              fontWeight: 700,
                              fontSize: '0.7rem',
                            }}
                          />
                        )}
                      </Box>
                    </Box>
                    <Typography variant="h6" sx={{ color: '#0F172A', mb: 1, fontWeight: 700 }}>
                      {f.title}
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#64748B', lineHeight: 1.6 }}>
                      {f.desc}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Container>
        </>
      )}

      {/* Footer / Contact */}
      <Box id="contact" sx={{ backgroundColor: '#0F172A', color: '#FFFFFF', pt: 8, pb: 6 }}>
        <Container maxWidth="lg">
          <Grid container spacing={4} justifyContent="space-between">
            <Grid item xs={12} md={4}>
              <Box mb={2}>
                <MedTraceLogo variant="full" size="medium" />
              </Box>
              <Typography variant="body2" sx={{ color: '#94A3B8', mb: 3 }}>
                AI-Based Clinical Intelligence & Contactless Patient Monitoring System for hospitals.
              </Typography>
              <Typography variant="caption" sx={{ color: '#64748B' }}>
                © {new Date().getFullYear()} MEDTRACE AI Inc. All rights reserved.
              </Typography>
            </Grid>

            <Grid item xs={6} md={2}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2, color: '#F8FAFC' }}>
                Platform
              </Typography>
              {['Web Portal', 'Mobile iOS & Android', 'API & Integration', 'Security'].map((l) => (
                <Typography key={l} variant="body2" sx={{ color: '#94A3B8', mb: 1, cursor: 'pointer' }}>
                  {l}
                </Typography>
              ))}
            </Grid>


          </Grid>
        </Container>
      </Box>
    </Box>
  );
};
