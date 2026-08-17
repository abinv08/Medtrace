import React, { useState, useCallback, useRef } from 'react';
import {
  Box,
  Container,
  Typography,
  Button,
  Paper,
  Chip,
  CircularProgress,
  Alert,
  Divider,
  LinearProgress,
  Tooltip,
  IconButton,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  TextField,
  Snackbar,
} from '@mui/material';
import {
  CloudUpload,
  Analytics,
  CheckCircle,
  Warning,
  Error as ErrorIcon,
  Description,
  Image as ImageIcon,
  DeleteOutline,
  AutoAwesome,
  ArrowBack,
  MedicalServices,
  InfoOutlined,
  Save,
  Folder,
  ArrowForward,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { analyzeReport, ReportSummary } from '../services/geminiService';
import { uploadReport, ReportType } from '../services/reportService';
import { useAuth } from '../contexts/AuthContext';

// ─── Accepted MIME types ──────────────────────────────────────────────────────
const ACCEPTED = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/heic',
];
const ACCEPT_STRING = '.pdf,.png,.jpg,.jpeg,.webp,.heic';
const MAX_MB = 10;

const REPORT_TYPE_LABELS: { value: ReportType; label: string }[] = [
  { value: 'lab', label: 'Lab / Blood Test' },
  { value: 'radiology', label: 'Radiology / Scan' },
  { value: 'discharge', label: 'Discharge Summary' },
  { value: 'prescription', label: 'Prescription' },
  { value: 'other', label: 'Other' },
];

// ─── Urgency config ───────────────────────────────────────────────────────────
const urgencyConfig = {
  Normal: { color: '#14B8A6', bg: 'rgba(20,184,166,0.1)', icon: <CheckCircle sx={{ fontSize: 18 }} />, label: 'All Normal' },
  Monitor: { color: '#F59E0B', bg: 'rgba(245,158,11,0.1)', icon: <Warning sx={{ fontSize: 18 }} />, label: 'Monitor Closely' },
  Urgent: { color: '#EF4444', bg: 'rgba(239,68,68,0.1)', icon: <ErrorIcon sx={{ fontSize: 18 }} />, label: 'Urgent Attention' },
};

// ─── Section card ─────────────────────────────────────────────────────────────
const SectionCard: React.FC<{ title: string; accent: string; children: React.ReactNode }> = ({
  title, accent, children,
}) => (
  <Paper
    elevation={0}
    sx={{
      p: { xs: 2.5, sm: 3.5 },
      borderRadius: '20px',
      border: `1px solid ${accent}30`,
      backgroundColor: '#FFFFFF',
      boxShadow: '0 4px 16px rgba(0,0,0,0.04)',
    }}
  >
    <Typography
      variant="caption"
      sx={{ color: accent, fontWeight: 800, letterSpacing: 1.2, display: 'block', mb: 2 }}
    >
      {title}
    </Typography>
    {children}
  </Paper>
);

