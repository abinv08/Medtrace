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
  Alert,
  Snackbar,
} from '@mui/material';
import {
  FitnessCenter,
  DirectionsRun,
  SelfImprovement,
  Add,
  CheckCircle,
  LocalFireDepartment,
  Timer,
  Favorite,
  AutoAwesome,
  TrendingUp,
  DirectionsWalk,
  AirOutlined,
  BalanceOutlined,
  FitnessCenterOutlined,
} from '@mui/icons-material';
import {
  ExercisePlan,
  ExerciseItem,
  ExerciseProgressLog,
  fetchPatientExercisePlan,
  logExerciseProgress,
  createBackendExercisePlan,
  generateAIExercisePlan,
  generateVitalsBasedSuggestions,
  VitalsSuggestion,
} from '../services/exerciseService';
import { VitalReading } from '../services/healthAnalyticsService';

interface ExercisePlannerProps {
  patientId: string;
  patientName?: string;
  chronicConditions?: string;
  vitals?: VitalReading[];
  onPlanUpdate?: (plan: ExercisePlan | null) => void;
}

export const ExercisePlanner: React.FC<ExercisePlannerProps> = ({
  patientId,
  patientName,
  chronicConditions,
  vitals = [],
  onPlanUpdate,
}) => {
  const [plan, setPlan] = useState<ExercisePlan | null>(null);
  const [logs, setLogs] = useState<ExerciseProgressLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingAI, setGeneratingAI] = useState(false);
  const [openLogModal, setOpenLogModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [suggestions, setSuggestions] = useState<VitalsSuggestion[]>([]);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form state
  const [actName, setActName] = useState('');
  const [category, setCategory] = useState<string>('Cardio');
  const [duration, setDuration] = useState('30');
  const [calories, setCalories] = useState('120');
  const [intensity, setIntensity] = useState<string>('Moderate');
  const [avgHr, setAvgHr] = useState('');
  const [notes, setNotes] = useState('');

  const loadData = async () => {
    if (!patientId) return;
    setLoading(true);
    try {
      // Fetch plan from GET /api/exercise-plans/:patientId via exerciseService
      const p = await fetchPatientExercisePlan(patientId);
      setPlan(p);
      setLogs(p?.progressLog || []);
      if (onPlanUpdate) {
        onPlanUpdate(p);
      }
    } catch (err: any) {
      console.warn('Error loading exercise plan:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [patientId]);

  // Derive suggestions from vitals whenever vitals change
  useEffect(() => {
    setSuggestions(generateVitalsBasedSuggestions(vitals));
  }, [vitals]);

  const handleGenerateAI = async () => {
    setGeneratingAI(true);
    try {
      const latestVital = vitals.length > 0 ? vitals[vitals.length - 1] : null;
      const newPlan = await generateAIExercisePlan(patientId, {
        name: patientName,
        chronicConditions:
          chronicConditions ||
          (latestVital ? `Systolic BP: ${latestVital.systolicBP}, HR: ${latestVital.heartRate}` : 'General Wellness'),
        bloodPressure: latestVital ? `${latestVital.systolicBP}/${latestVital.diastolicBP} mmHg` : undefined,
      });

      if (newPlan) {
        setPlan(newPlan);
        setLogs(newPlan.progressLog || []);
        if (onPlanUpdate) onPlanUpdate(newPlan);
        setFeedbackMsg({ type: 'success', text: 'AI Exercise Plan generated and saved successfully!' });
      } else {
        setFeedbackMsg({ type: 'error', text: 'Could not generate AI exercise plan. Please try again.' });
      }
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Error generating AI plan' });
    } finally {
      setGeneratingAI(false);
    }
  };

  const handleLogActivity = async () => {
    if (!actName.trim() || !duration) return;
    setSubmitting(true);
    try {
      let activePlanId = plan?._id || plan?.id;

      // If no exercise plan exists yet for this patient, create an initial plan via POST /api/exercise-plans
      if (!activePlanId) {
        const initialPlan = await createBackendExercisePlan({
          patientId,
          frequency: '3-5 days/week',
          exercises: [
            {
              name: actName.trim(),
              notes: `${category} · ${intensity} intensity · ${duration} min`,
            },
          ],
        });
        if (initialPlan) {
          activePlanId = initialPlan._id || initialPlan.id;
          setPlan(initialPlan);
        }
      }

      // Log progress via PUT /api/exercise-plans/:id/progress
      const targetId = activePlanId || patientId;
      const result = await logExerciseProgress(targetId, {
        date: new Date().toISOString(),
        completed: true,
        activityName: actName.trim(),
        category,
        durationMinutes: Number(duration) || 30,
        caloriesBurned: Number(calories) || 100,
        intensity,
        averageHeartRate: Number(avgHr) || undefined,
        notes: notes.trim() || undefined,
      });

      if (result.success && result.exercisePlan) {
        setPlan(result.exercisePlan);
        setLogs(result.exercisePlan.progressLog || []);
        if (onPlanUpdate) onPlanUpdate(result.exercisePlan);
      } else {
        // Fallback: reload from GET /api/exercise-plans/:patientId
        await loadData();
      }

      setFeedbackMsg({ type: 'success', text: 'Workout progress logged successfully!' });
      setOpenLogModal(false);
      // Reset modal fields
      setActName('');
      setNotes('');
      setAvgHr('');
    } catch (err: any) {
      console.error('Error logging workout progress:', err);
      setFeedbackMsg({
        type: 'error',
        text: err.response?.data?.message || err.message || 'Failed to log workout progress',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Extract exercise routines list from plan
  const exerciseList: ExerciseItem[] =
    plan?.exercises && plan.exercises.length > 0
      ? plan.exercises
      : plan?.routines && plan.routines.length > 0
      ? plan.routines
      : [];

  // Calculate weekly minutes completed from progressLog
  const totalMinutesCompleted = logs.reduce((acc, l) => {
    if (l.durationMinutes && l.durationMinutes > 0) {
      return acc + l.durationMinutes;
    }
    const match = l.notes?.match(/Duration:\s*(\d+)\s*min/i) || l.notes?.match(/(\d+)\s*min/i);
    return acc + (match ? Number(match[1]) : 30);
  }, 0);

  const targetMinutes = plan?.weeklyTargetMinutes || 150;
  const progressPercent = Math.min(100, Math.round((totalMinutesCompleted / targetMinutes) * 100));

  return (
    <Box display="flex" flexDirection="column" gap={3}>
      {/* ── Feedback Notification ────────────────────────────────────────────── */}
      <Snackbar
        open={Boolean(feedbackMsg)}
        autoHideDuration={4000}
        onClose={() => setFeedbackMsg(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        {feedbackMsg ? (
          <Alert
            onClose={() => setFeedbackMsg(null)}
            severity={feedbackMsg.type}
            sx={{ width: '100%', borderRadius: '10px' }}
          >
            {feedbackMsg.text}
          </Alert>
        ) : undefined}
      </Snackbar>

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
                {generatingAI ? 'Generating Plan...' : 'Regenerate AI Plan'}
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
                  {progressPercent}% of weekly guideline reached ({logs.length} session{logs.length === 1 ? '' : 's'})
                </Typography>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.9)', fontWeight: 700, fontSize: '0.72rem' }}>
                  {targetMinutes - totalMinutesCompleted > 0
                    ? `${targetMinutes - totalMinutesCompleted} min remaining`
                    : 'Goal achieved!'}
                </Typography>
              </Box>
            </Paper>
          </Grid>
        </Grid>
      </Paper>

      {/* ── Loading Spinner ─────────────────────────────────────────────────── */}
      {loading && (
        <Box display="flex" justifyContent="center" py={4}>
          <CircularProgress size={32} sx={{ color: '#059669' }} />
        </Box>
      )}

      {/* ── Vitals-Based Smart Suggestions ──────────────────────────────────── */}
      {suggestions.length > 0 && !plan && !loading && (
        <Paper elevation={0} sx={{ p: 3, borderRadius: '20px', border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF' }}>
          <Box display="flex" alignItems="center" gap={1.5} mb={0.5}>
            <TrendingUp sx={{ color: '#1565C0', fontSize: 22 }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#1E293B' }}>
              Smart Suggestions Based on Your Vitals
            </Typography>
            <Chip label="PERSONALISED" size="small" sx={{ backgroundColor: '#EFF6FF', color: '#1565C0', fontWeight: 800, fontSize: '0.65rem' }} />
          </Box>
          <Typography variant="body2" sx={{ color: '#64748B', mb: 3 }}>
            These recommendations are derived from your logged vitals. Generate an AI plan to save a full weekly prescription.
          </Typography>

          <Grid container spacing={2}>
            {suggestions.map((sug) => {
              const iconMap: Record<string, React.ReactNode> = {
                cardio: <DirectionsWalk sx={{ fontSize: 20, color: '#1565C0' }} />,
                breathing: <AirOutlined sx={{ fontSize: 20, color: '#059669' }} />,
                strength: <FitnessCenterOutlined sx={{ fontSize: 20, color: '#D97706' }} />,
                flexibility: <SelfImprovement sx={{ fontSize: 20, color: '#7C3AED' }} />,
                balance: <BalanceOutlined sx={{ fontSize: 20, color: '#DC2626' }} />,
              };
              const colorMap: Record<string, string> = {
                cardio: '#EFF6FF',
                breathing: '#F0FDF4',
                strength: '#FFFBEB',
                flexibility: '#F5F3FF',
                balance: '#FEF2F2',
              };
              const borderMap: Record<string, string> = {
                cardio: '#1565C020',
                breathing: '#05966920',
                strength: '#D9770620',
                flexibility: '#7C3AED20',
                balance: '#DC262620',
              };

              return (
                <Grid item xs={12} md={6} key={sug.id}>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 2.5,
                      borderRadius: '16px',
                      border: `1px solid ${borderMap[sug.icon]}`,
                      backgroundColor: colorMap[sug.icon],
                      height: '100%',
                    }}
                  >
                    <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
                      <Box display="flex" alignItems="center" gap={1}>
                        {iconMap[sug.icon]}
                        <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#1E293B' }}>{sug.title}</Typography>
                      </Box>
                      <Chip label={sug.intensity} size="small" sx={{ fontSize: '0.65rem', fontWeight: 700, backgroundColor: 'rgba(255,255,255,0.7)' }} />
                    </Box>

                    <Box display="flex" gap={2} mb={1.5} flexWrap="wrap">
                      <Box display="flex" alignItems="center" gap={0.5}>
                        <Timer sx={{ fontSize: 14, color: '#64748B' }} />
                        <Typography variant="caption" sx={{ color: '#475569', fontWeight: 700 }}>{sug.duration}</Typography>
                      </Box>
                      <Box display="flex" alignItems="center" gap={0.5}>
                        <CheckCircle sx={{ fontSize: 14, color: '#64748B' }} />
                        <Typography variant="caption" sx={{ color: '#475569', fontWeight: 700 }}>{sug.frequency}</Typography>
                      </Box>
                    </Box>

                    <Box sx={{ p: 1.5, borderRadius: '10px', backgroundColor: 'rgba(255,255,255,0.6)', mb: 1.5 }}>
                      <Typography variant="caption" sx={{ color: '#334155', lineHeight: 1.5, display: 'block', fontSize: '0.75rem' }}>
                        💡 <strong>Why:</strong> {sug.reason}
                      </Typography>
                    </Box>

                    <Typography variant="caption" sx={{ color: '#059669', fontWeight: 600, display: 'block', mb: 0.5, fontSize: '0.72rem' }}>
                      🌱 <strong>Benefit:</strong> {sug.benefit}
                    </Typography>

                    {sug.precautions.length > 0 && (
                      <Typography variant="caption" sx={{ color: '#94A3B8', display: 'block', fontSize: '0.68rem' }}>
                        ⚠️ {sug.precautions.join(' · ')}
                      </Typography>
                    )}
                  </Paper>
                </Grid>
              );
            })}
          </Grid>

          <Box mt={3} display="flex" justifyContent="center">
            <Button
              variant="contained"
              startIcon={generatingAI ? <CircularProgress size={16} color="inherit" /> : <AutoAwesome />}
              onClick={handleGenerateAI}
              disabled={generatingAI}
              sx={{
                borderRadius: '999px',
                background: 'linear-gradient(135deg, #065F46, #047857)',
                color: '#fff',
                fontWeight: 700,
                px: 4,
              }}
            >
              {generatingAI ? 'Generating...' : 'Generate Full AI Exercise Plan'}
            </Button>
          </Box>
        </Paper>
      )}

      {/* ── No data empty state ──────────────────────────────────────────────── */}
      {!plan && suggestions.length === 0 && !loading && (
        <Paper
          elevation={0}
          sx={{
            p: 4,
            borderRadius: '20px',
            border: '1px dashed #CBD5E1',
            backgroundColor: '#F8FAFC',
            textAlign: 'center',
          }}
        >
          <FitnessCenter sx={{ fontSize: 48, color: '#CBD5E1', mb: 2 }} />
          <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#94A3B8', mb: 1 }}>
            No Exercise Plan Found
          </Typography>
          <Typography variant="body2" sx={{ color: '#94A3B8', mb: 3, maxWidth: 480, mx: 'auto' }}>
            No clinical exercise plan has been assigned yet. You can generate an AI-customized routine adapted to your health status or log individual workouts.
          </Typography>
          <Button
            variant="contained"
            startIcon={generatingAI ? <CircularProgress size={16} color="inherit" /> : <AutoAwesome />}
            onClick={handleGenerateAI}
            disabled={generatingAI}
            sx={{
              borderRadius: '999px',
              background: 'linear-gradient(135deg, #065F46, #047857)',
              color: '#fff',
              fontWeight: 700,
              px: 4,
            }}
          >
            {generatingAI ? 'Generating...' : 'Generate AI Exercise Plan'}
          </Button>
        </Paper>
      )}

      {/* ── Active Exercise Prescription Routines ────────────────────────────── */}
      {plan && (
        <Paper elevation={0} sx={{ p: 3, borderRadius: '20px', border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF' }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2} flexWrap="wrap" gap={1}>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#1E293B' }}>
                {plan.title || 'Prescribed Physical Conditioning'}
              </Typography>
              <Typography variant="caption" sx={{ color: '#64748B' }}>
                Prescribed by: {plan.prescribedBy || 'Clinical Health Engine'} · Schedule: {plan.frequency || 'Weekly Schedule'}
              </Typography>
            </Box>
            <Chip
              label="SYNCHRONIZED API"
              size="small"
              sx={{ backgroundColor: '#ECFDF5', color: '#059669', fontWeight: 800, fontSize: '0.68rem' }}
            />
          </Box>

          {exerciseList.length === 0 ? (
            <Box py={2} textAlign="center">
              <Typography variant="body2" sx={{ color: '#94A3B8' }}>
                No specific exercises listed under this plan. Use "Log Workout" to track activity.
              </Typography>
            </Box>
          ) : (
            <Grid container spacing={2}>
              {exerciseList.map((routine, idx) => (
                <Grid item xs={12} sm={6} md={4} key={routine._id || routine.id || idx}>
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
                          label={routine.category || 'Exercise'}
                          size="small"
                          sx={{ backgroundColor: '#EFF6FF', color: '#1565C0', fontWeight: 700, fontSize: '0.68rem' }}
                        />
                        {(routine.durationMinutes || routine.frequency) && (
                          <Box display="flex" alignItems="center" gap={0.5}>
                            <Timer sx={{ fontSize: 14, color: '#64748B' }} />
                            <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 700 }}>
                              {routine.durationMinutes ? `${routine.durationMinutes} min` : ''}
                              {routine.frequency ? ` (${routine.frequency})` : ''}
                            </Typography>
                          </Box>
                        )}
                      </Box>

                      <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#1E293B', mb: 0.5 }}>
                        {routine.name}
                      </Typography>

                      {(routine.sets || routine.reps) && (
                        <Typography variant="caption" sx={{ color: '#059669', fontWeight: 700, display: 'block', mb: 1 }}>
                          {routine.sets ? `${routine.sets} sets` : ''} {routine.reps ? `· ${routine.reps} reps` : ''}
                        </Typography>
                      )}

                      {(routine.instructions || routine.notes) && (
                        <Typography variant="body2" sx={{ color: '#475569', fontSize: '0.78rem', mb: 1.5, lineHeight: 1.4 }}>
                          {routine.instructions || routine.notes}
                        </Typography>
                      )}

                      {routine.targetHeartRate && (
                        <Box display="flex" alignItems="center" gap={0.5} mb={1}>
                          <Favorite sx={{ fontSize: 14, color: '#DC2626' }} />
                          <Typography variant="caption" sx={{ color: '#DC2626', fontWeight: 700 }}>
                            Target Zone: {routine.targetHeartRate}
                          </Typography>
                        </Box>
                      )}

                      {routine.benefits && (
                        <Box sx={{ p: 1, borderRadius: '8px', backgroundColor: '#ECFDF5', mb: 1.5 }}>
                          <Typography variant="caption" sx={{ color: '#065F46', fontWeight: 600, display: 'block', fontSize: '0.72rem' }}>
                            🌱 <strong>Benefit:</strong> {routine.benefits}
                          </Typography>
                        </Box>
                      )}
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
          )}
        </Paper>
      )}

      {/* ── Recent Activity Logs ──────────────────────────────────────────────── */}
      <Paper elevation={0} sx={{ p: 3, borderRadius: '20px', border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF' }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#1E293B' }}>
            Recent Workout & Activity Logs
          </Typography>
          <Chip
            label={`${logs.length} Recorded`}
            size="small"
            sx={{ backgroundColor: '#F1F5F9', color: '#475569', fontWeight: 700 }}
          />
        </Box>

        <Box display="flex" flexDirection="column" gap={1.5}>
          {logs.length === 0 ? (
            <Box textAlign="center" py={3}>
              <DirectionsRun sx={{ fontSize: 36, color: '#CBD5E1', mb: 1 }} />
              <Typography variant="body2" sx={{ color: '#94A3B8', fontWeight: 600 }}>
                No workouts logged yet
              </Typography>
              <Typography variant="caption" sx={{ color: '#CBD5E1' }}>
                Click "Log Workout" to record your completed session to the database
              </Typography>
            </Box>
          ) : (
            [...logs].reverse().map((log, idx) => {
              const formattedDate = log.date
                ? new Date(log.date).toLocaleDateString(undefined, {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })
                : 'Recent Session';

              return (
                <Paper
                  key={log._id || log.id || idx}
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
                    gap: 1.5,
                  }}
                >
                  <Box display="flex" alignItems="center" gap={1.5}>
                    <Box
                      sx={{
                        width: 38,
                        height: 38,
                        borderRadius: '50%',
                        backgroundColor: '#ECFDF5',
                        color: '#059669',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <DirectionsRun sx={{ fontSize: 20 }} />
                    </Box>
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 800, color: '#1E293B' }}>
                        {log.activityName || log.notes || 'Exercise Session'}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#64748B' }}>
                        {formattedDate} {log.completed ? '· Completed' : ''}
                      </Typography>
                    </Box>
                  </Box>

                  <Box display="flex" alignItems="center" gap={2}>
                    {log.durationMinutes ? (
                      <Box display="flex" alignItems="center" gap={0.5}>
                        <Timer sx={{ fontSize: 16, color: '#1565C0' }} />
                        <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#1565C0' }}>
                          {log.durationMinutes} min
                        </Typography>
                      </Box>
                    ) : null}

                    {log.caloriesBurned ? (
                      <Box display="flex" alignItems="center" gap={0.5}>
                        <LocalFireDepartment sx={{ fontSize: 16, color: '#D97706' }} />
                        <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#D97706' }}>
                          {log.caloriesBurned} kcal
                        </Typography>
                      </Box>
                    ) : null}

                    <Chip
                      icon={<CheckCircle sx={{ fontSize: '14px !important' }} />}
                      label="Logged"
                      size="small"
                      sx={{
                        backgroundColor: '#ECFDF5',
                        color: '#059669',
                        fontWeight: 700,
                        fontSize: '0.68rem',
                      }}
                    />
                  </Box>
                </Paper>
              );
            })
          )}
        </Box>
      </Paper>

      {/* ── Log Workout Dialog ───────────────────────────────────────────────── */}
      <Dialog open={openLogModal} onClose={() => setOpenLogModal(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, color: '#1E293B' }}>Log Physical Workout</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: '#64748B', mb: 3 }}>
            Saves progress directly to your active plan via <code>PUT /api/exercise-plans/:id/progress</code>.
          </Typography>

          <Grid container spacing={2}>
            <Grid item xs={12} sm={8}>
              <TextField
                label="Activity Name"
                fullWidth
                value={actName}
                onChange={(e) => setActName(e.target.value)}
                placeholder={exerciseList[0]?.name || 'e.g. Brisk Walking, Chair Squats'}
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
                onChange={(e) => setCategory(e.target.value)}
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
                onChange={(e) => setIntensity(e.target.value)}
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
                placeholder="e.g. Good energy, completed full session comfortably."
                size="small"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setOpenLogModal(false)} sx={{ borderRadius: '999px', fontWeight: 600 }}>
            Cancel
          </Button>
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
