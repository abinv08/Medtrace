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
  IconButton,
  Tooltip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import {
  Science,
  UploadFile,
  Add,
  DeleteOutline,
  ExpandMore,
  CheckCircle,
  WarningAmber,
  Description,
  LocalHospital,
} from '@mui/icons-material';
import {
  TestResult,
  TestBiomarker,
  fetchPatientTestResults,
  addTestResult,
  deleteTestResult,
} from '../services/testResultService';

interface TestResultsManagerProps {
  patientId: string;
}

export const TestResultsManager: React.FC<TestResultsManagerProps> = ({ patientId }) => {
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [openModal, setOpenModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [testName, setTestName] = useState('Comprehensive Metabolic Panel (CMP)');
  const [category, setCategory] = useState<TestResult['category']>('Blood Chemistry');
  const [labName, setLabName] = useState('MedTrace Central Pathology Lab');
  const [doctorName, setDoctorName] = useState('Dr. Alexander Wright');
  const [testDate, setTestDate] = useState(new Date().toISOString().split('T')[0]);
  const [summary, setSummary] = useState('');
  const [fileName, setFileName] = useState('Lab_Report_2026.pdf');
  const [biomarkers, setBiomarkers] = useState<TestBiomarker[]>([
    { name: 'Fasting Blood Glucose', value: 98, unit: 'mg/dL', referenceRange: '70 - 99', status: 'normal' },
    { name: 'Serum Creatinine', value: 0.92, unit: 'mg/dL', referenceRange: '0.7 - 1.3', status: 'normal' },
    { name: 'Total Cholesterol', value: 195, unit: 'mg/dL', referenceRange: '< 200', status: 'normal' },
  ]);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchPatientTestResults(patientId);
      setTestResults(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [patientId]);

  const handleAddBiomarkerRow = () => {
    setBiomarkers([
      ...biomarkers,
      { name: 'New Parameter', value: 100, unit: 'mg/dL', referenceRange: '70 - 120', status: 'normal' },
    ]);
  };

  const handleBiomarkerChange = (idx: number, field: keyof TestBiomarker, val: any) => {
    const updated = [...biomarkers];
    updated[idx] = { ...updated[idx], [field]: val };
    setBiomarkers(updated);
  };

  const handleRemoveBiomarker = (idx: number) => {
    setBiomarkers(biomarkers.filter((_, i) => i !== idx));
  };

  const handleSaveTest = async () => {
    if (!testName.trim()) return;
    setSubmitting(true);
    try {
      const hasAbnormal = biomarkers.some((b) => b.status === 'high' || b.status === 'low' || b.status === 'critical');
      await addTestResult({
        patientId,
        testName: testName.trim(),
        category,
        labName: labName.trim(),
        doctorName: doctorName.trim(),
        testDate,
        summary: summary.trim() || 'Laboratory test completed and verified.',
        fileName,
        fileSize: '1.2 MB',
        status: hasAbnormal ? 'abnormal_flagged' : 'final',
        biomarkers,
      });
      setOpenModal(false);
      await loadData();
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    await deleteTestResult(id, patientId);
    await loadData();
  };

  const biomarkerChip = (status: TestBiomarker['status']) => {
    const map = {
      normal: { bg: '#ECFDF5', color: '#059669', label: 'NORMAL' },
      high: { bg: '#FEF2F2', color: '#DC2626', label: 'HIGH' },
      low: { bg: '#FFFBEB', color: '#D97706', label: 'LOW' },
      critical: { bg: '#7F1D1D', color: '#FFFFFF', label: 'CRITICAL' },
    }[status] || { bg: '#F1F5F9', color: '#64748B', label: status.toUpperCase() };

    return (
      <Chip
        label={map.label}
        size="small"
        sx={{ backgroundColor: map.bg, color: map.color, fontWeight: 800, fontSize: '0.62rem', height: 20 }}
      />
    );
  };

  return (
    <Box display="flex" flexDirection="column" gap={3}>
      {/* ── Top Header ───────────────────────────────────────────────────────── */}
      <Paper elevation={0} sx={{ p: 3, borderRadius: '20px', border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF' }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2}>
          <Box display="flex" alignItems="center" gap={1.5}>
            <Science sx={{ color: '#00838F', fontSize: 28 }} />
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 800, color: '#1E293B' }}>
                Diagnostic & Lab Test Results
              </Typography>
              <Typography variant="caption" sx={{ color: '#64748B' }}>
                Structured clinical biomarker logs & pathology report repository
              </Typography>
            </Box>
          </Box>

          <Button
            variant="contained"
            size="small"
            startIcon={<UploadFile />}
            onClick={() => setOpenModal(true)}
            sx={{
              borderRadius: '999px',
              backgroundColor: '#00838F',
              fontWeight: 700,
              fontSize: '0.8rem',
              '&:hover': { backgroundColor: '#006064' },
            }}
          >
            Upload Test Result
          </Button>
        </Box>
      </Paper>

      {/* ── Test List ────────────────────────────────────────────────────────── */}
      {loading ? (
        <Box display="flex" justifyContent="center" py={6}><CircularProgress sx={{ color: '#00838F' }} /></Box>
      ) : testResults.length === 0 ? (
        <Paper elevation={0} sx={{ p: 5, borderRadius: '16px', border: '1px solid #E2E8F0', textAlign: 'center', color: '#64748B' }}>
          <Science sx={{ fontSize: 48, opacity: 0.3, mb: 1 }} />
          <Typography variant="body1" sx={{ fontWeight: 700 }}>No Lab Tests Uploaded Yet</Typography>
          <Typography variant="body2" sx={{ color: '#94A3B8', mt: 0.5 }}>
            Click "Upload Test Result" to record laboratory reports and biomarker values.
          </Typography>
        </Paper>
      ) : (
        <Box display="flex" flexDirection="column" gap={2}>
          {testResults.map((test) => (
            <Accordion
              key={test.id}
              elevation={0}
              defaultExpanded={false}
              sx={{
                borderRadius: '16px !important',
                border: '1px solid #E2E8F0',
                backgroundColor: '#FFFFFF',
                '&:before': { display: 'none' },
                overflow: 'hidden',
              }}
            >
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Box display="flex" justifyContent="space-between" alignItems="center" width="100%" pr={2} flexWrap="wrap" gap={1}>
                  <Box display="flex" alignItems="center" gap={1.5}>
                    <Box
                      sx={{
                        width: 40,
                        height: 40,
                        borderRadius: '10px',
                        backgroundColor: '#E0F7FA',
                        color: '#00838F',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Science sx={{ fontSize: 22 }} />
                    </Box>
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#1E293B' }}>
                        {test.testName}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#64748B' }}>
                        {test.labName} · {test.testDate}
                      </Typography>
                    </Box>
                  </Box>

                  <Box display="flex" alignItems="center" gap={1}>
                    <Chip label={test.category} size="small" sx={{ backgroundColor: '#F1F5F9', fontSize: '0.7rem', fontWeight: 600 }} />
                    {test.status === 'abnormal_flagged' ? (
                      <Chip label="FLAGGED ABNORMAL" size="small" sx={{ backgroundColor: '#FEF2F2', color: '#DC2626', fontWeight: 800, fontSize: '0.65rem' }} />
                    ) : (
                      <Chip label="VERIFIED" size="small" sx={{ backgroundColor: '#ECFDF5', color: '#059669', fontWeight: 800, fontSize: '0.65rem' }} />
                    )}
                  </Box>
                </Box>
              </AccordionSummary>

              <AccordionDetails sx={{ pt: 0, px: 3, pb: 3 }}>
                <Typography variant="body2" sx={{ color: '#475569', fontSize: '0.82rem', mb: 2, p: 1.5, borderRadius: '8px', backgroundColor: '#F8FAFC' }}>
                  <strong>Summary Findings:</strong> {test.summary}
                </Typography>

                {/* Biomarkers Table */}
                <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #E2E8F0', borderRadius: '10px', mb: 2 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ backgroundColor: '#F8FAFC', '& th': { fontWeight: 700, color: '#64748B', fontSize: '0.75rem' } }}>
                        <TableCell>Biomarker / Analyte</TableCell>
                        <TableCell>Observed Value</TableCell>
                        <TableCell>Reference Range</TableCell>
                        <TableCell>Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {test.biomarkers.map((b, idx) => (
                        <TableRow key={idx} hover sx={{ '& td': { py: 1, fontSize: '0.8rem' } }}>
                          <TableCell sx={{ fontWeight: 700, color: '#1E293B' }}>{b.name}</TableCell>
                          <TableCell sx={{ fontWeight: 800, color: b.status === 'high' || b.status === 'critical' ? '#DC2626' : b.status === 'low' ? '#D97706' : '#1E293B' }}>
                            {b.value} {b.unit}
                          </TableCell>
                          <TableCell sx={{ color: '#64748B', fontFamily: 'monospace' }}>{b.referenceRange} {b.unit}</TableCell>
                          <TableCell>{biomarkerChip(b.status)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>

                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Box display="flex" alignItems="center" gap={1}>
                    <Description sx={{ fontSize: 16, color: '#64748B' }} />
                    <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600 }}>
                      Attached File: {test.fileName || 'Report.pdf'} ({test.fileSize || '1.2 MB'})
                    </Typography>
                  </Box>

                  <Tooltip title="Delete Lab Report">
                    <IconButton size="small" onClick={() => handleDelete(test.id)} sx={{ color: '#94A3B8', '&:hover': { color: '#EF4444' } }}>
                      <DeleteOutline sx={{ fontSize: 18 }} />
                    </IconButton>
                  </Tooltip>
                </Box>
              </AccordionDetails>
            </Accordion>
          ))}
        </Box>
      )}

      {/* ── Add Test Result Dialog ───────────────────────────────────────────── */}
      <Dialog open={openModal} onClose={() => setOpenModal(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, color: '#1E293B' }}>Upload Laboratory Test Result</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: '#64748B', mb: 3 }}>
            Log diagnostic report information and structured biomarker parameters.
          </Typography>

          <Grid container spacing={2}>
            <Grid item xs={12} sm={8}>
              <TextField
                label="Test Name"
                fullWidth
                value={testName}
                onChange={(e) => setTestName(e.target.value)}
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
                <MenuItem value="Blood Chemistry">Blood Chemistry</MenuItem>
                <MenuItem value="Lipid Panel">Lipid Panel</MenuItem>
                <MenuItem value="Endocrine / Glucose">Endocrine / Glucose</MenuItem>
                <MenuItem value="Renal & Kidney">Renal & Kidney</MenuItem>
                <MenuItem value="Liver Function">Liver Function</MenuItem>
                <MenuItem value="Complete Blood Count (CBC)">Complete Blood Count (CBC)</MenuItem>
                <MenuItem value="Cardiology / ECG">Cardiology / ECG</MenuItem>
                <MenuItem value="Radiology / Imaging">Radiology / Imaging</MenuItem>
                <MenuItem value="Urinalysis">Urinalysis</MenuItem>
                <MenuItem value="Other">Other</MenuItem>
              </TextField>
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                label="Diagnostic Laboratory"
                fullWidth
                value={labName}
                onChange={(e) => setLabName(e.target.value)}
                size="small"
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                label="Test Date"
                type="date"
                fullWidth
                InputLabelProps={{ shrink: true }}
                value={testDate}
                onChange={(e) => setTestDate(e.target.value)}
                size="small"
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                label="Summary / Clinical Impressions"
                fullWidth
                multiline
                rows={2}
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="e.g. Fasting glucose is slightly elevated. Renal parameters are normal."
                size="small"
              />
            </Grid>

            {/* Biomarker Row Inputs */}
            <Grid item xs={12}>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.5}>
                <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#1E293B' }}>
                  Biomarker Parameter Values
                </Typography>
                <Button size="small" startIcon={<Add />} onClick={handleAddBiomarkerRow} sx={{ fontSize: '0.75rem', fontWeight: 700 }}>
                  Add Parameter
                </Button>
              </Box>

              {biomarkers.map((bm, idx) => (
                <Grid container spacing={1} key={idx} alignItems="center" sx={{ mb: 1 }}>
                  <Grid item xs={4}>
                    <TextField
                      label="Analyte Name"
                      fullWidth
                      size="small"
                      value={bm.name}
                      onChange={(e) => handleBiomarkerChange(idx, 'name', e.target.value)}
                    />
                  </Grid>
                  <Grid item xs={2}>
                    <TextField
                      label="Value"
                      fullWidth
                      size="small"
                      value={bm.value}
                      onChange={(e) => handleBiomarkerChange(idx, 'value', e.target.value)}
                    />
                  </Grid>
                  <Grid item xs={2}>
                    <TextField
                      label="Unit"
                      fullWidth
                      size="small"
                      value={bm.unit}
                      onChange={(e) => handleBiomarkerChange(idx, 'unit', e.target.value)}
                    />
                  </Grid>
                  <Grid item xs={3}>
                    <TextField
                      select
                      label="Status"
                      fullWidth
                      size="small"
                      value={bm.status}
                      onChange={(e) => handleBiomarkerChange(idx, 'status', e.target.value)}
                    >
                      <MenuItem value="normal">Normal</MenuItem>
                      <MenuItem value="high">High</MenuItem>
                      <MenuItem value="low">Low</MenuItem>
                      <MenuItem value="critical">Critical</MenuItem>
                    </TextField>
                  </Grid>
                  <Grid item xs={1}>
                    <IconButton size="small" onClick={() => handleRemoveBiomarker(idx)} color="error">
                      <DeleteOutline sx={{ fontSize: 18 }} />
                    </IconButton>
                  </Grid>
                </Grid>
              ))}
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setOpenModal(false)} sx={{ borderRadius: '999px', fontWeight: 600 }}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSaveTest}
            disabled={submitting || !testName.trim()}
            sx={{ borderRadius: '999px', backgroundColor: '#00838F', fontWeight: 700, px: 3 }}
          >
            {submitting ? <CircularProgress size={20} color="inherit" /> : 'Save Test Result'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