// ─── Main Page ────────────────────────────────────────────────────────────────
export const MedicalReportPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ReportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reportType, setReportType] = useState<ReportType>('lab');
  const [reportDate, setReportDate] = useState('');
  const [notes, setNotes] = useState('');
  const [savedToCloud, setSavedToCloud] = useState(false);
  const [snackOpen, setSnackOpen] = useState(false);
  const [snackMsg, setSnackMsg] = useState('');

  // ── File validation ─────────────────────────────────────────────────────────
  const validateAndSet = (f: File) => {
    setError(null);
    setResult(null);
    setSavedToCloud(false);
    if (!ACCEPTED.includes(f.type)) {
      setError('Unsupported file type. Please upload a PDF or image (PNG, JPG, WEBP, HEIC).');
      return;
    }
    if (f.size > MAX_MB * 1024 * 1024) {
      setError(`File is too large. Maximum size is ${MAX_MB} MB.`);
      return;
    }
    setFile(f);
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) validateAndSet(e.target.files[0]);
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.[0]) validateAndSet(e.dataTransfer.files[0]);
  }, []);

  const clearFile = () => {
    setFile(null);
    setResult(null);
    setError(null);
    setSavedToCloud(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── Analysis ────────────────────────────────────────────────────────────────
  const handleAnalyze = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setProgress(0);
    setSavedToCloud(false);

    // Fake progress animation while waiting
    const iv = setInterval(() => {
      setProgress((p) => (p < 88 ? p + Math.random() * 12 : p));
    }, 400);

    try {
      const summary = await analyzeReport(file);
      clearInterval(iv);
      setProgress(100);
      await new Promise((r) => setTimeout(r, 300));
      setResult(summary);

      // Auto-save to Firebase if user is logged in
      if (user?.id) {
        await handleSave(summary);
      }
    } catch (err: any) {
      clearInterval(iv);
      setError(err?.message || 'Analysis failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Save to Firebase Storage + Firestore ─────────────────────────────────────
  const handleSave = async (summary?: ReportSummary) => {
    if (!file || !user?.id || savedToCloud) return;
    setSaving(true);
    try {
      await uploadReport({
        uid: user.id,
        patientId: user.patientId || `NOID-${user.id.slice(0, 8)}`,
        file,
        reportType,
        reportDate: reportDate || undefined,
        notes: notes || undefined,
        analysisResult: summary || result || undefined,
      });
      setSavedToCloud(true);
      setSnackMsg('Report saved to your health records ✓');
      setSnackOpen(true);
    } catch (err: any) {
      setSnackMsg('Could not save report: ' + (err?.message || 'Unknown error'));
      setSnackOpen(true);
    } finally {
      setSaving(false);
    }
  };

  const isPdf = file?.type === 'application/pdf';
  const urgency = result ? urgencyConfig[result.urgencyLevel] : null;

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: '#F8FAFC' }}>
      <Navbar />

      {/* ── Page Header ──────────────────────────────────────────────────────── */}
      <Box
        sx={{
          background: 'linear-gradient(135deg, rgba(37,99,235,0.06) 0%, rgba(20,184,166,0.04) 100%)',
          borderBottom: '1px solid #E2E8F0',
          py: { xs: 4, md: 5 },
        }}
      >
        <Container maxWidth="lg">
          <Button
            startIcon={<ArrowBack />}
            onClick={() => navigate('/')}
            sx={{ color: '#64748B', mb: 2, fontWeight: 600, '&:hover': { color: '#2563EB', backgroundColor: 'transparent' } }}
          >
            Back to Home
          </Button>
          <Box display="flex" alignItems="center" gap={2} mb={1}>
            <Box
              sx={{
                p: 1.5,
                borderRadius: '14px',
                background: 'linear-gradient(135deg, #2563EB 0%, #14B8A6 100%)',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <Analytics sx={{ color: '#FFFFFF', fontSize: 28 }} />
            </Box>
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 800, color: '#0F172A', lineHeight: 1.2 }}>
                AI Medical Report Analysis
              </Typography>
              <Typography variant="body2" sx={{ color: '#64748B', mt: 0.5 }}>
                Upload a lab report, radiology scan, or discharge summary — get instant clinical insights
              </Typography>
            </Box>
          </Box>

          {/* Badges */}
          <Box display="flex" gap={1.5} flexWrap="wrap" mt={2}>
            {[
              { label: 'Powered by Gemini AI', color: '#2563EB' },
              { label: 'PDF & Image Support', color: '#14B8A6' },
              { label: 'Saved to Health Records', color: '#8B5CF6' },
            ].map((b) => (
              <Chip
                key={b.label}
                icon={<AutoAwesome sx={{ fontSize: '14px !important', color: `${b.color} !important` }} />}
                label={b.label}
                size="small"
                sx={{
                  backgroundColor: `${b.color}14`,
                  color: b.color,
                  fontWeight: 700,
                  fontSize: '0.75rem',
                  borderRadius: '999px',
                }}
              />
            ))}
          </Box>
        </Container>
      </Box>

      {/* ── Main Content ─────────────────────────────────────────────────────── */}
      <Container maxWidth="lg" sx={{ py: { xs: 4, md: 6 } }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: result ? '1fr 1.6fr' : '1fr' },
            gap: 4,
            maxWidth: result ? '100%' : 720,
            mx: result ? 0 : 'auto',
          }}
        >
          {/* ── Left: Upload Panel ─────────────────────────────────────────── */}
          <Box display="flex" flexDirection="column" gap={3}>

            {/* Drop Zone */}
            <Paper
              elevation={0}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => !file && fileInputRef.current?.click()}
              sx={{
                p: { xs: 3, sm: 5 },
                borderRadius: '24px',
                border: `2px dashed ${dragOver ? '#2563EB' : file ? '#14B8A6' : '#CBD5E1'}`,
                backgroundColor: dragOver
                  ? 'rgba(37,99,235,0.04)'
                  : file
                  ? 'rgba(20,184,166,0.03)'
                  : '#FFFFFF',
                textAlign: 'center',
                cursor: file ? 'default' : 'pointer',
                transition: 'all 0.25s ease',
                '&:hover': !file ? { borderColor: '#2563EB', backgroundColor: 'rgba(37,99,235,0.03)' } : {},
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPT_STRING}
                onChange={onFileChange}
                style={{ display: 'none' }}
              />

              {!file ? (
                <>
                  <Box
                    sx={{
                      width: 72,
                      height: 72,
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, rgba(37,99,235,0.12) 0%, rgba(20,184,166,0.12) 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mx: 'auto',
                      mb: 2.5,
                    }}
                  >
                    <CloudUpload sx={{ fontSize: 34, color: '#2563EB' }} />
                  </Box>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: '#0F172A', mb: 1 }}>
                    Drop your report here
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#64748B', mb: 2.5 }}>
                    Supports PDF, PNG, JPG, WEBP, HEIC · Max {MAX_MB} MB
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={<CloudUpload />}
                    sx={{
                      borderRadius: '999px',
                      px: 3.5,
                      py: 1.2,
                      background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
                      fontWeight: 700,
                    }}
                  >
                    Browse File
                  </Button>
                </>
              ) : (
                /* File selected preview */
                <Box>
                  <Box
                    sx={{
                      width: 64,
                      height: 64,
                      borderRadius: '16px',
                      backgroundColor: isPdf ? 'rgba(239,68,68,0.1)' : 'rgba(37,99,235,0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mx: 'auto',
                      mb: 2,
                    }}
                  >
                    {isPdf
                      ? <Description sx={{ fontSize: 34, color: '#EF4444' }} />
                      : <ImageIcon sx={{ fontSize: 34, color: '#2563EB' }} />}
                  </Box>
                  <Typography variant="body1" sx={{ fontWeight: 700, color: '#0F172A', mb: 0.5, wordBreak: 'break-all' }}>
                    {file.name}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#64748B' }}>
                    {(file.size / 1024 / 1024).toFixed(2)} MB · {file.type}
                  </Typography>
                  <Box display="flex" justifyContent="center" gap={2} mt={2.5}>
                    <Button
                      variant="outlined"
                      startIcon={<DeleteOutline />}
                      onClick={(e) => { e.stopPropagation(); clearFile(); }}
                      sx={{ borderRadius: '999px', borderColor: '#E2E8F0', color: '#64748B', fontWeight: 600 }}
                    >
                      Remove
                    </Button>
                    <Button
                      variant="text"
                      onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                      sx={{ borderRadius: '999px', color: '#2563EB', fontWeight: 600 }}
                    >
                      Change
                    </Button>
                  </Box>
                </Box>
              )}
            </Paper>

            {/* Report type + date selectors */}
            {file && (
              <Paper elevation={0} sx={{ p: 2.5, borderRadius: '16px', border: '1px solid #E2E8F0' }}>
                <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 700, display: 'block', mb: 1.5 }}>
                  REPORT DETAILS (OPTIONAL)
                </Typography>
                <Box display="flex" flexDirection="column" gap={2}>
                  <FormControl size="small" fullWidth>
                    <InputLabel>Report Type</InputLabel>
                    <Select
                      value={reportType}
                      label="Report Type"
                      onChange={(e) => setReportType(e.target.value as ReportType)}
                    >
                      {REPORT_TYPE_LABELS.map((r) => (
                        <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <TextField
                    size="small"
                    label="Report Date (on document)"
                    type="date"
                    InputLabelProps={{ shrink: true }}
                    value={reportDate}
                    onChange={(e) => setReportDate(e.target.value)}
                    fullWidth
                  />
                  <TextField
                    size="small"
                    label="Notes (optional)"
                    multiline
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    fullWidth
                  />
                </Box>
              </Paper>
            )}

            {/* Error */}
            {error && (
              <Alert
                severity="error"
                sx={{ borderRadius: '14px', fontWeight: 600 }}
                onClose={() => setError(null)}
              >
                {error}
              </Alert>
            )}

            {/* Analyze Button */}
            <Button
              variant="contained"
              size="large"
              disabled={!file || loading}
              onClick={handleAnalyze}
              startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <MedicalServices />}
              sx={{
                borderRadius: '999px',
                py: 1.8,
                fontWeight: 800,
                fontSize: '1rem',
                background: 'linear-gradient(135deg, #2563EB 0%, #14B8A6 100%)',
                boxShadow: '0 8px 24px rgba(37,99,235,0.25)',
                transition: 'all 0.3s ease',
                '&:hover': { boxShadow: '0 12px 32px rgba(37,99,235,0.35)', transform: 'translateY(-1px)' },
                '&:disabled': { background: '#E2E8F0', boxShadow: 'none', transform: 'none' },
              }}
            >
              {loading ? 'Analyzing Report…' : 'Analyze with AI'}
            </Button>

            {/* Progress bar */}
            {loading && (
              <Box>
                <Box display="flex" justifyContent="space-between" mb={0.75}>
                  <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600 }}>
                    Extracting clinical insights…
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#2563EB', fontWeight: 700 }}>
                    {Math.round(progress)}%
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={progress}
                  sx={{
                    borderRadius: 99,
                    height: 6,
                    backgroundColor: '#E2E8F0',
                    '& .MuiLinearProgress-bar': {
                      background: 'linear-gradient(90deg, #2563EB, #14B8A6)',
                      borderRadius: 99,
                    },
                  }}
                />
              </Box>
            )}

            {/* Save status */}
            {result && user?.id && (
              <Alert
                severity={savedToCloud ? 'success' : 'info'}
                icon={savedToCloud ? <Save /> : <Folder />}
                sx={{ borderRadius: '14px' }}
                action={
                  !savedToCloud ? (
                    <Button
                      size="small"
                      onClick={() => handleSave()}
                      disabled={saving}
                      sx={{ fontWeight: 700, color: '#2563EB' }}
                    >
                      {saving ? 'Saving…' : 'Save Now'}
                    </Button>
                  ) : (
                    <Button
                      size="small"
                      onClick={() => navigate(`/dashboard/${user.role?.toLowerCase()}`)}
                      endIcon={<ArrowForward />}
                      sx={{ fontWeight: 700 }}
                    >
                      View Records
                    </Button>
                  )
                }
              >
                {savedToCloud
                  ? 'Report saved to your health records'
                  : 'This report has not been saved yet'}
              </Alert>
            )}

            {/* Info box */}
            <Paper
              elevation={0}
              sx={{ p: 2.5, borderRadius: '16px', backgroundColor: 'rgba(37,99,235,0.04)', border: '1px solid rgba(37,99,235,0.1)' }}
            >
              <Box display="flex" gap={1.5} alignItems="flex-start">
                <InfoOutlined sx={{ color: '#2563EB', fontSize: 20, mt: 0.2, flexShrink: 0 }} />
                <Typography variant="caption" sx={{ color: '#475569', lineHeight: 1.7 }}>
                  Your report is processed securely and saved to your personal health record in Firebase.
                  Analysis is performed using Google Gemini AI. This tool is for
                  informational purposes only — always consult a qualified healthcare provider.
                </Typography>
              </Box>
            </Paper>
          </Box>

          {/* ── Right: Results Panel ───────────────────────────────────────── */}
          {result && (
            <Box display="flex" flexDirection="column" gap={3}>

              {/* Urgency Banner */}
              {urgency && (
                <Paper
                  elevation={0}
                  sx={{
                    p: 2.5,
                    borderRadius: '20px',
                    backgroundColor: urgency.bg,
                    border: `1px solid ${urgency.color}30`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                  }}
                >
                  <Box sx={{ color: urgency.color }}>{urgency.icon}</Box>
                  <Box flex={1}>
                    <Typography variant="caption" sx={{ color: urgency.color, fontWeight: 800, display: 'block' }}>
                      URGENCY LEVEL
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 800, color: urgency.color, lineHeight: 1.2 }}>
                      {urgency.label}
                    </Typography>
                  </Box>
                  <Chip
                    label={result.urgencyLevel}
                    sx={{
                      backgroundColor: urgency.color,
                      color: '#FFFFFF',
                      fontWeight: 800,
                      borderRadius: '999px',
                    }}
                  />
                </Paper>
              )}

              {/* Overview */}
              <SectionCard title="REPORT OVERVIEW" accent="#2563EB">
                <Typography variant="body1" sx={{ color: '#1E293B', lineHeight: 1.75 }}>
                  {result.overview}
                </Typography>
              </SectionCard>

              {/* Key Findings */}
              {result.keyFindings.length > 0 && (
                <SectionCard title="KEY FINDINGS" accent="#8B5CF6">
                  <Box display="flex" flexDirection="column" gap={1.5}>
                    {result.keyFindings.map((f, i) => (
                      <Box key={i} display="flex" gap={1.5} alignItems="flex-start">
                        <Box
                          sx={{
                            minWidth: 24,
                            height: 24,
                            borderRadius: '50%',
                            backgroundColor: 'rgba(139,92,246,0.12)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            mt: 0.2,
                          }}
                        >
                          <Typography variant="caption" sx={{ color: '#8B5CF6', fontWeight: 800 }}>
                            {i + 1}
                          </Typography>
                        </Box>
                        <Typography variant="body2" sx={{ color: '#334155', lineHeight: 1.65 }}>
                          {f}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </SectionCard>
              )}

              {/* Abnormal Values */}
              {result.abnormalValues.length > 0 && (
                <SectionCard title="ABNORMAL / NOTABLE VALUES" accent="#EF4444">
                  <Box display="flex" flexDirection="column" gap={2}>
                    {result.abnormalValues.map((v, i) => (
                      <Box
                        key={i}
                        sx={{
                          p: 2,
                          borderRadius: '14px',
                          backgroundColor: 'rgba(239,68,68,0.04)',
                          border: '1px solid rgba(239,68,68,0.12)',
                        }}
                      >
                        <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.5}>
                          <Typography variant="body2" sx={{ fontWeight: 700, color: '#0F172A' }}>
                            {v.parameter}
                          </Typography>
                          <Chip
                            label={v.value}
                            size="small"
                            sx={{
                              backgroundColor: 'rgba(239,68,68,0.1)',
                              color: '#EF4444',
                              fontWeight: 800,
                              fontSize: '0.75rem',
                            }}
                          />
                        </Box>
                        <Typography variant="caption" sx={{ color: '#64748B' }}>
                          {v.note}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </SectionCard>
              )}

              {/* Recommendations */}
              {result.recommendations.length > 0 && (
                <SectionCard title="RECOMMENDATIONS" accent="#14B8A6">
                  <Box display="flex" flexDirection="column" gap={1.5}>
                    {result.recommendations.map((r, i) => (
                      <Box key={i} display="flex" gap={1.5} alignItems="flex-start">
                        <CheckCircle sx={{ color: '#14B8A6', fontSize: 18, mt: 0.25, flexShrink: 0 }} />
                        <Typography variant="body2" sx={{ color: '#334155', lineHeight: 1.65 }}>
                          {r}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </SectionCard>
              )}

              {/* Disclaimer */}
              <Alert
                severity="info"
                icon={<InfoOutlined />}
                sx={{
                  borderRadius: '16px',
                  backgroundColor: 'rgba(37,99,235,0.05)',
                  border: '1px solid rgba(37,99,235,0.12)',
                  '& .MuiAlert-message': { color: '#475569', fontSize: '0.8rem', lineHeight: 1.6 },
                }}
              >
                {result.disclaimer}
              </Alert>

              {/* Analyze another */}
              <Button
                variant="outlined"
                onClick={clearFile}
                startIcon={<CloudUpload />}
                sx={{
                  borderRadius: '999px',
                  py: 1.4,
                  borderColor: '#2563EB',
                  color: '#2563EB',
                  fontWeight: 700,
                  '&:hover': { backgroundColor: 'rgba(37,99,235,0.06)' },
                }}
              >
                Analyze Another Report
              </Button>
            </Box>
          )}
        </Box>
      </Container>

      {/* Snackbar */}
      <Snackbar
        open={snackOpen}
        autoHideDuration={5000}
        onClose={() => setSnackOpen(false)}
        message={snackMsg}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  );
};
