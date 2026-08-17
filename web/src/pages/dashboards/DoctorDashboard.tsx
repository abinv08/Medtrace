import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Container, Typography, Paper, Button, TextField, Chip, Avatar,
  CircularProgress, Alert, Tabs, Tab, IconButton, Tooltip, Divider,
  Card, Badge, InputAdornment, Dialog, DialogTitle, DialogContent,
  DialogActions, MenuItem, Select, FormControl, InputLabel, Grid,
} from '@mui/material';
import {
  Search, Person, Description, Analytics, TrendingUp, Psychology,
  Logout, Notifications, MedicalServices, CheckCircle, Cancel,
  Edit, ArrowBack, WarningAmber, LocalHospital, Timeline as TLIcon,
  Chat, Science, Medication, CalendarMonth, FitnessCenter, Save,
  AccessTime, Done, Close,
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
  searchPatients,
  searchPatientById,
  searchPatientsByName,
  fetchAllPatients,
  fetchPatientProfile,
  addDoctorNote,
  saveAIFeedback,
  DoctorNote,
  PatientSearchResult,
} from '../../services/doctorService';
import {
  fetchPatientReports,
  fetchPatientTimeline,
  StoredReport,
  TimelineEvent,
} from '../../services/reportService';
import {
  Appointment,
  fetchDoctorAppointments,
  updateAppointmentStatus,
} from '../../services/appointmentService';
import {
  VitalReading,
  fetchPatientVitals,
  detectAnomalies,
  AnomalyAlert,
} from '../../services/healthAnalyticsService';
import { analyzeReport } from '../../services/geminiService';
import { compareReportsWithAI, ReportComparisonResult } from '../../services/comparisonService';

// ─── Color tokens ─────────────────────────────────────────────────────────────
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
};

const fmtDate = (iso: string) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

// ─── Stat card ────────────────────────────────────────────────────────────────
const StatCard: React.FC<{ label: string; value: number | string; icon: React.ReactNode; color: string }> = ({
  label, value, icon, color,
}) => (
  <Paper elevation={0} sx={{ p: 2, borderRadius: '14px', border: `1px solid ${color}20`, backgroundColor: `${color}08` }}>
    <Box sx={{ color, mb: 1 }}>{icon}</Box>
    <Typography variant="h5" sx={{ fontWeight: 800, color: C.slate }}>{value}</Typography>
    <Typography variant="caption" sx={{ color: C.muted, fontWeight: 600 }}>{label}</Typography>
  </Paper>
);

// ─── Doctor Dashboard ─────────────────────────────────────────────────────────
export const DoctorDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState(0);
  const [workspaceMode, setWorkspaceMode] = useState<'patients' | 'appointments'>('patients');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PatientSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [allPatients, setAllPatients] = useState<PatientSearchResult[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<PatientSearchResult | null>(null);
  const [patientReports, setPatientReports] = useState<StoredReport[]>([]);
  const [patientTimeline, setPatientTimeline] = useState<TimelineEvent[]>([]);
  const [patientVitals, setPatientVitals] = useState<VitalReading[]>([]);
  const [patientAnomalies, setPatientAnomalies] = useState<AnomalyAlert[]>([]);
  const [doctorAppointments, setDoctorAppointments] = useState<Appointment[]>([]);
  const [loadingPatient, setLoadingPatient] = useState(false);
  const [searchError, setSearchError] = useState('');

  // Doctor is pending → show pending screen
  if (user?.status === 'pending') {
    return <DoctorPendingScreen user={user} logout={logout} navigate={navigate} />;
  }
  if (user?.status === 'rejected') {
    return <DoctorRejectedScreen user={user} logout={logout} navigate={navigate} />;
  }

  return (
    <DoctorDashboardInner
      user={user}
      logout={logout}
      navigate={navigate}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      workspaceMode={workspaceMode}
      setWorkspaceMode={setWorkspaceMode}
      searchQuery={searchQuery}
      setSearchQuery={setSearchQuery}
      searchResults={searchResults}
      setSearchResults={setSearchResults}
      searching={searching}
      setSearching={setSearching}
      allPatients={allPatients}
      setAllPatients={setAllPatients}
      selectedPatient={selectedPatient}
      setSelectedPatient={setSelectedPatient}
      patientReports={patientReports}
      setPatientReports={setPatientReports}
      patientTimeline={patientTimeline}
      setPatientTimeline={setPatientTimeline}
      patientVitals={patientVitals}
      setPatientVitals={setPatientVitals}
      patientAnomalies={patientAnomalies}
      setPatientAnomalies={setPatientAnomalies}
      doctorAppointments={doctorAppointments}
      setDoctorAppointments={setDoctorAppointments}
      loadingPatient={loadingPatient}
      setLoadingPatient={setLoadingPatient}
      searchError={searchError}
      setSearchError={setSearchError}
    />
  );
};

