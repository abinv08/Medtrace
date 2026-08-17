import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Button,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  CircularProgress,
  Divider,
  LinearProgress,
  Tooltip,
} from '@mui/material';
import {
  Medication,
  CheckCircle,
  Cancel,
  Add,
  DeleteOutline,
  Alarm,
  Schedule,
  LocalPharmacy,
  MedicalServices,
  Edit,
} from '@mui/icons-material';
import {
  MedicationItem,
  MedicationDoseLog,
  fetchPatientMedications,
  addMedication,
  deleteMedication,
  logDoseAdherence,
  fetchDoseLogs,
  calculateAdherenceRate,
} from '../services/medicationService';

interface MedicationTrackerProps {
  patientId: string;
  onAdherenceChange?: (rate: number) => void;
}

const TIME_SLOTS: ('Morning' | 'Afternoon' | 'Evening' | 'Night')[] = ['Morning', 'Afternoon', 'Evening', 'Night'];

export const MedicationTracker: React.FC<MedicationTrackerProps> = ({
  patientId,
  onAdherenceChange,
}) => {
  const [medications, setMedications] = useState<MedicationItem[]>([]);
  const [doseLogs, setDoseLogs] = useState<MedicationDoseLog[]>([]);
  const [adherenceScore, setAdherenceScore] = useState(92);
  const [loading, setLoading] = useState(true);
  const [openAddModal, setOpenAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state for adding medication
  const [medName, setMedName] = useState('');
  const [dosage, setDosage] = useState('');
  const [frequency, setFrequency] = useState<MedicationItem['frequency']>('Twice Daily');
  const [selectedSlots, setSelectedSlots] = useState<('Morning' | 'Afternoon' | 'Evening' | 'Night')[]>(['Morning', 'Evening']);
  const [prescribingDoctor, setPrescribingDoctor] = useState('Dr. Alexander Wright');
  const [instructions, setInstructions] = useState('');
  const [category, setCategory] = useState<MedicationItem['category']>('Cardiovascular');

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [meds, logs, score] = await Promise.all([
        fetchPatientMedications(patientId),
        fetchDoseLogs(patientId, todayStr),
        calculateAdherenceRate(patientId),
      ]);
      setMedications(meds);
      setDoseLogs(logs);
      setAdherenceScore(score);
      if (onAdherenceChange) onAdherenceChange(score);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [patientId, todayStr]);

  const handleToggleSlot = (slot: 'Morning' | 'Afternoon' | 'Evening' | 'Night') => {
    if (selectedSlots.includes(slot)) {
      setSelectedSlots(selectedSlots.filter((s) => s !== slot));
    } else {
      setSelectedSlots([...selectedSlots, slot]);
    }
  };

  const handleAddMedication = async () => {
    if (!medName.trim() || !dosage.trim()) return;
    setSubmitting(true);
    try {
      await addMedication({
        patientId,
        name: medName.trim(),
        dosage: dosage.trim(),
        frequency,
        timeSlots: selectedSlots.length ? selectedSlots : ['Morning'],
        prescribingDoctor,
        instructions: instructions.trim() || 'Take as directed by your physician.',
        status: 'active',
        startDate: todayStr,
        category,
        refillsRemaining: 3,
      });
      setOpenAddModal(false);
      setMedName('');
      setDosage('');
      setInstructions('');
      await loadData();
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    await deleteMedication(id, patientId);
    await loadData();
  };

  const handleDoseAction = async (
    med: MedicationItem,
    slot: 'Morning' | 'Afternoon' | 'Evening' | 'Night',
    status: 'taken' | 'skipped'
  ) => {
    await logDoseAdherence({
      patientId,
      medicationId: med.id,
      medicationName: med.name,
      date: todayStr,
      timeSlot: slot,
      status,
    });
    const [newLogs, score] = await Promise.all([
      fetchDoseLogs(patientId, todayStr),
      calculateAdherenceRate(patientId),
    ]);
    setDoseLogs(newLogs);
    setAdherenceScore(score);
    if (onAdherenceChange) onAdherenceChange(score);
  };

  const getDoseStatus = (medId: string, slot: string): 'taken' | 'skipped' | 'pending' => {
    const log = doseLogs.find((l) => l.medicationId === medId && l.timeSlot === slot);
    return log ? log.status : 'pending';
  };

  return (
    <Box display="flex" flexDirection="column" gap={3}>
      {/* ── Top Header & Adherence Score ──────────────────────────────────────── */}
      <Paper
        elevation={0}
        sx={{
          p: 3,
          borderRadius: '20px',
          border: '1px solid #E2E8F0',
          background: 'linear-gradient(135deg, #1E293B 0%, #334155 100%)',
          color: '#fff',
        }}
      >
        <Grid container spacing={3} alignItems="center">
          <Grid item xs={12} md={7}>
            <Box display="flex" alignItems="center" gap={1.5} mb={1}>
              <LocalPharmacy sx={{ color: '#60A5FA', fontSize: 28 }} />
              <Typography variant="h6" sx={{ fontWeight: 800 }}>
                Medication Adherence & Schedule
              </Typography>
            </Box>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)', mb: 2 }}>
              Track daily dosages, maintain prescription compliance, and receive timely in-app reminders.
            </Typography>
            <Button
              variant="contained"
              size="small"
              startIcon={<Add />}
              onClick={() => setOpenAddModal(true)}
              sx={{
                borderRadius: '999px',
                backgroundColor: '#3B82F6',
                fontWeight: 700,
                fontSize: '0.8rem',
                '&:hover': { backgroundColor: '#2563EB' },
              }}
            >
              Add New Prescription
            </Button>
          </Grid>

          <Grid item xs={12} md={5}>
            <Paper
              elevation={0}
              sx={{
                p: 2.5,
                borderRadius: '16px',
                backgroundColor: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.15)',
              }}
            >
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', fontWeight: 700, textTransform: 'uppercase' }}>
                  Weekly Compliance Score
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 800, color: adherenceScore >= 80 ? '#34D399' : '#FBBF24' }}>
                  {adherenceScore}%
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={adherenceScore}
                sx={{
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: 'rgba(255,255,255,0.2)',
                  '& .MuiLinearProgress-bar': {
                    backgroundColor: adherenceScore >= 80 ? '#34D399' : '#FBBF24',
                    borderRadius: 4,
                  },
                }}
              />
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', display: 'block', mt: 1, fontSize: '0.72rem' }}>
                {adherenceScore >= 90 ? '🌟 Excellent adherence — maintain this consistency!' : 'Keep taking prescribed doses on schedule.'}
              </Typography>
            </Paper>
          </Grid>
        </Grid>
      </Paper>

      {/* ── Today's Dose Schedule Breakdown ──────────────────────────────────── */}
      <Paper elevation={0} sx={{ p: 3, borderRadius: '20px', border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF' }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2.5}>
          <Box display="flex" alignItems="center" gap={1}>
            <Schedule sx={{ color: '#1565C0', fontSize: 22 }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#1E293B' }}>
              Today's Dosage Schedule ({todayStr})
            </Typography>
          </Box>
          <Chip label={`${medications.length} Active Prescriptions`} size="small" sx={{ fontWeight: 700, backgroundColor: '#EFF6FF', color: '#1565C0' }} />
        </Box>

        {loading ? (
          <Box display="flex" justifyContent="center" py={4}><CircularProgress size={32} /></Box>
        ) : medications.length === 0 ? (
          <Typography variant="body2" sx={{ color: '#64748B', py: 4, textAlign: 'center' }}>
            No medications prescribed yet. Click "Add New Prescription" to begin.
          </Typography>
        ) : (
          <Grid container spacing={2}>
            {TIME_SLOTS.map((slot) => {
              const slotMeds = medications.filter((m) => m.timeSlots.includes(slot));
              return (
                <Grid item xs={12} sm={6} md={3} key={slot}>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 2,
                      borderRadius: '14px',
                      border: '1px solid #E2E8F0',
                      backgroundColor: '#F8FAFC',
                      height: '100%',
                    }}
                  >
                    <Box display="flex" alignItems="center" gap={1} mb={1.5}>
                      <Alarm sx={{ fontSize: 16, color: '#64748B' }} />
                      <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#1E293B' }}>
                        {slot}
                      </Typography>
                    </Box>

                    {slotMeds.length === 0 ? (
                      <Typography variant="caption" sx={{ color: '#94A3B8', display: 'block', py: 2, textAlign: 'center' }}>
                        No doses for this slot
                      </Typography>
                    ) : (
                      <Box display="flex" flexDirection="column" gap={1.5}>
                        {slotMeds.map((med) => {
                          const status = getDoseStatus(med.id, slot);
                          return (
                            <Paper
                              key={med.id}
                              elevation={0}
                              sx={{
                                p: 1.5,
                                borderRadius: '10px',
                                border: '1px solid #E2E8F0',
                                backgroundColor: status === 'taken' ? '#ECFDF5' : status === 'skipped' ? '#FEF2F2' : '#FFFFFF',
                              }}
                            >
                              <Typography variant="body2" sx={{ fontWeight: 800, color: '#1E293B', fontSize: '0.82rem' }}>
                                {med.name}
                              </Typography>
                              <Typography variant="caption" sx={{ color: '#64748B', display: 'block', mb: 1 }}>
                                {med.dosage}
                              </Typography>

                              <Box display="flex" gap={0.5}>
                                <Button
                                  size="small"
                                  variant={status === 'taken' ? 'contained' : 'outlined'}
                                  onClick={() => handleDoseAction(med, slot, 'taken')}
                                  sx={{
                                    fontSize: '0.68rem',
                                    fontWeight: 700,
                                    py: 0.25,
                                    minWidth: 54,
                                    backgroundColor: status === 'taken' ? '#059669' : 'transparent',
                                    color: status === 'taken' ? '#fff' : '#059669',
                                    borderColor: '#059669',
                                    '&:hover': { backgroundColor: status === 'taken' ? '#047857' : '#ECFDF5' },
                                  }}
                                >
                                  Taken
                                </Button>
                                <Button
                                  size="small"
                                  variant={status === 'skipped' ? 'contained' : 'outlined'}
                                  onClick={() => handleDoseAction(med, slot, 'skipped')}
                                  sx={{
                                    fontSize: '0.68rem',
                                    fontWeight: 700,
                                    py: 0.25,
                                    minWidth: 50,
                                    backgroundColor: status === 'skipped' ? '#DC2626' : 'transparent',
                                    color: status === 'skipped' ? '#fff' : '#DC2626',
                                    borderColor: '#DC2626',
                                    '&:hover': { backgroundColor: status === 'skipped' ? '#B91C1C' : '#FEF2F2' },
                                  }}
                                >
                                  Skip
                                </Button>
                              </Box>
                            </Paper>
                          );
                        })}
                      </Box>
                    )}
                  </Paper>
                </Grid>
              );
            })}
          </Grid>
        )}
      </Paper>

      {/* ── Active Prescriptions Directory ────────────────────────────────────── */}
      <Paper elevation={0} sx={{ p: 3, borderRadius: '20px', border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF' }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#1E293B', mb: 2 }}>
          Full Prescription Directory
        </Typography>

        <Grid container spacing={2}>
          {medications.map((med) => (
            <Grid item xs={12} md={6} key={med.id}>
              <Paper elevation={0} sx={{ p: 2.5, borderRadius: '14px', border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC' }}>
                <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#1E293B' }}>
                      {med.name}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#1565C0', fontWeight: 700 }}>
                      {med.dosage} · {med.frequency}
                    </Typography>
                  </Box>
                  <Tooltip title="Delete Prescription">
                    <IconButton size="small" onClick={() => handleDelete(med.id)} sx={{ color: '#94A3B8', '&:hover': { color: '#EF4444' } }}>
                      <DeleteOutline sx={{ fontSize: 18 }} />
                    </IconButton>
                  </Tooltip>
                </Box>

                <Typography variant="body2" sx={{ color: '#64748B', fontSize: '0.78rem', mb: 1.5 }}>
                  {med.instructions}
                </Typography>

                <Box display="flex" gap={1} flexWrap="wrap" alignItems="center">
                  <Chip label={med.category || 'General'} size="small" sx={{ backgroundColor: '#EFF6FF', color: '#1565C0', fontWeight: 600, fontSize: '0.68rem' }} />
                  <Typography variant="caption" sx={{ color: '#94A3B8', fontSize: '0.7rem' }}>
                    Doctor: {med.prescribingDoctor || 'Attending Physician'}
                  </Typography>
                </Box>
              </Paper>
            </Grid>
          ))}
        </Grid>
      </Paper>

      {/* ── Add Medication Dialog ────────────────────────────────────────────── */}
      <Dialog open={openAddModal} onClose={() => setOpenAddModal(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, color: '#1E293B' }}>Add New Prescription</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: '#64748B', mb: 3 }}>
            Add medication details to setup daily reminders and adherence logs.
          </Typography>

          <Grid container spacing={2}>
            <Grid item xs={12} sm={8}>
              <TextField
                label="Medication Name"
                fullWidth
                placeholder="e.g. Lisinopril"
                value={medName}
                onChange={(e) => setMedName(e.target.value)}
                size="small"
                required
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                label="Dosage"
                fullWidth
                placeholder="e.g. 10 mg"
                value={dosage}
                onChange={(e) => setDosage(e.target.value)}
                size="small"
                required
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                select
                label="Frequency"
                fullWidth
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as any)}
                size="small"
              >
                <MenuItem value="Once Daily">Once Daily</MenuItem>
                <MenuItem value="Twice Daily">Twice Daily</MenuItem>
                <MenuItem value="Three Times Daily">Three Times Daily</MenuItem>
                <MenuItem value="Four Times Daily">Four Times Daily</MenuItem>
                <MenuItem value="As Needed">As Needed</MenuItem>
                <MenuItem value="Weekly">Weekly</MenuItem>
              </TextField>
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                select
                label="Category"
                fullWidth
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                size="small"
              >
                <MenuItem value="Cardiovascular">Cardiovascular</MenuItem>
                <MenuItem value="Antidiabetic">Antidiabetic</MenuItem>
                <MenuItem value="Antibiotic">Antibiotic</MenuItem>
                <MenuItem value="Respiratory">Respiratory</MenuItem>
                <MenuItem value="Analgesic">Analgesic</MenuItem>
                <MenuItem value="Supplement">Supplement</MenuItem>
                <MenuItem value="Other">Other</MenuItem>
              </TextField>
            </Grid>

            <Grid item xs={12}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: '#64748B', display: 'block', mb: 1 }}>
                Scheduled Time Slots:
              </Typography>
              <Box display="flex" gap={1} flexWrap="wrap">
                {TIME_SLOTS.map((slot) => (
                  <Chip
                    key={slot}
                    label={slot}
                    onClick={() => handleToggleSlot(slot)}
                    variant={selectedSlots.includes(slot) ? 'filled' : 'outlined'}
                    color={selectedSlots.includes(slot) ? 'primary' : 'default'}
                    sx={{ fontWeight: 700, cursor: 'pointer' }}
                  />
                ))}
              </Box>
            </Grid>

            <Grid item xs={12}>
              <TextField
                label="Prescribing Doctor"
                fullWidth
                placeholder="Dr. Alexander Wright"
                value={prescribingDoctor}
                onChange={(e) => setPrescribingDoctor(e.target.value)}
                size="small"
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                label="Instructions / Special Notes"
                fullWidth
                multiline
                rows={2}
                placeholder="e.g. Take with breakfast. Avoid skipping doses."
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                size="small"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setOpenAddModal(false)} sx={{ borderRadius: '999px', fontWeight: 600 }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleAddMedication}
            disabled={submitting || !medName.trim() || !dosage.trim()}
            sx={{ borderRadius: '999px', backgroundColor: '#1565C0', fontWeight: 700, px: 3 }}
          >
            {submitting ? <CircularProgress size={20} color="inherit" /> : 'Save Prescription'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
