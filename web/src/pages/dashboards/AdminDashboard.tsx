import React, { useState, useEffect } from 'react';
import {
  Box, Container, Typography, Paper, Button, Chip, Avatar,
  CircularProgress, Alert, Tabs, Tab, Divider, Dialog,
  DialogTitle, DialogContent, DialogActions, TextField,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
} from '@mui/material';
import {
  CheckCircle, Cancel, Person, MedicalServices, HowToReg,
  Logout, AdminPanelSettings, WarningAmber, Refresh,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { MedTraceLogo } from '../../components/Logo';
import { useAuth } from '../../contexts/AuthContext';
import {
  fetchPendingDoctors,
  fetchAllDoctors,
  approveDoctor,
  rejectDoctor,
  DoctorProfile,
} from '../../services/doctorService';
import { fetchAllPatients, PatientSearchResult } from '../../services/doctorService';

import { NotificationBell } from '../../components/NotificationBell';

const C = { primary: '#1565C0', teal: '#00838F', green: '#059669', red: '#DC2626', amber: '#D97706', slate: '#1E293B', muted: '#64748B', border: '#E2E8F0', bg: '#F0F4F8' };

const fmtDate = (val: any) => {
  if (!val) return '—';
  if (typeof val?.toDate === 'function') {
    try {
      return val.toDate().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      /* ignore */
    }
  }
  if (typeof val?.seconds === 'number') {
    return new Date(val.seconds * 1000).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return String(val);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return String(val);
  }
};

export const AdminDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(0);
  const [pending, setPending] = useState<DoctorProfile[]>([]);
  const [allDoctors, setAllDoctors] = useState<DoctorProfile[]>([]);
  const [allPatients, setAllPatients] = useState<PatientSearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [rejectDialog, setRejectDialog] = useState<{ open: boolean; doctorId: string; doctorName: string }>({ open: false, doctorId: '', doctorName: '' });
  const [rejectReason, setRejectReason] = useState('');

  const load = async () => {
    setLoading(true);
    const [pend, all, patients] = await Promise.all([
      fetchPendingDoctors(),
      fetchAllDoctors(),
      fetchAllPatients(),
    ]);
    setPending(pend);
    setAllDoctors(all);
    setAllPatients(patients);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleApprove = async (doctorId: string) => {
    if (!user?.id) return;
    setProcessing(doctorId);
    try {
      await approveDoctor(doctorId, user.id);
      await load();
    } finally {
      setProcessing(null);
    }
  };

  const openReject = (doctor: DoctorProfile) => {
    setRejectDialog({ open: true, doctorId: doctor.id, doctorName: doctor.name });
    setRejectReason('');
  };

  const handleReject = async () => {
    if (!user?.id || !rejectDialog.doctorId) return;
    setProcessing(rejectDialog.doctorId);
    try {
      await rejectDoctor(rejectDialog.doctorId, user.id, rejectReason);
      setRejectDialog({ open: false, doctorId: '', doctorName: '' });
      await load();
    } finally {
      setProcessing(null);
    }
  };

  const statusChip = (status: string) => {
    const config = {
      pending: { color: C.amber, bg: `${C.amber}12`, label: 'PENDING' },
      approved: { color: C.green, bg: `${C.green}12`, label: 'APPROVED' },
      rejected: { color: C.red, bg: `${C.red}12`, label: 'REJECTED' },
    }[status] || { color: C.muted, bg: `${C.muted}12`, label: (status || 'PENDING').toUpperCase() };
    return (
      <Chip label={config.label} size="small" sx={{ backgroundColor: config.bg, color: config.color, fontWeight: 800, fontSize: '0.65rem', height: 20, borderRadius: '4px' }} />
    );
  };

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: C.bg }}>
      {/* Header */}
      <Box sx={{ backgroundColor: '#fff', borderBottom: `1px solid ${C.border}`, py: 1.5, px: { xs: 2, sm: 4 }, display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
        <Box display="flex" alignItems="center" gap={2}>
          <MedTraceLogo variant="full" size="small" />
          <Chip label="ADMIN PANEL" size="small" sx={{ backgroundColor: C.red, color: '#fff', fontWeight: 800, fontSize: '0.68rem', borderRadius: '999px', height: 26 }} />
        </Box>
        <Box display="flex" alignItems="center" gap={2}>
          <NotificationBell userId={user?.id || 'default'} />
          <Typography variant="caption" sx={{ color: C.muted, fontWeight: 600, display: { xs: 'none', sm: 'block' } }}>
            {user?.name}
          </Typography>
          <Button variant="outlined" onClick={() => { logout(); navigate('/login'); }} startIcon={<Logout />} size="small"
            sx={{ borderRadius: '999px', borderColor: '#EF4444', color: '#EF4444', fontWeight: 700, '&:hover': { borderColor: '#DC2626', backgroundColor: 'rgba(239,68,68,0.05)' } }}>
            Sign Out
          </Button>
        </Box>
      </Box>

      {/* Hero */}
      <Box sx={{ background: `linear-gradient(135deg, #1E293B 0%, #334155 100%)`, py: 3, px: { xs: 2, sm: 4 } }}>
        <Container maxWidth="lg">
          <Box display="flex" alignItems="center" gap={2} mb={2}>
            <AdminPanelSettings sx={{ color: '#fff', fontSize: 36 }} />
            <Box>
              <Typography variant="h5" sx={{ color: '#fff', fontWeight: 800 }}>MedTrace Administration</Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>System control · User management · Doctor approvals</Typography>
            </Box>
          </Box>
          {/* Stats */}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(4,1fr)' }, gap: 2 }}>
            {[
              { label: 'Pending Approvals', value: pending.length, color: C.amber },
              { label: 'Total Doctors', value: allDoctors.length, color: C.teal },
              { label: 'Total Patients', value: allPatients.length, color: C.primary },
              { label: 'Approved Doctors', value: allDoctors.filter((d) => d.status === 'approved').length, color: C.green },
            ].map((s) => (
              <Paper key={s.label} elevation={0} sx={{ p: 2, borderRadius: '14px', backgroundColor: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}>
                <Typography variant="h4" sx={{ color: s.color, fontWeight: 800 }}>{s.value}</Typography>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>{s.label}</Typography>
              </Paper>
            ))}
          </Box>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ py: 3 }}>
        {/* Urgent pending alert */}
        {pending.length > 0 && (
          <Alert severity="warning" sx={{ mb: 3, borderRadius: '12px' }} icon={<WarningAmber />}>
            <strong>{pending.length} doctor registration{pending.length > 1 ? 's' : ''}</strong> awaiting approval.
          </Alert>
        )}

        {/* Tabs */}
        <Box sx={{ backgroundColor: '#fff', borderRadius: '12px', border: `1px solid ${C.border}`, mb: 3 }}>
          <Tabs
            value={activeTab}
            onChange={(_, v) => setActiveTab(v)}
            sx={{ '& .MuiTab-root': { fontWeight: 700, fontSize: '0.85rem', textTransform: 'none', minHeight: 48 }, '& .Mui-selected': { color: C.primary }, '& .MuiTabs-indicator': { backgroundColor: C.primary } }}
          >
            <Tab label={`Pending Approvals ${pending.length > 0 ? `(${pending.length})` : ''}`} />
            <Tab label={`All Doctors (${allDoctors.length})`} />
            <Tab label={`All Patients (${allPatients.length})`} />
          </Tabs>
        </Box>

        {loading ? (
          <Box display="flex" justifyContent="center" py={6}><CircularProgress sx={{ color: C.primary }} /></Box>
        ) : (
          <>
            {/* ── Tab 0: Pending ─────────────────────────────────────────────── */}
            {activeTab === 0 && (
              <Box>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="subtitle2" sx={{ color: C.muted, fontWeight: 700 }}>
                    DOCTOR APPROVAL QUEUE ({pending.length})
                  </Typography>
                  <Button size="small" startIcon={<Refresh />} onClick={load} sx={{ fontWeight: 700, color: C.muted }}>Refresh</Button>
                </Box>
                {pending.length === 0 ? (
                  <Alert severity="success" sx={{ borderRadius: '12px' }}>No pending approvals — all caught up!</Alert>
                ) : (
                  <Box display="flex" flexDirection="column" gap={2}>
                    {pending.map((doc) => (
                      <Paper key={doc.id} elevation={0} sx={{ p: 2.5, borderRadius: '16px', border: `1px solid ${C.amber}30`, backgroundColor: `${C.amber}04` }}>
                        <Box display="flex" gap={2} alignItems="flex-start" flexWrap="wrap">
                          <Avatar sx={{ backgroundColor: `${C.teal}18`, color: C.teal, fontWeight: 800, width: 48, height: 48 }}>
                            {doc.name?.charAt(0)}
                          </Avatar>
                          <Box flex={1} minWidth={200}>
                            <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                              <Typography variant="body1" sx={{ fontWeight: 800, color: C.slate }}>{doc.name}</Typography>
                              {statusChip(doc.status || 'pending')}
                            </Box>
                            <Typography variant="caption" sx={{ color: C.muted, display: 'block' }}>{doc.email}</Typography>
                            <Typography variant="caption" sx={{ color: C.muted, display: 'block' }}>📞 {doc.phone || '—'}</Typography>
                            <Box display="flex" gap={1} mt={1} flexWrap="wrap">
                              {doc.specialization && <Chip label={doc.specialization} size="small" sx={{ backgroundColor: `${C.teal}12`, color: C.teal, fontWeight: 700, fontSize: '0.7rem' }} />}
                              {doc.licenseNumber && <Chip label={`License: ${doc.licenseNumber}`} size="small" sx={{ backgroundColor: '#F1F5F9', fontSize: '0.7rem', fontWeight: 600 }} />}
                              {(doc.registeredDate || doc.registrationDate) && (
                                <Chip
                                  label={`Reg. Date: ${fmtDate(doc.registeredDate || doc.registrationDate)}`}
                                  size="small"
                                  sx={{ backgroundColor: '#EFF6FF', color: C.primary, fontSize: '0.7rem', fontWeight: 600 }}
                                />
                              )}
                              {doc.yearsExperience && <Chip label={`${doc.yearsExperience}yr experience`} size="small" sx={{ backgroundColor: '#F1F5F9', fontSize: '0.7rem', fontWeight: 600 }} />}
                            </Box>
                            {doc.qualifications && (
                              <Typography variant="caption" sx={{ color: C.muted, display: 'block', mt: 0.5 }}>
                                Qualifications: {doc.qualifications}
                              </Typography>
                            )}
                            <Typography variant="caption" sx={{ color: '#94A3B8', fontSize: '0.7rem', display: 'block', mt: 0.5 }}>
                              Applied: {fmtDate(doc.createdAt || '')}
                            </Typography>
                          </Box>
                          <Box display="flex" gap={1.5} flexDirection="column" alignItems="flex-end">
                            <Button
                              variant="contained"
                              startIcon={processing === doc.id ? <CircularProgress size={16} color="inherit" /> : <CheckCircle />}
                              onClick={() => handleApprove(doc.id)}
                              disabled={processing === doc.id}
                              sx={{ borderRadius: '999px', backgroundColor: C.green, '&:hover': { backgroundColor: '#047857' }, fontWeight: 700, boxShadow: 'none', fontSize: '0.82rem', minWidth: 110 }}
                            >
                              Approve
                            </Button>
                            <Button
                              variant="outlined"
                              startIcon={<Cancel />}
                              onClick={() => openReject(doc)}
                              disabled={processing === doc.id}
                              sx={{ borderRadius: '999px', borderColor: C.red, color: C.red, fontWeight: 700, fontSize: '0.82rem', '&:hover': { backgroundColor: 'rgba(220,38,38,0.05)' }, minWidth: 110 }}
                            >
                              Reject
                            </Button>
                          </Box>
                        </Box>
                      </Paper>
                    ))}
                  </Box>
                )}
              </Box>
            )}

            {/* ── Tab 1: All Doctors ──────────────────────────────────────────── */}
            {activeTab === 1 && (
              <TableContainer component={Paper} elevation={0} sx={{ borderRadius: '14px', border: `1px solid ${C.border}` }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ '& th': { backgroundColor: '#F8FAFC', fontWeight: 700, color: C.muted, fontSize: '0.75rem', py: 1.5 } }}>
                      <TableCell>Name</TableCell>
                      <TableCell>Email</TableCell>
                      <TableCell>Specialization</TableCell>
                      <TableCell>License</TableCell>
                      <TableCell>Registered Date</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {allDoctors.map((d) => (
                      <TableRow key={d.id} hover sx={{ '& td': { py: 1.5, fontSize: '0.82rem' } }}>
                        <TableCell>
                          <Box display="flex" alignItems="center" gap={1.5}>
                            <Avatar sx={{ width: 32, height: 32, backgroundColor: `${C.teal}18`, color: C.teal, fontSize: '0.85rem', fontWeight: 800 }}>{d.name?.charAt(0)}</Avatar>
                            <Box>
                              <Typography variant="body2" sx={{ fontWeight: 700, color: C.slate }}>{d.name}</Typography>
                              <Typography variant="caption" sx={{ color: C.muted, display: { sm: 'none' } }}>{d.phone}</Typography>
                            </Box>
                          </Box>
                        </TableCell>
                        <TableCell sx={{ color: C.muted }}>{d.email}</TableCell>
                        <TableCell>{d.specialization || '—'}</TableCell>
                        <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{d.licenseNumber || '—'}</TableCell>
                        <TableCell sx={{ color: C.muted }}>{fmtDate(d.registeredDate || d.registrationDate || d.createdAt || '')}</TableCell>
                        <TableCell>{statusChip(d.status || 'pending')}</TableCell>
                        <TableCell align="right">
                          {(d.status === 'pending' || !d.status) ? (
                            <Box display="flex" gap={1} justifyContent="flex-end">
                              <Button
                                size="small"
                                variant="contained"
                                onClick={() => handleApprove(d.id)}
                                disabled={processing === d.id}
                                sx={{ backgroundColor: C.green, '&:hover': { backgroundColor: '#047857' }, fontSize: '0.72rem', fontWeight: 700, borderRadius: '6px', py: 0.25, px: 1 }}
                              >
                                Approve
                              </Button>
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={() => openReject(d)}
                                disabled={processing === d.id}
                                sx={{ borderColor: C.red, color: C.red, '&:hover': { backgroundColor: 'rgba(220,38,38,0.05)' }, fontSize: '0.72rem', fontWeight: 700, borderRadius: '6px', py: 0.25, px: 1 }}
                              >
                                Reject
                              </Button>
                            </Box>
                          ) : d.status === 'approved' ? (
                            <Chip label="Verified" size="small" sx={{ backgroundColor: `${C.green}12`, color: C.green, fontWeight: 700, fontSize: '0.68rem', height: 22 }} />
                          ) : (
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => handleApprove(d.id)}
                              disabled={processing === d.id}
                              sx={{ borderColor: C.green, color: C.green, fontSize: '0.72rem', fontWeight: 700, borderRadius: '6px', py: 0.25, px: 1 }}
                            >
                              Re-Approve
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {allDoctors.length === 0 && (
                      <TableRow><TableCell colSpan={7} sx={{ textAlign: 'center', py: 3, color: C.muted }}>No doctors registered yet.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}

            {/* ── Tab 2: All Patients ─────────────────────────────────────────── */}
            {activeTab === 2 && (
              <TableContainer component={Paper} elevation={0} sx={{ borderRadius: '14px', border: `1px solid ${C.border}` }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ '& th': { backgroundColor: '#F8FAFC', fontWeight: 700, color: C.muted, fontSize: '0.75rem', py: 1.5 } }}>
                      <TableCell>Patient ID</TableCell>
                      <TableCell>Name</TableCell>
                      <TableCell>Email</TableCell>
                      <TableCell>Phone</TableCell>
                      <TableCell>Registered</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {allPatients.map((p) => (
                      <TableRow key={p.uid} hover sx={{ '& td': { py: 1.5, fontSize: '0.82rem' } }}>
                        <TableCell sx={{ fontFamily: 'monospace', fontWeight: 700, color: C.primary }}>{p.patientId}</TableCell>
                        <TableCell>
                          <Box display="flex" alignItems="center" gap={1.5}>
                            <Avatar sx={{ width: 32, height: 32, backgroundColor: `${C.primary}18`, color: C.primary, fontSize: '0.85rem', fontWeight: 800 }}>{p.name?.charAt(0)}</Avatar>
                            <Typography variant="body2" sx={{ fontWeight: 700, color: C.slate }}>{p.name}</Typography>
                          </Box>
                        </TableCell>
                        <TableCell sx={{ color: C.muted }}>{p.email}</TableCell>
                        <TableCell sx={{ color: C.muted }}>{p.phone || '—'}</TableCell>
                        <TableCell sx={{ color: C.muted }}>{fmtDate(p.createdAt || '')}</TableCell>
                      </TableRow>
                    ))}
                    {allPatients.length === 0 && (
                      <TableRow><TableCell colSpan={5} sx={{ textAlign: 'center', py: 3, color: C.muted }}>No patients registered yet.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </>
        )}
      </Container>

      {/* Reject Dialog */}
      <Dialog open={rejectDialog.open} onClose={() => setRejectDialog({ open: false, doctorId: '', doctorName: '' })} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Reject Doctor Registration</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: C.muted, mb: 2 }}>
            You are about to reject <strong>{rejectDialog.doctorName}</strong>'s registration. Please provide a reason.
          </Typography>
          <TextField
            label="Rejection Reason"
            fullWidth
            multiline
            rows={3}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="e.g. License number could not be verified, incomplete application…"
            size="small"
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setRejectDialog({ open: false, doctorId: '', doctorName: '' })} sx={{ borderRadius: '999px' }}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleReject}
            disabled={!rejectReason.trim() || processing !== null}
            sx={{ borderRadius: '999px', backgroundColor: C.red, '&:hover': { backgroundColor: '#B91C1C' }, fontWeight: 700, boxShadow: 'none' }}
          >
            Confirm Rejection
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
