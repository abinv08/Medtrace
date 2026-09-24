import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  Assignment,
  CheckCircle,
  Cancel,
  Logout,
  Refresh,
  Schedule,
  Send,
  SupervisorAccount,
  MonitorHeart,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { MedTraceLogo } from '../../components/Logo';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';

const colors = {
  navy: '#1E293B',
  blue: '#1565C0',
  teal: '#00838F',
  green: '#059669',
  amber: '#D97706',
  red: '#DC2626',
  muted: '#64748B',
  border: '#E2E8F0',
  background: '#F0F4F8',
};

type Patient = {
  _id?: string;
  id?: string;
  name?: string;
  userId?: { name?: string; email?: string } | string;
  assignments?: { nurseId: string }[];
  latestVitals?: { heartRate?: number; spo2?: number; temperature?: number; bloodPressureSystolic?: number; bloodPressureDiastolic?: number; recordedAt?: string } | null;
};

type Nurse = {
  _id?: string;
  id?: string;
  name?: string;
  email?: string;
  department?: string;
};

type NurseWithPatients = Nurse & { patients: Patient[] };

type NurseTask = {
  _id: string;
  taskDescription: string;
  status: 'pending_approval' | 'approved' | 'rejected' | 'completed';
  dueAt?: string;
  assignedNurse?: Nurse;
  patientId?: Patient;
};

const idOf = (value: { _id?: string; id?: string } | undefined) => value?._id || value?.id || '';

const patientName = (patient?: Patient) => {
  if (!patient) return 'Patient';
  if (patient.name) return patient.name;
  if (patient.userId && typeof patient.userId === 'object') return patient.userId.name || patient.userId.email || 'Patient';
  return 'Patient';
};

const statusLabel = (status: NurseTask['status']) => status.replace('_', ' ');

const statusColor = (status: NurseTask['status']) => {
  if (status === 'approved') return colors.blue;
  if (status === 'completed') return colors.green;
  if (status === 'rejected') return colors.red;
  return colors.amber;
};