// ─── Pending / Rejected screens ───────────────────────────────────────────────
const DoctorPendingScreen: React.FC<{ user: any; logout: any; navigate: any }> = ({ user, logout, navigate }) => (
  <Box sx={{ minHeight: '100vh', backgroundColor: C.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', p: 3 }}>
    <Paper elevation={0} sx={{ p: 5, borderRadius: '24px', border: `1px solid ${C.border}`, maxWidth: 500, textAlign: 'center' }}>
      <Box sx={{ width: 72, height: 72, borderRadius: '50%', backgroundColor: 'rgba(217,119,6,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 3 }}>
        <WarningAmber sx={{ fontSize: 36, color: C.amber }} />
      </Box>
      <Typography variant="h5" sx={{ fontWeight: 800, color: C.slate, mb: 1 }}>Account Pending Approval</Typography>
      <Typography variant="body2" sx={{ color: C.muted, mb: 1.5 }}>
        Welcome, Dr. <strong>{user?.name}</strong>
      </Typography>
      <Typography variant="body2" sx={{ color: C.muted, mb: 3 }}>
        Your doctor account has been created and is awaiting review by the MedTrace administrator. You will receive notification once your account is approved. This typically takes 1–2 business days.
      </Typography>
      <Chip label="Status: PENDING REVIEW" sx={{ backgroundColor: 'rgba(217,119,6,0.12)', color: C.amber, fontWeight: 800, mb: 3 }} />
      <Box display="flex" gap={2} justifyContent="center">
        <Button variant="outlined" onClick={() => { logout(); navigate('/login'); }} startIcon={<Logout />} sx={{ borderRadius: '999px', borderColor: C.border }}>Sign Out</Button>
      </Box>
    </Paper>
  </Box>
);

const DoctorRejectedScreen: React.FC<{ user: any; logout: any; navigate: any }> = ({ user, logout, navigate }) => (
  <Box sx={{ minHeight: '100vh', backgroundColor: C.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', p: 3 }}>
    <Paper elevation={0} sx={{ p: 5, borderRadius: '24px', border: `1px solid ${C.border}`, maxWidth: 500, textAlign: 'center' }}>
      <Box sx={{ width: 72, height: 72, borderRadius: '50%', backgroundColor: 'rgba(220,38,38,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 3 }}>
        <Cancel sx={{ fontSize: 36, color: C.red }} />
      </Box>
      <Typography variant="h5" sx={{ fontWeight: 800, color: C.slate, mb: 1 }}>Account Not Approved</Typography>
      <Typography variant="body2" sx={{ color: C.muted, mb: 3 }}>
        Your doctor registration was not approved. Please contact the MedTrace administration for more information.
      </Typography>
      <Button variant="outlined" onClick={() => { logout(); navigate('/login'); }} startIcon={<Logout />} sx={{ borderRadius: '999px', borderColor: C.border }}>Sign Out</Button>
    </Paper>
  </Box>
);

// ─── Main Doctor Dashboard Inner ─────────────────────────────────────────────
const DoctorDashboardInner: React.FC<any> = (props) => {
  const {
    user, logout, navigate,
    activeTab, setActiveTab,
    workspaceMode, setWorkspaceMode,
    searchQuery, setSearchQuery,
    searchResults, setSearchResults,
    searching, setSearching,
    allPatients, setAllPatients,
    selectedPatient, setSelectedPatient,
    patientReports, setPatientReports,
    patientTimeline, setPatientTimeline,
    patientVitals, setPatientVitals,
    patientAnomalies, setPatientAnomalies,
    doctorAppointments, setDoctorAppointments,
    loadingPatient, setLoadingPatient,
    searchError, setSearchError,
  } = props;

  const loadInitialData = useCallback(async () => {
    const [patients, apts] = await Promise.all([
      fetchAllPatients(),
      fetchDoctorAppointments(user?.id || 'doc-1'),
    ]);
    setAllPatients(patients);
    setDoctorAppointments(apts);
  }, [user?.id]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchError('');
    setSearchResults([]);
    setSelectedPatient(null);

    try {
      const results = await searchPatients(searchQuery.trim());
      if (results.length === 0) {
        setSearchError(`No patients found matching "${searchQuery}". Search by patient name (e.g. Johnathan) or Patient ID (e.g. MT-2026-000001, 000001).`);
      } else {
        setSearchResults(results);
      }
    } catch {
      setSearchError('Search failed. Please try again.');
    } finally {
      setSearching(false);
    }
  };

  const openPatient = async (patient: PatientSearchResult) => {
    setSelectedPatient(patient);
    setLoadingPatient(true);
    setActiveTab(0);
    try {
      const [reps, tl, vit] = await Promise.all([
        fetchPatientReports(patient.uid),
        fetchPatientTimeline(patient.uid),
        fetchPatientVitals(patient.uid),
      ]);
      setPatientReports(reps);
      setPatientTimeline(tl);
      setPatientVitals(vit);
      if (vit.length > 0) {
        setPatientAnomalies(detectAnomalies(vit[vit.length - 1], vit));
      }
    } finally {
      setLoadingPatient(false);
    }
  };

  const patientTabs = [
    'Clinical Overview',
    'Health Trends & Vitals',
    'Prescriptions & Meds',
    'Diagnostic Tests',
    'Reports & Analysis',
    'Health Timeline',
    'Doctor Notes',
    'AI Assistant',
  ];

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: C.bg }}>
      {/* ── Top Bar ─────────────────────────────────────────────────────────── */}
      <Box sx={{ backgroundColor: '#fff', borderBottom: `1px solid ${C.border}`, py: 1.5, px: { xs: 2, sm: 4 }, display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
        <Box display="flex" alignItems="center" gap={2}>
          <MedTraceLogo variant="full" size="small" />
          <Chip label="DOCTOR WORKSPACE" size="small" sx={{ backgroundColor: C.teal, color: '#fff', fontWeight: 800, fontSize: '0.68rem', borderRadius: '999px', height: 26 }} />
        </Box>
        <Box display="flex" alignItems="center" gap={2}>
          <NotificationBell userId={user?.id || 'default'} />
          <Typography variant="caption" sx={{ color: C.muted, fontWeight: 600, display: { xs: 'none', sm: 'block' } }}>
            Dr. {user?.name} · {user?.specialization || 'Physician'}
          </Typography>
          <Button variant="outlined" onClick={() => { logout(); navigate('/login'); }} startIcon={<Logout />} size="small"
            sx={{ borderRadius: '999px', borderColor: '#EF4444', color: '#EF4444', fontWeight: 700, '&:hover': { borderColor: '#DC2626', backgroundColor: 'rgba(239,68,68,0.05)' } }}>
            Sign Out
          </Button>
        </Box>
      </Box>

      {/* ── Hero Bar ────────────────────────────────────────────────────────── */}
      <Box sx={{ background: `linear-gradient(135deg, ${C.teal} 0%, ${C.primary} 100%)`, py: 3, px: { xs: 2, sm: 4 } }}>
        <Container maxWidth="lg">
          <Typography variant="h5" sx={{ color: '#fff', fontWeight: 800, mb: 0.5 }}>
            Clinical Intelligence Workspace
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)' }}>
            Dr. {user?.name} · {user?.specialization || 'General Physician'} · {user?.hospitalName}
          </Typography>

          {/* Search Bar */}
          <Box display="flex" gap={1.5} mt={2.5} flexWrap="wrap">
            <TextField
              placeholder="Search by Patient ID (MT-2026-000001) or Name…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              size="small"
              InputProps={{
                startAdornment: <InputAdornment position="start"><Search sx={{ color: 'rgba(255,255,255,0.7)', fontSize: 20 }} /></InputAdornment>,
                sx: {
                  backgroundColor: 'rgba(255,255,255,0.15)',
                  borderRadius: '999px',
                  color: '#fff',
                  '& input': { color: '#fff' },
                  '& input::placeholder': { color: 'rgba(255,255,255,0.6)' },
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.3) !important' },
                  minWidth: { xs: 220, sm: 380 },
                },
              }}
            />
            <Button
              variant="contained"
              onClick={handleSearch}
              disabled={searching || !searchQuery.trim()}
              startIcon={searching ? <CircularProgress size={16} color="inherit" /> : <Search />}
              sx={{
                borderRadius: '999px',
                backgroundColor: 'rgba(255,255,255,0.2)',
                backdropFilter: 'blur(8px)',
                color: '#fff',
                fontWeight: 700,
                border: '1px solid rgba(255,255,255,0.3)',
                boxShadow: 'none',
                '&:hover': { backgroundColor: 'rgba(255,255,255,0.3)' },
              }}
            >
              {searching ? 'Searching…' : 'Search Patient'}
            </Button>
          </Box>
        </Container>
      </Box>

      {/* ── Main Content Container ────────────────────────────────────────────── */}
      <Container maxWidth="lg" sx={{ py: 3 }}>
        {searchError && (
          <Alert severity="warning" sx={{ mb: 2, borderRadius: '12px' }} onClose={() => setSearchError('')}>{searchError}</Alert>
        )}

        {/* Search Results */}
        {searchResults.length > 0 && !selectedPatient && (
          <Paper elevation={0} sx={{ p: 2, borderRadius: '16px', border: `1px solid ${C.border}`, mb: 3 }}>
            <Typography variant="caption" sx={{ color: C.muted, fontWeight: 700, display: 'block', mb: 1.5 }}>
              SEARCH RESULTS ({searchResults.length})
            </Typography>
            <Box display="flex" flexDirection="column" gap={1}>
              {searchResults.map((p: PatientSearchResult) => (
                <Box
                  key={p.uid}
                  onClick={() => openPatient(p)}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 2, p: 1.5,
                    borderRadius: '10px', cursor: 'pointer',
                    '&:hover': { backgroundColor: '#F8FAFC' },
                    transition: 'background 0.15s',
                  }}
                >
                  <Avatar sx={{ backgroundColor: `${C.primary}18`, color: C.primary, fontWeight: 800, width: 40, height: 40 }}>
                    {p.name?.charAt(0)}
                  </Avatar>
                  <Box flex={1}>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: C.slate }}>{p.name}</Typography>
                    <Typography variant="caption" sx={{ color: C.muted }}>{p.patientId} · {p.email}</Typography>
                  </Box>
                  <Chip label="Open Profile" size="small" sx={{ backgroundColor: `${C.primary}12`, color: C.primary, fontWeight: 700, cursor: 'pointer' }} />
                </Box>
              ))}
            </Box>
          </Paper>
        )}

        {/* ── Selected Patient View ─────────────────────────────────────────── */}
        {selectedPatient ? (
          <Box>
            <Button startIcon={<ArrowBack />} onClick={() => { setSelectedPatient(null); setSearchResults([]); }}
              sx={{ color: C.muted, mb: 2, fontWeight: 600, '&:hover': { color: C.primary, backgroundColor: 'transparent' } }}>
              Back to Patient Directory
            </Button>

            {/* Patient Info Card */}
            <Paper elevation={0} sx={{ p: 3, borderRadius: '16px', border: `1px solid ${C.border}`, mb: 2, background: `linear-gradient(135deg, ${C.primary}06, ${C.teal}04)` }}>
              <Box display="flex" gap={2} alignItems="center" flexWrap="wrap">
                <Avatar sx={{ width: 56, height: 56, backgroundColor: `${C.primary}18`, color: C.primary, fontWeight: 800, fontSize: '1.3rem' }}>
                  {selectedPatient.name?.charAt(0)}
                </Avatar>
                <Box flex={1}>
                  <Typography variant="h6" sx={{ fontWeight: 800, color: C.slate }}>{selectedPatient.name}</Typography>
                  <Box display="flex" gap={1} flexWrap="wrap" mt={0.5}>
                    <Chip label={selectedPatient.patientId} size="small" sx={{ fontFamily: 'monospace', fontWeight: 800, backgroundColor: `${C.primary}12`, color: C.primary, fontSize: '0.75rem' }} />
                    {selectedPatient.gender && <Chip label={selectedPatient.gender} size="small" sx={{ backgroundColor: '#F1F5F9' }} />}
                    {selectedPatient.dateOfBirth && <Chip label={`DOB: ${fmtDate(selectedPatient.dateOfBirth)}`} size="small" sx={{ backgroundColor: '#F1F5F9' }} />}
                    {selectedPatient.bloodGroup && <Chip label={`Blood: ${selectedPatient.bloodGroup}`} size="small" sx={{ backgroundColor: 'rgba(220,38,38,0.08)', color: C.red }} />}
                  </Box>
                  {selectedPatient.chronicConditions && (
                    <Typography variant="caption" sx={{ color: C.amber, display: 'block', mt: 0.5 }}>
                      ⚠ Chronic: {selectedPatient.chronicConditions}
                    </Typography>
                  )}
                  {selectedPatient.allergies && (
                    <Typography variant="caption" sx={{ color: C.red, display: 'block' }}>
                      🚫 Allergies: {selectedPatient.allergies}
                    </Typography>
                  )}
                </Box>
                <Box display="flex" gap={1.5}>
                  <Box sx={{ textAlign: 'center', p: 1.5, borderRadius: '12px', backgroundColor: '#F8FAFC', border: `1px solid ${C.border}` }}>
                    <Typography variant="h5" sx={{ fontWeight: 800, color: C.primary }}>{patientReports.length}</Typography>
                    <Typography variant="caption" sx={{ color: C.muted, fontWeight: 600 }}>Reports</Typography>
                  </Box>
                  <Box sx={{ textAlign: 'center', p: 1.5, borderRadius: '12px', backgroundColor: '#F8FAFC', border: `1px solid ${C.border}` }}>
                    <Typography variant="h5" sx={{ fontWeight: 800, color: C.teal }}>{patientTimeline.length}</Typography>
                    <Typography variant="caption" sx={{ color: C.muted, fontWeight: 600 }}>Events</Typography>
                  </Box>
                </Box>
              </Box>
            </Paper>

            {/* Tab navigation */}
            <Box sx={{ backgroundColor: '#fff', borderRadius: '12px', border: `1px solid ${C.border}`, mb: 2 }}>
              <Tabs
                value={activeTab}
                onChange={(_, v) => setActiveTab(v)}
                variant="scrollable"
                scrollButtons="auto"
                sx={{ '& .MuiTab-root': { fontWeight: 700, fontSize: '0.82rem', textTransform: 'none', minHeight: 48 }, '& .Mui-selected': { color: C.primary }, '& .MuiTabs-indicator': { backgroundColor: C.primary } }}
              >
                {patientTabs.map((t, i) => <Tab key={t} label={t} id={`patient-detail-tab-${i}`} />)}
              </Tabs>
            </Box>

            {loadingPatient ? (
              <Box display="flex" justifyContent="center" py={6}><CircularProgress sx={{ color: C.primary }} /></Box>
            ) : (
              <>
                {activeTab === 0 && (
                  <Box display="flex" flexDirection="column" gap={2}>
                    <AnomalyDetectionCard
                      anomalies={patientAnomalies}
                      patientId={selectedPatient.uid}
                      patientName={selectedPatient.name}
                    />
                    <PatientOverviewTab patient={selectedPatient} reports={patientReports} timeline={patientTimeline} />
                  </Box>
                )}
                {activeTab === 1 && (
                  <Box display="flex" flexDirection="column" gap={2}>
                    <AnomalyDetectionCard
                      anomalies={patientAnomalies}
                      patientId={selectedPatient.uid}
                      patientName={selectedPatient.name}
                    />
                    <LongitudinalTrends
                      patientId={selectedPatient.uid}
                      vitals={patientVitals}
                      onVitalsUpdated={() => openPatient(selectedPatient)}
                    />
                  </Box>
                )}
                {activeTab === 2 && <MedicationTracker patientId={selectedPatient.uid} />}
                {activeTab === 3 && <TestResultsManager patientId={selectedPatient.uid} />}
                {activeTab === 4 && <ReportsTab patient={selectedPatient} reports={patientReports} doctorId={user?.id} doctorName={user?.name} />}
                {activeTab === 5 && <TimelineTab timeline={patientTimeline} />}
                {activeTab === 6 && <NotesTab patient={selectedPatient} doctorId={user?.id || ''} doctorName={user?.name || ''} />}
                {activeTab === 7 && <AIAssistantTab patient={selectedPatient} reports={patientReports} />}
              </>
            )}
          </Box>
        ) : (
          /* ── Workspace Mode Switcher (All Patients / Appointments Queue) ─── */
          <Box display="flex" flexDirection="column" gap={3}>
            <Box display="flex" gap={1.5} alignItems="center" flexWrap="wrap">
              <Button
                variant={workspaceMode === 'patients' ? 'contained' : 'outlined'}
                onClick={() => setWorkspaceMode('patients')}
                sx={{ borderRadius: '999px', fontWeight: 700, textTransform: 'none', backgroundColor: workspaceMode === 'patients' ? C.primary : 'transparent' }}
              >
                Patients Directory ({allPatients.length})
              </Button>
              <Button
                variant={workspaceMode === 'appointments' ? 'contained' : 'outlined'}
                onClick={() => setWorkspaceMode('appointments')}
                sx={{ borderRadius: '999px', fontWeight: 700, textTransform: 'none', backgroundColor: workspaceMode === 'appointments' ? C.primary : 'transparent' }}
              >
                Appointments Queue ({doctorAppointments.length})
                {doctorAppointments.filter((a: Appointment) => a.status === 'pending').length > 0 && (
                  <Chip
                    label={`${doctorAppointments.filter((a: Appointment) => a.status === 'pending').length} Pending`}
                    size="small"
                    sx={{ ml: 1, height: 20, fontSize: '0.65rem', fontWeight: 800, backgroundColor: '#EF4444', color: '#fff' }}
                  />
                )}
              </Button>
            </Box>

            {workspaceMode === 'patients' ? (
              <Box>
                <Typography variant="subtitle2" sx={{ color: C.muted, fontWeight: 700, mb: 2 }}>
                  ACTIVE PATIENT RECORDS
                </Typography>
                {allPatients.length === 0 ? (
                  <Alert severity="info" sx={{ borderRadius: '12px' }}>No patients registered yet.</Alert>
                ) : (
                  <Box display="flex" flexDirection="column" gap={1.5}>
                    {allPatients.map((p: PatientSearchResult) => (
                      <Paper key={p.uid} elevation={0} onClick={() => openPatient(p)} sx={{ p: 2, borderRadius: '12px', border: `1px solid ${C.border}`, cursor: 'pointer', '&:hover': { borderColor: C.primary, backgroundColor: `${C.primary}04` }, transition: 'all 0.15s' }}>
                        <Box display="flex" alignItems="center" gap={2}>
                          <Avatar sx={{ backgroundColor: `${C.primary}18`, color: C.primary, fontWeight: 800 }}>{p.name?.charAt(0)}</Avatar>
                          <Box flex={1}>
                            <Typography variant="body2" sx={{ fontWeight: 700, color: C.slate }}>{p.name}</Typography>
                            <Typography variant="caption" sx={{ color: C.muted }}>{p.patientId} · {p.email}</Typography>
                          </Box>
                          <Chip label={`Registered ${fmtDate(p.createdAt || '')}`} size="small" sx={{ backgroundColor: '#F1F5F9', fontSize: '0.7rem' }} />
                        </Box>
                      </Paper>
                    ))}
                  </Box>
                )}
              </Box>
            ) : (
              <AppointmentsQueueTab
                appointments={doctorAppointments}
                onStatusUpdated={loadInitialData}
              />
            )}
          </Box>
        )}
      </Container>
    </Box>
  );
};

// ─── Appointments Queue Tab ──────────────────────────────────────────────────
const AppointmentsQueueTab: React.FC<{
  appointments: Appointment[];
  onStatusUpdated: () => void;
}> = ({ appointments, onStatusUpdated }) => {
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const handleAction = async (id: string, status: Appointment['status'], patientId?: string, patientName?: string, date?: string, timeSlot?: string) => {
    setUpdatingId(id);
    try {
      await updateAppointmentStatus(id, status, status === 'confirmed' ? 'Confirmed by specialist.' : 'Completed.', patientId);
      if (status === 'confirmed') {
        setFeedbackMsg(`✓ Appointment with ${patientName || 'Patient'} on ${date} at ${timeSlot} is now CONFIRMED! Patient has been notified.`);
      } else if (status === 'completed') {
        setFeedbackMsg(`✓ Consultation with ${patientName || 'Patient'} marked as COMPLETED.`);
      } else if (status === 'cancelled') {
        setFeedbackMsg(`Appointment slot with ${patientName || 'Patient'} has been cancelled.`);
      }
      setTimeout(() => setFeedbackMsg(null), 6000);
      onStatusUpdated();
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <Paper elevation={0} sx={{ p: 3, borderRadius: '16px', border: `1px solid ${C.border}`, backgroundColor: '#FFFFFF' }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2.5} flexWrap="wrap" gap={1}>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 800, color: C.slate }}>
            Clinical Consultations & Booking Queue
          </Typography>
          <Typography variant="caption" sx={{ color: C.muted }}>
            Review incoming consultation requests, confirm slots, and update visit statuses
          </Typography>
        </Box>
        <Chip label={`${appointments.length} Total Consultations`} size="small" sx={{ fontWeight: 700, backgroundColor: '#EFF6FF', color: C.primary }} />
      </Box>

      {feedbackMsg && (
        <Alert severity="success" sx={{ mb: 2.5, borderRadius: '12px', fontWeight: 600 }} onClose={() => setFeedbackMsg(null)}>
          {feedbackMsg}
        </Alert>
      )}

      {appointments.length === 0 ? (
        <Typography variant="body2" sx={{ color: C.muted, py: 4, textAlign: 'center' }}>
          No appointments scheduled in your queue.
        </Typography>
      ) : (
        <Box display="flex" flexDirection="column" gap={2}>
          {appointments.map((apt) => (
            <Paper key={apt.id} elevation={0} sx={{ p: 2.5, borderRadius: '14px', border: `1px solid ${C.border}`, backgroundColor: '#F8FAFC' }}>
              <Box display="flex" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={1.5} mb={1}>
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, color: C.slate }}>
                    {apt.patientName}
                  </Typography>
                  <Typography variant="caption" sx={{ color: C.primary, fontWeight: 700 }}>
                    📅 {apt.date} at {apt.timeSlot} ({apt.consultationType})
                  </Typography>
                </Box>
                <Chip
                  label={apt.status.toUpperCase()}
                  size="small"
                  sx={{
                    fontWeight: 800,
                    fontSize: '0.68rem',
                    backgroundColor: apt.status === 'confirmed' ? '#ECFDF5' : apt.status === 'pending' ? '#FFFBEB' : '#F1F5F9',
                    color: apt.status === 'confirmed' ? '#059669' : apt.status === 'pending' ? '#D97706' : C.muted,
                  }}
                />
              </Box>

              <Typography variant="body2" sx={{ color: '#475569', fontSize: '0.82rem', mb: 2 }}>
                <strong>Chief Complaint:</strong> {apt.reason}
              </Typography>

              <Box display="flex" justifyContent="flex-end" gap={1}>
                {apt.status === 'pending' && (
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={updatingId === apt.id ? <CircularProgress size={14} color="inherit" /> : <Done />}
                    onClick={() => handleAction(apt.id, 'confirmed', apt.patientId, apt.patientName, apt.date, apt.timeSlot)}
                    disabled={Boolean(updatingId)}
                    sx={{ borderRadius: '999px', backgroundColor: '#059669', fontWeight: 700, fontSize: '0.75rem', '&:hover': { backgroundColor: '#047857' } }}
                  >
                    Accept & Confirm
                  </Button>
                )}
                {apt.status === 'confirmed' && (
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={updatingId === apt.id ? <CircularProgress size={14} color="inherit" /> : <CheckCircle />}
                    onClick={() => handleAction(apt.id, 'completed', apt.patientId, apt.patientName, apt.date, apt.timeSlot)}
                    disabled={Boolean(updatingId)}
                    sx={{ borderRadius: '999px', backgroundColor: C.primary, fontWeight: 700, fontSize: '0.75rem' }}
                  >
                    Mark Completed
                  </Button>
                )}
                {apt.status !== 'cancelled' && apt.status !== 'completed' && (
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<Close />}
                    onClick={() => handleAction(apt.id, 'cancelled', apt.patientId, apt.patientName, apt.date, apt.timeSlot)}
                    disabled={Boolean(updatingId)}
                    sx={{ borderRadius: '999px', borderColor: '#EF4444', color: '#EF4444', fontWeight: 700, fontSize: '0.75rem' }}
                  >
                    Cancel Slot
                  </Button>
                )}
              </Box>
            </Paper>
          ))}
        </Box>
      )}
    </Paper>
  );
};

