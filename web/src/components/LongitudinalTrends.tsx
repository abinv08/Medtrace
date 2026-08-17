import React, { useState, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  ButtonGroup,
  Chip,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  CircularProgress,
  Tooltip,
} from '@mui/material';
import {
  Favorite,
  MonitorHeart,
  Speed,
  FitnessCenter,
  WaterDrop,
  Add,
  TrendingUp,
  Timeline,
  CheckCircle,
} from '@mui/icons-material';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ReferenceLine,
  ReferenceArea,
} from 'recharts';
import {
  VitalReading,
  addVitalReading,
  getBaselineStatistics,
  AnomalyAlert,
} from '../services/healthAnalyticsService';

interface LongitudinalTrendsProps {
  patientId: string;
  vitals: VitalReading[];
  onVitalsUpdated: () => void;
  onAnomalyDetected?: (anomalies: AnomalyAlert[]) => void;
}

type MetricType = 'bp' | 'glucose' | 'heartRate' | 'spO2' | 'weight' | 'cholesterol';

export const LongitudinalTrends: React.FC<LongitudinalTrendsProps> = ({
  patientId,
  vitals,
  onVitalsUpdated,
  onAnomalyDetected,
}) => {
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('bp');
  const [timeRange, setTimeRange] = useState<number>(30); // 7, 14, 30
  const [openLogModal, setOpenLogModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // New vital form state
  const [formSys, setFormSys] = useState('120');
  const [formDia, setFormDia] = useState('80');
  const [formHr, setFormHr] = useState('72');
  const [formGlu, setFormGlu] = useState('95');
  const [formSpo2, setFormSpo2] = useState('98');
  const [formWeight, setFormWeight] = useState('75');
  const [formSource, setFormSource] = useState<'manual' | 'iot_monitor' | 'csi_sensor'>('manual');

  // Filter vitals by time range
  const filteredData = useMemo(() => {
    if (vitals.length <= timeRange) return vitals;
    return vitals.slice(vitals.length - timeRange);
  }, [vitals, timeRange]);

  const baselines = useMemo(() => getBaselineStatistics(vitals), [vitals]);

  // Format date tick
  const formatTick = (tickStr: string) => {
    if (!tickStr) return '';
    const parts = tickStr.split('-');
    if (parts.length === 3) return `${parts[1]}/${parts[2]}`;
    return tickStr;
  };

  const handleSaveVital = async () => {
    setSubmitting(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const res = await addVitalReading({
        patientId,
        date: today,
        time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        systolicBP: Number(formSys) || 120,
        diastolicBP: Number(formDia) || 80,
        heartRate: Number(formHr) || 72,
        glucoseFasting: Number(formGlu) || 95,
        spO2: Number(formSpo2) || 98,
        weightKg: Number(formWeight) || 75,
        bmi: Number(((Number(formWeight) || 75) / (1.75 * 1.75)).toFixed(1)),
        source: formSource,
      });

      if (res.anomalies.length > 0 && onAnomalyDetected) {
        onAnomalyDetected(res.anomalies);
      }
      setOpenLogModal(false);
      onVitalsUpdated();
    } finally {
      setSubmitting(false);
    }
  };

  // Compute stat summary for active metric
  const metricSummary = useMemo(() => {
    if (filteredData.length === 0) return null;
    const latest = filteredData[filteredData.length - 1];

    if (selectedMetric === 'bp') {
      const sysAvg = Math.round(filteredData.reduce((a, b) => a + b.systolicBP, 0) / filteredData.length);
      const diaAvg = Math.round(filteredData.reduce((a, b) => a + b.diastolicBP, 0) / filteredData.length);
      return {
        latest: `${latest.systolicBP}/${latest.diastolicBP} mmHg`,
        average: `${sysAvg}/${diaAvg} mmHg`,
        status: latest.systolicBP < 130 && latest.diastolicBP < 85 ? 'Optimal' : latest.systolicBP < 140 ? 'Elevated' : 'Hypertensive',
        statusColor: latest.systolicBP < 130 ? '#059669' : latest.systolicBP < 140 ? '#D97706' : '#DC2626',
      };
    }
    if (selectedMetric === 'glucose') {
      const vals = filteredData.map((d) => d.glucoseFasting || 0).filter(Boolean);
      const avg = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
      return {
        latest: `${latest.glucoseFasting || '—'} mg/dL`,
        average: `${avg} mg/dL`,
        status: (latest.glucoseFasting || 0) < 100 ? 'Normal Fasting' : (latest.glucoseFasting || 0) < 126 ? 'Pre-diabetic' : 'Elevated',
        statusColor: (latest.glucoseFasting || 0) < 100 ? '#059669' : '#D97706',
      };
    }
    if (selectedMetric === 'heartRate') {
      const avg = Math.round(filteredData.reduce((a, b) => a + b.heartRate, 0) / filteredData.length);
      return {
        latest: `${latest.heartRate} bpm`,
        average: `${avg} bpm`,
        status: latest.heartRate >= 60 && latest.heartRate <= 100 ? 'Normal Resting Pulse' : 'Out of Bounds',
        statusColor: latest.heartRate >= 60 && latest.heartRate <= 100 ? '#059669' : '#DC2626',
      };
    }
    if (selectedMetric === 'spO2') {
      const vals = filteredData.map((d) => d.spO2 || 0).filter(Boolean);
      const avg = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 98;
      return {
        latest: `${latest.spO2 || 98}%`,
        average: `${avg}%`,
        status: (latest.spO2 || 98) >= 95 ? 'Normal Saturation' : 'Low Oxygen',
        statusColor: (latest.spO2 || 98) >= 95 ? '#059669' : '#DC2626',
      };
    }
    if (selectedMetric === 'weight') {
      const avg = Number((filteredData.reduce((a, b) => a + (b.weightKg || 0), 0) / filteredData.length).toFixed(1));
      return {
        latest: `${latest.weightKg || '—'} kg (BMI ${latest.bmi || '—'})`,
        average: `${avg} kg`,
        status: 'Stable Trend',
        statusColor: '#059669',
      };
    }
    const vals = filteredData.map((d) => d.cholesterolTotal || 0).filter(Boolean);
    const avg = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 200;
    return {
      latest: `${latest.cholesterolTotal || '—'} mg/dL`,
      average: `${avg} mg/dL`,
      status: (latest.cholesterolTotal || 0) < 200 ? 'Desirable' : 'Borderline High',
      statusColor: (latest.cholesterolTotal || 0) < 200 ? '#059669' : '#D97706',
    };
  }, [filteredData, selectedMetric]);

  return (
    <Paper elevation={0} sx={{ p: { xs: 2.5, md: 3.5 }, borderRadius: '20px', border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF' }}>
      {/* Top Header & Controls */}
      <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2} mb={3}>
        <Box>
          <Box display="flex" alignItems="center" gap={1.5}>
            <Timeline sx={{ color: '#1565C0', fontSize: 26 }} />
            <Typography variant="h6" sx={{ fontWeight: 800, color: '#1E293B' }}>
              Longitudinal Health Trends
            </Typography>
          </Box>
          <Typography variant="caption" sx={{ color: '#64748B', display: 'block', mt: 0.25 }}>
            Continuous multi-metric physiological tracking & baseline trajectory
          </Typography>
        </Box>

        <Box display="flex" gap={1.5} alignItems="center" flexWrap="wrap">
          {/* Timeframe selector */}
          <ButtonGroup size="small" variant="outlined" sx={{ borderRadius: '999px', overflow: 'hidden' }}>
            {[
              { label: '7 Days', val: 7 },
              { label: '14 Days', val: 14 },
              { label: '30 Days', val: 30 },
            ].map((t) => (
              <Button
                key={t.val}
                onClick={() => setTimeRange(t.val)}
                variant={timeRange === t.val ? 'contained' : 'outlined'}
                sx={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  textTransform: 'none',
                  px: 1.5,
                  backgroundColor: timeRange === t.val ? '#1565C0' : 'transparent',
                }}
              >
                {t.label}
              </Button>
            ))}
          </ButtonGroup>

          {/* Log reading button */}
          <Button
            variant="contained"
            size="small"
            startIcon={<Add />}
            onClick={() => setOpenLogModal(true)}
            sx={{
              borderRadius: '999px',
              backgroundColor: '#1565C0',
              fontWeight: 700,
              fontSize: '0.8rem',
              '&:hover': { backgroundColor: '#0D47A1' },
            }}
          >
            Log Vitals
          </Button>
        </Box>
      </Box>

      {/* Metric Selector Tabs */}
      <Box display="flex" gap={1} overflow="auto" pb={1.5} mb={3}>
        {[
          { id: 'bp' as MetricType, label: 'Blood Pressure', icon: <Favorite sx={{ fontSize: 16 }} /> },
          { id: 'glucose' as MetricType, label: 'Blood Glucose', icon: <WaterDrop sx={{ fontSize: 16 }} /> },
          { id: 'heartRate' as MetricType, label: 'Heart Rate', icon: <MonitorHeart sx={{ fontSize: 16 }} /> },
          { id: 'spO2' as MetricType, label: 'Oxygen (SpO2)', icon: <Speed sx={{ fontSize: 16 }} /> },
          { id: 'weight' as MetricType, label: 'Weight & BMI', icon: <FitnessCenter sx={{ fontSize: 16 }} /> },
          { id: 'cholesterol' as MetricType, label: 'Cholesterol', icon: <TrendingUp sx={{ fontSize: 16 }} /> },
        ].map((m) => (
          <Chip
            key={m.id}
            icon={m.icon}
            label={m.label}
            onClick={() => setSelectedMetric(m.id)}
            variant={selectedMetric === m.id ? 'filled' : 'outlined'}
            sx={{
              fontWeight: 700,
              fontSize: '0.8rem',
              py: 2,
              px: 1,
              borderRadius: '10px',
              backgroundColor: selectedMetric === m.id ? '#EFF6FF' : 'transparent',
              color: selectedMetric === m.id ? '#1565C0' : '#64748B',
              borderColor: selectedMetric === m.id ? '#1565C0' : '#E2E8F0',
              cursor: 'pointer',
              '&:hover': { backgroundColor: '#F0F7FF' },
            }}
          />
        ))}
      </Box>

      {/* Metric Summary Header */}
      {metricSummary && (
        <Grid container spacing={2} mb={3}>
          <Grid item xs={12} sm={4}>
            <Paper elevation={0} sx={{ p: 2, borderRadius: '12px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
              <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600 }}>Latest Reading</Typography>
              <Typography variant="h6" sx={{ fontWeight: 800, color: '#1E293B' }}>{metricSummary.latest}</Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Paper elevation={0} sx={{ p: 2, borderRadius: '12px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
              <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600 }}>{timeRange}-Day Moving Average</Typography>
              <Typography variant="h6" sx={{ fontWeight: 800, color: '#1565C0' }}>{metricSummary.average}</Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Paper elevation={0} sx={{ p: 2, borderRadius: '12px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
              <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600 }}>Clinical Classification</Typography>
              <Box display="flex" alignItems="center" gap={1} mt={0.5}>
                <CheckCircle sx={{ color: metricSummary.statusColor, fontSize: 20 }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 800, color: metricSummary.statusColor }}>
                  {metricSummary.status}
                </Typography>
              </Box>
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* Chart Canvas */}
      <Box sx={{ width: '100%', height: 340, mt: 1 }}>
        <ResponsiveContainer width="100%" height="100%">
          {selectedMetric === 'bp' ? (
            <AreaChart data={filteredData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="colorSys" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1565C0" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#1565C0" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="colorDia" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00838F" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#00838F" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="date" tickFormatter={formatTick} tick={{ fontSize: 11, fill: '#64748B' }} />
              <YAxis domain={[50, 180]} tick={{ fontSize: 11, fill: '#64748B' }} unit=" mmHg" />
              <RechartsTooltip
                contentStyle={{ backgroundColor: '#1E293B', borderRadius: '8px', border: 'none', color: '#fff', fontSize: '0.8rem' }}
                labelFormatter={(label) => `Date: ${label}`}
              />
              <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '0.8rem', fontWeight: 600 }} />
              {/* Reference target bands */}
              <ReferenceLine y={120} stroke="#059669" strokeDasharray="3 3" label={{ value: 'Systolic Target (120)', fill: '#059669', fontSize: 10 }} />
              <ReferenceLine y={80} stroke="#00838F" strokeDasharray="3 3" label={{ value: 'Diastolic Target (80)', fill: '#00838F', fontSize: 10 }} />
              <Area type="monotone" dataKey="systolicBP" name="Systolic BP" stroke="#1565C0" strokeWidth={2.5} fillOpacity={1} fill="url(#colorSys)" />
              <Area type="monotone" dataKey="diastolicBP" name="Diastolic BP" stroke="#00838F" strokeWidth={2} fillOpacity={1} fill="url(#colorDia)" />
            </AreaChart>
          ) : selectedMetric === 'glucose' ? (
            <LineChart data={filteredData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="date" tickFormatter={formatTick} tick={{ fontSize: 11, fill: '#64748B' }} />
              <YAxis domain={[60, 200]} tick={{ fontSize: 11, fill: '#64748B' }} unit=" mg/dL" />
              <RechartsTooltip contentStyle={{ backgroundColor: '#1E293B', borderRadius: '8px', border: 'none', color: '#fff' }} />
              <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '0.8rem', fontWeight: 600 }} />
              <ReferenceLine y={100} stroke="#059669" strokeDasharray="3 3" label={{ value: 'Fasting Target (<100)', fill: '#059669', fontSize: 10 }} />
              <Line type="monotone" dataKey="glucoseFasting" name="Fasting Glucose" stroke="#D97706" strokeWidth={2.5} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="glucosePostPrandial" name="Post-Prandial Glucose" stroke="#7C3AED" strokeWidth={2} strokeDasharray="4 4" dot={{ r: 2 }} />
            </LineChart>
          ) : selectedMetric === 'heartRate' ? (
            <AreaChart data={filteredData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="colorHr" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#DC2626" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#DC2626" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="date" tickFormatter={formatTick} tick={{ fontSize: 11, fill: '#64748B' }} />
              <YAxis domain={[50, 130]} tick={{ fontSize: 11, fill: '#64748B' }} unit=" bpm" />
              <RechartsTooltip contentStyle={{ backgroundColor: '#1E293B', borderRadius: '8px', border: 'none', color: '#fff' }} />
              <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '0.8rem', fontWeight: 600 }} />
              <ReferenceLine y={60} stroke="#64748B" strokeDasharray="3 3" />
              <ReferenceLine y={100} stroke="#DC2626" strokeDasharray="3 3" label={{ value: 'Tachycardia Line (100)', fill: '#DC2626', fontSize: 10 }} />
              <Area type="monotone" dataKey="heartRate" name="Resting Pulse" stroke="#DC2626" strokeWidth={2.5} fillOpacity={1} fill="url(#colorHr)" />
            </AreaChart>
          ) : selectedMetric === 'spO2' ? (
            <LineChart data={filteredData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="date" tickFormatter={formatTick} tick={{ fontSize: 11, fill: '#64748B' }} />
              <YAxis domain={[90, 100]} tick={{ fontSize: 11, fill: '#64748B' }} unit=" %" />
              <RechartsTooltip contentStyle={{ backgroundColor: '#1E293B', borderRadius: '8px', border: 'none', color: '#fff' }} />
              <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '0.8rem', fontWeight: 600 }} />
              <ReferenceLine y={95} stroke="#DC2626" strokeDasharray="3 3" label={{ value: 'Hypoxemia Cutoff (<95%)', fill: '#DC2626', fontSize: 10 }} />
              <Line type="monotone" dataKey="spO2" name="Blood Oxygen (SpO2)" stroke="#00838F" strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          ) : selectedMetric === 'weight' ? (
            <LineChart data={filteredData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="date" tickFormatter={formatTick} tick={{ fontSize: 11, fill: '#64748B' }} />
              <YAxis domain={['auto', 'auto']} tick={{ fontSize: 11, fill: '#64748B' }} unit=" kg" />
              <RechartsTooltip contentStyle={{ backgroundColor: '#1E293B', borderRadius: '8px', border: 'none', color: '#fff' }} />
              <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '0.8rem', fontWeight: 600 }} />
              <Line type="monotone" dataKey="weightKg" name="Weight (kg)" stroke="#059669" strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          ) : (
            <LineChart data={filteredData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="date" tickFormatter={formatTick} tick={{ fontSize: 11, fill: '#64748B' }} />
              <YAxis domain={[140, 260]} tick={{ fontSize: 11, fill: '#64748B' }} unit=" mg/dL" />
              <RechartsTooltip contentStyle={{ backgroundColor: '#1E293B', borderRadius: '8px', border: 'none', color: '#fff' }} />
              <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '0.8rem', fontWeight: 600 }} />
              <ReferenceLine y={200} stroke="#D97706" strokeDasharray="3 3" label={{ value: 'Desirable Limit (200)', fill: '#D97706', fontSize: 10 }} />
              <Line type="monotone" dataKey="cholesterolTotal" name="Total Cholesterol" stroke="#7C3AED" strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          )}
        </ResponsiveContainer>
      </Box>

      {/* Log Vital Dialog */}
      <Dialog open={openLogModal} onClose={() => setOpenLogModal(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, color: '#1E293B' }}>Log Physiological Vitals</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: '#64748B', mb: 3 }}>
            Record current vitals into your longitudinal medical record. Readings will be evaluated against personal baseline bounds.
          </Typography>

          <Grid container spacing={2}>
            <Grid item xs={6}>
              <TextField
                label="Systolic BP (mmHg)"
                fullWidth
                type="number"
                value={formSys}
                onChange={(e) => setFormSys(e.target.value)}
                placeholder="120"
                size="small"
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                label="Diastolic BP (mmHg)"
                fullWidth
                type="number"
                value={formDia}
                onChange={(e) => setFormDia(e.target.value)}
                placeholder="80"
                size="small"
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                label="Heart Rate (bpm)"
                fullWidth
                type="number"
                value={formHr}
                onChange={(e) => setFormHr(e.target.value)}
                placeholder="72"
                size="small"
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                label="Blood Glucose (mg/dL)"
                fullWidth
                type="number"
                value={formGlu}
                onChange={(e) => setFormGlu(e.target.value)}
                placeholder="95"
                size="small"
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                label="Oxygen (SpO2 %)"
                fullWidth
                type="number"
                value={formSpo2}
                onChange={(e) => setFormSpo2(e.target.value)}
                placeholder="98"
                size="small"
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                label="Body Weight (kg)"
                fullWidth
                type="number"
                value={formWeight}
                onChange={(e) => setFormWeight(e.target.value)}
                placeholder="75"
                size="small"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                select
                label="Measurement Source"
                fullWidth
                value={formSource}
                onChange={(e) => setFormSource(e.target.value as any)}
                size="small"
              >
                <MenuItem value="manual">Manual Home Cuff / Glucometer</MenuItem>
                <MenuItem value="csi_sensor">CSI WiFi Wireless Sensor</MenuItem>
                <MenuItem value="iot_monitor">Bluetooth BLE Continuous Monitor</MenuItem>
              </TextField>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setOpenLogModal(false)} sx={{ borderRadius: '999px', fontWeight: 600 }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveVital}
            disabled={submitting}
            sx={{ borderRadius: '999px', backgroundColor: '#1565C0', fontWeight: 700, px: 3 }}
          >
            {submitting ? <CircularProgress size={20} color="inherit" /> : 'Record & Analyze'}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};
