import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  MenuItem,
  Paper,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import ArrowBack from '@mui/icons-material/ArrowBack';
import Person from '@mui/icons-material/Person';
import { LongitudinalTrends } from '../components/LongitudinalTrends';
import { useAuth } from '../contexts/AuthContext';
import { fetchPatientMedications, MedicationItem } from '../services/medicationService';
import { fetchPatientTestResults, TestResult } from '../services/testResultService';
import { fetchPatientAppointments, Appointment } from '../services/appointmentService';
import { fetchPatientProfile, PatientSearchResult } from '../services/doctorService';
import { fetchPatientVitals, VitalReading } from '../services/healthAnalyticsService';
import api from '../services/api';

const PatientDetailPage: React.FC = () => {
  const { patientId = '' } = useParams<{ patientId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tab, setTab] = useState(0);
  const [patient, setPatient] = useState<PatientSearchResult | null>(null);
  const [vitals, setVitals] = useState<VitalReading[]>([]);
  const [medications, setMedications] = useState<MedicationItem[]>([]);
  const [tests, setTests] = useState<TestResult[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [prescription, setPrescription] = useState({ name: '', dosage: '', frequency: 'Once Daily', startDate: '' });
  const [prescribing, setPrescribing] = useState(false);
  const [prescriptionMessage, setPrescriptionMessage] = useState('');
  const [notes, setNotes] = useState<any[]>([]);
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [testRequest, setTestRequest] = useState({ category: '', notes: '' });
  const [requestingTest, setRequestingTest] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [messageText, setMessageText] = useState('');
  const [recipientId, setRecipientId] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!patientId) return;
      setLoading(true);
      setError('');
      try {
        const [profile, patientVitals, patientMedications, patientTests, patientAppointments, notesResponse] = await Promise.all([
          fetchPatientProfile(patientId),
          fetchPatientVitals(patientId),
          fetchPatientMedications(patientId),
          fetchPatientTestResults(patientId),
          fetchPatientAppointments(patientId),
          api.get(`/api/clinical-notes/${encodeURIComponent(patientId)}`).catch(() => ({ data: { clinicalNotes: [] } })),
        ]);
        if (!active) return;
        setPatient(profile);
        setVitals(patientVitals);
        setMedications(patientMedications);
        setTests(patientTests);
        setAppointments(patientAppointments);
        setNotes(notesResponse.data?.clinicalNotes || []);
        const messagesResponse = await api.get(`/api/messages/${encodeURIComponent(patientId)}`).catch(() => ({ data: { messages: [] } }));
        setMessages(messagesResponse.data?.messages || []);
        if (!profile) setError('Patient profile not found.');
      } catch (err: any) {
        if (active) setError(err?.message || 'Unable to load patient details.');
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [patientId]);

  const createPrescription = async () => {
    if (!prescription.name.trim() || !prescription.dosage.trim() || !user?.id) return;
    setPrescribing(true);
    setPrescriptionMessage('');
    try {
      await api.post('/api/medications', {
        patientId,
        name: prescription.name.trim(),
        dosage: prescription.dosage.trim(),
        frequency: prescription.frequency,
        startDate: prescription.startDate || new Date().toISOString().slice(0, 10),
        prescribedBy: user.id,
        status: 'active',
      });
      const refreshed = await api.get(`/api/medications/${encodeURIComponent(patientId)}`);
      setMedications((refreshed.data?.medications || []).map((med: any) => ({
        id: med._id || med.id,
        patientId: med.patientId,
        name: med.name,
        dosage: med.dosage || '',
        frequency: med.frequency || 'Once Daily',
        timeSlots: [],
        instructions: med.instructions || '',
        status: med.status || 'active',
        startDate: med.startDate ? String(med.startDate).slice(0, 10) : '',
      })));
      setPrescription({ name: '', dosage: '', frequency: 'Once Daily', startDate: '' });
      setPrescriptionMessage('Prescription created successfully.');
    } catch (err: any) {
      setPrescriptionMessage(err?.response?.data?.message || err?.message || 'Unable to create prescription.');
    } finally {
      setPrescribing(false);
    }
  };

  const saveClinicalNote = async () => {
    if (!noteText.trim() || !user?.id) return;
    setSavingNote(true);
    try {
      const response = await api.post('/api/clinical-notes', { patientId, doctorId: user.id, content: noteText.trim() });
      setNotes((previous) => [response.data.clinicalNote, ...previous]);
      setNoteText('');
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Unable to save clinical note.');
    } finally {
      setSavingNote(false);
    }
  };

  const requestLabTest = async () => {
    if (!testRequest.category.trim() || !user?.id) return;
    setRequestingTest(true);
    try {
      await api.post('/api/test-results/request', {
        patientId,
        category: testRequest.category.trim(),
        notes: testRequest.notes.trim(),
        requestedBy: user.id,
      });
      const refreshed = await fetchPatientTestResults(patientId);
      setTests(refreshed);
      setTestRequest({ category: '', notes: '' });
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Unable to request test.');
    } finally {
      setRequestingTest(false);
    }
  };

  const sendPatientMessage = async () => {
    if (!messageText.trim() || !user?.id || !recipientId) return;
    setSendingMessage(true);
    try {
      const response = await api.post('/api/messages', { patientId, senderId: user.id, recipientId, content: messageText.trim() });
      setMessages((previous) => [...previous, response.data.message]);
      setMessageText('');
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Unable to send message.');
    } finally {
      setSendingMessage(false);
    }
  };

  if (loading) {
    return <Box display="flex" justifyContent="center" py={10}><CircularProgress /></Box>;
  }

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: '#F0F4F8', py: 3 }}>
      <Container maxWidth="lg">
        <Box display="flex" alignItems="center" gap={1} mb={2}>
          <Chip icon={<ArrowBack />} label="Back to Doctor Workspace" onClick={() => navigate('/dashboard/doctor')} clickable />
        </Box>
        {error && <Alert severity="warning" sx={{ mb: 2 }}>{error}</Alert>}
        <Paper elevation={0} sx={{ p: 3, mb: 2, border: '1px solid #E2E8F0', borderRadius: 2 }}>
          <Box display="flex" alignItems="center" gap={2}>
            <Person sx={{ fontSize: 42, color: '#1565C0' }} />
            <Box>
              <Typography variant="h5" fontWeight={800}>{patient?.name || 'Patient'}</Typography>
              <Typography variant="body2" color="text.secondary">
                {patient?.patientId || patientId} {patient?.email ? `· ${patient.email}` : ''}
              </Typography>
            </Box>
          </Box>
        </Paper>
        <Paper elevation={0} sx={{ border: '1px solid #E2E8F0', borderRadius: 2, overflow: 'hidden' }}>
          <Tabs value={tab} onChange={(_, value) => setTab(value)} variant="scrollable" scrollButtons="auto">
            <Tab label={`Vitals (${vitals.length})`} />
            <Tab label={`Medications (${medications.length})`} />
            <Tab label={`Test Results (${tests.length})`} />
            <Tab label={`Appointments (${appointments.length})`} />
            <Tab label={`Clinical Notes (${notes.length})`} />
            <Tab label={`Messages (${messages.length})`} />
          </Tabs>
          <Box p={3}>
            {tab === 0 && <LongitudinalTrends patientId={patientId} vitals={vitals} />}
            {tab === 1 && (
              <Box>
                <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                  <Typography variant="subtitle1" fontWeight={800} mb={1.5}>New Prescription</Typography>
                  <Box display="flex" gap={1.5} flexWrap="wrap">
                    <TextField size="small" label="Medication" value={prescription.name} onChange={(e) => setPrescription({ ...prescription, name: e.target.value })} />
                    <TextField size="small" label="Dosage" value={prescription.dosage} onChange={(e) => setPrescription({ ...prescription, dosage: e.target.value })} />
                    <TextField select size="small" label="Frequency" value={prescription.frequency} onChange={(e) => setPrescription({ ...prescription, frequency: e.target.value })} sx={{ minWidth: 160 }}>
                      {['Once Daily', 'Twice Daily', 'Three Times Daily', 'As Needed', 'Weekly'].map((frequency) => <MenuItem key={frequency} value={frequency}>{frequency}</MenuItem>)}
                    </TextField>
                    <TextField size="small" type="date" label="Start date" InputLabelProps={{ shrink: true }} value={prescription.startDate} onChange={(e) => setPrescription({ ...prescription, startDate: e.target.value })} />
                    <Button variant="contained" onClick={createPrescription} disabled={prescribing || !prescription.name.trim() || !prescription.dosage.trim()}>{prescribing ? 'Saving...' : 'Prescribe'}</Button>
                  </Box>
                  {prescriptionMessage && <Typography variant="body2" color={prescriptionMessage.includes('successfully') ? 'success.main' : 'error'} mt={1}>{prescriptionMessage}</Typography>}
                </Paper>
                {medications.length ? medications.map((med) => (
                  <Paper key={med.id} variant="outlined" sx={{ p: 2, mb: 1 }}>
                    <Typography fontWeight={700}>{med.name}</Typography>
                    <Typography variant="body2" color="text.secondary">{med.dosage} · {med.frequency} · {med.status}</Typography>
                    <Typography variant="caption">Started {med.startDate}</Typography>
                  </Paper>
                )) : <Typography color="text.secondary">No medications recorded.</Typography>}
              </Box>
            )}
            {tab === 2 && (
              <Box>
                <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                  <Typography variant="subtitle1" fontWeight={800} mb={1}>Request Test</Typography>
                  <Box display="flex" gap={1.5} flexWrap="wrap">
                    <TextField size="small" label="Test category" value={testRequest.category} onChange={(e) => setTestRequest({ ...testRequest, category: e.target.value })} />
                    <TextField size="small" label="Notes" value={testRequest.notes} onChange={(e) => setTestRequest({ ...testRequest, notes: e.target.value })} sx={{ minWidth: 260 }} />
                    <Button variant="contained" onClick={requestLabTest} disabled={requestingTest || !testRequest.category.trim()}>{requestingTest ? 'Requesting...' : 'Request Test'}</Button>
                  </Box>
                </Paper>
                {tests.length ? tests.map((test) => (
                  <Paper key={test._id || test.id} variant="outlined" sx={{ p: 2, mb: 1 }}>
                    <Box display="flex" justifyContent="space-between" gap={1}>
                      <Typography fontWeight={700}>{test.testName || test.category || 'Diagnostic test'}</Typography>
                      <Chip size="small" color={test.status === 'requested' ? 'warning' : 'success'} label={test.status === 'requested' ? 'Requested' : 'Completed'} />
                    </Box>
                    <Typography variant="body2" color="text.secondary">{test.notes || 'No notes recorded.'}</Typography>
                    <Typography variant="caption">{test.uploadDate ? new Date(test.uploadDate).toLocaleDateString() : 'Date unavailable'}</Typography>
                  </Paper>
                )) : <Typography color="text.secondary">No test results recorded.</Typography>}
              </Box>
            )}
            {tab === 3 && (
              appointments.length ? appointments.map((appointment) => (
                <Paper key={appointment.id} variant="outlined" sx={{ p: 2, mb: 1 }}>
                  <Typography fontWeight={700}>{appointment.date} · {appointment.timeSlot}</Typography>
                  <Typography variant="body2" color="text.secondary">{appointment.reason}</Typography>
                  <Chip size="small" label={appointment.status} sx={{ mt: 1 }} />
                </Paper>
              )) : <Typography color="text.secondary">No appointments recorded.</Typography>
            )}
            {tab === 4 && (
              <Box>
                <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                  <Typography variant="subtitle1" fontWeight={800} mb={1}>Add Clinical Note</Typography>
                  <TextField fullWidth multiline minRows={3} label="Clinical note" value={noteText} onChange={(e) => setNoteText(e.target.value)} />
                  <Button sx={{ mt: 1.5 }} variant="contained" onClick={saveClinicalNote} disabled={savingNote || !noteText.trim()}>{savingNote ? 'Saving...' : 'Save Note'}</Button>
                </Paper>
                {notes.length ? notes.map((note) => (
                  <Paper key={note._id || note.id} variant="outlined" sx={{ p: 2, mb: 1 }}>
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{note.content}</Typography>
                    <Typography variant="caption" color="text.secondary" display="block" mt={1}>
                      {note.doctorId?.name || 'Doctor'} · {note.createdAt ? new Date(note.createdAt).toLocaleString() : 'Date unavailable'}
                    </Typography>
                  </Paper>
                )) : <Typography color="text.secondary">No clinical notes recorded.</Typography>}
              </Box>
            )}
            {tab === 5 && (
              <Box>
                <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                  <Typography variant="subtitle1" fontWeight={800} mb={1}>Patient Messaging</Typography>
                  <Box display="flex" gap={1.5} flexWrap="wrap">
                    <TextField size="small" label="Recipient user ID" value={recipientId} onChange={(e) => setRecipientId(e.target.value)} helperText="Use the patient or caretaker Firebase/Mongo user ID." />
                    <TextField fullWidth multiline minRows={2} label="Message" value={messageText} onChange={(e) => setMessageText(e.target.value)} />
                    <Button variant="contained" onClick={sendPatientMessage} disabled={sendingMessage || !recipientId || !messageText.trim()}>{sendingMessage ? 'Sending...' : 'Send Message'}</Button>
                  </Box>
                </Paper>
                {messages.length ? messages.map((message) => (
                  <Paper key={message._id || message.id} variant="outlined" sx={{ p: 2, mb: 1 }}>
                    <Typography variant="body2">{message.content}</Typography>
                    <Typography variant="caption" color="text.secondary">{message.senderId} · {message.createdAt ? new Date(message.createdAt).toLocaleString() : 'Date unavailable'}</Typography>
                  </Paper>
                )) : <Typography color="text.secondary">No messages in this thread.</Typography>}
              </Box>
            )}
          </Box>
        </Paper>
        <Typography variant="caption" color="text.secondary" display="block" mt={2}>
          Signed in as Dr. {user?.name || 'Doctor'}
        </Typography>
      </Container>
    </Box>
  );
};

export default PatientDetailPage;