// ─── Sub-tabs ──────────────────────────────────────────────────────────────────
const PatientOverviewTab: React.FC<{ patient: PatientSearchResult; reports: StoredReport[]; timeline: TimelineEvent[] }> = ({ patient, reports, timeline }) => (
  <Box display="flex" flexDirection="column" gap={2}>
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(3,1fr)' }, gap: 2 }}>
      <StatCard label="Total Reports" value={reports.length} icon={<Description />} color={C.primary} />
      <StatCard label="AI Analyses" value={reports.filter((r) => r.analysisResult).length} icon={<Analytics />} color={C.purple} />
      <StatCard label="Urgent Reports" value={reports.filter((r) => r.analysisResult?.urgencyLevel === 'Urgent').length} icon={<WarningAmber />} color={C.red} />
    </Box>
    {reports.filter((r) => r.analysisResult?.urgencyLevel === 'Urgent').length > 0 && (
      <Alert severity="error" sx={{ borderRadius: '12px' }}>
        ⚠ This patient has <strong>{reports.filter((r) => r.analysisResult?.urgencyLevel === 'Urgent').length}</strong> report(s) flagged as URGENT. Review immediately.
      </Alert>
    )}
    {reports.length > 0 && (
      <Paper elevation={0} sx={{ p: 2.5, borderRadius: '14px', border: `1px solid ${C.border}` }}>
        <Typography variant="caption" sx={{ color: C.muted, fontWeight: 700, display: 'block', mb: 1.5 }}>LATEST REPORT SUMMARY</Typography>
        {reports[0].analysisResult ? (
          <>
            <Typography variant="body2" sx={{ color: C.slate, lineHeight: 1.7 }}>{reports[0].analysisResult.overview}</Typography>
            <Box mt={1.5} display="flex" gap={1} flexWrap="wrap">
              {reports[0].analysisResult.abnormalValues.slice(0, 3).map((v, i) => (
                <Chip key={i} label={`${v.parameter}: ${v.value}`} size="small" sx={{ backgroundColor: 'rgba(220,38,38,0.08)', color: C.red, fontWeight: 700, fontSize: '0.7rem' }} />
              ))}
            </Box>
          </>
        ) : (
          <Typography variant="body2" sx={{ color: C.muted }}>No AI analysis available for this report.</Typography>
        )}
      </Paper>
    )}
  </Box>
);

