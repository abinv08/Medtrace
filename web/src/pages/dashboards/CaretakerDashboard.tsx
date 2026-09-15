import React, { useState, useEffect, useCallback } from 'react';
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
  Badge,
  IconButton,
  Tooltip,
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
  Refresh,
  MonitorHeart,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { MedTraceLogo } from '../../components/Logo';
import { useAuth } from '../../contexts/AuthContext';
import { Navbar } from '../../components/Navbar';
import { NotificationBell } from '../../components/NotificationBell';
import { LongitudinalTrends } from '../../components/LongitudinalTrends';
import { AnomalyDetectionCard } from '../../components/AnomalyDetectionCard';
import { MedicationTracker } from '../../components/MedicationTracker';
import { TestResultsManager } from '../../components/TestResultsManager';
import api from '../../services/api';
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

export interface BackendVitals {
  _id: string;
  patientId: string;
  heartRate?: number;
  spo2?: number;
  bloodPressureSystolic?: number;
  bloodPressureDiastolic?: number;
  temperature?: number;
  source?: string;
  recordedAt?: string;
}

export interface MonitoredPatient extends CaretakerLink {
  patientDocId?: string;
  patientUserId?: string;
}

const computeVitalsAlerts = (vitals: BackendVitals, history: VitalReading[] = []): AnomalyAlert[] => {
  const alerts: AnomalyAlert[] = [];
  const nowStr = vitals.recordedAt || new Date().toISOString();

  // Convert BackendVitals to VitalReading
  const reading: VitalReading = {
    id: vitals._id || `vital-${Date.now()}`,
    patientId: vitals.patientId,
    date: vitals.recordedAt ? vitals.recordedAt.split('T')[0] : new Date().toISOString().split('T')[0],
    time: vitals.recordedAt ? new Date(vitals.recordedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : undefined,
    systolicBP: vitals.bloodPressureSystolic || 120,
    diastolicBP: vitals.bloodPressureDiastolic || 80,
    heartRate: vitals.heartRate || 72,
    spO2: vitals.spo2,
    source: (vitals.source as any) || 'manual',
  };

  // Run detectAnomalies algorithm
  const detected = detectAnomalies(reading, history.length > 0 ? history : [reading]);
  alerts.push(...detected);

  // Oxygen saturation alert if low and not already caught
  if (vitals.spo2 && vitals.spo2 < 92 && !alerts.some((a) => a.metric === 'Oxygen Saturation')) {
    alerts.push({
      id: `anom-spo2-${Date.now()}`,
      metric: 'Oxygen Saturation',
      severity: vitals.spo2 < 88 ? 'critical' : 'high',
      detectedValue: `${vitals.spo2}%`,
      baselineValue: '98%',
      standardDeviations: 3.2,
      title: vitals.spo2 < 88 ? 'Severe Hypoxemia Critical Alert' : 'Low Oxygen Saturation Alert',
      description: `Dependent SpO₂ level has dropped to ${vitals.spo2}%, below safe clinical limits.`,
      clinicalAction: 'Ensure patient is resting comfortably. Verify pulse oximeter positioning and seek immediate clinical care if persistent.',
      timestamp: nowStr,
    });
  }

  // Hypertensive Crisis check
  if (
    vitals.bloodPressureSystolic &&
    vitals.bloodPressureSystolic >= 180 &&
    !alerts.some((a) => a.metric === 'Blood Pressure')
  ) {
    alerts.push({
      id: `anom-bp-crit-${Date.now()}`,
      metric: 'Blood Pressure',
      severity: 'critical',
      detectedValue: `${vitals.bloodPressureSystolic}/${vitals.bloodPressureDiastolic || 100} mmHg`,
      baselineValue: '120/80 mmHg',
      standardDeviations: 4.0,
      title: 'Hypertensive Crisis Threshold Exceeded',
      description: `Blood pressure reading of ${vitals.bloodPressureSystolic}/${vitals.bloodPressureDiastolic || 100} mmHg is critically elevated.`,
      clinicalAction: 'Rest immediately. Contact attending physician or emergency services immediately.',
      timestamp: nowStr,
    });
  }

  return alerts;
};

export const CaretakerDashboard: React.FC = () => {
  const { user, token, getToken } = useAuth();
  const navigate = useNavigate();

  const [dependents, setDependents] = useState<MonitoredPatient[]>([]);
  const [selectedDependent, setSelectedDependent] = useState<MonitoredPatient | null>(null);
  const [patientVitalsMap, setPatientVitalsMap] = useState<Record<string, BackendVitals>>({});
  const [patientAlertsMap, setPatientAlertsMap] = useState<Record<string, AnomalyAlert[]>>({});
  const [vitals, setVitals] = useState<VitalReading[]>([]);
  const [anomalies, setAnomalies] = useState<AnomalyAlert[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const loadDependentDetails = async (
    dep: MonitoredPatient,
    authHeaders?: Record<string, string>,
    latestVital?: BackendVitals
  ) => {
    const [historicalVitals, apts] = await Promise.all([
      fetchPatientVitals(dep.patientId).catch(() => []),
      fetchPatientAppointments(dep.patientId).catch(() => []),
    ]);

    let mergedVitals = historicalVitals;
    if (latestVital) {
      const exists = mergedVitals.some((v) => v.date === latestVital.recordedAt?.split('T')[0]);
      if (!exists) {
        const liveReading: VitalReading = {
          id: latestVital._id || `live-${Date.now()}`,
          patientId: dep.patientId,
          date: latestVital.recordedAt ? latestVital.recordedAt.split('T')[0] : new Date().toISOString().split('T')[0],
          time: latestVital.recordedAt ? new Date(latestVital.recordedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : undefined,
          systolicBP: latestVital.bloodPressureSystolic || 120,
          diastolicBP: latestVital.bloodPressureDiastolic || 80,
          heartRate: latestVital.heartRate || 72,
          spO2: latestVital.spo2,
          source: (latestVital.source as any) || 'manual',
        };
        mergedVitals = [...mergedVitals, liveReading];
      }
    }

    setVitals(mergedVitals);
    setAppointments(apts);

    if (latestVital) {
      const alerts = computeVitalsAlerts(latestVital, mergedVitals);
      setAnomalies(alerts);
    } else if (mergedVitals.length > 0) {
      const latest = mergedVitals[mergedVitals.length - 1];
      setAnomalies(detectAnomalies(latest, mergedVitals));
    } else {
      setAnomalies([]);
    }
  };

  const loadData = useCallback(async (isSilent = false) => {
    if (!user) return;
    if (!isSilent) setLoading(true);
    else setRefreshing(true);
    setFetchError(null);

    try {
      let authToken = token;
      if (!authToken && typeof getToken === 'function') {
        try {
          authToken = await getToken();
        } catch {
          /* ignore */
        }
      }
      const authHeaders: Record<string, string> = authToken ? { Authorization: `Bearer ${authToken}` } : {};
      const caretakerId = user.id || (user as any)._id || (user as any).uid || '';

      // 1. Fetch assigned monitored patients: GET /api/caretaker/:caretakerId/patients
      let loadedDependents: MonitoredPatient[] = [];
      try {
        const res = await api.get(`/api/caretaker/${caretakerId}/patients`, { headers: authHeaders });
        if (res.data?.success && Array.isArray(res.data.assignments) && res.data.assignments.length > 0) {
          loadedDependents = res.data.assignments.map((a: any) => {
            const patientObj = a.patientId || {};
            const userObj = typeof patientObj.userId === 'object' && patientObj.userId ? patientObj.userId : {};
            const patientDocId = patientObj._id ? String(patientObj._id) : undefined;
            const patientUserId = userObj._id ? String(userObj._id) : (typeof patientObj.userId === 'string' ? patientObj.userId : undefined);
            const targetId = patientDocId || patientUserId || patientObj.patientId || a.patientId;
            const patientName = userObj.name || patientObj.name || 'Monitored Patient';
            const patientPatientId = patientObj.patientId || (patientDocId ? `PT-${patientDocId.slice(-6).toUpperCase()}` : undefined);

            return {
              id: a._id ? String(a._id) : `care-${Date.now()}`,
              patientId: targetId,
              patientDocId,
              patientUserId,
              patientName,
              patientPatientId,
              caretakerEmail: user.email || '',
              caretakerName: user.name || '',
              relationship: a.relationship || 'Dependent',
              accessLevel: 'Full Access (Vitals, Meds, Appointments)',
              status: a.status || 'active',
              assignedAt: a.createdAt || new Date().toISOString(),
            };
          });
        }
      } catch (err: any) {
        console.warn('GET /api/caretaker/:caretakerId/patients returned error, checking fallback:', err.message);
      }

      // Fallback to local / mock / firestore patients if backend returned 0
      if (loadedDependents.length === 0 && user.email) {
        const fallbackLinks = await fetchAssignedPatientsForCaretaker(user.email).catch(() => []);
        loadedDependents = fallbackLinks;
      }

      setDependents(loadedDependents);

      if (loadedDependents.length === 0) {
        setSelectedDependent(null);
        setVitals([]);
        setAnomalies([]);
        setAppointments([]);
        return;
      }

      // 2. Fetch Latest Vitals for EACH patient: GET /api/vitals/:patientId/latest for alert display
      const vitalsMap: Record<string, BackendVitals> = {};
      const alertsMap: Record<string, AnomalyAlert[]> = {};

      await Promise.allSettled(
        loadedDependents.map(async (dep) => {
          const candidateIds = [dep.patientDocId, dep.patientUserId, dep.patientId].filter(Boolean) as string[];
          for (const tid of candidateIds) {
            try {
              const vRes = await api.get(`/api/vitals/${tid}/latest`, { headers: authHeaders });
              if (vRes.data?.success && vRes.data?.vitals) {
                const bv: BackendVitals = vRes.data.vitals;
                vitalsMap[dep.patientId] = bv;
                if (dep.patientDocId) vitalsMap[dep.patientDocId] = bv;
                if (dep.patientUserId) vitalsMap[dep.patientUserId] = bv;

                const patientAlerts = computeVitalsAlerts(bv);
                alertsMap[dep.patientId] = patientAlerts;
                break;
              }
            } catch {
              // no latest vitals under this ID
            }
          }
        })
      );

      setPatientVitalsMap(vitalsMap);
      setPatientAlertsMap(alertsMap);

      // Select active dependent
      const currentSelected = selectedDependent && loadedDependents.some((d) => d.patientId === selectedDependent.patientId)
        ? loadedDependents.find((d) => d.patientId === selectedDependent.patientId)!
        : loadedDependents[0];

      setSelectedDependent(currentSelected);

      // 3. Load historical vitals and appointments for the selected dependent
      const selectedLatestVital = vitalsMap[currentSelected.patientId] ||
        (currentSelected.patientDocId ? vitalsMap[currentSelected.patientDocId] : undefined);
      await loadDependentDetails(currentSelected, authHeaders, selectedLatestVital);
    } catch (e: any) {
      console.error('Error loading caretaker dashboard data:', e);
      setFetchError(e.message || 'Error loading dependent clinical records');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, token, getToken]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSelectDependent = async (dep: MonitoredPatient) => {
    setSelectedDependent(dep);
    setLoading(true);
    try {
      let authToken = token;
      if (!authToken && typeof getToken === 'function') {
        try {
          authToken = await getToken();
        } catch {
          /* ignore */
        }
      }
      const authHeaders: Record<string, string> = authToken ? { Authorization: `Bearer ${authToken}` } : {};
      const latest = patientVitalsMap[dep.patientId] || (dep.patientDocId ? patientVitalsMap[dep.patientDocId] : undefined);
      await loadDependentDetails(dep, authHeaders, latest);
    } finally {
      setLoading(false);
    }
  };

  // Compile all alerts across all monitored patients for the alert display
  const allActiveAlerts = Object.entries(patientAlertsMap).flatMap(([pId, alerts]) => {
    const dep = dependents.find((d) => d.patientId === pId);
    return alerts.map((a) => ({
      ...a,
      patientName: dep?.patientName || 'Monitored Dependent',
      patientId: pId,
    }));
  });

  const currentLatestVital = selectedDependent
    ? patientVitalsMap[selectedDependent.patientId] ||
      (selectedDependent.patientDocId ? patientVitalsMap[selectedDependent.patientDocId] : undefined)
    : undefined;

  const tabs = ['Dependent Overview', 'Vitals & Trends', 'Medications', 'Lab Results', 'Appointments'];

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: '#F0F4F8' }}>
      {/* ── Main Navbar ──────────────────────────────────────────────────────── */}
      <Navbar />

      {/* ── Hero Banner ──────────────────────────────────────────────────────── */}
      <Box sx={{ background: 'linear-gradient(135deg, #1E293B 0%, #334155 100%)', py: 3, px: { xs: 2, sm: 4 } }}>
        <Container maxWidth="lg">
          <Box display="flex" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={2}>
            <Box display="flex" alignItems="center" gap={2}>
              <Avatar sx={{ width: 56, height: 56, backgroundColor: '#D97706', color: '#fff', fontWeight: 800 }}>
                <Shield />
              </Avatar>
              <Box>
                <Box display="flex" alignItems="center" gap={1.5}>
                  <Typography variant="h5" sx={{ color: '#fff', fontWeight: 800 }}>
                    Caregiver & Family Oversight
                  </Typography>
                  <Tooltip title="Refresh Dependent Records & Vitals">
                    <IconButton
                      size="small"
                      onClick={() => loadData(true)}
                      disabled={loading || refreshing}
                      sx={{ color: 'rgba(255,255,255,0.7)', '&:hover': { color: '#fff' } }}
                    >
                      <Refresh sx={{ fontSize: 18, animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
                    </IconButton>
                  </Tooltip>
                </Box>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                  Active monitoring for dependent: <strong>{selectedDependent?.patientName || 'Patient'}</strong> ({selectedDependent?.relationship || 'Dependent'})
                </Typography>
              </Box>
            </Box>

            {/* Dependent Switcher */}
            {dependents.length > 1 && (
              <Box display="flex" gap={1} flexWrap="wrap">
                {dependents.map((dep) => {
                  const hasAlerts = (patientAlertsMap[dep.patientId]?.length || 0) > 0;
                  const isSelected = selectedDependent?.id === dep.id;
                  return (
                    <Badge
                      key={dep.id}
                      color="error"
                      variant="dot"
                      invisible={!hasAlerts}
                    >
                      <Chip
                        label={`${dep.patientName} (${dep.relationship})`}
                        onClick={() => handleSelectDependent(dep)}
                        color={isSelected ? 'warning' : 'default'}
                        sx={{
                          fontWeight: 700,
                          cursor: 'pointer',
                          color: '#fff',
                          backgroundColor: isSelected ? '#D97706' : 'rgba(255,255,255,0.15)',
                          border: hasAlerts ? '1px solid #EF4444' : 'none',
                        }}
                      />
                    </Badge>
                  );
                })}
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
        {fetchError && (
          <Alert severity="warning" sx={{ mb: 3, borderRadius: '12px' }} onClose={() => setFetchError(null)}>
            {fetchError}
          </Alert>
        )}

        {/* ── Real-Time Alert Display Across Monitored Patients ───────────────── */}
        {allActiveAlerts.length > 0 && (
          <Alert
            severity="error"
            icon={<WarningAmber sx={{ fontSize: 24, color: '#DC2626' }} />}
            sx={{
              mb: 3,
              borderRadius: '16px',
              border: '1px solid #FECACA',
              backgroundColor: '#FEF2F2',
              p: 2,
            }}
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#991B1B', mb: 0.5 }}>
              HEALTH ALERT: {allActiveAlerts.length} Dependent Vitals Notification{allActiveAlerts.length > 1 ? 's' : ''}
            </Typography>
            <Box component="ul" sx={{ m: 0, pl: 2 }}>
              {allActiveAlerts.map((alt, idx) => (
                <li key={idx}>
                  <Typography variant="body2" sx={{ color: '#B91C1C' }}>
                    <strong>{alt.patientName}</strong>: {alt.title} — Value: <strong>{alt.detectedValue}</strong> ({alt.clinicalAction})
                  </Typography>
                </li>
              ))}
            </Box>
          </Alert>
        )}

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
                {/* Anomaly Card for Selected Dependent */}
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
                        {currentLatestVital?.bloodPressureSystolic && currentLatestVital?.bloodPressureDiastolic
                          ? `${currentLatestVital.bloodPressureSystolic}/${currentLatestVital.bloodPressureDiastolic} mmHg`
                          : vitals.length
                          ? `${vitals[vitals.length - 1].systolicBP}/${vitals[vitals.length - 1].diastolicBP} mmHg`
                          : '124/82 mmHg'}
                      </Typography>
                      <Typography variant="caption" sx={{ color: currentLatestVital?.heartRate ? '#1565C0' : '#059669', fontWeight: 600 }}>
                        {currentLatestVital?.heartRate
                          ? `● HR: ${currentLatestVital.heartRate} bpm ${currentLatestVital.spo2 ? `· SpO₂: ${currentLatestVital.spo2}%` : ''}`
                          : '● Continuous Baseline Active'}
                      </Typography>
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
                  onVitalsUpdated={() => loadData(true)}
                />
              </Box>
            )}

            {/* ── Tab 1: Vitals & Trends ──────────────────────────────────────── */}
            {activeTab === 1 && (
              <LongitudinalTrends
                patientId={selectedDependent.patientId}
                vitals={vitals}
                onVitalsUpdated={() => loadData(true)}
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
                {appointments.length === 0 ? (
                  <Alert severity="info" sx={{ borderRadius: '12px' }}>
                    No consultations scheduled for this dependent.
                  </Alert>
                ) : (
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
                )}
              </Paper>
            )}
          </>
        )}
      </Container>
    </Box>
  );
};
