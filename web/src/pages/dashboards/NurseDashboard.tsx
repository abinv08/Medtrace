import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  CheckCircle,
  Logout,
  MonitorHeart,
  Refresh,
  TaskAlt,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '../../components/Navbar';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';

const C = {
  primary: '#1565C0',
  teal: '#00838F',
  green: '#059669',
  amber: '#D97706',
  slate: '#1E293B',
  muted: '#64748B',
  border: '#E2E8F0',
  bg: '#F0F4F8',
};

interface Patient {
  _id?: string;
  name?: string;
  userId?: { name?: string; email?: string } | string;
}

interface AssignedPatient {
  id: string;
  patientId: string;
  patient: Patient;
  latestVitals?: LatestVitals | null;
}

interface LatestVitals {
  _id?: string;
  heartRate?: number;
  spo2?: number;
  bloodPressureSystolic?: number;
  bloodPressureDiastolic?: number;
  temperature?: number;
  recordedAt?: string;
}

interface NurseTask {
  _id: string;
  taskDescription: string;
  dueAt?: string;
  patientId?: Patient | string;
}

interface VitalsForm {
  heartRate: string;
  spo2: string;
  bloodPressureSystolic: string;
  bloodPressureDiastolic: string;
  temperature: string;
}

const emptyVitals = (): VitalsForm => ({
  heartRate: '',
  spo2: '',
  bloodPressureSystolic: '',
  bloodPressureDiastolic: '',
  temperature: '',
});

const getId = (value: { _id?: string } | undefined) => value?._id || '';

const getPatientName = (patient?: Patient | string) => {
  if (!patient) return 'Patient';
  if (typeof patient === 'string') return patient;
  if (patient.name) return patient.name;
  if (patient.userId && typeof patient.userId === 'object') return patient.userId.name || patient.userId.email || 'Patient';
  return 'Patient';
};

const formatDate = (value?: string) => value ? new Date(value).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : 'No reading yet';

