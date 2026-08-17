import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Button,
  Chip,
  Avatar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  CircularProgress,
  IconButton,
  Tooltip,
  Alert,
} from '@mui/material';
import {
  Shield,
  PersonAdd,
  DeleteOutline,
  Phone,
  Email,
  NotificationsActive,
  ReportProblem,
  CheckCircle,
} from '@mui/icons-material';
import {
  CaretakerLink,
  fetchPatientCaretakers,
  assignCaretaker,
  removeCaretaker,
  triggerEmergencySOS,
} from '../services/caretakerService';

interface CaretakerManagerProps {
  patientId: string;
  patientName: string;
  patientPatientId?: string;
}

export const CaretakerManager: React.FC<CaretakerManagerProps> = ({
  patientId,
  patientName,
  patientPatientId,
}) => {
  const [caretakers, setCaretakers] = useState<CaretakerLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [openModal, setOpenModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sosActive, setSosActive] = useState(false);
  const [sosFeedback, setSosFeedback] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [relationship, setRelationship] = useState<CaretakerLink['relationship']>('Spouse');
  const [accessLevel, setAccessLevel] = useState<CaretakerLink['accessLevel']>('Full Access (Vitals, Meds, Appointments)');

  const loadData = async () => {
    setLoading(true);
    try {
      const list = await fetchPatientCaretakers(patientId);
      setCaretakers(list);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [patientId]);

  const handleAssign = async () => {
    if (!name.trim() || !email.trim()) return;
    setSubmitting(true);
    try {
      await assignCaretaker({
        patientId,
        patientName,
        patientPatientId,
        caretakerName: name.trim(),
        caretakerEmail: email.trim(),
        caretakerPhone: phone.trim(),
        relationship,
        accessLevel,
      });
      setOpenModal(false);
      setName('');
      setEmail('');
      setPhone('');
      await loadData();
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async (id: string) => {
    await removeCaretaker(id, patientId);
    await loadData();
  };

  const handleTriggerSOS = async () => {
    setSosActive(true);
    try {
      const res = await triggerEmergencySOS(patientId, patientName);
      setSosFeedback(`Emergency broadcast transmitted to ${res.notifiedCount} caretakers and attending hospital unit.`);
      setTimeout(() => setSosFeedback(null), 6000);
    } finally {
      setSosActive(false);
    }
  };

  return (
    <Box display="flex" flexDirection="column" gap={3}>
      {/* ── Emergency SOS Banner ──────────────────────────────────────────────── */}
      <Paper
        elevation={0}
        sx={{
          p: 3,
          borderRadius: '20px',
          border: '1.5px solid #FCA5A5',
          background: 'linear-gradient(135deg, #7F1D1D 0%, #991B1B 100%)',
          color: '#fff',
        }}
      >
        <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2}>
          <Box display="flex" alignItems="center" gap={2}>
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                backgroundColor: 'rgba(255,255,255,0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ReportProblem sx={{ fontSize: 28, color: '#FCA5A5' }} />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>
                Emergency Care Network & Rapid SOS
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)' }}>
                Instantly broadcast an urgent distress alert with your real-time vitals and hospital ID.
              </Typography>
            </Box>
          </Box>

          <Button
            variant="contained"
            startIcon={sosActive ? <CircularProgress size={16} color="inherit" /> : <NotificationsActive />}
            onClick={handleTriggerSOS}
            disabled={sosActive}
            sx={{
              borderRadius: '999px',
              backgroundColor: '#EF4444',
              fontWeight: 800,
              px: 3,
              py: 1.2,
              boxShadow: '0 4px 14px rgba(0,0,0,0.3)',
              '&:hover': { backgroundColor: '#DC2626' },
            }}
          >
            Trigger Emergency SOS
          </Button>
        </Box>

        {sosFeedback && (
          <Alert severity="success" sx={{ mt: 2, borderRadius: '10px', backgroundColor: '#ECFDF5', color: '#065F46' }}>
            {sosFeedback}
          </Alert>
        )}
      </Paper>

      {/* ── Caretaker Directory Header ───────────────────────────────────────── */}
      <Paper elevation={0} sx={{ p: 3, borderRadius: '20px', border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF' }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2} mb={3}>
          <Box display="flex" alignItems="center" gap={1.5}>
            <Shield sx={{ color: '#1565C0', fontSize: 26 }} />
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 800, color: '#1E293B' }}>
                Assigned Caretakers & Guardians
              </Typography>
              <Typography variant="caption" sx={{ color: '#64748B' }}>
                Family members, designated proxies, and healthcare caregivers with monitoring access
              </Typography>
            </Box>
          </Box>

          <Button
            variant="contained"
            size="small"
            startIcon={<PersonAdd />}
            onClick={() => setOpenModal(true)}
            sx={{
              borderRadius: '999px',
              backgroundColor: '#1565C0',
              fontWeight: 700,
              fontSize: '0.8rem',
              '&:hover': { backgroundColor: '#0D47A1' },
            }}
          >
            Assign Caretaker
          </Button>
        </Box>

        {loading ? (
          <Box display="flex" justifyContent="center" py={4}><CircularProgress size={32} /></Box>
        ) : caretakers.length === 0 ? (
          <Typography variant="body2" sx={{ color: '#64748B', py: 4, textAlign: 'center' }}>
            No caretakers assigned yet. Click "Assign Caretaker" to add family oversight.
          </Typography>
        ) : (
          <Grid container spacing={2}>
            {caretakers.map((care) => (
              <Grid item xs={12} md={6} key={care.id}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 2.5,
                    borderRadius: '16px',
                    border: '1px solid #E2E8F0',
                    backgroundColor: '#F8FAFC',
                  }}
                >
                  <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1.5}>
                    <Box display="flex" alignItems="center" gap={1.5}>
                      <Avatar sx={{ width: 44, height: 44, backgroundColor: '#EFF6FF', color: '#1565C0', fontWeight: 800 }}>
                        {care.caretakerName?.charAt(0)}
                      </Avatar>
                      <Box>
                        <Box display="flex" alignItems="center" gap={1}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#1E293B' }}>
                            {care.caretakerName}
                          </Typography>
                          <Chip
                            label={care.relationship}
                            size="small"
                            sx={{ backgroundColor: '#EFF6FF', color: '#1565C0', fontWeight: 700, fontSize: '0.65rem', height: 20 }}
                          />
                        </Box>
                        <Typography variant="caption" sx={{ color: '#059669', fontWeight: 600, display: 'block' }}>
                          ● Active Care Proxy
                        </Typography>
                      </Box>
                    </Box>

                    <Tooltip title="Remove Caretaker">
                      <IconButton size="small" onClick={() => handleRemove(care.id)} sx={{ color: '#94A3B8', '&:hover': { color: '#EF4444' } }}>
                        <DeleteOutline sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Tooltip>
                  </Box>

                  <Box display="flex" flexDirection="column" gap={0.5} mb={1.5}>
                    <Box display="flex" alignItems="center" gap={1}>
                      <Email sx={{ fontSize: 14, color: '#64748B' }} />
                      <Typography variant="caption" sx={{ color: '#64748B' }}>{care.caretakerEmail}</Typography>
                    </Box>
                    {care.caretakerPhone && (
                      <Box display="flex" alignItems="center" gap={1}>
                        <Phone sx={{ fontSize: 14, color: '#64748B' }} />
                        <Typography variant="caption" sx={{ color: '#64748B' }}>{care.caretakerPhone}</Typography>
                      </Box>
                    )}
                  </Box>

                  <Box sx={{ p: 1, borderRadius: '8px', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                    <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600, display: 'block' }}>
                      Access Scope: <strong>{care.accessLevel}</strong>
                    </Typography>
                  </Box>
                </Paper>
              </Grid>
            ))}
          </Grid>
        )}
      </Paper>

      {/* ── Assign Caretaker Dialog ──────────────────────────────────────────── */}
      <Dialog open={openModal} onClose={() => setOpenModal(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, color: '#1E293B' }}>Assign Caretaker / Family Guardian</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: '#64748B', mb: 3 }}>
            Authorize a family member or caregiver to monitor vitals, receive anomaly alerts, and oversee prescriptions.
          </Typography>

          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                label="Full Name"
                fullWidth
                placeholder="Eleanor Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                size="small"
                required
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                label="Email Address"
                fullWidth
                placeholder="eleanor@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                size="small"
                required
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                label="Phone Number"
                fullWidth
                placeholder="+1 (555) 234-5678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                size="small"
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                select
                label="Relationship"
                fullWidth
                value={relationship}
                onChange={(e) => setRelationship(e.target.value as any)}
                size="small"
              >
                <MenuItem value="Spouse">Spouse</MenuItem>
                <MenuItem value="Parent">Parent</MenuItem>
                <MenuItem value="Child">Child</MenuItem>
                <MenuItem value="Sibling">Sibling</MenuItem>
                <MenuItem value="Professional Caregiver">Professional Caregiver</MenuItem>
                <MenuItem value="Guardian / Legal">Guardian / Legal</MenuItem>
                <MenuItem value="Other">Other</MenuItem>
              </TextField>
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                select
                label="Access Permission Level"
                fullWidth
                value={accessLevel}
                onChange={(e) => setAccessLevel(e.target.value as any)}
                size="small"
              >
                <MenuItem value="Full Access (Vitals, Meds, Appointments)">Full Clinical Access</MenuItem>
                <MenuItem value="View Only">View Only (No Modifications)</MenuItem>
                <MenuItem value="Emergency Alerts Only">Emergency Alerts Only</MenuItem>
              </TextField>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setOpenModal(false)} sx={{ borderRadius: '999px', fontWeight: 600 }}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleAssign}
            disabled={submitting || !name.trim() || !email.trim()}
            sx={{ borderRadius: '999px', backgroundColor: '#1565C0', fontWeight: 700, px: 3 }}
          >
            {submitting ? <CircularProgress size={20} color="inherit" /> : 'Confirm Assignment'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
