import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Container,
  Typography,
  Button,
  Chip,
  Avatar,
  Grid,
  Paper,
  CircularProgress,
  Alert,
  Tooltip,
  IconButton,
  Tab,
  Tabs,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Snackbar,
} from '@mui/material';
import {
  Person,
  MedicalServices,
  Description,
  Science,
  Medication,
  CalendarMonth,
  FitnessCenter,
  UploadFile,
  LocalHospital,
  Favorite,
  MonitorHeart,
  WarningAmber,
  CheckCircle,
  Edit,
  ContentCopy,
  Shield,
  Save,
  Close,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  fetchPatientReports,
  fetchPatientTimeline,
  StoredReport,
  TimelineEvent,
} from '../../services/reportService';
import { NotificationBell } from '../../components/NotificationBell';
import { LongitudinalTrends } from '../../components/LongitudinalTrends';
import { AnomalyDetectionCard } from '../../components/AnomalyDetectionCard';
import { MedicationTracker } from '../../components/MedicationTracker';
import { TestResultsManager } from '../../components/TestResultsManager';
import { ExercisePlanner } from '../../components/ExercisePlanner';
import { AppointmentBookingModal } from '../../components/AppointmentBookingModal';
import { CaretakerManager } from '../../components/CaretakerManager';
import { Navbar } from '../../components/Navbar';
import {
  VitalReading,
  fetchPatientVitals,
  detectAnomalies,
  AnomalyAlert,
} from '../../services/healthAnalyticsService';
import {
  Appointment,
  fetchPatientAppointments,
} from '../../services/appointmentService';
import { authService } from '../../services/authService';

// ─── Colour palette ──────────────────────────────────────────────────────────
const C = {
  primary: '#1565C0',
  teal: '#00838F',
  purple: '#7C3AED',
  amber: '#D97706',
  red: '#DC2626',
  green: '#059669',
  slate: '#1E293B',
  muted: '#64748B',
  border: '#E2E8F0',
  bg: '#F0F4F8',
  paper: '#FFFFFF',
};

const eventConfig: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
  report_uploaded: { icon: <Description fontSize="small" />, color: C.primary, bg: 'rgba(21,101,192,0.1)' },
  test_result_added: { icon: <Science fontSize="small" />, color: C.teal, bg: 'rgba(0,131,143,0.1)' },
  appointment_booked: { icon: <CalendarMonth fontSize="small" />, color: C.purple, bg: 'rgba(124,58,237,0.1)' },
  appointment_completed: { icon: <CheckCircle fontSize="small" />, color: C.green, bg: 'rgba(5,150,105,0.1)' },
  medication_started: { icon: <Medication fontSize="small" />, color: C.amber, bg: 'rgba(217,119,6,0.1)' },
  doctor_consultation: { icon: <MedicalServices fontSize="small" />, color: C.teal, bg: 'rgba(0,131,143,0.1)' },
  monitoring_alert: { icon: <WarningAmber fontSize="small" />, color: C.red, bg: 'rgba(220,38,38,0.1)' },
  ai_analysis: { icon: <MonitorHeart fontSize="small" />, color: C.purple, bg: 'rgba(124,58,237,0.1)' },
  exercise_recommended: { icon: <FitnessCenter fontSize="small" />, color: C.green, bg: 'rgba(5,150,105,0.1)' },
  profile_updated: { icon: <Person fontSize="small" />, color: C.muted, bg: 'rgba(100,116,139,0.1)' },
  caretaker_assigned: { icon: <Shield fontSize="small" />, color: C.amber, bg: 'rgba(217,119,6,0.1)' },
};

const fallbackEvent = { icon: <LocalHospital fontSize="small" />, color: C.muted, bg: 'rgba(100,116,139,0.1)' };

const fmtDate = (iso: string) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

const fmtTime = (iso: string) => {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
};

const reportTypeColor: Record<string, string> = {
  lab: C.primary,
  radiology: C.purple,
  discharge: C.teal,
  prescription: C.green,
  other: C.muted,
};

