import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Grid,
  TextField,
  MenuItem,
  Button,
  Chip,
  Avatar,
  Paper,
  CircularProgress,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormControl,
  FormLabel,
} from '@mui/material';
import {
  CalendarMonth,
  MedicalServices,
  VideoCall,
  LocalHospital,
  AccessTime,
  Person,
} from '@mui/icons-material';
import { Appointment, bookAppointment } from '../services/appointmentService';
import { fetchAllDoctors, DoctorProfile } from '../services/doctorService';

interface AppointmentBookingModalProps {
  open: boolean;
  onClose: () => void;
  patientId: string;
  patientName: string;
  patientPhone?: string;
  patientEmail?: string;
  onAppointmentBooked: (apt: Appointment) => void;
}

const TIME_SLOTS = [
  '09:00 AM',
  '10:00 AM',
  '10:30 AM',
  '11:30 AM',
  '02:00 PM',
  '03:00 PM',
  '04:30 PM',
  '05:30 PM',
];

const DEFAULT_DOCTOR_LIST: Partial<DoctorProfile>[] = [
  {
    id: 'doc-alexander-wright',
    name: 'Dr. Alexander Wright',
    specialization: 'Cardiology',
    qualifications: 'MD (Cardiology), FACC',
    hospitalName: 'MedTrace General Hospital',
  },
  {
    id: 'doc-sarah-jenkins',
    name: 'Dr. Sarah Jenkins',
    specialization: 'Endocrinology & Diabetes',
    qualifications: 'MD, FACE',
    hospitalName: 'MedTrace General Hospital',
  },
  {
    id: 'doc-robert-chen',
    name: 'Dr. Robert Chen',
    specialization: 'General Medicine & Pulmonology',
    qualifications: 'MBBS, MD',
    hospitalName: 'MedTrace General Hospital',
  },
  {
    id: 'doc-elena-rodriguez',
    name: 'Dr. Elena Rodriguez',
    specialization: 'Neurology',
    qualifications: 'MD, DM (Neuro)',
    hospitalName: 'MedTrace General Hospital',
  },
];

