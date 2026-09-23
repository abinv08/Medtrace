import React, { useState, useEffect, useRef } from 'react';
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
  Alert,
  Snackbar,
  Stack,
} from '@mui/material';
import {
  Science,
  UploadFile,
  Add,
  DeleteOutline,
  ExpandMore,
  Description,
  Download,
  CloudUpload,
  Close,
  PictureAsPdf,
  Image as ImageIcon,
  InsertDriveFile,
  CheckCircleOutline,
} from '@mui/icons-material';
import {
  TestResult,
  TestBiomarker,
  fetchPatientTestResults,
  uploadTestResult,
  downloadTestResultFile,
  parseTestResultDetails,
} from '../services/testResultService';

interface TestResultsManagerProps {
  patientId: string;
}

const CATEGORIES = [
  'Blood Chemistry',
  'Lipid Panel',
  'Endocrine / Glucose',
  'Renal & Kidney',
  'Liver Function',
  'Complete Blood Count (CBC)',
  'Cardiology / ECG',
  'Radiology / Imaging',
  'Urinalysis',
  'Pathology / Biopsy',
  'Other',
];

export const TestResultsManager: React.FC<TestResultsManagerProps> = ({ patientId }) => {
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [openModal, setOpenModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // File Upload State
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Form State
  const [testName, setTestName] = useState('Comprehensive Metabolic Panel (CMP)');
  const [category, setCategory] = useState<string>('Blood Chemistry');
  const [labName, setLabName] = useState('MedTrace Central Pathology Lab');
  const [summary, setSummary] = useState('');
  const [showBiomarkers, setShowBiomarkers] = useState(false);
  const [biomarkers, setBiomarkers] = useState<TestBiomarker[]>([
    { name: 'Fasting Blood Glucose', value: 98, unit: 'mg/dL', referenceRange: '70 - 99', status: 'normal' },
    { name: 'Serum Creatinine', value: 0.92, unit: 'mg/dL', referenceRange: '0.7 - 1.3', status: 'normal' },
    { name: 'Total Cholesterol', value: 195, unit: 'mg/dL', referenceRange: '< 200', status: 'normal' },
  ]);

  const loadData = async () => {
    if (!patientId) return;
    setLoading(true);
    try {
      const data = await fetchPatientTestResults(patientId);
      setTestResults(data);
    } catch (err: any) {
      console.error('Error fetching test results:', err);
      setErrorMessage(err.response?.data?.message || 'Failed to fetch test results from server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [patientId]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setSelectedFile(e.dataTransfer.files[0]);
    }
  };

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

  const resetForm = () => {
    setSelectedFile(null);
    setTestName('Comprehensive Metabolic Panel (CMP)');
    setCategory('Blood Chemistry');
    setLabName('MedTrace Central Pathology Lab');
    setSummary('');
    setShowBiomarkers(false);
    setBiomarkers([
      { name: 'Fasting Blood Glucose', value: 98, unit: 'mg/dL', referenceRange: '70 - 99', status: 'normal' },
      { name: 'Serum Creatinine', value: 0.92, unit: 'mg/dL', referenceRange: '0.7 - 1.3', status: 'normal' },
      { name: 'Total Cholesterol', value: 195, unit: 'mg/dL', referenceRange: '< 200', status: 'normal' },
    ]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSaveTest = async () => {
    if (!selectedFile) {
      setErrorMessage('Please select a laboratory test file to upload.');
      return;
    }
    if (!patientId) {
      setErrorMessage('Invalid patient identifier.');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('patientId', patientId);
      formData.append('category', category);

      // Package test metadata into notes
      let compiledNotes = summary.trim();
      if (testName.trim()) {
        compiledNotes = `[${testName.trim()}] ${compiledNotes}`;
      }
      if (labName.trim()) {
        compiledNotes += ` | Lab: ${labName.trim()}`;
      }
      if (showBiomarkers && biomarkers.length > 0) {
        compiledNotes += ` | Biomarkers: ${JSON.stringify(biomarkers)}`;
      }
      formData.append('notes', compiledNotes);

      await uploadTestResult(formData);

      setSuccessMessage(`Test result "${selectedFile.name}" uploaded successfully!`);
      setOpenModal(false);
      resetForm();
      await loadData();
    } catch (err: any) {
      console.error('Upload test result error:', err);
      setErrorMessage(err.response?.data?.message || 'Failed to upload test result to server.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownload = async (test: TestResult) => {
    const identifier = test._id || test.id || (test.fileUrl ? test.fileUrl.split('/').pop() : '');
    if (!identifier) {
      setErrorMessage('File reference not available for download.');
      return;
    }

    const preferredName = test.fileUrl ? test.fileUrl.split('/').pop() : `test-result-${identifier}.pdf`;
    setDownloadingId(identifier);

    try {
      await downloadTestResultFile(identifier, preferredName);
    } catch (err: any) {
      console.error('Download error:', err);
      // Fallback attempt: if identifier was an ObjectId and server expects filename, or vice versa
      if (test.fileUrl) {
        const fallbackFilename = test.fileUrl.split('/').pop();
        if (fallbackFilename && fallbackFilename !== identifier) {
          try {
            await downloadTestResultFile(fallbackFilename, preferredName);
            return;
          } catch (secondErr) {
            console.error('Fallback download failed:', secondErr);
          }
        }
      }
      setErrorMessage(err.response?.data?.message || 'Failed to download test report file.');
    } finally {
      setDownloadingId(null);
    }
  };

  const formatFileSize = (bytes?: number | string) => {
    if (!bytes) return '';
    const num = typeof bytes === 'string' ? parseFloat(bytes) : bytes;
    if (isNaN(num)) return typeof bytes === 'string' ? bytes : '';
    if (num < 1024) return `${num} B`;
    if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`;
    return `${(num / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (fileUrl?: string, fileType?: string) => {
    const ext = (fileUrl || '').split('.').pop()?.toLowerCase() || (fileType || '').toLowerCase();
    if (ext === 'pdf') {
      return <PictureAsPdf sx={{ color: '#DC2626', fontSize: 24 }} />;
    }
    if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) {
      return <ImageIcon sx={{ color: '#0284C7', fontSize: 24 }} />;
    }
    return <InsertDriveFile sx={{ color: '#00838F', fontSize: 24 }} />;
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

  // Filter test results by category if selected
  const filteredResults = testResults.filter((test) => {
    if (categoryFilter === 'All') return true;
    return (test.category || '').toLowerCase() === categoryFilter.toLowerCase();
  });

  return (
    <Box display="flex" flexDirection="column" gap={3}>
      {/* ── Top Header ───────────────────────────────────────────────────────── */}
      <Paper elevation={0} sx={{ p: 3, borderRadius: '20px', border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF' }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2}>
          <Box display="flex" alignItems="center" gap={1.5}>
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: '12px',
                backgroundColor: '#E0F7FA',
                color: '#00838F',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Science sx={{ fontSize: 28 }} />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 800, color: '#1E293B' }}>
                Diagnostic & Lab Test Results
              </Typography>
              <Typography variant="caption" sx={{ color: '#64748B' }}>
                Uploaded clinical reports, laboratory analyte logs, and official pathology documents
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
              px: 2.5,
              py: 1,
              boxShadow: '0 4px 14px rgba(0, 131, 143, 0.25)',
              '&:hover': { backgroundColor: '#006064' },
            }}
          >
            Upload Test Result
          </Button>
        </Box>

        {/* ── Category Filter Pills ────────────────────────────────────────── */}
        <Box display="flex" alignItems="center" gap={1} mt={2.5} flexWrap="wrap">
          <Typography variant="caption" sx={{ color: '#94A3B8', fontWeight: 700, mr: 1, textTransform: 'uppercase' }}>
            Filter:
          </Typography>
          {['All', 'Blood Chemistry', 'Lipid Panel', 'CBC', 'Cardiology', 'Radiology'].map((cat) => {
            const isSelected =
              categoryFilter === cat ||
              (cat === 'CBC' && categoryFilter === 'Complete Blood Count (CBC)') ||
              (cat === 'Cardiology' && categoryFilter === 'Cardiology / ECG') ||
              (cat === 'Radiology' && categoryFilter === 'Radiology / Imaging');
            return (
              <Chip
                key={cat}
                label={cat}
                clickable
                onClick={() => {
                  if (cat === 'CBC') setCategoryFilter(isSelected ? 'All' : 'Complete Blood Count (CBC)');
                  else if (cat === 'Cardiology') setCategoryFilter(isSelected ? 'All' : 'Cardiology / ECG');
                  else if (cat === 'Radiology') setCategoryFilter(isSelected ? 'All' : 'Radiology / Imaging');
                  else setCategoryFilter(isSelected && cat !== 'All' ? 'All' : cat);
                }}
                size="small"
                sx={{
                  fontWeight: 700,
                  fontSize: '0.72rem',
                  backgroundColor: isSelected ? '#00838F' : '#F1F5F9',
                  color: isSelected ? '#FFFFFF' : '#475569',
                  '&:hover': { backgroundColor: isSelected ? '#006064' : '#E2E8F0' },
                }}
              />
            );
          })}
        </Box>
      </Paper>

      {/* ── Test List ────────────────────────────────────────────────────────── */}
      {loading ? (
        <Box display="flex" justifyContent="center" py={8}>
          <CircularProgress sx={{ color: '#00838F' }} />
        </Box>
      ) : filteredResults.length === 0 ? (
        <Paper
          elevation={0}
          sx={{
            p: 6,
            borderRadius: '16px',
            border: '1px dashed #CBD5E1',
            textAlign: 'center',
            color: '#64748B',
            backgroundColor: '#FAFAFA',
          }}
        >
          <Science sx={{ fontSize: 54, color: '#00838F', opacity: 0.3, mb: 1.5 }} />
          <Typography variant="h6" sx={{ fontWeight: 700, color: '#1E293B' }}>
            No Lab Test Results Found
          </Typography>
          <Typography variant="body2" sx={{ color: '#94A3B8', mt: 0.5, mb: 3, maxWidth: 460, mx: 'auto' }}>
            {categoryFilter !== 'All'
              ? `No tests recorded under "${categoryFilter}". Clear the filter or upload a new test result.`
              : 'Upload patient diagnostic files (PDFs, images, laboratory analyte reports) to attach them to this clinical profile.'}
          </Typography>
          <Button
            variant="outlined"
            startIcon={<UploadFile />}
            onClick={() => setOpenModal(true)}
            sx={{
              borderRadius: '999px',
              color: '#00838F',
              borderColor: '#00838F',
              fontWeight: 700,
              textTransform: 'none',
              '&:hover': { borderColor: '#006064', backgroundColor: 'rgba(0, 131, 143, 0.04)' },
            }}
          >
            Upload First Test Result
          </Button>
        </Paper>
      ) : (
        <Box display="flex" flexDirection="column" gap={2}>
          {filteredResults.map((test) => {
            const parsed = parseTestResultDetails(test);
            const rawFileName = test.fileUrl ? test.fileUrl.split('/').pop() : 'Report Document';
            const uploadDate = test.uploadDate || test.createdAt;
            const formattedDate = uploadDate ? new Date(uploadDate).toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            }) : 'Recent';

            const testIdentifier = test._id || test.id || rawFileName;
            const isDownloading = downloadingId === testIdentifier;

            const uploaderInfo =
              typeof test.uploadedBy === 'object' && test.uploadedBy !== null
                ? test.uploadedBy.name || test.uploadedBy.email
                : undefined;

            return (
              <Accordion
                key={test._id || test.id || rawFileName}
                elevation={0}
                defaultExpanded={false}
                sx={{
                  borderRadius: '16px !important',
                  border: '1px solid #E2E8F0',
                  backgroundColor: '#FFFFFF',
                  '&:before': { display: 'none' },
                  overflow: 'hidden',
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': { borderColor: '#CBD5E1', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' },
                }}
              >
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Box display="flex" justifyContent="space-between" alignItems="center" width="100%" pr={2} flexWrap="wrap" gap={1.5}>
                    <Box display="flex" alignItems="center" gap={1.8}>
                      <Box
                        sx={{
                          width: 44,
                          height: 44,
                          borderRadius: '12px',
                          backgroundColor: '#F8FAFC',
                          border: '1px solid #E2E8F0',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {getFileIcon(test.fileUrl, test.fileType)}
                      </Box>
                      <Box>
                        <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#1E293B', fontSize: '0.95rem' }}>
                          {parsed.title}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#64748B', display: 'flex', alignItems: 'center', gap: 0.8 }}>
                          <span>{parsed.labName}</span>
                          <span>•</span>
                          <span>{formattedDate}</span>
                          {uploaderInfo && (
                            <>
                              <span>•</span>
                              <span>By {uploaderInfo}</span>
                            </>
                          )}
                        </Typography>
                      </Box>
                    </Box>

                    <Box display="flex" alignItems="center" gap={1.5}>
                      <Chip
                        label={test.category || 'General'}
                        size="small"
                        sx={{ backgroundColor: '#F1F5F9', color: '#334155', fontSize: '0.72rem', fontWeight: 700 }}
                      />

                      {test.status === 'requested' && (
                        <Chip
                          label="PENDING"
                          size="small"
                          color="warning"
                          sx={{ fontSize: '0.72rem', fontWeight: 800 }}
                        />
                      )}

                      {test.status !== 'requested' && test.fileUrl && <Button
                        variant="contained"
                        size="small"
                        startIcon={isDownloading ? <CircularProgress size={14} color="inherit" /> : <Download />}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownload(test);
                        }}
                        disabled={isDownloading}
                        sx={{
                          borderRadius: '8px',
                          backgroundColor: '#00838F',
                          color: '#FFFFFF',
                          fontWeight: 700,
                          fontSize: '0.75rem',
                          textTransform: 'none',
                          py: 0.6,
                          px: 1.8,
                          '&:hover': { backgroundColor: '#006064' },
                        }}
                      >
                        {isDownloading ? 'Downloading...' : 'Download'}
                      </Button>}
                    </Box>
                  </Box>
                </AccordionSummary>

                <AccordionDetails sx={{ pt: 0, px: 3, pb: 3 }}>
                  {parsed.summary && (
                    <Box sx={{ mb: 2, p: 2, borderRadius: '10px', backgroundColor: '#F8FAFC', border: '1px solid #EDF2F7' }}>
                      <Typography variant="caption" sx={{ fontWeight: 800, color: '#475569', textTransform: 'uppercase', display: 'block', mb: 0.5 }}>
                        Clinical Notes & Observations
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#334155', fontSize: '0.85rem', whiteSpace: 'pre-line' }}>
                        {parsed.summary}
                      </Typography>
                    </Box>
                  )}

                  {/* Biomarkers Table if structured analytes were logged */}
                  {parsed.biomarkers.length > 0 && (
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
                          {parsed.biomarkers.map((b, idx) => (
                            <TableRow key={idx} hover sx={{ '& td': { py: 1, fontSize: '0.8rem' } }}>
                              <TableCell sx={{ fontWeight: 700, color: '#1E293B' }}>{b.name}</TableCell>
                              <TableCell
                                sx={{
                                  fontWeight: 800,
                                  color: b.status === 'high' || b.status === 'critical' ? '#DC2626' : b.status === 'low' ? '#D97706' : '#1E293B',
                                }}
                              >
                                {b.value} {b.unit}
                              </TableCell>
                              <TableCell sx={{ color: '#64748B', fontFamily: 'monospace' }}>
                                {b.referenceRange} {b.unit}
                              </TableCell>
                              <TableCell>{biomarkerChip(b.status)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}

                  {/* File Metadata & Download Action Footer */}
                  <Box
                    display="flex"
                    justifyContent="space-between"
                    alignItems="center"
                    p={1.5}
                    sx={{ backgroundColor: '#F1F5F9', borderRadius: '10px' }}
                  >
                    <Box display="flex" alignItems="center" gap={1.2}>
                      <Description sx={{ fontSize: 18, color: '#64748B' }} />
                      <Typography variant="caption" sx={{ color: '#334155', fontWeight: 600 }}>
                        {rawFileName}
                      </Typography>
                      {test.fileType && (
                        <Chip
                          label={test.fileType.toUpperCase()}
                          size="small"
                          sx={{ height: 18, fontSize: '0.62rem', fontWeight: 800, backgroundColor: '#E2E8F0', color: '#475569' }}
                        />
                      )}
                    </Box>

                    {test.status !== 'requested' && test.fileUrl && <Button
                      size="small"
                      startIcon={isDownloading ? <CircularProgress size={12} color="inherit" /> : <Download />}
                      onClick={() => handleDownload(test)}
                      disabled={isDownloading}
                      sx={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color: '#00838F',
                        textTransform: 'none',
                        '&:hover': { backgroundColor: 'rgba(0,131,143,0.08)' },
                      }}
                    >
                      {isDownloading ? 'Downloading...' : 'Download File'}
                    </Button>}
                  </Box>
                </AccordionDetails>
              </Accordion>
            );
          })}
        </Box>
      )}

      {/* ── Add Test Result Dialog ───────────────────────────────────────────── */}
      <Dialog open={openModal} onClose={() => !submitting && setOpenModal(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, color: '#1E293B', pb: 1 }}>
          Upload Laboratory Test Result
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: '#64748B', mb: 2.5 }}>
            Attach diagnostic reports (PDF, PNG, JPG, DICOM) and record clinical metadata for patient ID: <strong>{patientId}</strong>
          </Typography>

          <Grid container spacing={2}>
            {/* Real File Input Dropzone */}
            <Grid item xs={12}>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".pdf,.png,.jpg,.jpeg,.dcm,.txt,.doc,.docx"
                style={{ display: 'none' }}
                id="test-result-file-input"
              />
              <Box
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                sx={{
                  border: isDragOver ? '2px dashed #00838F' : selectedFile ? '2px solid #10B981' : '2px dashed #CBD5E1',
                  borderRadius: '12px',
                  p: 3,
                  textAlign: 'center',
                  backgroundColor: isDragOver ? '#E0F7FA' : selectedFile ? '#F0FDF4' : '#F8FAFC',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    borderColor: selectedFile ? '#10B981' : '#00838F',
                    backgroundColor: selectedFile ? '#F0FDF4' : '#F0FDF4',
                  },
                }}
              >
                {selectedFile ? (
                  <Box display="flex" alignItems="center" justifyContent="center" gap={1.5} flexWrap="wrap">
                    <CheckCircleOutline sx={{ color: '#10B981', fontSize: 32 }} />
                    <Box textAlign="left">
                      <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#1E293B' }}>
                        {selectedFile.name}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#64748B' }}>
                        {formatFileSize(selectedFile.size)} • {selectedFile.type || 'Document'}
                      </Typography>
                    </Box>
                    <Button
                      size="small"
                      color="primary"
                      variant="outlined"
                      sx={{ ml: 2, borderRadius: '999px', fontSize: '0.72rem', textTransform: 'none' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        fileInputRef.current?.click();
                      }}
                    >
                      Change File
                    </Button>
                  </Box>
                ) : (
                  <Box>
                    <CloudUpload sx={{ fontSize: 40, color: '#00838F', mb: 1 }} />
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#1E293B' }}>
                      Click or drag & drop laboratory document here
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#94A3B8' }}>
                      Supported formats: PDF, PNG, JPG, JPEG, DICOM (Max: 25 MB)
                    </Typography>
                  </Box>
                )}
              </Box>
            </Grid>

            <Grid item xs={12} sm={8}>
              <TextField
                label="Test / Report Title"
                fullWidth
                value={testName}
                onChange={(e) => setTestName(e.target.value)}
                size="small"
                required
                placeholder="e.g. Comprehensive Metabolic Panel (CMP)"
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
                required
              >
                {CATEGORIES.map((cat) => (
                  <MenuItem key={cat} value={cat}>
                    {cat}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            <Grid item xs={12} sm={12}>
              <TextField
                label="Diagnostic Laboratory"
                fullWidth
                value={labName}
                onChange={(e) => setLabName(e.target.value)}
                size="small"
                placeholder="e.g. MedTrace Central Pathology Lab"
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                label="Clinical Impressions & Notes"
                fullWidth
                multiline
                rows={2}
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="e.g. Fasting glucose is slightly elevated. Renal parameters are normal."
                size="small"
              />
            </Grid>

            {/* Optional Structured Biomarkers Accordion */}
            <Grid item xs={12}>
              <Box display="flex" justifyContent="space-between" alignItems="center" mt={1} mb={1}>
                <Typography variant="caption" sx={{ fontWeight: 800, color: '#64748B', textTransform: 'uppercase' }}>
                  Biomarker Parameters (Optional)
                </Typography>
                <Button
                  size="small"
                  onClick={() => setShowBiomarkers(!showBiomarkers)}
                  sx={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'none' }}
                >
                  {showBiomarkers ? 'Hide Analytes' : 'Log Structured Analytes'}
                </Button>
              </Box>

              {showBiomarkers && (
                <Box sx={{ p: 2, borderRadius: '10px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                  <Box display="flex" justifyContent="flex-end" mb={1.5}>
                    <Button size="small" startIcon={<Add />} onClick={handleAddBiomarkerRow} sx={{ fontSize: '0.72rem', fontWeight: 700 }}>
                      Add Analyte
                    </Button>
                  </Box>

                  {biomarkers.map((bm, idx) => (
                    <Grid container spacing={1} key={idx} alignItems="center" sx={{ mb: 1 }}>
                      <Grid item xs={4}>
                        <TextField
                          label="Analyte"
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
                </Box>
              )}
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setOpenModal(false)} disabled={submitting} sx={{ borderRadius: '999px', fontWeight: 600 }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveTest}
            disabled={submitting || !selectedFile}
            sx={{
              borderRadius: '999px',
              backgroundColor: '#00838F',
              fontWeight: 700,
              px: 3,
              '&:hover': { backgroundColor: '#006064' },
            }}
          >
            {submitting ? (
              <Stack direction="row" spacing={1} alignItems="center">
                <CircularProgress size={18} color="inherit" />
                <span>Uploading...</span>
              </Stack>
            ) : (
              'Upload Test Result'
            )}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Notification Feedback Snackbars ─────────────────────────────────── */}
      <Snackbar
        open={Boolean(errorMessage)}
        autoHideDuration={6000}
        onClose={() => setErrorMessage(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity="error" onClose={() => setErrorMessage(null)} sx={{ width: '100%' }}>
          {errorMessage}
        </Alert>
      </Snackbar>

      <Snackbar
        open={Boolean(successMessage)}
        autoHideDuration={5000}
        onClose={() => setSuccessMessage(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity="success" onClose={() => setSuccessMessage(null)} sx={{ width: '100%' }}>
          {successMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
};
export default TestResultsManager;
