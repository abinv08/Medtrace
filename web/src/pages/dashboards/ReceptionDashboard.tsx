import React, { useEffect, useState } from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress, Container, Divider, Grid,
  InputAdornment, MenuItem, Paper, Snackbar, Stack, TextField, Typography,
} from '@mui/material';
import {
  Add, CalendarMonth, CheckCircle, CreditCard, LocalHospital, Payments,
  PersonAdd, Phone, ReceiptLong, Search,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { MedTraceLogo } from '../../components/Logo';
import api from '../../services/api';

interface IntakePatient {
  id?: string;
  _id?: string;
  name: string;
  phone: string;
  dateOfBirth?: string;
  gender?: string;
  bloodGroup?: string;
  visitReason?: string;
  createdAt?: string;
  status?: 'active' | 'inactive';
  userId?: { name?: string; phone?: string; email?: string } | string;
}

interface PaymentRecord {
  id?: string;
  patientName: string;
  amount: number;
  method: string;
  status: string;
  createdAt?: string;
}

const initialForm = {
  name: '', phone: '', dateOfBirth: '', gender: '', bloodGroup: '', visitReason: '',
  amount: '', paymentMethod: 'Cash',
};

const formatTime = (value?: string) => value ? new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now';

export const ReceptionDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const [form, setForm] = useState(initialForm);
  const [patients, setPatients] = useState<IntakePatient[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [feedback, setFeedback] = useState<{ message: string; severity: 'success' | 'error' } | null>(null);

  const getPatientId = (patient: IntakePatient) => patient.id || patient._id || (typeof patient.userId === 'string' ? patient.userId : undefined);
  const getPatientPhone = (patient: IntakePatient) => patient.phone || (typeof patient.userId === 'object' ? patient.userId.phone || '' : '');
  const getPatientName = (patient: IntakePatient) => patient.name || (typeof patient.userId === 'object' ? patient.userId.name || 'Patient' : 'Patient');

  const loadActivity = async () => {
    setLoading(true);
    const [patientResult, paymentResult] = await Promise.allSettled([
      api.get('/api/patients'),
      api.get('/api/payments'),
    ]);

    if (patientResult.status === 'fulfilled') {
      setPatients(patientResult.value.data?.patients || []);
    }
    if (paymentResult.status === 'fulfilled') {
      setPayments(paymentResult.value.data?.payments || []);
    }

    if (patientResult.status === 'rejected' && paymentResult.status === 'rejected') {
      setFeedback({ message: 'Unable to load patients or payments. Please check your connection and sign in again.', severity: 'error' });
    } else if (patientResult.status === 'rejected') {
      setFeedback({ message: 'Unable to load registered patients. Please check your connection and sign in again.', severity: 'error' });
    } else if (paymentResult.status === 'rejected') {
      setFeedback({ message: 'Patients loaded, but payment history is unavailable.', severity: 'error' });
    }
    setLoading(false);
  };

  useEffect(() => { loadActivity(); }, []);

  const updatePatientStatus = async (patient: IntakePatient, status: 'active' | 'inactive') => {
    const patientId = getPatientId(patient);
    if (!patientId) return;
    try {
      await api.put(`/api/patients/${patientId}/status`, { status });
      setPatients((current) => current.map((item) => getPatientId(item) === patientId ? { ...item, status } : item));
      setFeedback({ message: `${getPatientName(patient)} is now ${status}.`, severity: 'success' });
    } catch (error: any) {
      setFeedback({ message: error?.message || 'Unable to update patient status.', severity: 'error' });
    }
  };

  const updateField = (field: keyof typeof initialForm) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name.trim() || !form.phone.trim() || !form.amount) {
      setFeedback({ message: 'Name, phone number, and payment amount are required.', severity: 'error' });
      return;
    }

    setSubmitting(true);
    try {
      const createdAt = new Date().toISOString();
      const normalizedPhone = form.phone.trim().replace(/\s+/g, '');
      const existingPatient = patients.find((patient) => getPatientPhone(patient).replace(/\s+/g, '') === normalizedPhone);
      let patient = existingPatient;

      if (existingPatient) {
        const patientId = getPatientId(existingPatient);
        if (!patientId) throw new Error('The existing patient record has no valid ID.');
        await api.put(`/api/patients/${patientId}/status`, { status: 'active' });
        patient = { ...existingPatient, status: 'active' };
      } else {
        const patientResponse = await api.post('/api/patients', {
          name: form.name.trim(),
          phone: form.phone.trim(),
          dateOfBirth: form.dateOfBirth,
          gender: form.gender,
          bloodGroup: form.bloodGroup,
          visitReason: form.visitReason,
          status: 'active',
          createdBy: user?.id || 'reception',
          createdAt,
        });
        patient = patientResponse.data?.patients || patientResponse.data?.patient || {};
      }

      await api.post('/api/payments', {
        patientId: patient?.id || patient?._id,
        patientName: form.name.trim(),
        amount: Number(form.amount),
        method: form.paymentMethod,
        status: 'paid',
        createdBy: user?.id || 'reception',
        createdAt,
      });
      setForm(initialForm);
      setFeedback({ message: existingPatient ? `Welcome back, ${getPatientName(existingPatient)} is active and payment was recorded.` : `Patient ${form.name.trim()} was registered and payment recorded.`, severity: 'success' });
      await loadActivity();
    } catch (error: any) {
      setFeedback({ message: error?.message || 'Unable to register patient.', severity: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const filteredPatients = patients.filter((patient) => `${getPatientName(patient)} ${getPatientPhone(patient)}`.toLowerCase().includes(search.toLowerCase()));
  const totalCollected = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#F0F4F8' }}>
      <Box sx={{ bgcolor: '#fff', borderBottom: '1px solid #CFD8DC' }}>
        <Container maxWidth="xl" sx={{ py: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <MedTraceLogo size="small" />
          <Stack direction="row" alignItems="center" spacing={2}>
            <Box sx={{ textAlign: 'right', display: { xs: 'none', sm: 'block' } }}>
              <Typography fontWeight={700} color="#1A2B4A">Reception desk</Typography>
              <Typography variant="caption" color="text.secondary">{user?.name || 'Front desk'}</Typography>
            </Box>
            <Button size="small" variant="outlined" onClick={logout}>Sign out</Button>
          </Stack>
        </Container>
      </Box>

      <Container maxWidth="xl" sx={{ py: { xs: 3, md: 5 } }}>
        <Box sx={{ mb: 4 }}>
          <Typography variant="overline" sx={{ color: '#00838F', fontWeight: 800, letterSpacing: '0.12em' }}>Front desk operations</Typography>
          <Typography variant="h3" sx={{ color: '#1A2B4A', mt: 0.5, fontWeight: 700 }}>Reception</Typography>
          <Typography color="text.secondary" sx={{ mt: 1 }}>Register a patient, collect the visit fee, and keep the queue moving.</Typography>
        </Box>

        <Grid container spacing={2.5} sx={{ mb: 3.5 }}>
          {[
            { label: 'Patients registered', value: patients.length, icon: <PersonAdd />, color: '#1565C0' },
            { label: 'Payments today', value: payments.length, icon: <ReceiptLong />, color: '#00838F' },
            { label: 'Collected today', value: `₹${totalCollected.toLocaleString('en-IN')}`, icon: <Payments />, color: '#059669' },
          ].map((stat) => (
            <Grid item xs={12} sm={4} key={stat.label}>
              <Paper sx={{ p: 2.25, border: '1px solid #CFD8DC', boxShadow: 'none', display: 'flex', alignItems: 'center', gap: 1.75 }}>
                <Box sx={{ width: 44, height: 44, borderRadius: 1.5, display: 'grid', placeItems: 'center', bgcolor: `${stat.color}12`, color: stat.color }}>{stat.icon}</Box>
                <Box><Typography variant="caption" color="text.secondary">{stat.label}</Typography><Typography variant="h5" fontWeight={700} color="#1A2B4A">{stat.value}</Typography></Box>
              </Paper>
            </Grid>
          ))}
        </Grid>

        <Grid container spacing={3} alignItems="flex-start">
          <Grid item xs={12} lg={7}>
            <Paper component="form" onSubmit={handleSubmit} sx={{ p: { xs: 2.5, md: 3.5 }, border: '1px solid #CFD8DC', boxShadow: '0px 4px 18px rgba(21, 101, 192, 0.06)' }}>
              <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 3 }}>
                <Box sx={{ color: '#1565C0', display: 'flex' }}><PersonAdd /></Box>
                <Box><Typography variant="h6" fontWeight={700}>Add new patient</Typography><Typography variant="body2" color="text.secondary">Create an intake record and payment receipt together.</Typography></Box>
              </Stack>
              <Divider sx={{ mb: 3 }} />
              <Typography variant="subtitle2" sx={{ mb: 1.5, color: '#546E7A' }}>PATIENT DETAILS</Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}><TextField fullWidth required label="Full name" value={form.name} onChange={updateField('name')} /></Grid>
                <Grid item xs={12} sm={6}><TextField fullWidth required label="Phone number" value={form.phone} onChange={updateField('phone')} InputProps={{ startAdornment: <InputAdornment position="start"><Phone fontSize="small" /></InputAdornment> }} /></Grid>
                <Grid item xs={12} sm={4}><TextField fullWidth type="date" label="Date of birth" value={form.dateOfBirth} onChange={updateField('dateOfBirth')} InputLabelProps={{ shrink: true }} InputProps={{ startAdornment: <InputAdornment position="start"><CalendarMonth fontSize="small" /></InputAdornment> }} /></Grid>
                <Grid item xs={12} sm={4}><TextField fullWidth select label="Gender" value={form.gender} onChange={updateField('gender')}><MenuItem value="Female">Female</MenuItem><MenuItem value="Male">Male</MenuItem><MenuItem value="Other">Other</MenuItem><MenuItem value="Prefer not to say">Prefer not to say</MenuItem></TextField></Grid>
                <Grid item xs={12} sm={4}><TextField fullWidth select label="Blood group" value={form.bloodGroup} onChange={updateField('bloodGroup')}><MenuItem value="A+">A+</MenuItem><MenuItem value="A-">A-</MenuItem><MenuItem value="B+">B+</MenuItem><MenuItem value="B-">B-</MenuItem><MenuItem value="AB+">AB+</MenuItem><MenuItem value="AB-">AB-</MenuItem><MenuItem value="O+">O+</MenuItem><MenuItem value="O-">O-</MenuItem></TextField></Grid>
                <Grid item xs={12}><TextField fullWidth label="Visit reason" placeholder="e.g. General consultation" value={form.visitReason} onChange={updateField('visitReason')} /></Grid>
              </Grid>
              <Typography variant="subtitle2" sx={{ mt: 3, mb: 1.5, color: '#546E7A' }}>PAYMENT</Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}><TextField fullWidth required type="number" label="Amount" value={form.amount} onChange={updateField('amount')} InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment>, inputProps: { min: 0 } }} /></Grid>
                <Grid item xs={12} sm={6}><TextField fullWidth select label="Payment method" value={form.paymentMethod} onChange={updateField('paymentMethod')} InputProps={{ startAdornment: <InputAdornment position="start"><CreditCard fontSize="small" /></InputAdornment> }}><MenuItem value="Cash">Cash</MenuItem><MenuItem value="Card">Card</MenuItem><MenuItem value="UPI">UPI</MenuItem><MenuItem value="Insurance">Insurance</MenuItem></TextField></Grid>
              </Grid>
              <Button type="submit" fullWidth variant="contained" size="large" startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : <Add />} disabled={submitting} sx={{ mt: 3 }}>Register patient and record payment</Button>
            </Paper>
          </Grid>

          <Grid item xs={12} lg={5}>
            <Paper sx={{ p: { xs: 2.5, md: 3 }, border: '1px solid #CFD8DC', boxShadow: 'none' }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                <Box><Typography variant="h6" fontWeight={700}>Registered patients</Typography><Typography variant="body2" color="text.secondary">Search every registered patient by name or phone</Typography></Box>
                <LocalHospital sx={{ color: '#00838F' }} />
              </Stack>
              <TextField fullWidth size="small" placeholder="Search every patient by name or phone" value={search} onChange={(event) => setSearch(event.target.value)} InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }} sx={{ mb: 1.5 }} />
              {loading ? <Box sx={{ py: 5, textAlign: 'center' }}><CircularProgress size={24} /></Box> : filteredPatients.length === 0 ? <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>{search.trim() ? 'No matching patient found.' : 'No patients registered yet.'}</Typography> : filteredPatients.map((patient) => <Box key={getPatientId(patient) || getPatientPhone(patient)} sx={{ py: 1.5, borderBottom: '1px solid #EEF2F5' }}><Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1}><Box><Typography fontWeight={600}>{getPatientName(patient)}</Typography><Typography variant="caption" color="text.secondary">{getPatientPhone(patient)} · {patient.gender || 'Gender not recorded'} · {patient.bloodGroup || 'Blood group not recorded'}</Typography><Typography variant="caption" display="block" color="text.secondary">Registered {formatTime(patient.createdAt)}</Typography></Box><Chip size="small" label={patient.status === 'active' ? 'Active' : 'Inactive'} color={patient.status === 'active' ? 'success' : 'default'} /></Stack><Stack direction="row" spacing={1} sx={{ mt: 1 }}>{patient.status !== 'active' && <Button size="small" variant="contained" color="success" onClick={() => updatePatientStatus(patient, 'active')}>Make active</Button>}{patient.status === 'active' && <Button size="small" color="inherit" onClick={() => updatePatientStatus(patient, 'inactive')}>Discharge</Button>}</Stack></Box>)}
            </Paper>
            <Paper sx={{ mt: 2.5, p: { xs: 2.5, md: 3 }, bgcolor: '#E0F7FA', border: '1px solid #B2EBF2', boxShadow: 'none' }}>
              <Typography variant="subtitle2" color="#006064" fontWeight={700}>PAYMENT STATUS</Typography>
              <Typography variant="body2" color="#365A60" sx={{ mt: 0.75 }}>Receipts are marked paid when registration is completed.</Typography>
              <Chip icon={<CheckCircle />} label="Ready for collection" size="small" sx={{ mt: 2, bgcolor: '#fff', color: '#006064', fontWeight: 600 }} />
            </Paper>
          </Grid>
        </Grid>
      </Container>
      <Snackbar open={Boolean(feedback)} autoHideDuration={5000} onClose={() => setFeedback(null)}><Alert severity={feedback?.severity} onClose={() => setFeedback(null)}>{feedback?.message}</Alert></Snackbar>
    </Box>
  );
};

export default ReceptionDashboard;