export const AppointmentBookingModal: React.FC<AppointmentBookingModalProps> = ({
  open,
  onClose,
  patientId,
  patientName,
  patientPhone,
  patientEmail,
  onAppointmentBooked,
}) => {
  const [doctors, setDoctors] = useState<Partial<DoctorProfile>[]>(DEFAULT_DOCTOR_LIST);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [selectedDoctorId, setSelectedDoctorId] = useState('doc-alexander-wright');
  const [date, setDate] = useState(() => {
    const tomorrow = new Date(Date.now() + 86400000);
    return tomorrow.toISOString().split('T')[0];
  });
  const [selectedSlot, setSelectedSlot] = useState('10:30 AM');
  const [consultationType, setConsultationType] = useState<Appointment['consultationType']>('In-Person Consultation');
  const [reason, setReason] = useState('Quarterly cardiovascular checkup and blood pressure review.');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setLoadingDocs(true);
      fetchAllDoctors('approved')
        .then((list) => {
          if (list.length > 0) {
            setDoctors(list);
            setSelectedDoctorId(list[0].id);
          } else {
            setDoctors(DEFAULT_DOCTOR_LIST);
          }
        })
        .catch(() => setDoctors(DEFAULT_DOCTOR_LIST))
        .finally(() => setLoadingDocs(false));
    }
  }, [open]);

  const selectedDoctor = doctors.find((d) => d.id === selectedDoctorId) || doctors[0];

  const handleSubmit = async () => {
    if (!selectedDoctor || !date || !selectedSlot || !reason.trim()) return;
    setSubmitting(true);
    try {
      const newApt = await bookAppointment({
        patientId,
        patientName,
        patientPhone: patientPhone || '',
        patientEmail: patientEmail || '',
        doctorId: selectedDoctor.id || 'doc-1',
        doctorName: selectedDoctor.name || 'Dr. Physician',
        doctorSpecialization: selectedDoctor.specialization || 'Clinical Specialist',
        hospitalName: selectedDoctor.hospitalName || 'MedTrace General Hospital',
        date,
        timeSlot: selectedSlot,
        consultationType,
        reason: reason.trim(),
        meetingLink:
          consultationType === 'Teleconsultation / Video'
            ? `https://meet.medtrace.health/room-${Math.random().toString(36).substring(2, 8)}`
            : undefined,
      });

      onAppointmentBooked(newApt);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontWeight: 800, color: '#1E293B' }}>
        Book Clinical Consultation
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ color: '#64748B', mb: 3 }}>
          Schedule an in-person hospital appointment or telehealth video consultation with MedTrace verified clinical specialists.
        </Typography>

        <Grid container spacing={3}>
          {/* Step 1: Select Doctor */}
          <Grid item xs={12}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#1E293B', mb: 1.5 }}>
              1. Select Attending Specialist
            </Typography>

            <Grid container spacing={1.5}>
              {doctors.map((doc) => {
                const isSelected = doc.id === selectedDoctorId;
                return (
                  <Grid item xs={12} sm={6} key={doc.id}>
                    <Paper
                      elevation={0}
                      onClick={() => setSelectedDoctorId(doc.id || '')}
                      sx={{
                        p: 2,
                        borderRadius: '14px',
                        border: isSelected ? '2px solid #1565C0' : '1px solid #E2E8F0',
                        backgroundColor: isSelected ? '#EFF6FF' : '#FFFFFF',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.5,
                        transition: 'all 0.15s',
                        '&:hover': { borderColor: '#1565C0', backgroundColor: '#F8FAFC' },
                      }}
                    >
                      <Avatar sx={{ backgroundColor: isSelected ? '#1565C0' : '#E2E8F0', color: isSelected ? '#fff' : '#1E293B', fontWeight: 800 }}>
                        {doc.name?.charAt(0)}
                      </Avatar>
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#1E293B' }}>
                          {doc.name}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#1565C0', fontWeight: 700, display: 'block' }}>
                          {doc.specialization}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#64748B' }}>
                          {doc.hospitalName || 'MedTrace General Hospital'}
                        </Typography>
                      </Box>
                    </Paper>
                  </Grid>
                );
              })}
            </Grid>
          </Grid>

          {/* Step 2: Consultation Mode */}
          <Grid item xs={12} sm={6}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#1E293B', mb: 1 }}>
              2. Consultation Format
            </Typography>
            <TextField
              select
              fullWidth
              size="small"
              value={consultationType}
              onChange={(e) => setConsultationType(e.target.value as any)}
            >
              <MenuItem value="In-Person Consultation">🏥 In-Person Hospital Consultation</MenuItem>
              <MenuItem value="Teleconsultation / Video">📹 Telehealth Video Consultation</MenuItem>
              <MenuItem value="Follow-up Checkup">🔄 Routine Follow-up Review</MenuItem>
              <MenuItem value="Emergency / Urgent">⚡ Priority Urgent Consultation</MenuItem>
            </TextField>
          </Grid>

          {/* Step 3: Date Picker */}
          <Grid item xs={12} sm={6}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#1E293B', mb: 1 }}>
              3. Select Consultation Date
            </Typography>
            <TextField
              type="date"
              fullWidth
              size="small"
              InputLabelProps={{ shrink: true }}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Grid>

          {/* Step 4: Time Slot */}
          <Grid item xs={12}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#1E293B', mb: 1 }}>
              4. Available Time Slot
            </Typography>
            <Box display="flex" gap={1} flexWrap="wrap">
              {TIME_SLOTS.map((slot) => {
                const isSelected = slot === selectedSlot;
                return (
                  <Chip
                    key={slot}
                    label={slot}
                    icon={<AccessTime sx={{ fontSize: '14px !important' }} />}
                    onClick={() => setSelectedSlot(slot)}
                    variant={isSelected ? 'filled' : 'outlined'}
                    color={isSelected ? 'primary' : 'default'}
                    sx={{
                      fontWeight: 700,
                      cursor: 'pointer',
                      py: 2,
                      px: 0.5,
                      borderRadius: '8px',
                    }}
                  />
                );
              })}
            </Box>
          </Grid>

          {/* Step 5: Symptoms & Reason */}
          <Grid item xs={12}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#1E293B', mb: 1 }}>
              5. Chief Complaint / Reason for Visit
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={3}
              placeholder="Describe symptoms, duration, current medication concerns, or reason for follow-up…"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              size="small"
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} sx={{ borderRadius: '999px', fontWeight: 600 }}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={submitting || !reason.trim()}
          sx={{
            borderRadius: '999px',
            backgroundColor: '#1565C0',
            fontWeight: 700,
            px: 3.5,
            '&:hover': { backgroundColor: '#0D47A1' },
          }}
        >
          {submitting ? <CircularProgress size={20} color="inherit" /> : 'Confirm Booking'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