const ReportsTab: React.FC<{ patient: PatientSearchResult; reports: StoredReport[]; doctorId?: string; doctorName?: string }> = ({ patient, reports, doctorId, doctorName }) => {
  const [selectedA, setSelectedA] = useState('');
  const [selectedB, setSelectedB] = useState('');
  const [comparing, setComparing] = useState(false);
  const [comparison, setComparison] = useState<ReportComparisonResult | null>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackReport, setFeedbackReport] = useState<StoredReport | null>(null);
  const [agree, setAgree] = useState(true);
  const [correctedDiagnosis, setCorrectedDiagnosis] = useState('');
  const [feedbackComments, setFeedbackComments] = useState('');
  const [savingFeedback, setSavingFeedback] = useState(false);
  const [feedbackSaved, setFeedbackSaved] = useState(false);

  const handleCompare = async () => {
    const rA = reports.find((r) => r.id === selectedA);
    const rB = reports.find((r) => r.id === selectedB);
    if (!rA || !rB) return;
    setComparing(true);
    try {
      const res = await compareReportsWithAI(rA, rB);
      setComparison(res);
    } catch {
      // ignore
    } finally {
      setComparing(false);
    }
  };

  const handleOpenFeedback = (report: StoredReport) => {
    setFeedbackReport(report);
    setAgree(true);
    setCorrectedDiagnosis('');
    setFeedbackComments('');
    setFeedbackSaved(false);
    setFeedbackOpen(true);
  };

  const handleSaveFeedback = async () => {
    if (!feedbackReport) return;
    setSavingFeedback(true);
    try {
      await saveAIFeedback({
        reportId: feedbackReport.id,
        doctorId: doctorId || '',
        doctorName: doctorName || '',
        patientUid: patient.uid,
        aiResult: feedbackReport.analysisResult,
        decision: agree ? 'confirmed' : 'modified',
        doctorComment: feedbackComments,
        modifiedFindings: agree ? undefined : correctedDiagnosis,
      });
      setFeedbackSaved(true);
      setTimeout(() => setFeedbackOpen(false), 1500);
    } finally {
      setSavingFeedback(false);
    }
  };

  return (
    <Box display="flex" flexDirection="column" gap={3}>
      <Typography variant="subtitle2" sx={{ fontWeight: 800, color: C.slate }}>
        Patient Medical Reports ({reports.length})
      </Typography>

      {/* Comparison Tool */}
      {reports.length >= 2 && (
        <Paper elevation={0} sx={{ p: 2.5, borderRadius: '14px', border: `1px solid ${C.border}`, backgroundColor: '#FFFFFF' }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 800, color: C.slate, mb: 1.5 }}>
            AI Longitudinal Report Comparison
          </Typography>
          <Box display="flex" gap={2} flexWrap="wrap" alignItems="center">
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>Baseline Report</InputLabel>
              <Select value={selectedA} label="Baseline Report" onChange={(e) => setSelectedA(e.target.value)}>
                {reports.map((r) => (
                  <MenuItem key={r.id} value={r.id}>{r.fileName} ({fmtDate(r.uploadedAt)})</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>Follow-up Report</InputLabel>
              <Select value={selectedB} label="Follow-up Report" onChange={(e) => setSelectedB(e.target.value)}>
                {reports.map((r) => (
                  <MenuItem key={r.id} value={r.id}>{r.fileName} ({fmtDate(r.uploadedAt)})</MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button
              variant="contained"
              size="small"
              onClick={handleCompare}
              disabled={comparing || !selectedA || !selectedB || selectedA === selectedB}
              sx={{ borderRadius: '999px', backgroundColor: C.primary, fontWeight: 700 }}
            >
              {comparing ? <CircularProgress size={16} color="inherit" /> : 'Compare with AI'}
            </Button>
          </Box>

          {comparison && (
            <Box mt={2} p={2} sx={{ backgroundColor: '#F8FAFC', borderRadius: '10px', border: `1px solid ${C.border}` }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, color: C.slate, mb: 1 }}>
                Overall Trend: <span style={{ color: comparison.overallTrend === 'Improving' ? '#059669' : comparison.overallTrend === 'Deteriorating' ? '#DC2626' : '#1565C0' }}>{comparison.overallTrend.toUpperCase()}</span>
              </Typography>
              <Typography variant="body2" sx={{ color: C.slate, mb: 1 }}>{comparison.summary}</Typography>
              <Typography variant="caption" sx={{ fontWeight: 700, color: C.muted }}>Key Changes Observed:</Typography>
              <Box component="ul" sx={{ pl: 2, m: 0 }}>
                {comparison.changes.map((c, i) => (
                  <li key={i}>
                    <Typography variant="caption" sx={{ color: '#475569' }}>
                      <strong>{c.parameter}:</strong> {c.previousValue} → {c.currentValue} ({c.trend} · {c.significance} significance)
                    </Typography>
                  </li>
                ))}
              </Box>
            </Box>
          )}
        </Paper>
      )}

      {/* Reports List */}
      <Box display="flex" flexDirection="column" gap={2}>
        {reports.map((r) => (
          <Paper key={r.id} elevation={0} sx={{ p: 2.5, borderRadius: '14px', border: `1px solid ${C.border}` }}>
            <Box display="flex" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={1}>
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 800, color: C.slate }}>{r.fileName}</Typography>
                <Typography variant="caption" sx={{ color: C.muted }}>Uploaded {fmtDate(r.uploadedAt)} · Type: {r.reportType}</Typography>
              </Box>
              <Box display="flex" gap={1}>
                {r.analysisResult && (
                  <Button size="small" variant="outlined" onClick={() => handleOpenFeedback(r)} sx={{ borderRadius: '999px', fontSize: '0.72rem', fontWeight: 700 }}>
                    Provide Feedback on AI
                  </Button>
                )}
                <Button size="small" variant="outlined" href={r.storageUrl} target="_blank" sx={{ borderRadius: '999px', fontSize: '0.72rem', fontWeight: 700 }}>
                  View Document
                </Button>
              </Box>
            </Box>

            {r.analysisResult && (
              <Box mt={1.5} p={1.5} sx={{ backgroundColor: '#F8FAFC', borderRadius: '10px' }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: C.muted, display: 'block', mb: 0.5 }}>AI CLINICAL SUMMARY</Typography>
                <Typography variant="caption" sx={{ color: C.slate, lineHeight: 1.6 }}>{r.analysisResult.overview}</Typography>
              </Box>
            )}
          </Paper>
        ))}
      </Box>

      {/* Feedback Dialog */}
      <Dialog open={feedbackOpen} onClose={() => setFeedbackOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Clinical AI Analysis Feedback</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: C.muted, mb: 2 }}>
            Provide clinical ground truth to refine MedTrace diagnostic models.
          </Typography>
          <FormControl fullWidth size="small" sx={{ mb: 2 }}>
            <InputLabel>Do you agree with the AI Interpretation?</InputLabel>
            <Select value={agree ? 'yes' : 'no'} label="Do you agree with the AI Interpretation?" onChange={(e) => setAgree(e.target.value === 'yes')}>
              <MenuItem value="yes">Yes — Assessment is accurate</MenuItem>
              <MenuItem value="no">No — Requires clinical adjustment</MenuItem>
            </Select>
          </FormControl>
          {!agree && (
            <TextField fullWidth label="Corrected Diagnosis / Findings" size="small" value={correctedDiagnosis} onChange={(e) => setCorrectedDiagnosis(e.target.value)} sx={{ mb: 2 }} />
          )}
          <TextField fullWidth multiline rows={3} label="Clinical Comments / Rationale" size="small" value={feedbackComments} onChange={(e) => setFeedbackComments(e.target.value)} />
          {feedbackSaved && <Alert severity="success" sx={{ mt: 2, borderRadius: '8px' }}>Feedback recorded successfully.</Alert>}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setFeedbackOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveFeedback} disabled={savingFeedback} sx={{ borderRadius: '999px', backgroundColor: C.primary, fontWeight: 700 }}>
            {savingFeedback ? 'Saving…' : 'Submit Feedback'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

const TimelineTab: React.FC<{ timeline: TimelineEvent[] }> = ({ timeline }) => (
  <Paper elevation={0} sx={{ p: 3, borderRadius: '14px', border: `1px solid ${C.border}`, backgroundColor: '#FFFFFF' }}>
    <Typography variant="subtitle1" sx={{ fontWeight: 800, color: C.slate, mb: 2 }}>
      Patient Longitudinal Timeline ({timeline.length} events)
    </Typography>
    {timeline.length === 0 ? (
      <Typography variant="body2" sx={{ color: C.muted }}>No timeline events recorded.</Typography>
    ) : (
      <Box display="flex" flexDirection="column" gap={1.5}>
        {timeline.map((e) => (
          <Paper key={e.id} elevation={0} sx={{ p: 2, borderRadius: '10px', border: `1px solid ${C.border}`, backgroundColor: '#F8FAFC' }}>
            <Typography variant="body2" sx={{ fontWeight: 800, color: C.slate }}>{e.title}</Typography>
            <Typography variant="caption" sx={{ color: C.muted }}>{fmtDate(e.createdAt)} · {e.description}</Typography>
          </Paper>
        ))}
      </Box>
    )}
  </Paper>
);

const NotesTab: React.FC<{ patient: PatientSearchResult; doctorId: string; doctorName: string }> = ({ patient, doctorId, doctorName }) => {
  const [noteText, setNoteText] = useState('');
  const [visibility, setVisibility] = useState<'patient_visible' | 'doctors_only'>('patient_visible');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    if (!noteText.trim()) return;
    setSaving(true);
    try {
      await addDoctorNote({
        patientId: patient.patientId || patient.uid,
        patientUid: patient.uid,
        doctorId,
        doctorName,
        note: noteText.trim(),
        noteType: 'observation',
      });
      setSaved(true);
      setNoteText('');
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Paper elevation={0} sx={{ p: 3, borderRadius: '14px', border: `1px solid ${C.border}`, backgroundColor: '#FFFFFF' }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 800, color: C.slate, mb: 2 }}>
        Clinical Doctor Notes & Observations
      </Typography>
      <Box mb={2}>
        <FormControl size="small" sx={{ minWidth: 220, mb: 2 }}>
          <InputLabel>Note Visibility</InputLabel>
          <Select value={visibility} label="Note Visibility" onChange={(e) => setVisibility(e.target.value as any)}>
            <MenuItem value="patient_visible">Visible to Patient & Caretakers</MenuItem>
            <MenuItem value="doctors_only">Confidential (Doctors Only)</MenuItem>
          </Select>
        </FormControl>
        <TextField
          fullWidth
          multiline
          rows={4}
          placeholder="Record clinical observations, treatment plans, follow-up instructions, or lab test orders…"
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          size="small"
        />
      </Box>
      {saved && <Alert severity="success" sx={{ mb: 2, borderRadius: '8px' }}>Note saved to patient medical record.</Alert>}
      <Button
        variant="contained"
        onClick={handleSave}
        disabled={saving || !noteText.trim()}
        startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <Save />}
        sx={{ borderRadius: '999px', backgroundColor: C.primary, fontWeight: 700 }}
      >
        {saving ? 'Saving…' : 'Save Note'}
      </Button>
    </Paper>
  );
};

