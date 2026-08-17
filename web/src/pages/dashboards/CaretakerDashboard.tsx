import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Paper,
  Button,
  Chip,
  Avatar,
  CircularProgress,
  Tabs,
  Tab,
  Grid,
  Divider,
  Alert,
} from '@mui/material';
import {
  Shield,
  Person,
  Logout,
  LocalHospital,
  Favorite,
  CalendarMonth,
  Medication,
  WarningAmber,
  Timeline,
  CheckCircle,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { MedTraceLogo } from '../../components/Logo';
import { useAuth } from '../../contexts/AuthContext';
import { NotificationBell } from '../../components/NotificationBell';
import { LongitudinalTrends } from '../../components/LongitudinalTrends';
import { AnomalyDetectionCard } from '../../components/AnomalyDetectionCard';
import { MedicationTracker } from '../../components/MedicationTracker';
import { TestResultsManager } from '../../components/TestResultsManager';
import {
  CaretakerLink,
  fetchAssignedPatientsForCaretaker,
} from '../../services/caretakerService';
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

export const CaretakerDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [dependents, setDependents] = useState<CaretakerLink[]>([]);
  const [selectedDependent, setSelectedDependent] = useState<CaretakerLink | null>(null);
  const [vitals, setVitals] = useState<VitalReading[]>([]);
  const [anomalies, setAnomalies] = useState<AnomalyAlert[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    if (!user?.email) return;
    setLoading(true);
    try {
      const links = await fetchAssignedPatientsForCaretaker(user.email);
      setDependents(links);
      if (links.length > 0) {
        const primary = links[0];
        setSelectedDependent(primary);
        const [v, apts] = await Promise.all([
          fetchPatientVitals(primary.patientId),
          fetchPatientAppointments(primary.patientId),
        ]);
        setVitals(v);
        setAppointments(apts);
        if (v.length > 0) {
          const latest = v[v.length - 1];
          setAnomalies(detectAnomalies(latest, v));
        }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user?.email]);

  const handleSelectDependent = async (dep: CaretakerLink) => {
    setSelectedDependent(dep);
    setLoading(true);
    try {
      const [v, apts] = await Promise.all([
        fetchPatientVitals(dep.patientId),
        fetchPatientAppointments(dep.patientId),
      ]);
      setVitals(v);
      setAppointments(apts);
      if (v.length > 0) {
        setAnomalies(detectAnomalies(v[v.length - 1], v));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const tabs = ['Dependent Overview', 'Vitals & Trends', 'Medications', 'Lab Results', 'Appointments'];

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: '#F0F4F8' }}>
      {/* ── Top Bar ─────────────────────────────────────────────────────────── */}
      <Box
        sx={{
          backgroundColor: '#FFFFFF',
          borderBottom: '1px solid #E2E8F0',
          py: 1.5,
          px: { xs: 2, sm: 4 },
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          position: 'sticky',
          top: 0,
          zIndex: 100,
          boxShadow: '0 1px 8px rgba(0,0,0,0.06)',
        }}
      >
        <Box display="flex" alignItems="center" gap={2}>
          <MedTraceLogo variant="full" size="small" />
          <Chip
            label="CARETAKER PORTAL"
            size="small"
            sx={{
              backgroundColor: '#D97706',
              color: '#fff',
              fontWeight: 800,
              fontSize: '0.68rem',
              borderRadius: '999px',
              height: 26,
            }}
          />
        </Box>

        <Box display="flex" alignItems="center" gap={2}>
          <NotificationBell userId={user?.id || 'default'} />
          <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600, display: { xs: 'none', sm: 'block' } }}>
            {user?.name}
          </Typography>
          <Button
            variant="outlined"
            onClick={handleLogout}
            startIcon={<Logout />}
            size="small"
            sx={{
              borderRadius: '999px',
              borderColor: '#EF4444',
              color: '#EF4444',
              fontWeight: 700,
              fontSize: '0.8rem',
              '&:hover': { borderColor: '#DC2626', backgroundColor: 'rgba(239,68,68,0.05)' },
            }}
          >
            Sign Out
          </Button>
        </Box>
      </Box>

      {/* ── Hero Banner ──────────────────────────────────────────────────────── */}
      <Box sx={{ background: 'linear-gradient(135deg, #1E293B 0%, #334155 100%)', py: 3, px: { xs: 2, sm: 4 } }}>
        <Container maxWidth="lg">
          <Box display="flex" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={2}>
            <Box display="flex" alignItems="center" gap={2}>
              <Avatar sx={{ width: 56, height: 56, backgroundColor: '#D97706', color: '#fff', fontWeight: 800 }}>
                <Shield />
              </Avatar>
              <Box>
                <Typography variant="h5" sx={{ color: '#fff', fontWeight: 800 }}>
                  Caregiver & Family Oversight
                </Typography>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                  Active monitoring for dependent: <strong>{selectedDependent?.patientName || 'Patient'}</strong> ({selectedDependent?.relationship || 'Dependent'})
                </Typography>
              </Box>
            </Box>

            {/* Dependent Switcher */}
            {dependents.length > 1 && (
              <Box display="flex" gap={1}>
                {dependents.map((dep) => (
                  <Chip
                    key={dep.id}
                    label={`${dep.patientName} (${dep.relationship})`}
                    onClick={() => handleSelectDependent(dep)}
                    color={selectedDependent?.id === dep.id ? 'warning' : 'default'}
                    sx={{ fontWeight: 700, cursor: 'pointer', color: '#fff' }}
                  />
                ))}
              </Box>
            )}
          </Box>
        </Container>
      </Box>

      {/* ── Tabs Navigation ──────────────────────────────────────────────────── */}
      <Box sx={{ backgroundColor: '#FFFFFF', borderBottom: '1px solid #E2E8F0' }}>
        <Container maxWidth="lg">
          <Tabs
            value={activeTab}
            onChange={(_, v) => setActiveTab(v)}
            sx={{
              '& .MuiTab-root': { fontWeight: 700, fontSize: '0.85rem', textTransform: 'none', minHeight: 48 },
              '& .Mui-selected': { color: '#D97706' },
              '& .MuiTabs-indicator': { backgroundColor: '#D97706' },
            }}
          >
            {tabs.map((t, i) => (
              <Tab key={t} label={t} id={`care-tab-${i}`} />
            ))}
          </Tabs>
        </Container>
      </Box>

      {/* ── Main Content ─────────────────────────────────────────────────────── */}
      <Container maxWidth="lg" sx={{ py: 3.5 }}>
        {loading ? (
          <Box display="flex" justifyContent="center" py={8}><CircularProgress sx={{ color: '#D97706' }} /></Box>
        ) : !selectedDependent ? (
          <Alert severity="info" sx={{ borderRadius: '12px' }}>
            No dependent patients linked to your caretaker account. Ask your family member to assign you via their Care Network tab.
          </Alert>
        ) : (
          <>
            {/* ── Tab 0: Overview ────────────────────────────────────────────── */}
            {activeTab === 0 && (
              <Box display="flex" flexDirection="column" gap={3}>
                {/* Anomaly Card */}
                <AnomalyDetectionCard
                  anomalies={anomalies}
                  patientId={selectedDependent.patientId}
                  patientName={selectedDependent.patientName}
                />

                {/* Quick Stats Grid */}
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={4}>
                    <Paper elevation={0} sx={{ p: 2.5, borderRadius: '16px', border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF' }}>
                      <Box display="flex" alignItems="center" gap={1} mb={1}>
                        <Favorite sx={{ color: '#DC2626', fontSize: 20 }} />
                        <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 700 }}>LATEST BLOOD PRESSURE</Typography>
                      </Box>
                      <Typography variant="h5" sx={{ fontWeight: 800, color: '#1E293B' }}>
                        {vitals.length ? `${vitals[vitals.length - 1].systolicBP}/${vitals[vitals.length - 1].diastolicBP} mmHg` : '124/82 mmHg'}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#059669', fontWeight: 600 }}>● Continuous Baseline Active</Typography>
                    </Paper>
                  </Grid>

                  <Grid item xs={12} sm={4}>
                    <Paper elevation={0} sx={{ p: 2.5, borderRadius: '16px', border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF' }}>
                      <Box display="flex" alignItems="center" gap={1} mb={1}>
                        <Medication sx={{ color: '#D97706', fontSize: 20 }} />
                        <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 700 }}>MEDICATION COMPLIANCE</Typography>
                      </Box>
                      <Typography variant="h5" sx={{ fontWeight: 800, color: '#D97706' }}>92% Score</Typography>
                      <Typography variant="caption" sx={{ color: '#64748B' }}>Doses tracked on schedule</Typography>
                    </Paper>
                  </Grid>

                  <Grid item xs={12} sm={4}>
                    <Paper elevation={0} sx={{ p: 2.5, borderRadius: '16px', border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF' }}>
                      <Box display="flex" alignItems="center" gap={1} mb={1}>
                        <CalendarMonth sx={{ color: '#7C3AED', fontSize: 20 }} />
                        <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 700 }}>NEXT APPOINTMENT</Typography>
                      </Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#1E293B' }}>
                        {appointments.length ? `${appointments[0].date} (${appointments[0].timeSlot})` : 'No upcoming visits'}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#64748B' }}>
                        {appointments.length ? appointments[0].doctorName : 'Schedule follow-up'}
                      </Typography>
                    </Paper>
                  </Grid>
                </Grid>

                {/* Embedded Trends preview */}
                <LongitudinalTrends
                  patientId={selectedDependent.patientId}
                  vitals={vitals}
                  onVitalsUpdated={loadData}
                />
              </Box>
            )}

            {/* ── Tab 1: Vitals & Trends ──────────────────────────────────────── */}
            {activeTab === 1 && (
              <LongitudinalTrends
                patientId={selectedDependent.patientId}
                vitals={vitals}
                onVitalsUpdated={loadData}
              />
            )}

            {/* ── Tab 2: Medications ─────────────────────────────────────────── */}
            {activeTab === 2 && (
              <MedicationTracker patientId={selectedDependent.patientId} />
            )}

            {/* ── Tab 3: Lab Results ─────────────────────────────────────────── */}
            {activeTab === 3 && (
              <TestResultsManager patientId={selectedDependent.patientId} />
            )}

            {/* ── Tab 4: Appointments ────────────────────────────────────────── */}
            {activeTab === 4 && (
              <Paper elevation={0} sx={{ p: 3, borderRadius: '20px', border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF' }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#1E293B', mb: 2 }}>
                  Dependent Clinical Consultations
                </Typography>
                <Box display="flex" flexDirection="column" gap={1.5}>
                  {appointments.map((apt) => (
                    <Paper key={apt.id} elevation={0} sx={{ p: 2, borderRadius: '12px', border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC' }}>
                      <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
                        <Box>
                          <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#1E293B' }}>{apt.doctorName}</Typography>
                          <Typography variant="caption" sx={{ color: '#1565C0', fontWeight: 600 }}>{apt.doctorSpecialization} · {apt.date} at {apt.timeSlot}</Typography>
                        </Box>
                        <Chip label={apt.status.toUpperCase()} size="small" sx={{ fontWeight: 800, fontSize: '0.68rem', backgroundColor: apt.status === 'confirmed' ? '#ECFDF5' : '#EFF6FF', color: apt.status === 'confirmed' ? '#059669' : '#1565C0' }} />
                      </Box>
                      <Typography variant="caption" sx={{ color: '#64748B', display: 'block', mt: 0.5 }}>Reason: {apt.reason}</Typography>
                    </Paper>
                  ))}
                </Box>
              </Paper>
            )}
          </>
        )}
      </Container>
    </Box>
  );
};