export const PatientDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();

  const [activeTab, setActiveTab] = useState(0);
  const [reports, setReports] = useState<StoredReport[]>([]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [vitals, setVitals] = useState<VitalReading[]>([]);
  const [anomalies, setAnomalies] = useState<AnomalyAlert[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [openBookingModal, setOpenBookingModal] = useState(false);

  const patientId = user?.id || 'default';

  const loadData = useCallback(async () => {
    if (!patientId) return;
    setLoading(true);
    try {
      const [reps, tl, vit, apts] = await Promise.all([
        fetchPatientReports(patientId),
        fetchPatientTimeline(patientId),
        fetchPatientVitals(patientId),
        fetchPatientAppointments(patientId),
      ]);
      setReports(reps);
      setTimeline(tl);
      setVitals(vit);
      setAppointments(apts);

      if (vit.length > 0) {
        const latest = vit[vit.length - 1];
        setAnomalies(detectAnomalies(latest, vit));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    loadData();
  }, [loadData]);


  const copyPatientId = () => {
    if (user?.patientId) {
      navigator.clipboard.writeText(user.patientId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const tabs = [
    'Overview',
    'Health Trends & Vitals',
    'Medications & Reminders',
    'Lab & Test Results',
    'Exercise & Wellness',
    'Appointments',
    'Care Network',
    'Medical Reports',
    'Profile',
  ];

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: C.bg }}>
      {/* ── Main Navbar ──────────────────────────────────────────────────────── */}
      <Navbar />

      {/* ── Hero: Patient ID Banner ──────────────────────────────────────────── */}
      <Box
        sx={{
          background: `linear-gradient(135deg, ${C.primary} 0%, ${C.teal} 100%)`,
          py: { xs: 3, md: 4 },
          px: { xs: 2, sm: 4 },
        }}
      >
        <Container maxWidth="lg">
          <Box display="flex" alignItems="center" gap={3} flexWrap="wrap">
            <Avatar
              sx={{
                width: 64,
                height: 64,
                backgroundColor: 'rgba(255,255,255,0.2)',
                fontSize: '1.5rem',
                fontWeight: 800,
                color: '#fff',
                border: '2px solid rgba(255,255,255,0.4)',
              }}
            >
              {user?.name?.charAt(0).toUpperCase() || 'P'}
            </Avatar>
            <Box flex={1}>
              <Typography variant="h5" sx={{ color: '#fff', fontWeight: 800, lineHeight: 1.2 }}>
                {user?.name || 'Patient'}
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)', mt: 0.25 }}>
                {user?.email}
              </Typography>

              {/* Patient ID */}
              <Box display="flex" alignItems="center" gap={1} mt={1}>
                <Chip
                  icon={<LocalHospital sx={{ fontSize: '14px !important', color: 'rgba(255,255,255,0.9) !important' }} />}
                  label={user?.patientId || 'MT-2026-000001'}
                  sx={{
                    backgroundColor: 'rgba(255,255,255,0.18)',
                    color: '#fff',
                    fontWeight: 800,
                    fontSize: '0.85rem',
                    fontFamily: 'monospace',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.3)',
                    '& .MuiChip-label': { px: 1.5 },
                  }}
                />
                <Tooltip title={copied ? 'Copied!' : 'Copy Patient ID'}>
                  <IconButton size="small" onClick={copyPatientId} sx={{ color: 'rgba(255,255,255,0.8)' }}>
                    <ContentCopy sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>

            {/* Quick Actions */}
            <Box display="flex" gap={1.5} flexWrap="wrap">
              <Button
                variant="contained"
                size="small"
                startIcon={<UploadFile />}
                onClick={() => navigate('/report/analysis')}
                sx={{
                  backgroundColor: 'rgba(255,255,255,0.2)',
                  backdropFilter: 'blur(8px)',
                  color: '#fff',
                  fontWeight: 700,
                  borderRadius: '999px',
                  border: '1px solid rgba(255,255,255,0.3)',
                  '&:hover': { backgroundColor: 'rgba(255,255,255,0.3)' },
                  boxShadow: 'none',
                }}
              >
                AI Report Analysis
              </Button>
              <Button
                variant="contained"
                size="small"
                startIcon={<CalendarMonth />}
                onClick={() => setOpenBookingModal(true)}
                sx={{
                  backgroundColor: '#FFFFFF',
                  color: C.primary,
                  fontWeight: 800,
                  borderRadius: '999px',
                  '&:hover': { backgroundColor: '#F8FAFC' },
                  boxShadow: 'none',
                }}
              >
                Book Appointment
              </Button>
            </Box>
          </Box>
        </Container>
      </Box>

      {/* ── Tab Navigation ───────────────────────────────────────────────────── */}
      <Box sx={{ backgroundColor: C.paper, borderBottom: `1px solid ${C.border}` }}>
        <Container maxWidth="lg">
          <Tabs
            value={activeTab}
            onChange={(_, v) => setActiveTab(v)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              '& .MuiTab-root': { fontWeight: 700, fontSize: '0.85rem', textTransform: 'none', minHeight: 50 },
              '& .Mui-selected': { color: C.primary },
              '& .MuiTabs-indicator': { backgroundColor: C.primary, height: 3, borderRadius: '3px 3px 0 0' },
            }}
          >
            {tabs.map((t, i) => <Tab key={t} label={t} id={`patient-tab-${i}`} />)}
          </Tabs>
        </Container>
      </Box>

      {/* ── Tab Content Container ────────────────────────────────────────────── */}
      <Container maxWidth="lg" sx={{ py: 3.5 }}>
        {loading ? (
          <Box display="flex" justifyContent="center" py={8}>
            <CircularProgress sx={{ color: C.primary }} />
          </Box>
        ) : (
          <>
            {/* ── Tab 0: Overview ────────────────────────────────────────────── */}
            {activeTab === 0 && (
              <Box display="flex" flexDirection="column" gap={3}>
                {/* Real-time Anomaly Detection Card */}
                {anomalies.length > 0 && (
                  <AnomalyDetectionCard
                    anomalies={anomalies}
                    patientId={patientId}
                    patientName={user?.name || 'Patient'}
                    onDismiss={(id) => setAnomalies(anomalies.filter((a) => a.id !== id))}
                  />
                )}

                {/* Vitals Summary Strip */}
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6} md={3}>
                    <Paper elevation={0} sx={{ p: 2.5, borderRadius: '16px', border: `1px solid ${C.primary}20`, backgroundColor: '#FFFFFF' }}>
                      <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                        <Favorite sx={{ color: '#DC2626', fontSize: 18 }} />
                        <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 700 }}>BLOOD PRESSURE</Typography>
                      </Box>
                      {vitals.length > 0 ? (
                        <>
                          <Typography variant="h5" sx={{ fontWeight: 800, color: '#1E293B' }}>
                            {vitals[vitals.length - 1].systolicBP}/{vitals[vitals.length - 1].diastolicBP} <span style={{ fontSize: '0.8rem', color: '#64748B' }}>mmHg</span>
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#059669', fontWeight: 600 }}>● Latest Reading</Typography>
                        </>
                      ) : (
                        <>
                          <Typography variant="h5" sx={{ fontWeight: 700, color: '#CBD5E1' }}>—</Typography>
                          <Typography variant="caption" sx={{ color: '#94A3B8' }}>Add vitals to see data</Typography>
                        </>
                      )}
                    </Paper>
                  </Grid>

                  <Grid item xs={12} sm={6} md={3}>
                    <Paper elevation={0} sx={{ p: 2.5, borderRadius: '16px', border: `1px solid ${C.teal}20`, backgroundColor: '#FFFFFF' }}>
                      <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                        <MonitorHeart sx={{ color: '#00838F', fontSize: 18 }} />
                        <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 700 }}>RESTING PULSE</Typography>
                      </Box>
                      {vitals.length > 0 ? (
                        <>
                          <Typography variant="h5" sx={{ fontWeight: 800, color: '#1E293B' }}>
                            {vitals[vitals.length - 1].heartRate} <span style={{ fontSize: '0.8rem', color: '#64748B' }}>bpm</span>
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#059669', fontWeight: 600 }}>● Latest Reading</Typography>
                        </>
                      ) : (
                        <>
                          <Typography variant="h5" sx={{ fontWeight: 700, color: '#CBD5E1' }}>—</Typography>
                          <Typography variant="caption" sx={{ color: '#94A3B8' }}>Add vitals to see data</Typography>
                        </>
                      )}
                    </Paper>
                  </Grid>

                  <Grid item xs={12} sm={6} md={3}>
                    <Paper elevation={0} sx={{ p: 2.5, borderRadius: '16px', border: `1px solid ${C.amber}20`, backgroundColor: '#FFFFFF' }}>
                      <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                        <Medication sx={{ color: '#D97706', fontSize: 18 }} />
                        <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 700 }}>UPCOMING VISIT</Typography>
                      </Box>
                      {appointments.length > 0 ? (
                        <>
                          <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#1E293B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {appointments[0].date}
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#1565C0', fontWeight: 600 }}>
                            {appointments[0].doctorName}
                          </Typography>
                        </>
                      ) : (
                        <>
                          <Typography variant="h5" sx={{ fontWeight: 700, color: '#CBD5E1' }}>—</Typography>
                          <Typography variant="caption" sx={{ color: '#94A3B8' }}>No appointments yet</Typography>
                        </>
                      )}
                    </Paper>
                  </Grid>

                  <Grid item xs={12} sm={6} md={3}>
                    <Paper elevation={0} sx={{ p: 2.5, borderRadius: '16px', border: `1px solid ${C.purple}20`, backgroundColor: '#FFFFFF' }}>
                      <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                        <CalendarMonth sx={{ color: '#7C3AED', fontSize: 18 }} />
                        <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 700 }}>MEDICAL REPORTS</Typography>
                      </Box>
                      {reports.length > 0 ? (
                        <>
                          <Typography variant="h5" sx={{ fontWeight: 800, color: '#1E293B' }}>
                            {reports.length} <span style={{ fontSize: '0.8rem', color: '#64748B' }}>uploaded</span>
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#059669', fontWeight: 600 }}>● Latest: {reports[0]?.reportType}</Typography>
                        </>
                      ) : (
                        <>
                          <Typography variant="h5" sx={{ fontWeight: 700, color: '#CBD5E1' }}>—</Typography>
                          <Typography variant="caption" sx={{ color: '#94A3B8' }}>No reports uploaded</Typography>
                        </>
                      )}
                    </Paper>
                  </Grid>
                </Grid>

                {/* Getting Started — shown only to new patients with no data */}
                {vitals.length === 0 && appointments.length === 0 && reports.length === 0 && (
                  <Paper
                    elevation={0}
                    sx={{
                      p: 3.5,
                      borderRadius: '20px',
                      border: '1px solid #E2E8F0',
                      background: 'linear-gradient(135deg, #EFF6FF 0%, #F0FDF4 100%)',
                    }}
                  >
                    <Typography variant="h6" sx={{ fontWeight: 800, color: '#1E293B', mb: 0.5 }}>
                      👋 Welcome to MedTrace!
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#64748B', mb: 3 }}>
                      Your dashboard is fresh and ready. Start adding your health data to unlock personalized insights, vitals analysis, and AI-driven exercise suggestions.
                    </Typography>
                    <Grid container spacing={2}>
                      {[
                        { icon: '🩺', label: 'Log Vitals', desc: 'Add your blood pressure, pulse, and glucose readings', tab: 1, color: '#1565C0' },
                        { icon: '💊', label: 'Add Medications', desc: 'Track your prescriptions and daily dose schedule', tab: 2, color: '#D97706' },
                        { icon: '📋', label: 'Upload Lab Reports', desc: 'Get AI analysis of your medical documents', tab: 7, color: '#7C3AED' },
                        { icon: '🏃', label: 'Get Exercise Plan', desc: 'Receive vitals-based exercise recommendations', tab: 4, color: '#059669' },
                      ].map((item) => (
                        <Grid item xs={12} sm={6} md={3} key={item.label}>
                          <Paper
                            elevation={0}
                            onClick={() => setActiveTab(item.tab)}
                            sx={{
                              p: 2.5,
                              borderRadius: '16px',
                              border: `2px solid ${item.color}20`,
                              backgroundColor: '#FFFFFF',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                              '&:hover': { transform: 'translateY(-2px)', boxShadow: `0 8px 24px ${item.color}20`, borderColor: `${item.color}40` },
                            }}
                          >
                            <Typography sx={{ fontSize: '2rem', mb: 1 }}>{item.icon}</Typography>
                            <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#1E293B', mb: 0.5 }}>{item.label}</Typography>
                            <Typography variant="caption" sx={{ color: '#64748B', lineHeight: 1.4, display: 'block' }}>{item.desc}</Typography>
                          </Paper>
                        </Grid>
                      ))}
                    </Grid>
                  </Paper>
                )}

                {/* Longitudinal Trends Preview */}
                <LongitudinalTrends
                  patientId={patientId}
                  vitals={vitals}
                  onVitalsUpdated={loadData}
                  onAnomalyDetected={(newAnoms) => setAnomalies(newAnoms)}
                />

                {/* Today's Medications */}
                <MedicationTracker patientId={patientId} />
              </Box>
            )}


            {/* ── Tab 1: Health Trends & Vitals ──────────────────────────────── */}
            {activeTab === 1 && (
              <Box display="flex" flexDirection="column" gap={3}>
                <AnomalyDetectionCard
                  anomalies={anomalies}
                  patientId={patientId}
                  patientName={user?.name || 'Patient'}
                />
                <LongitudinalTrends
                  patientId={patientId}
                  vitals={vitals}
                  onVitalsUpdated={loadData}
                  onAnomalyDetected={(newAnoms) => setAnomalies(newAnoms)}
                />
              </Box>
            )}

            {/* ── Tab 2: Medications & Reminders ─────────────────────────────── */}
            {activeTab === 2 && (
              <MedicationTracker patientId={patientId} />
            )}

            {/* ── Tab 3: Lab & Test Results ──────────────────────────────────── */}
            {activeTab === 3 && (
              <TestResultsManager patientId={patientId} />
            )}

            {/* ── Tab 4: Exercise & Wellness ─────────────────────────────────── */}
            {activeTab === 4 && (
              <ExercisePlanner
                patientId={patientId}
                patientName={user?.name}
                chronicConditions={user?.chronicConditions}
                vitals={vitals}
              />
            )}

            {/* ── Tab 5: Appointments ────────────────────────────────────────── */}
            {activeTab === 5 && (
              <Box display="flex" flexDirection="column" gap={3}>
                <Paper elevation={0} sx={{ p: 3, borderRadius: '20px', border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF' }}>
                  <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2} mb={3}>
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 800, color: '#1E293B' }}>
                        Clinical Appointments & Consultations
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#64748B' }}>
                        Scheduled hospital checkups and telehealth video consultations
                      </Typography>
                    </Box>
                    <Button
                      variant="contained"
                      startIcon={<CalendarMonth />}
                      onClick={() => setOpenBookingModal(true)}
                      sx={{ borderRadius: '999px', backgroundColor: '#1565C0', fontWeight: 700 }}
                    >
                      Book Consultation
                    </Button>
                  </Box>

                  {appointments.length === 0 ? (
                    <Typography variant="body2" sx={{ color: '#64748B', py: 4, textAlign: 'center' }}>
                      No appointments booked yet. Click "Book Consultation" to schedule a visit with a specialist.
                    </Typography>
                  ) : (
                    <Grid container spacing={2}>
                      {appointments.map((apt) => (
                        <Grid item xs={12} md={6} key={apt.id}>
                          <Paper elevation={0} sx={{ p: 2.5, borderRadius: '16px', border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC' }}>
                            <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1.5}>
                              <Box>
                                <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#1E293B' }}>
                                  {apt.doctorName}
                                </Typography>
                                <Typography variant="caption" sx={{ color: '#1565C0', fontWeight: 700 }}>
                                  {apt.doctorSpecialization} · {apt.hospitalName || 'MedTrace Hospital'}
                                </Typography>
                              </Box>
                              <Chip
                                label={apt.status.toUpperCase()}
                                size="small"
                                sx={{
                                  fontWeight: 800,
                                  fontSize: '0.68rem',
                                  backgroundColor: apt.status === 'confirmed' ? '#ECFDF5' : apt.status === 'pending' ? '#FFFBEB' : '#EFF6FF',
                                  color: apt.status === 'confirmed' ? '#059669' : apt.status === 'pending' ? '#D97706' : '#1565C0',
                                }}
                              />
                            </Box>

                            <Box sx={{ p: 1.5, borderRadius: '10px', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                              <Typography variant="body2" sx={{ fontWeight: 700, color: '#1E293B', fontSize: '0.82rem' }}>
                                📅 {apt.date} at {apt.timeSlot} ({apt.consultationType})
                              </Typography>
                              <Typography variant="caption" sx={{ color: '#64748B', display: 'block', mt: 0.5 }}>
                                Reason: {apt.reason}
                              </Typography>
                            </Box>
                          </Paper>
                        </Grid>
                      ))}
                    </Grid>
                  )}
                </Paper>
              </Box>
            )}

            {/* ── Tab 6: Care Network ────────────────────────────────────────── */}
            {activeTab === 6 && (
              <CaretakerManager
                patientId={patientId}
                patientName={user?.name || 'Patient'}
                patientPatientId={user?.patientId}
              />
            )}

            {/* ── Tab 7: Medical Reports ─────────────────────────────────────── */}
            {activeTab === 7 && (
              <Box display="flex" flexDirection="column" gap={3}>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Typography variant="h6" sx={{ fontWeight: 800, color: C.slate }}>
                    Medical Reports ({reports.length})
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={<UploadFile />}
                    onClick={() => navigate('/report/analysis')}
                    sx={{
                      borderRadius: '999px',
                      background: `linear-gradient(135deg, ${C.primary}, ${C.teal})`,
                      fontWeight: 700,
                    }}
                  >
                    AI Report Analysis
                  </Button>
                </Box>

                {reports.length === 0 ? (
                  <Alert severity="info" sx={{ borderRadius: '12px' }}>
                    No reports uploaded yet. Click "AI Report Analysis" to scan documents.
                  </Alert>
                ) : (
                  <Box display="flex" flexDirection="column" gap={2}>
                    {reports.map((r) => (
                      <Paper key={r.id} elevation={0} sx={{ p: 2.5, borderRadius: '16px', border: `1px solid ${C.border}` }}>
                        <ReportRow report={r} expanded />
                      </Paper>
                    ))}
                  </Box>
                )}
              </Box>
            )}

            {/* ── Tab 8: Profile ─────────────────────────────────────────────── */}
            {activeTab === 8 && (
              <ProfileTab user={user} />
            )}
          </>
        )}
      </Container>

      {/* ── Booking Modal ────────────────────────────────────────────────────── */}
      <AppointmentBookingModal
        open={openBookingModal}
        onClose={() => setOpenBookingModal(false)}
        patientId={patientId}
        patientName={user?.name || 'Patient'}
        patientPhone={user?.phone}
        patientEmail={user?.email}
        onAppointmentBooked={(newApt) => {
          setAppointments([newApt, ...appointments]);
          setActiveTab(5); // switch to appointments
        }}
      />
    </Box>
  );
};