export const HeadNurseDashboard: React.FC = () => {
  const { user, token, getToken, logout } = useAuth();
  const navigate = useNavigate();
  const [nurses, setNurses] = useState<NurseWithPatients[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [tasks, setTasks] = useState<NurseTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [patientId, setPatientId] = useState('');
  const [assignedNurse, setAssignedNurse] = useState('');
  const [taskNurses, setTaskNurses] = useState<string[]>([]);
  const [selectedNurses, setSelectedNurses] = useState<string[]>([]);
  const [selectedPatient, setSelectedPatient] = useState('');
  const [vitals, setVitals] = useState<Record<string, Record<string, string>>>({});
  const [taskDescription, setTaskDescription] = useState('');
  const [dueAt, setDueAt] = useState('');

  const authHeaders = useCallback(async () => {
    let activeToken = token;
    if (!activeToken) activeToken = await getToken();
    return activeToken ? { Authorization: `Bearer ${activeToken}` } : {};
  }, [getToken, token]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const headers = await authHeaders();
      const [rosterResponse, tasksResponse] = await Promise.all([
        api.get('/api/nurse-assignments/head-nurse/roster', { headers }),
        api.get('/api/nurse-tasks', { params: { status: 'pending_approval' }, headers }),
      ]);
      const rosterPatients: Patient[] = rosterResponse.data?.patients || [];
      const nurseUsers: Nurse[] = rosterResponse.data?.nurses || [];
      const nurseResults = nurseUsers.map((nurse) => ({
        ...nurse,
        patients: rosterPatients.filter((patient) => (patient.assignments || []).some((assignment) => assignment.nurseId === idOf(nurse))),
      }));
      setNurses(nurseResults);
      setPatients(rosterPatients);
      setTasks(tasksResponse.data?.tasks || []);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Unable to load head nurse data');
    } finally {
      setLoading(false);
    }
  }, [authHeaders, user?.id]);

  const handleAssignGroup = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedPatient || selectedNurses.length === 0) return;
    setSubmitting(true);
    setError('');
    try {
      const headers = await authHeaders();
      await Promise.all(selectedNurses.map((nurseId) => api.post('/api/nurse-assignments', { patientId: selectedPatient, nurseId }, { headers })));
      setFeedback(`Patient assigned to ${selectedNurses.length} nurse${selectedNurses.length === 1 ? '' : 's'}.`);
      setSelectedPatient('');
      setSelectedNurses([]);
      await loadData();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Unable to assign patient group');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSavePatientVitals = async (event: React.FormEvent, patientId: string) => {
    event.preventDefault();
    const form = vitals[patientId] || {};
    const payload: Record<string, unknown> = { patientId, source: 'manual' };
    ['heartRate', 'spo2', 'bloodPressureSystolic', 'bloodPressureDiastolic', 'temperature'].forEach((field) => {
      if (form[field]?.trim()) payload[field] = Number(form[field]);
    });
    if (Object.keys(payload).length === 2) return setError('Enter at least one vital sign before saving.');
    try {
      const headers = await authHeaders();
      await api.post('/api/vitals', payload, { headers });
      setFeedback('Patient vitals recorded successfully.');
      setVitals((current) => ({ ...current, [patientId]: {} }));
      await loadData();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Unable to record vitals');
    }
  };

  useEffect(() => {
    if (user?.id) loadData();
  }, [loadData, user?.id]);

  const patientOptions = useMemo(() => {
    return patients.map((patient) => ({ patient, nurseId: '' }));
  }, [patients]);

  const handleCreateTask = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!patientId || taskNurses.length === 0 || !taskDescription.trim()) return;
    setSubmitting(true);
    setError('');
    setFeedback('');
    try {
      const headers = await authHeaders();
      await Promise.all(taskNurses.map((nurseId) => api.post('/api/nurse-tasks', {
        patientId,
        assignedNurse: nurseId,
        taskDescription: taskDescription.trim(),
        ...(dueAt ? { dueAt: new Date(dueAt).toISOString() } : {}),
      }, { headers })));
      setPatientId('');
      setAssignedNurse('');
      setTaskNurses([]);
      setTaskDescription('');
      setDueAt('');
      setFeedback('Task created and sent for approval.');
      await loadData();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Unable to create task');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTaskApproval = async (taskId: string, action: 'approve' | 'reject') => {
    const approvalNotes = action === 'reject' ? window.prompt('Reason for rejecting this task:')?.trim() : '';
    if (action === 'reject' && !approvalNotes) return;
    try {
      const headers = await authHeaders();
      await api.put(`/api/nurse-tasks/${taskId}/${action}`, action === 'reject' ? { approvalNotes } : {}, { headers });
      setTasks((current) => current.filter((task) => task._id !== taskId));
      setFeedback(`Task ${action === 'approve' ? 'approved' : 'rejected'} successfully.`);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || `Unable to ${action} task`);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: colors.background }}>
      <Box sx={{ backgroundColor: '#fff', borderBottom: `1px solid ${colors.border}`, px: { xs: 2, md: 5 }, py: 1.5 }}>
        <Box sx={{ maxWidth: 1440, mx: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <MedTraceLogo variant="full" size="small" />
          <Stack direction="row" alignItems="center" spacing={2}>
            <Box sx={{ display: { xs: 'none', sm: 'block' }, textAlign: 'right' }}>
              <Typography sx={{ color: colors.navy, fontWeight: 800 }}>{user?.name || 'Head Nurse'}</Typography>
              <Typography variant="caption" sx={{ color: colors.muted }}>Head Nurse workspace</Typography>
            </Box>
            <Button aria-label="Sign out" onClick={() => { logout(); navigate('/login'); }} startIcon={<Logout />} sx={{ color: colors.muted }}>
              Sign out
            </Button>
          </Stack>
        </Box>
      </Box>

      <Box sx={{ maxWidth: 1440, mx: 'auto', px: { xs: 2, md: 5 }, py: { xs: 3, md: 5 } }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, gap: 2, mb: 4, flexWrap: 'wrap' }}>
          <Box>
            <Typography variant="h4" sx={{ color: colors.navy, fontWeight: 850, letterSpacing: 0 }}>Nursing operations</Typography>
            <Typography sx={{ color: colors.muted, mt: 0.5 }}>Coordinate assignments and keep task approvals moving.</Typography>
          </Box>
          <Button variant="outlined" startIcon={<Refresh />} onClick={loadData} sx={{ borderColor: colors.border, color: colors.navy, borderRadius: '10px' }}>Refresh</Button>
        </Box>

        {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
        {feedback && <Alert severity="success" sx={{ mb: 3 }}>{feedback}</Alert>}

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 12 }}><CircularProgress sx={{ color: colors.blue }} /></Box>
        ) : (
          <Stack spacing={3}>
            <Paper component="form" onSubmit={handleAssignGroup} elevation={0} sx={{ p: { xs: 2.5, md: 3 }, border: `1px solid ${colors.border}`, borderRadius: '14px' }}>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                <SupervisorAccount sx={{ color: colors.teal }} />
                <Typography variant="h6" sx={{ color: colors.navy, fontWeight: 800 }}>Assign a nurse group</Typography>
              </Stack>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr auto' }, gap: 2, alignItems: 'center' }}>
                <FormControl fullWidth size="small" required>
                  <InputLabel>Patient</InputLabel>
                  <Select value={selectedPatient} label="Patient" onChange={(event) => setSelectedPatient(event.target.value)}>
                    {patients.map((patient) => <MenuItem key={idOf(patient)} value={idOf(patient)}>{patientName(patient)}</MenuItem>)}
                  </Select>
                </FormControl>
                <FormControl fullWidth size="small" required>
                  <InputLabel>Nurses in group</InputLabel>
                  <Select multiple value={selectedNurses} label="Nurses in group" onChange={(event) => setSelectedNurses(typeof event.target.value === 'string' ? event.target.value.split(',') : event.target.value)} renderValue={(selected) => `${selected.length} nurse${selected.length === 1 ? '' : 's'} selected`}>
                    {nurses.map((nurse) => <MenuItem key={idOf(nurse)} value={idOf(nurse)}>{nurse.name || nurse.email || 'Nurse'}</MenuItem>)}
                  </Select>
                </FormControl>
                <Button type="submit" variant="contained" disabled={submitting || !selectedPatient || selectedNurses.length === 0} sx={{ backgroundColor: colors.teal, borderRadius: '10px', py: 1.2 }}>Assign group</Button>
              </Box>
            </Paper>

            <Paper elevation={0} sx={{ p: { xs: 2.5, md: 3 }, border: `1px solid ${colors.border}`, borderRadius: '14px' }}>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                <MonitorHeart sx={{ color: colors.red }} />
                <Typography variant="h6" sx={{ color: colors.navy, fontWeight: 800 }}>Patient live data</Typography>
                <Chip size="small" label={`${patients.length} patients`} sx={{ ml: 'auto', color: colors.muted, backgroundColor: '#F1F5F9', fontWeight: 700 }} />
              </Stack>
              <Divider sx={{ mb: 2 }} />
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: 'repeat(2, 1fr)' }, gap: 2 }}>
                {patients.map((patient) => {
                  const latest = patient.latestVitals;
                  const form = vitals[idOf(patient)] || {};
                  return <Paper key={idOf(patient)} variant="outlined" sx={{ p: 2, borderColor: colors.border, borderRadius: '10px' }}>
                    <Typography sx={{ color: colors.navy, fontWeight: 800 }}>{patientName(patient)}</Typography>
                    <Typography variant="caption" sx={{ color: colors.muted }}>Latest: {latest?.recordedAt ? new Date(latest.recordedAt).toLocaleString() : 'No reading yet'}</Typography>
                    <Typography variant="body2" sx={{ color: colors.muted, my: 1 }}>HR {latest?.heartRate ?? '--'} · SpO2 {latest?.spo2 ?? '--'}% · BP {latest?.bloodPressureSystolic ?? '--'}/{latest?.bloodPressureDiastolic ?? '--'} · Temp {latest?.temperature ?? '--'}</Typography>
                    <Box component="form" onSubmit={(event) => handleSavePatientVitals(event, idOf(patient))} sx={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1 }}>
                      {(['heartRate', 'spo2', 'bloodPressureSystolic', 'bloodPressureDiastolic', 'temperature']).map((field) => <TextField key={field} size="small" label={field === 'heartRate' ? 'HR' : field === 'spo2' ? 'SpO2' : field === 'bloodPressureSystolic' ? 'Sys' : field === 'bloodPressureDiastolic' ? 'Dia' : 'Temp'} type="number" value={form[field] || ''} onChange={(event) => setVitals((current) => ({ ...current, [idOf(patient)]: { ...form, [field]: event.target.value } }))} />)}
                      <Button type="submit" variant="outlined" sx={{ gridColumn: '1 / -1', borderRadius: '8px' }}>Record vitals</Button>
                    </Box>
                  </Paper>;
                })}
              </Box>
            </Paper>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1.1fr 0.9fr' }, gap: 3 }}>
              <Paper elevation={0} sx={{ p: { xs: 2.5, md: 3 }, border: `1px solid ${colors.border}`, borderRadius: '14px' }}>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                  <SupervisorAccount sx={{ color: colors.teal }} />
                  <Typography variant="h6" sx={{ color: colors.navy, fontWeight: 800 }}>Nurse coverage</Typography>
                  <Chip size="small" label={`${nurses.length} nurses`} sx={{ ml: 'auto', color: colors.teal, backgroundColor: '#E6FFFB', fontWeight: 700 }} />
                </Stack>
                <Divider sx={{ mb: 1 }} />
                {nurses.length === 0 ? <Typography sx={{ color: colors.muted, py: 3 }}>No nurses were returned.</Typography> : nurses.map((nurse) => (
                  <Box key={idOf(nurse)} sx={{ py: 2, display: 'flex', gap: 2, justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Box>
                      <Typography sx={{ color: colors.navy, fontWeight: 800 }}>{nurse.name || 'Nurse'}</Typography>
                      <Typography variant="body2" sx={{ color: colors.muted }}>{nurse.email || nurse.department || 'Clinical team'}</Typography>
                    </Box>
                    <Box sx={{ textAlign: 'right' }}>
                      <Typography sx={{ color: colors.blue, fontWeight: 800 }}>{nurse.patients.length}</Typography>
                      <Typography variant="caption" sx={{ color: colors.muted }}>assigned patients</Typography>
                      {nurse.patients.length > 0 && <Typography variant="caption" display="block" sx={{ color: colors.muted, mt: 0.5 }}>{nurse.patients.map(patientName).join(', ')}</Typography>}
                    </Box>
                  </Box>
                ))}
              </Paper>

              <Paper component="form" onSubmit={handleCreateTask} elevation={0} sx={{ p: { xs: 2.5, md: 3 }, border: `1px solid ${colors.border}`, borderRadius: '14px' }}>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                  <Assignment sx={{ color: colors.blue }} />
                  <Typography variant="h6" sx={{ color: colors.navy, fontWeight: 800 }}>Create task</Typography>
                </Stack>
                <Stack spacing={2}>
                  <FormControl fullWidth size="small" required>
                    <InputLabel>Assigned nurses</InputLabel>
                    <Select multiple value={taskNurses} label="Assigned nurses" onChange={(event) => { const selected = typeof event.target.value === 'string' ? event.target.value.split(',') : event.target.value; setTaskNurses(selected); setAssignedNurse(selected[0] || ''); setPatientId(''); }} renderValue={(selected) => `${selected.length} nurse${selected.length === 1 ? '' : 's'} selected`}>
                      {nurses.map((nurse) => <MenuItem key={idOf(nurse)} value={idOf(nurse)}>{nurse.name || nurse.email || 'Nurse'}</MenuItem>)}
                    </Select>
                  </FormControl>
                  <FormControl fullWidth size="small" required>
                    <InputLabel>Patient</InputLabel>
                    <Select value={patientId} label="Patient" onChange={(event) => setPatientId(event.target.value)}>
                      {patientOptions.filter(({ patient }) => (patient.assignments || []).some((assignment) => assignment.nurseId === assignedNurse)).map(({ patient }) => <MenuItem key={idOf(patient)} value={idOf(patient)}>{patientName(patient)}</MenuItem>)}
                    </Select>
                  </FormControl>
                  <TextField label="Task description" value={taskDescription} onChange={(event) => setTaskDescription(event.target.value)} multiline minRows={3} required fullWidth size="small" />
                  <TextField label="Due date and time (optional)" type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} fullWidth size="small" InputLabelProps={{ shrink: true }} />
                  <Button type="submit" variant="contained" disabled={submitting || !patientId || taskNurses.length === 0 || !taskDescription.trim()} startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : <Send />} sx={{ backgroundColor: colors.blue, borderRadius: '10px', py: 1.2 }}>Send for approval</Button>
                </Stack>
              </Paper>
            </Box>

            <Paper elevation={0} sx={{ p: { xs: 2.5, md: 3 }, border: `1px solid ${colors.border}`, borderRadius: '14px' }}>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                <Schedule sx={{ color: colors.amber }} />
                <Typography variant="h6" sx={{ color: colors.navy, fontWeight: 800 }}>Pending task approvals</Typography>
                <Chip size="small" label={`${tasks.length} pending`} sx={{ ml: 'auto', color: colors.muted, backgroundColor: '#F1F5F9', fontWeight: 700 }} />
              </Stack>
              <Divider />
              {tasks.length === 0 ? <Typography sx={{ color: colors.muted, py: 4 }}>No tasks are awaiting approval.</Typography> : (
                <Stack divider={<Divider flexItem />}>
                  {tasks.map((task) => (
                    <Box key={task._id} sx={{ py: 2, display: 'flex', alignItems: { xs: 'flex-start', sm: 'center' }, justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography sx={{ color: colors.navy, fontWeight: 750 }}>{task.taskDescription}</Typography>
                        <Typography variant="body2" sx={{ color: colors.muted, mt: 0.5 }}>{patientName(task.patientId)} · {task.assignedNurse?.name || 'Assigned nurse'}</Typography>
                        {task.dueAt && <Typography variant="caption" sx={{ color: colors.muted }}>Due {new Date(task.dueAt).toLocaleString()}</Typography>}
                      </Box>
                      <Stack direction="row" spacing={1}>
                        <Button size="small" variant="contained" startIcon={<CheckCircle />} onClick={() => handleTaskApproval(task._id, 'approve')} sx={{ backgroundColor: colors.green, borderRadius: '8px' }}>Approve</Button>
                        <Button size="small" variant="outlined" startIcon={<Cancel />} onClick={() => handleTaskApproval(task._id, 'reject')} sx={{ borderColor: colors.red, color: colors.red, borderRadius: '8px' }}>Reject</Button>
                      </Stack>
                    </Box>
                  ))}
                </Stack>
              )}
            </Paper>
          </Stack>
        )}
      </Box>
    </Box>
  );
};

export default HeadNurseDashboard;