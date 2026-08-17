import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Chip,
  Button,
  Alert,
  CircularProgress,
  Divider,
} from '@mui/material';
import {
  WarningAmber,
  ReportProblem,
  CheckCircle,
  PhoneInTalk,
  LocalHospital,
  NotificationsActive,
} from '@mui/icons-material';
import { AnomalyAlert } from '../services/healthAnalyticsService';
import { triggerEmergencySOS } from '../services/caretakerService';

interface AnomalyDetectionCardProps {
  anomalies: AnomalyAlert[];
  patientId: string;
  patientName: string;
  onDismiss?: (id: string) => void;
}

export const AnomalyDetectionCard: React.FC<AnomalyDetectionCardProps> = ({
  anomalies,
  patientId,
  patientName,
  onDismiss,
}) => {
  const [alerting, setAlerting] = useState(false);
  const [alertSent, setAlertSent] = useState(false);

  if (anomalies.length === 0) {
    return (
      <Paper
        elevation={0}
        sx={{
          p: 2.5,
          borderRadius: '16px',
          border: '1px solid rgba(5,150,105,0.2)',
          backgroundColor: 'rgba(5,150,105,0.04)',
          display: 'flex',
          alignItems: 'center',
          gap: 2,
        }}
      >
        <Box
          sx={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            backgroundColor: 'rgba(5,150,105,0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#059669',
          }}
        >
          <CheckCircle sx={{ fontSize: 24 }} />
        </Box>
        <Box flex={1}>
          <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#065F46' }}>
            Physiological Baselines Normal
          </Typography>
          <Typography variant="caption" sx={{ color: '#047857' }}>
            All current vital parameters fall within your expected statistical distribution and clinical target thresholds.
          </Typography>
        </Box>
      </Paper>
    );
  }

  const handleNotifyTeam = async () => {
    setAlerting(true);
    try {
      await triggerEmergencySOS(patientId, patientName);
      setAlertSent(true);
      setTimeout(() => setAlertSent(false), 5000);
    } finally {
      setAlerting(false);
    }
  };

  const severityStyles = {
    critical: { bg: '#FEF2F2', border: '#FCA5A5', color: '#DC2626', chipBg: '#DC2626', icon: <ReportProblem sx={{ color: '#DC2626' }} /> },
    high: { bg: '#FFFBEB', border: '#FCD34D', color: '#D97706', chipBg: '#D97706', icon: <WarningAmber sx={{ color: '#D97706' }} /> },
    moderate: { bg: '#EFF6FF', border: '#BFDBFE', color: '#1565C0', chipBg: '#1565C0', icon: <WarningAmber sx={{ color: '#1565C0' }} /> },
  };

  return (
    <Box display="flex" flexDirection="column" gap={2}>
      {anomalies.map((anom) => {
        const style = severityStyles[anom.severity] || severityStyles.high;
        return (
          <Paper
            key={anom.id}
            elevation={0}
            sx={{
              p: 2.5,
              borderRadius: '16px',
              border: `1.5px solid ${style.border}`,
              backgroundColor: style.bg,
            }}
          >
            <Box display="flex" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={1.5} mb={1.5}>
              <Box display="flex" alignItems="center" gap={1.5}>
                {style.icon}
                <Box>
                  <Box display="flex" alignItems="center" gap={1}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#1E293B' }}>
                      {anom.title}
                    </Typography>
                    <Chip
                      label={anom.severity.toUpperCase()}
                      size="small"
                      sx={{
                        backgroundColor: style.chipBg,
                        color: '#fff',
                        fontWeight: 800,
                        fontSize: '0.65rem',
                        height: 20,
                      }}
                    />
                  </Box>
                  <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600 }}>
                    Detected Value: <strong style={{ color: style.color }}>{anom.detectedValue}</strong> · Baseline Average: {anom.baselineValue} ({anom.standardDeviations > 0 ? `+${anom.standardDeviations}σ` : `${anom.standardDeviations}σ`})
                  </Typography>
                </Box>
              </Box>

              {onDismiss && (
                <Button size="small" onClick={() => onDismiss(anom.id)} sx={{ color: '#64748B', fontSize: '0.75rem', fontWeight: 600 }}>
                  Acknowledge
                </Button>
              )}
            </Box>

            <Typography variant="body2" sx={{ color: '#334155', mb: 1, lineHeight: 1.5, fontSize: '0.85rem' }}>
              {anom.description}
            </Typography>

            <Box
              sx={{
                p: 1.5,
                borderRadius: '10px',
                backgroundColor: 'rgba(255,255,255,0.7)',
                border: '1px solid rgba(0,0,0,0.06)',
                mb: 2,
              }}
            >
              <Typography variant="caption" sx={{ fontWeight: 700, color: '#1E293B', display: 'block', mb: 0.25 }}>
                💡 Recommended Clinical Action:
              </Typography>
              <Typography variant="caption" sx={{ color: '#475569', display: 'block', lineHeight: 1.4 }}>
                {anom.clinicalAction}
              </Typography>
            </Box>

            <Box display="flex" justifyContent="flex-end" alignItems="center" gap={1.5}>
              {alertSent && (
                <Chip
                  icon={<CheckCircle sx={{ fontSize: '14px !important', color: '#059669 !important' }} />}
                  label="Care Team & Caretakers Notified"
                  size="small"
                  sx={{ backgroundColor: '#ECFDF5', color: '#059669', fontWeight: 700 }}
                />
              )}
              <Button
                variant="contained"
                size="small"
                startIcon={alerting ? <CircularProgress size={14} color="inherit" /> : <NotificationsActive />}
                onClick={handleNotifyTeam}
                disabled={alerting}
                sx={{
                  borderRadius: '999px',
                  backgroundColor: '#DC2626',
                  '&:hover': { backgroundColor: '#B91C1C' },
                  fontWeight: 700,
                  fontSize: '0.78rem',
                }}
              >
                Notify Doctor & Caretakers
              </Button>
            </Box>
          </Paper>
        );
      })}
    </Box>
  );
};