// ─── ReportRow ────────────────────────────────────────────────────────────────
const urgencyChipColor: Record<string, string> = {
  Normal: '#059669',
  Monitor: '#D97706',
  Urgent: '#DC2626',
};

const ReportRow: React.FC<{ report: StoredReport; expanded?: boolean }> = ({ report, expanded }) => {
  const color = reportTypeColor[report.reportType] || '#64748B';
  return (
    <Box>
      <Box display="flex" gap={2} alignItems="flex-start">
        <Box
          sx={{
            width: 44, height: 44, borderRadius: '12px',
            backgroundColor: `${color}14`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}
        >
          <Description sx={{ color, fontSize: 22 }} />
        </Box>
        <Box flex={1} minWidth={0}>
          <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
            <Typography variant="body2" sx={{ fontWeight: 700, color: '#1E293B', wordBreak: 'break-all' }}>
              {report.fileName}
            </Typography>
            <Chip
              label={report.reportType.toUpperCase()}
              size="small"
              sx={{ backgroundColor: `${color}14`, color, fontWeight: 700, fontSize: '0.65rem', height: 20, borderRadius: '4px' }}
            />
            {report.analysisResult && (
              <Chip
                label={report.analysisResult.urgencyLevel}
                size="small"
                sx={{
                  backgroundColor: `${urgencyChipColor[report.analysisResult.urgencyLevel]}18`,
                  color: urgencyChipColor[report.analysisResult.urgencyLevel],
                  fontWeight: 700, fontSize: '0.65rem', height: 20, borderRadius: '4px',
                }}
              />
            )}
          </Box>
          <Typography variant="caption" sx={{ color: '#64748B' }}>
            Uploaded {fmtDate(report.uploadedAt)} · {(report.fileSizeBytes / 1024 / 1024).toFixed(2)} MB
          </Typography>
          {expanded && report.analysisResult && (
            <Box mt={1.5} p={1.5} sx={{ backgroundColor: '#F8FAFC', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
              <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 700, display: 'block', mb: 0.5 }}>
                AI ANALYSIS SUMMARY
              </Typography>
              <Typography variant="caption" sx={{ color: '#334155', lineHeight: 1.6 }}>
                {report.analysisResult.overview}
              </Typography>
            </Box>
          )}
        </Box>
        <Button
          size="small"
          variant="outlined"
          href={report.storageUrl}
          target="_blank"
          sx={{ borderRadius: '999px', fontWeight: 700, borderColor: '#E2E8F0', color: '#64748B', whiteSpace: 'nowrap', flexShrink: 0 }}
        >
          View
        </Button>
      </Box>
    </Box>
  );
};

// ─── ProfileTab ──────────────────────────────────────────────────────────────
const ProfileTab: React.FC<{ user: any }> = ({ user }) => {
  const { refreshUser } = useAuth();
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false, message: '', severity: 'success',
  });

  // ── Edit form state ──────────────────────────────────────────────────────
  const [form, setForm] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    dateOfBirth: user?.dateOfBirth || '',
    gender: user?.gender || '',
    bloodGroup: user?.bloodGroup || '',
    address: user?.address || '',
    allergies: user?.allergies || '',
    chronicConditions: user?.chronicConditions || '',
    emergencyContact: user?.emergencyContact || '',
  });

  const handleOpen = () => {
    setForm({
      name: user?.name || '',
      phone: user?.phone || '',
      dateOfBirth: user?.dateOfBirth || '',
      gender: user?.gender || '',
      bloodGroup: user?.bloodGroup || '',
      address: user?.address || '',
      allergies: user?.allergies || '',
      chronicConditions: user?.chronicConditions || '',
      emergencyContact: user?.emergencyContact || '',
    });
    setEditOpen(true);
  };

  const handleSave = async () => {
    if (!user?.id) return;
    setSaving(true);
    try {
      const res = await authService.updateProfile(user.id, {
        name: form.name.trim(),
        phone: form.phone.trim(),
        dateOfBirth: form.dateOfBirth.trim(),
        gender: form.gender,
        bloodGroup: form.bloodGroup,
        address: form.address.trim(),
        allergies: form.allergies.trim(),
        chronicConditions: form.chronicConditions.trim(),
        emergencyContact: form.emergencyContact.trim(),
      });
      if (res.success) {
        await refreshUser();
        setEditOpen(false);
        setSnackbar({ open: true, message: 'Profile updated successfully!', severity: 'success' });
      } else {
        setSnackbar({ open: true, message: res.message, severity: 'error' });
      }
    } catch (e: any) {
      setSnackbar({ open: true, message: e.message || 'Failed to save profile.', severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const fields = [
    { label: 'Full Name', value: user?.name },
    { label: 'Email Address', value: user?.email },
    { label: 'Phone Number', value: user?.phone },
    { label: 'Patient ID', value: user?.patientId, mono: true },
    { label: 'Date of Birth', value: user?.dateOfBirth || '—' },
    { label: 'Gender', value: user?.gender || '—' },
    { label: 'Blood Group', value: user?.bloodGroup || '—' },
    { label: 'Address', value: user?.address || '—' },
    { label: 'Allergies', value: user?.allergies || '—' },
    { label: 'Chronic Conditions', value: user?.chronicConditions || '—' },
    { label: 'Emergency Contact', value: user?.emergencyContact || '—' },
    { label: 'Hospital', value: user?.hospitalName },
    { label: 'Account Created', value: user?.createdAt ? fmtDate(user.createdAt) : '—' },
  ];

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h6" sx={{ fontWeight: 800, color: '#1E293B' }}>
          My Profile
        </Typography>
        <Button
          variant="contained"
          startIcon={<Edit />}
          onClick={handleOpen}
          sx={{
            borderRadius: '999px',
            fontWeight: 700,
            background: `linear-gradient(135deg, ${C.primary}, ${C.teal})`,
            boxShadow: 'none',
            '&:hover': { boxShadow: '0 4px 12px rgba(21,101,192,0.3)' },
          }}
        >
          Edit Profile
        </Button>
      </Box>

      <Paper elevation={0} sx={{ borderRadius: '16px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
        {fields.map((f, i) => (
          <Box
            key={f.label}
            sx={{
              display: 'flex',
              px: 3, py: 2,
              borderBottom: i < fields.length - 1 ? '1px solid #F1F5F9' : 'none',
              alignItems: 'flex-start',
              gap: 2,
            }}
          >
            <Typography
              variant="caption"
              sx={{ fontWeight: 700, color: '#64748B', minWidth: 160, flexShrink: 0, pt: 0.25 }}
            >
              {f.label}
            </Typography>
            <Typography
              variant="body2"
              sx={{
                color: '#1E293B',
                fontFamily: (f as any).mono ? 'monospace' : 'inherit',
                fontWeight: (f as any).mono ? 700 : 400,
              }}
            >
              {f.value || '—'}
            </Typography>
          </Box>
        ))}
      </Paper>

      {/* ── Edit Profile Dialog ──────────────────────────────────────────────── */}
      <Dialog
        open={editOpen}
        onClose={() => !saving && setEditOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: '20px' } }}
      >
        <DialogTitle
          sx={{
            fontWeight: 800,
            color: '#1E293B',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          Edit Profile
          <IconButton size="small" onClick={() => setEditOpen(false)} disabled={saving}>
            <Close />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers sx={{ pt: 2.5 }}>
          <Grid container spacing={2.5}>
            {/* Full Name */}
            <Grid item xs={12}>
              <TextField
                label="Full Name"
                fullWidth
                size="small"
                value={form.name}
                onChange={set('name')}
              />
            </Grid>

            {/* Phone */}
            <Grid item xs={12} sm={6}>
              <TextField
                label="Phone Number"
                fullWidth
                size="small"
                value={form.phone}
                onChange={set('phone')}
              />
            </Grid>

            {/* Date of Birth */}
            <Grid item xs={12} sm={6}>
              <TextField
                label="Date of Birth"
                fullWidth
                size="small"
                type="date"
                value={form.dateOfBirth}
                onChange={set('dateOfBirth')}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>

            {/* Gender */}
            <Grid item xs={12} sm={6}>
              <TextField
                select
                label="Gender"
                fullWidth
                size="small"
                value={form.gender}
                onChange={set('gender')}
              >
                <MenuItem value="">— Select —</MenuItem>
                <MenuItem value="Male">Male</MenuItem>
                <MenuItem value="Female">Female</MenuItem>
                <MenuItem value="Non-Binary">Non-Binary</MenuItem>
                <MenuItem value="Prefer not to say">Prefer not to say</MenuItem>
              </TextField>
            </Grid>

            {/* Blood Group */}
            <Grid item xs={12} sm={6}>
              <TextField
                select
                label="Blood Group"
                fullWidth
                size="small"
                value={form.bloodGroup}
                onChange={set('bloodGroup')}
              >
                <MenuItem value="">— Select —</MenuItem>
                {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map((g) => (
                  <MenuItem key={g} value={g}>{g}</MenuItem>
                ))}
              </TextField>
            </Grid>

            {/* Address */}
            <Grid item xs={12}>
              <TextField
                label="Address"
                fullWidth
                size="small"
                multiline
                rows={2}
                value={form.address}
                onChange={set('address')}
              />
            </Grid>

            {/* Allergies */}
            <Grid item xs={12} sm={6}>
              <TextField
                label="Allergies"
                fullWidth
                size="small"
                placeholder="e.g. Penicillin, Peanuts"
                value={form.allergies}
                onChange={set('allergies')}
              />
            </Grid>

            {/* Chronic Conditions */}
            <Grid item xs={12} sm={6}>
              <TextField
                label="Chronic Conditions"
                fullWidth
                size="small"
                placeholder="e.g. Diabetes, Hypertension"
                value={form.chronicConditions}
                onChange={set('chronicConditions')}
              />
            </Grid>

            {/* Emergency Contact */}
            <Grid item xs={12}>
              <TextField
                label="Emergency Contact"
                fullWidth
                size="small"
                placeholder="Name · Relationship · Phone"
                value={form.emergencyContact}
                onChange={set('emergencyContact')}
              />
            </Grid>
          </Grid>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button
            onClick={() => setEditOpen(false)}
            disabled={saving}
            sx={{ borderRadius: '999px', fontWeight: 600 }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving || !form.name.trim()}
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <Save />}
            sx={{
              borderRadius: '999px',
              fontWeight: 700,
              px: 3,
              background: `linear-gradient(135deg, ${C.primary}, ${C.teal})`,
              boxShadow: 'none',
            }}
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Snackbar ─────────────────────────────────────────────────────────── */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
          severity={snackbar.severity}
          sx={{ borderRadius: '12px', fontWeight: 600 }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};