export const NurseDashboard: React.FC = () => {
  const { user, token, getToken, logout } = useAuth();
  const navigate = useNavigate();
  const [patients, setPatients] = useState<AssignedPatient[]>([]);
  const [tasks, setTasks] = useState<NurseTask[]>([]);
  const [forms, setForms] = useState<Record<string, VitalsForm>>({});
  const [loading, setLoading] = useState(true);
  const [savingVitals, setSavingVitals] = useState<string | null>(null);
  const [completingTask, setCompletingTask] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');

  const loadData = useCallback(async () => {
    const nurseId = user?.id || (user as any)?._id || (user as any)?.uid;
    if (!nurseId) return;
    setLoading(true);
    setError('');
    try {
      const activeToken = token || await getToken();
      const headers = activeToken ? { Authorization: `Bearer ${activeToken}` } : {};
      const [assignmentsResponse, tasksResponse] = await Promise.all([
        api.get(`/api/nurse-assignments/${nurseId}/patients`, { headers }),
        api.get('/api/nurse-tasks', { params: { assignedNurse: nurseId, status: 'approved' }, headers }),
      ]);

      const assignments = assignmentsResponse.data?.assignments || [];
      const assignedPatients: AssignedPatient[] = assignments.map((assignment: any) => {
        const patient = typeof assignment.patientId === 'object' ? assignment.patientId : {};
        const patientId = String(patient._id || patient.userId?._id || patient.userId || assignment.patientId);
        return { id: String(assignment._id || patientId), patientId, patient };
      });

      const withVitals = await Promise.all(assignedPatients.map(async (assignedPatient) => {
        try {
          const response = await api.get(`/api/vitals/${assignedPatient.patientId}/latest`, { headers });
          return { ...assignedPatient, latestVitals: response.data?.vitals || null };
        } catch {
          return { ...assignedPatient, latestVitals: null };
        }
      }));

      setPatients(withVitals);
      setTasks(tasksResponse.data?.tasks || []);
      setForms((current) => {
        const next = { ...current };
        withVitals.forEach((patient) => { if (!next[patient.patientId]) next[patient.patientId] = emptyVitals(); });
        return next;
      });
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Unable to load nurse dashboard');
    } finally {
      setLoading(false);
    }
  }, [getToken, token, user]);

  useEffect(() => { loadData(); }, [loadData]);

  const updateForm = (patientId: string, field: keyof VitalsForm, value: string) => {
    setForms((current) => ({ ...current, [patientId]: { ...(current[patientId] || emptyVitals()), [field]: value } }));
  };

  const handleSaveVitals = async (event: React.FormEvent, patientId: string) => {
    event.preventDefault();
    const form = forms[patientId] || emptyVitals();
    const payload: Record<string, unknown> = { patientId, source: 'manual' };
    (['heartRate', 'spo2', 'bloodPressureSystolic', 'bloodPressureDiastolic', 'temperature'] as const).forEach((field) => {
      if (form[field].trim()) payload[field] = Number(form[field]);
    });
    if (Object.keys(payload).length === 2) {
      setError('Enter at least one vital sign before saving.');
      return;
    }

    setSavingVitals(patientId);
    setError('');
    try {
      const activeToken = token || await getToken();
      const headers = activeToken ? { Authorization: `Bearer ${activeToken}` } : {};
      await api.post('/api/vitals', payload, { headers });
      setForms((current) => ({ ...current, [patientId]: emptyVitals() }));
      setFeedback('Vitals recorded successfully.');
      await loadData();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Unable to record vitals');
    } finally {
      setSavingVitals(null);
    }
  };

  const handleCompleteTask = async (taskId: string) => {
    setCompletingTask(taskId);
    setError('');
    try {
      const activeToken = token || await getToken();
      const headers = activeToken ? { Authorization: `Bearer ${activeToken}` } : {};
      await api.put(`/api/nurse-tasks/${taskId}/complete`, {}, { headers });
      setTasks((current) => current.filter((task) => task._id !== taskId));
      setFeedback('Task marked complete.');
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Unable to complete task');
    } finally {
      setCompletingTask(null);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: C.bg }}>
      <Navbar />
      <Box sx={{ maxWidth: 1440, mx: 'auto', px: { xs: 2, md: 5 }, py: { xs: 3, md: 5 } }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, mb: 4, flexWrap: 'wrap' }}>
          <Box>
            <Typography variant="h4" sx={{ color: C.slate, fontWeight: 850 }}>Nurse rounds</Typography>
            <Typography sx={{ color: C.muted, mt: 0.5 }}>Assigned patients, approved tasks, and quick bedside observations.</Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" startIcon={<Refresh />} onClick={loadData} sx={{ borderColor: C.border, color: C.slate, borderRadius: '10px' }}>Refresh</Button>
            <Button variant="outlined" startIcon={<Logout />} onClick={() => { logout(); navigate('/login'); }} sx={{ borderColor: C.border, color: C.muted, borderRadius: '10px' }}>Sign out</Button>
          </Stack>
        </Box>

        {error && <Alert severity="error" sx={{ mb: 2.5 }}>{error}</Alert>}
        {feedback && <Alert severity="success" sx={{ mb: 2.5 }} onClose={() => setFeedback('')}>{feedback}</Alert>}

        {loading ? <Box sx={{ display: 'flex', justifyContent: 'center', py: 12 }}><CircularProgress sx={{ color: C.primary }} /></Box> : (
          <Stack spacing={3}>
            <Paper elevation={0} sx={{ p: { xs: 2.5, md: 3 }, border: `1px solid ${C.border}`, borderRadius: '14px' }}>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                <MonitorHeart sx={{ color: C.teal }} />
                <Typography variant="h6" sx={{ color: C.slate, fontWeight: 800 }}>Assigned patients</Typography>
                <Typography variant="body2" sx={{ color: C.muted, ml: 'auto' }}>{patients.length} patient{patients.length === 1 ? '' : 's'}</Typography>
              </Stack>
              <Divider sx={{ mb: 2 }} />
              {patients.length === 0 ? <Typography sx={{ color: C.muted, py: 3 }}>No patients are currently assigned to you.</Typography> : (
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: 'repeat(2, 1fr)' }, gap: 2 }}>
                  {patients.map((assignedPatient) => {
                    const vitals = assignedPatient.latestVitals;
                    const form = forms[assignedPatient.patientId] || emptyVitals();
                    return (
                      <Paper key={assignedPatient.id} variant="outlined" sx={{ p: 2, borderColor: C.border, borderRadius: '10px' }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, mb: 1.5 }}>
                          <Box>
                            <Typography sx={{ color: C.slate, fontWeight: 800 }}>{getPatientName(assignedPatient.patient)}</Typography>
                            <Typography variant="caption" sx={{ color: C.muted }}>Latest reading: {formatDate(vitals?.recordedAt)}</Typography>
                          </Box>
                          <Typography variant="caption" sx={{ color: C.muted, fontFamily: 'monospace' }}>{assignedPatient.patientId.slice(-8)}</Typography>
                        </Box>
                        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, mb: 2 }}>
                          {[
                            ['HR', vitals?.heartRate ? `${vitals.heartRate} bpm` : '—'],
                            ['SpO2', vitals?.spo2 ? `${vitals.spo2}%` : '—'],
                            ['BP', vitals?.bloodPressureSystolic ? `${vitals.bloodPressureSystolic}/${vitals.bloodPressureDiastolic || '—'}` : '—'],
                            ['Temp', vitals?.temperature ? `${vitals.temperature}°` : '—'],
                          ].map(([label, value]) => <Box key={label} sx={{ backgroundColor: '#F8FAFC', p: 1, borderRadius: '8px' }}><Typography variant="caption" sx={{ color: C.muted, display: 'block' }}>{label}</Typography><Typography variant="body2" sx={{ color: C.slate, fontWeight: 800 }}>{value}</Typography></Box>)}
                        </Box>
                        <Box component="form" onSubmit={(event) => handleSaveVitals(event, assignedPatient.patientId)}>
                          <Typography variant="caption" sx={{ color: C.slate, fontWeight: 800, display: 'block', mb: 1 }}>Quick manual entry</Typography>
                          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1 }}>
                            {([
                              ['heartRate', 'HR'], ['spo2', 'SpO2'], ['bloodPressureSystolic', 'Sys'], ['bloodPressureDiastolic', 'Dia'], ['temperature', 'Temp'],
                            ] as [keyof VitalsForm, string][]).map(([field, label]) => <TextField key={field} size="small" label={label} type="number" value={form[field]} onChange={(event) => updateForm(assignedPatient.patientId, field, event.target.value)} inputProps={{ min: 0 }} />)}
                          </Box>
                          <Button type="submit" fullWidth variant="contained" disabled={savingVitals === assignedPatient.patientId} sx={{ mt: 1.5, backgroundColor: C.teal, '&:hover': { backgroundColor: '#006974' }, borderRadius: '8px', fontWeight: 700 }}>{savingVitals === assignedPatient.patientId ? <CircularProgress size={18} color="inherit" /> : 'Record vitals'}</Button>
                        </Box>
                      </Paper>
                    );
                  })}
                </Box>
              )}
            </Paper>

            <Paper elevation={0} sx={{ p: { xs: 2.5, md: 3 }, border: `1px solid ${C.border}`, borderRadius: '14px' }}>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}><TaskAlt sx={{ color: C.amber }} /><Typography variant="h6" sx={{ color: C.slate, fontWeight: 800 }}>My Tasks</Typography><Typography variant="body2" sx={{ color: C.muted, ml: 'auto' }}>{tasks.length} approved</Typography></Stack>
              <Divider />
              {tasks.length === 0 ? <Typography sx={{ color: C.muted, py: 3 }}>No approved tasks are waiting for completion.</Typography> : tasks.map((task) => <Box key={task._id} sx={{ py: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}><Box><Typography sx={{ color: C.slate, fontWeight: 750 }}>{task.taskDescription}</Typography><Typography variant="body2" sx={{ color: C.muted }}>{getPatientName(task.patientId)}{task.dueAt ? ` · Due ${formatDate(task.dueAt)}` : ''}</Typography></Box><Button size="small" variant="contained" startIcon={<CheckCircle />} onClick={() => handleCompleteTask(task._id)} disabled={completingTask === task._id} sx={{ backgroundColor: C.green, '&:hover': { backgroundColor: '#047857' }, borderRadius: '8px', fontWeight: 700 }}>{completingTask === task._id ? <CircularProgress size={16} color="inherit" /> : 'Mark Complete'}</Button></Box>)}
            </Paper>
          </Stack>
        )}
      </Box>
    </Box>
  );
};

export default NurseDashboard;