const AIAssistantTab: React.FC<{ patient: PatientSearchResult; reports: StoredReport[] }> = ({ patient, reports }) => {
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);

  const buildContext = () => {
    const reportSummaries = reports
      .filter((r) => r.analysisResult)
      .slice(0, 5)
      .map((r, i) => `Report ${i + 1} (${r.reportType}, ${fmtDate(r.uploadedAt)}): ${r.analysisResult!.overview} Urgency: ${r.analysisResult!.urgencyLevel}. Abnormals: ${r.analysisResult!.abnormalValues.map((v) => `${v.parameter}=${v.value}`).join(', ')}.`)
      .join('\n');

    return `Patient: ${patient.name} (ID: ${patient.patientId})
Gender: ${patient.gender || 'unknown'}, DOB: ${patient.dateOfBirth || 'unknown'}
Blood Group: ${patient.bloodGroup || 'unknown'}
Chronic Conditions: ${patient.chronicConditions || 'none documented'}
Allergies: ${patient.allergies || 'none documented'}
Total Reports: ${reports.length}

Recent AI-Analyzed Reports:
${reportSummaries || 'No analyzed reports available.'}`;
  };

  const sendMessage = async () => {
    if (!input.trim() || thinking) return;
    const userMsg = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMsg }]);
    setThinking(true);

    try {
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY as string);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

      const systemContext = `You are MedTrace Clinical AI Assistant, helping a doctor review a patient's medical history.
You have access to the following de-identified patient data:

${buildContext()}

IMPORTANT RULES:
- You are assisting the DOCTOR, not the patient directly.
- You can provide clinical observations based on the data above.
- Do NOT make definitive diagnoses — say "may suggest" or "consistent with".
- Keep responses concise and clinical.
- If asked about something not in the data, say it's not available.
- Always recommend clinical judgment over AI interpretation.`;

      const chat = model.startChat({ history: [] });
      const result = await chat.sendMessage(`${systemContext}\n\nDoctor question: ${userMsg}`);
      const response = result.response.text();
      setMessages((prev) => [...prev, { role: 'assistant', content: response }]);
    } catch (err: any) {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Unable to process the request. Please try again.' }]);
    } finally {
      setThinking(false);
    }
  };

  return (
    <Paper elevation={0} sx={{ borderRadius: '14px', border: `1px solid ${C.border}`, overflow: 'hidden' }}>
      <Box sx={{ p: 2, borderBottom: `1px solid ${C.border}`, backgroundColor: `${C.primary}06` }}>
        <Box display="flex" alignItems="center" gap={1.5}>
          <Box sx={{ width: 36, height: 36, borderRadius: '10px', background: `linear-gradient(135deg, ${C.primary}, ${C.teal})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Psychology sx={{ color: '#fff', fontSize: 20 }} />
          </Box>
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 800, color: C.slate }}>MedTrace Clinical AI</Typography>
            <Typography variant="caption" sx={{ color: C.muted }}>Context-aware • Patient data loaded • {reports.filter((r) => r.analysisResult).length} reports analyzed</Typography>
          </Box>
        </Box>
      </Box>

      <Box sx={{ p: 2, minHeight: 300, maxHeight: 420, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {messages.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="body2" sx={{ color: C.muted, mb: 2 }}>Ask me about this patient's health history</Typography>
            <Box display="flex" gap={1} justifyContent="center" flexWrap="wrap">
              {['Summarize health history', 'Any urgent concerns?', 'Trend analysis', 'Medication risks'].map((s) => (
                <Chip key={s} label={s} size="small" onClick={() => setInput(s)} sx={{ cursor: 'pointer', backgroundColor: `${C.primary}10`, color: C.primary, fontWeight: 600, '&:hover': { backgroundColor: `${C.primary}20` } }} />
              ))}
            </Box>
          </Box>
        )}
        {messages.map((m, i) => (
          <Box key={i} sx={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <Box sx={{
              maxWidth: '85%', p: 1.5, borderRadius: m.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
              backgroundColor: m.role === 'user' ? C.primary : '#F8FAFC',
              border: m.role === 'assistant' ? `1px solid ${C.border}` : 'none',
            }}>
              <Typography variant="body2" sx={{ color: m.role === 'user' ? '#fff' : C.slate, lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
                {m.content}
              </Typography>
            </Box>
          </Box>
        ))}
        {thinking && (
          <Box display="flex" gap={1} alignItems="center">
            <CircularProgress size={16} sx={{ color: C.primary }} />
            <Typography variant="caption" sx={{ color: C.muted }}>Analyzing patient data…</Typography>
          </Box>
        )}
      </Box>

      <Box sx={{ p: 2, borderTop: `1px solid ${C.border}`, display: 'flex', gap: 1.5 }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Ask about this patient's health…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
          sx={{ '& .MuiOutlinedInput-root': { borderRadius: '999px' } }}
        />
        <Button
          variant="contained"
          onClick={sendMessage}
          disabled={thinking || !input.trim()}
          sx={{ borderRadius: '999px', background: `linear-gradient(135deg, ${C.primary}, ${C.teal})`, boxShadow: 'none', fontWeight: 700, minWidth: 80 }}
        >
          Send
        </Button>
      </Box>
    </Paper>
  );
};
