import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  CircularProgress,
  LinearProgress,
  Divider,
} from '@mui/material';
import {
  FitnessCenter,
  DirectionsRun,
  SelfImprovement,
  Psychology,
  Add,
  CheckCircle,
  LocalFireDepartment,
  Timer,
  Favorite,
  WarningAmber,
  AutoAwesome,
} from '@mui/icons-material';
import {
  ExercisePlan,
  ExerciseActivityLog,
  fetchPatientExercisePlan,
  fetchExerciseLogs,
  logExerciseActivity,
  generateAIExercisePlan,
} from '../services/exerciseService';

interface ExercisePlannerProps {
  patientId: string;
  patientName?: string;
  chronicConditions?: string;
}

export const ExercisePlanner: React.FC<ExercisePlannerProps> = ({
  patientId,
  patientName,
  chronicConditions,
}) => {
  const [plan, setPlan] = useState<ExercisePlan | null>(null);
  const [logs, setLogs] = useState<ExerciseActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingAI, setGeneratingAI] = useState(false);
  const [openLogModal, setOpenLogModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [actName, setActName] = useState('Brisk Walking in Neighborhood');
  const [category, setCategory] = useState<ExerciseActivityLog['category']>('Cardio');
  const [duration, setDuration] = useState('30');
  const [calories, setCalories] = useState('140');
  const [intensity, setIntensity] = useState<ExerciseActivityLog['intensity']>('Moderate');
  const [avgHr, setAvgHr] = useState('110');
  const [notes, setNotes] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [p, l] = await Promise.all([
        fetchPatientExercisePlan(patientId),
        fetchExerciseLogs(patientId),
      ]);
      setPlan(p);
      setLogs(l);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [patientId]);

  const handleGenerateAI = async () => {
    setGeneratingAI(true);
    try {
      const newPlan = await generateAIExercisePlan(patientId, {
        name: patientName,
        chronicConditions: chronicConditions || 'Hypertension, Borderline High Glucose',
        bloodPressure: '135/85 mmHg',
      });
      setPlan(newPlan);
    } finally {
      setGeneratingAI(false);
    }
  };

  const handleLogActivity = async () => {
    if (!actName.trim() || !duration) return;
    setSubmitting(true);
    try {
      await logExerciseActivity({
        patientId,
        date: new Date().toISOString().split('T')[0],
        activityName: actName.trim(),
        category,
        durationMinutes: Number(duration) || 30,
        caloriesBurned: Number(calories) || 100,
        intensity,
        averageHeartRate: Number(avgHr) || undefined,
        completed: true,
        notes: notes.trim() || undefined,
      });
      setOpenLogModal(false);
      await loadData();
    } finally {
      setSubmitting(false);
    }
  };

  // Calculate total weekly minutes completed
  const totalMinutesCompleted = logs.reduce((acc, l) => acc + l.durationMinutes, 0);
  const targetMinutes = plan?.weeklyTargetMinutes || 150;
  const progressPercent = Math.min(100, Math.round((totalMinutesCompleted / targetMinutes) * 100));

  return (
    <Box display="flex" flexDirection="column" gap={3}>
      {/* ── Header Banner ────────────────────────────────────────────────────── */}
      <Paper
        elevation={0}
        sx={{
          p: 3,
          borderRadius: '20px',
          border: '1px solid #E2E8F0',
          background: 'linear-gradient(135deg, #065F46 0%, #047857 100%)',
          color: '#fff',
        }}
      >
        <Grid container spacing={3} alignItems="center">
          <Grid item xs={12} md={7}>
            <Box display="flex" alignItems="center" gap={1.5} mb={1}>
              <FitnessCenter sx={{ color: '#34D399', fontSize: 28 }} />
              <Typography variant="h6" sx={{ fontWeight: 800 }}>
                Clinical Exercise & Lifestyle Recommendations
              </Typography>
            </Box>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)', mb: 2 }}>
              Personalized physical conditioning routines adapted to your physiological vitals and chronic condition status.
            </Typography>

            <Box display="flex" gap={1.5} flexWrap="wrap">
              <Button
                variant="contained"
                size="small"
                startIcon={<Add />}
                onClick={() => setOpenLogModal(true)}
                sx={{
                  borderRadius: '999px',
                  backgroundColor: '#FFFFFF',
                  color: '#065F46',
                  fontWeight: 800,
                  fontSize: '0.8rem',
                  '&:hover': { backgroundColor: '#F0FDF4' },
                }}
              >
                Log Workout
              </Button>
              <Button
                variant="outlined"
                size="small"
                startIcon={generatingAI ? <CircularProgress size={16} color="inherit" /> : <AutoAwesome />}
                onClick={handleGenerateAI}
                disabled={generatingAI}
                sx={{
                  borderRadius: '999px',
                  borderColor: 'rgba(255,255,255,0.6)',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '0.8rem',
                  '&:hover': { borderColor: '#fff', backgroundColor: 'rgba(255,255,255,0.1)' },
                }}
              >
                Regenerate AI Plan
              </Button>
            </Box>
          </Grid>

          <Grid item xs={12} md={5}>
            <Paper
              elevation={0}
              sx={{
                p: 2.5,
                borderRadius: '16px',
                backgroundColor: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)',
              }}
            >
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.8)', fontWeight: 700, textTransform: 'uppercase' }}>
                  Weekly Target Progress
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 800, color: '#34D399' }}>
                  {totalMinutesCompleted} / {targetMinutes} min
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={progressPercent}
                sx={{
                  height: 10,
                  borderRadius: 5,
                  backgroundColor: 'rgba(255,255,255,0.2)',
                  '& .MuiLinearProgress-bar': { backgroundColor: '#34D399', borderRadius: 5 },
                }}
              />
              <Box display="flex" justifyContent="space-between" mt={1}>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.72rem' }}>
                  {progressPercent}% of weekly guideline reached
                </Typography>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.9)', fontWeight: 700, fontSize: '0.72rem' }}>
                  {targetMinutes - totalMinutesCompleted > 0 ? `${targetMinutes - totalMinutesCompleted} min remaining` : 'Goal achieved!'}
                </Typography>
              </Box>
            </Paper>
          </Grid>
        </Grid>
      </Paper>

      {/* ── Active Exercise Prescription Routines ────────────────────────────── */}
      {plan && (
        <Paper elevation={0} sx={{ p: 3, borderRadius: '20px', border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF' }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2} flexWrap="wrap" gap={1}>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#1E293B' }}>
                {plan.title}
              </Typography>
              <Typography variant="caption" sx={{ color: '#64748B' }}>
                Prescribed by: {plan.prescribedBy || 'Clinical Health Engine'} · Focus: {plan.conditionFocus || 'Cardiometabolic'}
              </Typography>
            </Box>
            <Chip label="CLINICAL GUIDELINE" size="small" sx={{ backgroundColor: '#ECFDF5', color: '#059669', fontWeight: 800, fontSize: '0.68rem' }} />
          </Box>

          <Grid container spacing={2}>
            {plan.routines.map((routine) => (
              <Grid item xs={12} md={4} key={routine.id}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 2.5,
                    borderRadius: '16px',
                    border: '1px solid #E2E8F0',
                    backgroundColor: '#F8FAFC',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <Box>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                      <Chip
                        label={routine.category}
                        size="small"
                        sx={{ backgroundColor: '#EFF6FF', color: '#1565C0', fontWeight: 700, fontSize: '0.68rem' }}
                      />
                      <Box display="flex" alignItems="center" gap={0.5}>
                        <Timer sx={{ fontSize: 14, color: '#64748B' }} />
                        <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 700 }}>
                          {routine.durationMinutes} min ({routine.frequency})
                        </Typography>
                      </Box>
                    </Box>

                    <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#1E293B', mb: 0.5 }}>
                      {routine.name}
                    </Typography>

                    <Typography variant="body2" sx={{ color: '#475569', fontSize: '0.78rem', mb: 1.5, lineHeight: 1.4 }}>
                      {routine.instructions}
                    </Typography>

                    {routine.targetHeartRate && (
                      <Box display="flex" alignItems="center" gap={0.5} mb={1}>
                        <Favorite sx={{ fontSize: 14, color: '#DC2626' }} />
                        <Typography variant="caption" sx={{ color: '#DC2626', fontWeight: 700 }}>
                          Target Zone: {routine.targetHeartRate}
                        </Typography>
                      </Box>
                    )}

                    <Box sx={{ p: 1, borderRadius: '8px', backgroundColor: '#ECFDF5', mb: 1.5 }}>
                      <Typography variant="caption" sx={{ color: '#065F46', fontWeight: 600, display: 'block', fontSize: '0.72rem' }}>
                        🌱 <strong>Benefit:</strong> {routine.benefits}
                      </Typography>
                    </Box>
                  </Box>

                  {routine.precautions && routine.precautions.length > 0 && (
                    <Box sx={{ borderTop: '1px solid #E2E8F0', pt: 1, mt: 1 }}>
                      <Typography variant="caption" sx={{ color: '#94A3B8', fontSize: '0.68rem', display: 'block' }}>
                        ⚠️ Precautions: {routine.precautions.join(' · ')}
                      </Typography>
                    </Box>
                  )}
                </Paper>
              </Grid>
            ))}
          </Grid>
        </Paper>
      )}

      {/* ── Recent Activity Logs ──────────────────────────────────────────────── */}
      <Paper elevation={0} sx={{ p: 3, borderRadius: '20px', border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF' }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#1E293B', mb: 2 }}>
          Recent Workout & Activity Logs
        </Typography>

        <Box display="flex" flexDirection="column" gap={1.5}>
          {logs.map((log) => (
            <Paper
              key={log.id}
              elevation={0}
              sx={{
                p: 2,
                borderRadius: '12px',
                border: '1px solid #E2E8F0',
                backgroundColor: '#F8FAFC',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 1,
              }}
            >
              <Box display="flex" alignItems="center" gap={1.5}>
                <Box
                  sx={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    backgroundColor: '#ECFDF5',
                    color: '#059669',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <DirectionsRun sx={{ fontSize: 20 }} />
                </Box>
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 800, color: '#1E293B' }}>
                    {log.activityName}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#64748B' }}>
                    {log.date} · {log.category} · {log.intensity} intensity
                  </Typography>
                </Box>
              </Box>

              <Box display="flex" alignItems="center" gap={2}>
                <Box display="flex" alignItems="center" gap={0.5}>
                  <Timer sx={{ fontSize: 16, color: '#1565C0' }} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#1565C0' }}>
                    {log.durationMinutes} min
                  </Typography>
                </Box>

                <Box display="flex" alignItems="center" gap={0.5}>
                  <LocalFireDepartment sx={{ fontSize: 16, color: '#D97706' }} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#D97706' }}>
                    {log.caloriesBurned} kcal
                  </Typography>
                </Box>
              </Box>
            </Paper>
          ))}
        </Box>
      </Paper>

      {/* ── Log Workout Dialog ───────────────────────────────────────────────── */}
      <Dialog open={openLogModal} onClose={() => setOpenLogModal(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, color: '#1E293B' }}>Log Physical Workout</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: '#64748B', mb: 3 }}>
            Track duration, calories, and intensity to maintain weekly cardiovascular targets.
          </Typography>

          <Grid container spacing={2}>
            <Grid item xs={12} sm={8}>
              <TextField
                label="Activity Name"
                fullWidth
                value={actName}
                onChange={(e) => setActName(e.target.value)}
                size="small"
                required
              />
            </Grid>

            <Grid item xs={12} sm={4}>
              <TextField
                select
                label="Category"
                fullWidth
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                size="small"
              >
                <MenuItem value="Cardio">Cardio</MenuItem>
                <MenuItem value="Strength">Strength</MenuItem>
                <MenuItem value="Flexibility & Mobility">Flexibility & Mobility</MenuItem>
                <MenuItem value="Breathing & Rehabilitation">Breathing</MenuItem>
                <MenuItem value="Balance">Balance</MenuItem>
              </TextField>
            </Grid>

            <Grid item xs={6}>
              <TextField
                label="Duration (minutes)"
                fullWidth
                type="number"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                size="small"
                required
              />
            </Grid>

            <Grid item xs={6}>
              <TextField
                label="Calories Burned (kcal)"
                fullWidth
                type="number"
                value={calories}
                onChange={(e) => setCalories(e.target.value)}
                size="small"
              />
            </Grid>

            <Grid item xs={6}>
              <TextField
                select
                label="Intensity"
                fullWidth
                value={intensity}
                onChange={(e) => setIntensity(e.target.value as any)}
                size="small"
              >
                <MenuItem value="Light">Light (Easy Breathing)</MenuItem>
                <MenuItem value="Moderate">Moderate (Elevated HR)</MenuItem>
                <MenuItem value="Vigorous">Vigorous (High Effort)</MenuItem>
              </TextField>
            </Grid>

            <Grid item xs={6}>
              <TextField
                label="Avg Heart Rate (bpm)"
                fullWidth
                type="number"
                value={avgHr}
                onChange={(e) => setAvgHr(e.target.value)}
                size="small"
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                label="Workout Notes / Feeling"
                fullWidth
                multiline
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Good energy, completed full distance without fatigue."
                size="small"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setOpenLogModal(false)} sx={{ borderRadius: '999px', fontWeight: 600 }}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleLogActivity}
            disabled={submitting || !actName.trim() || !duration}
            sx={{ borderRadius: '999px', backgroundColor: '#059669', fontWeight: 700, px: 3 }}
          >
            {submitting ? <CircularProgress size={20} color="inherit" /> : 'Log Workout'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
