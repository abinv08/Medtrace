import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Container, Typography, Paper, Button, Chip, Avatar,
  CircularProgress, Alert, Tabs, Tab, Divider, Dialog,
  DialogTitle, DialogContent, DialogActions, TextField,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  IconButton, Tooltip, InputAdornment, MenuItem, Select, FormControl,
} from '@mui/material';
import {
  CheckCircle, Cancel, Person, MedicalServices, HowToReg,
  Logout, AdminPanelSettings, WarningAmber, Refresh, Block,
  Search, FilterList, Group, LocalHospital, EventNote,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { MedTraceLogo } from '../../components/Logo';
import { useAuth } from '../../contexts/AuthContext';
import { NotificationBell } from '../../components/NotificationBell';
import api from '../../services/api';
import {
  fetchPendingDoctors,
  fetchAllDoctors,
  approveDoctor,
  rejectDoctor,
  DoctorProfile,
  fetchAllPatients,
  PatientSearchResult,
} from '../../services/doctorService';

export interface AdminUser {
  _id: string;
  id?: string;
  name: string;
  email: string;
  role: string;
  phone?: string;
  specialization?: string;
  licenseNumber?: string;
  hospitalName?: string;
  department?: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface AdminStats {
  users: {
    total: number;
    doctors: number;
    nurses: number;
    caregivers: number;
    patients: number;
  };
  appointments: {
    total: number;
    thisWeek: number;
    pending: number;
    completed: number;
  };
  clinical: {
    vitalsRecorded: number;
    activePrescriptions: number;
    uploadedReports: number;
  };
}

const C = {
  primary: '#1565C0',
  teal: '#00838F',
  green: '#059669',
  red: '#DC2626',
  amber: '#D97706',
  purple: '#7C3AED',
  slate: '#1E293B',
  muted: '#64748B',
  border: '#E2E8F0',
  bg: '#F0F4F8',
};

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
  const { user, token, getToken, logout } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState(0);
  const [allUsers, setAllUsers] = useState<AdminUser[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [pending, setPending] = useState<DoctorProfile[]>([]);
  const [allDoctors, setAllDoctors] = useState<DoctorProfile[]>([]);
  const [allPatients, setAllPatients] = useState<PatientSearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Search and role filters for All Users tab
  const [userSearch, setUserSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');

  // Rejection dialog
  const [rejectDialog, setRejectDialog] = useState<{ open: boolean; doctorId: string; doctorName: string }>({
    open: false,
    doctorId: '',
    doctorName: '',
  });
  const [rejectReason, setRejectReason] = useState('');

  // Deactivate confirmation dialog
  const [deactivateDialog, setDeactivateDialog] = useState<{ open: boolean; userId: string; userName: string }>({
    open: false,
    userId: '',
    userName: '',
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    setActionError(null);

    let authToken = token;
    if (!authToken && typeof getToken === 'function') {
      try {
        authToken = await getToken();
      } catch {
        /* ignore */
      }
    }
    const authHeaders: Record<string, string> = authToken ? { Authorization: `Bearer ${authToken}` } : {};

    try {
      // 1. Fetch real users list: GET /api/admin/users
      // 2. Fetch real stats: GET /api/admin/stats
      // 3. Fetch pending doctor approvals & patients
      const [usersRes, statsRes, pendDocs, docProfiles, patientProfiles] = await Promise.allSettled([
        api.get('/api/admin/users', { headers: authHeaders }),
        api.get('/api/admin/stats', { headers: authHeaders }),
        fetchPendingDoctors().catch(() => []),
        fetchAllDoctors().catch(() => []),
        fetchAllPatients().catch(() => []),
      ]);

      if (usersRes.status === 'fulfilled' && usersRes.value.data?.success && Array.isArray(usersRes.value.data.users)) {
        setAllUsers(usersRes.value.data.users);
      }

      if (statsRes.status === 'fulfilled' && statsRes.value.data?.success && statsRes.value.data.stats) {
        setStats(statsRes.value.data.stats);
      }

      if (pendDocs.status === 'fulfilled') {
        setPending(pendDocs.value);
      }

      if (docProfiles.status === 'fulfilled') {
        setAllDoctors(docProfiles.value);
      }

      if (patientProfiles.status === 'fulfilled') {
        setAllPatients(patientProfiles.value);
      }
    } catch (e: any) {
      console.error('Error fetching admin data:', e);
      setActionError(e.message || 'Error loading administrator resources');
    } finally {
      setLoading(false);
    }
  }, [token, getToken]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Wire Deactivate User Action: PUT /api/admin/users/:id/deactivate
  const handleDeactivate = async () => {
    if (!deactivateDialog.userId) return;
    setProcessing(deactivateDialog.userId);
    setActionError(null);

    try {
      let authToken = token;
      if (!authToken && typeof getToken === 'function') {
        try {
          authToken = await getToken();
        } catch {
          /* ignore */
        }
      }
      const authHeaders: Record<string, string> = authToken ? { Authorization: `Bearer ${authToken}` } : {};

      const res = await api.put(`/api/admin/users/${deactivateDialog.userId}/deactivate`, {}, { headers: authHeaders });
      if (res.data?.success) {
        setActionFeedback(`✓ User "${deactivateDialog.userName}" has been deactivated successfully.`);
        // Update user active status in local state
        setAllUsers((prev) =>
          prev.map((u) =>
            u._id === deactivateDialog.userId || u.id === deactivateDialog.userId
              ? { ...u, isActive: false }
              : u
          )
        );
        setTimeout(() => setActionFeedback(null), 5000);

        // Refresh stats
        try {
          const statsRes = await api.get('/api/admin/stats', { headers: authHeaders });
          if (statsRes.data?.success && statsRes.data.stats) {
            setStats(statsRes.data.stats);
          }
        } catch {
          /* ignore */
        }
      }
    } catch (err: any) {
      console.error('Error deactivating user:', err);
      setActionError(err.response?.data?.message || err.message || 'Failed to deactivate user');
    } finally {
      setProcessing(null);
      setDeactivateDialog({ open: false, userId: '', userName: '' });
    }
  };

  const handleApprove = async (doctorId: string) => {
    if (!user?.id) return;
    setProcessing(doctorId);
    try {
      await approveDoctor(doctorId, user.id);
      await loadData();
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
      await loadData();
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
      <Chip
        label={config.label}
        size="small"
        sx={{ backgroundColor: config.bg, color: config.color, fontWeight: 800, fontSize: '0.65rem', height: 20, borderRadius: '4px' }}
      />
    );
  };

  const roleChip = (role: string) => {
    const normalized = (role || '').toLowerCase();
    let bg = `${C.primary}12`;
    let color = C.primary;

    if (normalized.includes('doctor')) {
      bg = `${C.teal}14`;
      color = C.teal;
    } else if (normalized.includes('nurse')) {
      bg = `${C.purple}14`;
      color = C.purple;
    } else if (normalized.includes('care') || normalized.includes('guardian')) {
      bg = `${C.amber}14`;
      color = C.amber;
    } else if (normalized.includes('admin')) {
      bg = `${C.red}14`;
      color = C.red;
    }

    return (
      <Chip
        label={role || 'User'}
        size="small"
        sx={{ backgroundColor: bg, color, fontWeight: 700, fontSize: '0.7rem', height: 22 }}
      />
    );
  };

  // Filter users by role and search string
  const filteredUsers = allUsers.filter((u) => {
    const matchesRole =
      roleFilter === 'ALL' || u.role?.toLowerCase() === roleFilter.toLowerCase();
    const matchesSearch =
      !userSearch.trim() ||
      u.name?.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email?.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.phone?.includes(userSearch);
    return matchesRole && matchesSearch;
  });

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: C.bg }}>
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <Box
        sx={{
          backgroundColor: '#fff',
          borderBottom: `1px solid ${C.border}`,
          py: 1.5,
          px: { xs: 2, sm: 4 },
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          position: 'sticky',
          top: 0,
          zIndex: 100,
          boxShadow: '0 1px 8px rgba(0,0,0,0.06)',
        }}
      >
        <Box display="flex" alignItems="center" gap={2}>
          <MedTraceLogo variant="full" size="small" />
          <Chip
            label="HOSPITAL ADMIN"
            size="small"
            sx={{ backgroundColor: C.red, color: '#fff', fontWeight: 800, fontSize: '0.68rem', borderRadius: '999px', height: 26 }}
          />
        </Box>
        <Box display="flex" alignItems="center" gap={2}>
          <NotificationBell userId={user?.id || 'default'} />
          <Typography variant="caption" sx={{ color: C.muted, fontWeight: 600, display: { xs: 'none', sm: 'block' } }}>
            {user?.name} · {user?.email}
          </Typography>
          <Button
            variant="outlined"
            onClick={() => {
              logout();
              navigate('/login');
            }}
            startIcon={<Logout />}
            size="small"
            sx={{
              borderRadius: '999px',
              borderColor: '#EF4444',
              color: '#EF4444',
              fontWeight: 700,
              '&:hover': { borderColor: '#DC2626', backgroundColor: 'rgba(239,68,68,0.05)' },
            }}
          >
            Sign Out
          </Button>
        </Box>
      </Box>

      {/* ── Hero & Real-Time Stats (GET /api/admin/stats) ────────────────────── */}
      <Box sx={{ background: 'linear-gradient(135deg, #1E293B 0%, #334155 100%)', py: 3, px: { xs: 2, sm: 4 } }}>
        <Container maxWidth="lg">
          <Box display="flex" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={2} mb={2.5}>
            <Box display="flex" alignItems="center" gap={2}>
              <AdminPanelSettings sx={{ color: '#fff', fontSize: 38 }} />
              <Box>
                <Typography variant="h5" sx={{ color: '#fff', fontWeight: 800 }}>
                  Hospital Administration Console
                </Typography>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                  Live System Metrics · User Access Control · Clinical Operations Oversight
                </Typography>
              </Box>
            </Box>
            <Tooltip title="Refresh Metrics & Users">
              <IconButton
                onClick={loadData}
                disabled={loading}
                sx={{ color: 'rgba(255,255,255,0.8)', border: '1px solid rgba(255,255,255,0.2)', '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' } }}
              >
                <Refresh sx={{ fontSize: 20 }} />
              </IconButton>
            </Tooltip>
          </Box>

          {/* Stats Grid */}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(4, 1fr)' }, gap: 2 }}>
            {[
              {
                label: 'Total Registered Users',
                value: stats?.users?.total ?? allUsers.length,
                color: '#38BDF8',
              },
              {
                label: 'Active Doctors',
                value: stats?.users?.doctors ?? allUsers.filter((u) => u.role?.toLowerCase() === 'doctor').length,
                color: C.teal,
              },
              {
                label: 'Monitored Patients',
                value: stats?.users?.patients ?? allUsers.filter((u) => u.role?.toLowerCase() === 'patient').length,
                color: C.primary,
              },
              {
                label: 'Appointments This Week',
                value: stats?.appointments?.thisWeek ?? stats?.appointments?.total ?? 0,
                color: C.green,
              },
            ].map((s) => (
              <Paper
                key={s.label}
                elevation={0}
                sx={{
                  p: 2,
                  borderRadius: '14px',
                  backgroundColor: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.12)',
                }}
              >
                <Typography variant="h4" sx={{ color: s.color, fontWeight: 800 }}>
                  {s.value}
                </Typography>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>
                  {s.label}
                </Typography>
              </Paper>
            ))}
          </Box>
        </Container>
      </Box>

      {/* ── Main Workspace Content ─────────────────────────────────────────── */}
      <Container maxWidth="lg" sx={{ py: 3 }}>
        {/* Action Alerts */}
        {actionFeedback && (
          <Alert severity="success" sx={{ mb: 2.5, borderRadius: '12px' }} onClose={() => setActionFeedback(null)}>
            {actionFeedback}
          </Alert>
        )}
        {actionError && (
          <Alert severity="error" sx={{ mb: 2.5, borderRadius: '12px' }} onClose={() => setActionError(null)}>
            {actionError}
          </Alert>
        )}

        {/* Pending approvals banner alert */}
        {pending.length > 0 && (
          <Alert severity="warning" sx={{ mb: 3, borderRadius: '12px' }} icon={<WarningAmber />}>
            <strong>{pending.length} doctor registration{pending.length > 1 ? 's' : ''}</strong> currently awaiting verification and approval.
          </Alert>
        )}

        {/* Workspace Navigation Tabs */}
        <Box sx={{ backgroundColor: '#fff', borderRadius: '12px', border: `1px solid ${C.border}`, mb: 3 }}>
          <Tabs
            value={activeTab}
            onChange={(_, v) => setActiveTab(v)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              '& .MuiTab-root': { fontWeight: 700, fontSize: '0.85rem', textTransform: 'none', minHeight: 48 },
              '& .Mui-selected': { color: C.primary },
              '& .MuiTabs-indicator': { backgroundColor: C.primary },
            }}
          >
            <Tab label={`All Users (${allUsers.length})`} />
            <Tab label={`Pending Approvals ${pending.length > 0 ? `(${pending.length})` : ''}`} />
            <Tab label={`All Doctors (${allDoctors.length})`} />
            <Tab label={`All Patients (${allPatients.length})`} />
          </Tabs>
        </Box>

        {loading ? (
          <Box display="flex" justifyContent="center" py={8}>
            <CircularProgress sx={{ color: C.primary }} />
          </Box>
        ) : (
          <>
            {/* ── Tab 0: All Users (GET /api/admin/users) & Deactivate Action ── */}
            {activeTab === 0 && (
              <Box>
                {/* Search & Role Filter Bar */}
                <Paper
                  elevation={0}
                  sx={{
                    p: 2,
                    borderRadius: '14px',
                    border: `1px solid ${C.border}`,
                    mb: 2.5,
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 2,
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <TextField
                    placeholder="Search by name, email, or phone…"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    size="small"
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Search sx={{ color: C.muted, fontSize: 20 }} />
                        </InputAdornment>
                      ),
                      sx: { borderRadius: '10px', minWidth: { xs: 240, sm: 320 } },
                    }}
                  />

                  <Box display="flex" alignItems="center" gap={1.5} flexWrap="wrap">
                    <Typography variant="caption" sx={{ color: C.muted, fontWeight: 700 }}>
                      ROLE FILTER:
                    </Typography>
                    {['ALL', 'Doctor', 'Patient', 'Nurse', 'Caregiver'].map((r) => (
                      <Chip
                        key={r}
                        label={r}
                        size="small"
                        onClick={() => setRoleFilter(r)}
                        color={roleFilter === r ? 'primary' : 'default'}
                        variant={roleFilter === r ? 'filled' : 'outlined'}
                        sx={{ fontWeight: 700, cursor: 'pointer', borderRadius: '8px' }}
                      />
                    ))}
                  </Box>
                </Paper>

                {/* Users Table */}
                <TableContainer component={Paper} elevation={0} sx={{ borderRadius: '14px', border: `1px solid ${C.border}` }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ '& th': { backgroundColor: '#F8FAFC', fontWeight: 700, color: C.muted, fontSize: '0.75rem', py: 1.5 } }}>
                        <TableCell>User</TableCell>
                        <TableCell>Email</TableCell>
                        <TableCell>Role</TableCell>
                        <TableCell>Hospital / Dept</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Registered</TableCell>
                        <TableCell align="right">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredUsers.map((u) => {
                        const isUserActive = u.isActive !== false;
                        const uid = u._id || u.id || '';
                        return (
                          <TableRow key={uid} hover sx={{ '& td': { py: 1.5, fontSize: '0.82rem' } }}>
                            <TableCell>
                              <Box display="flex" alignItems="center" gap={1.5}>
                                <Avatar sx={{ width: 34, height: 34, backgroundColor: `${C.primary}18`, color: C.primary, fontSize: '0.85rem', fontWeight: 800 }}>
                                  {u.name?.charAt(0) || 'U'}
                                </Avatar>
                                <Box>
                                  <Typography variant="body2" sx={{ fontWeight: 700, color: C.slate }}>
                                    {u.name}
                                  </Typography>
                                  <Typography variant="caption" sx={{ color: C.muted }}>
                                    {u.phone || 'No phone'}
                                  </Typography>
                                </Box>
                              </Box>
                            </TableCell>
                            <TableCell sx={{ color: C.muted }}>{u.email}</TableCell>
                            <TableCell>{roleChip(u.role)}</TableCell>
                            <TableCell sx={{ color: C.slate }}>
                              {u.hospitalName || u.department ? `${u.hospitalName || ''} ${u.department ? `· ${u.department}` : ''}` : '—'}
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={isUserActive ? 'ACTIVE' : 'DEACTIVATED'}
                                size="small"
                                sx={{
                                  backgroundColor: isUserActive ? `${C.green}12` : `${C.red}12`,
                                  color: isUserActive ? C.green : C.red,
                                  fontWeight: 800,
                                  fontSize: '0.65rem',
                                  height: 20,
                                  borderRadius: '4px',
                                }}
                              />
                            </TableCell>
                            <TableCell sx={{ color: C.muted }}>{fmtDate(u.createdAt)}</TableCell>
                            <TableCell align="right">
                              {isUserActive ? (
                                <Button
                                  size="small"
                                  variant="outlined"
                                  color="error"
                                  startIcon={<Block />}
                                  onClick={() => setDeactivateDialog({ open: true, userId: uid, userName: u.name })}
                                  disabled={processing === uid}
                                  sx={{
                                    fontSize: '0.72rem',
                                    fontWeight: 700,
                                    borderRadius: '6px',
                                    py: 0.25,
                                    px: 1,
                                    borderColor: `${C.red}60`,
                                    color: C.red,
                                    '&:hover': { borderColor: C.red, backgroundColor: `${C.red}08` },
                                  }}
                                >
                                  Deactivate
                                </Button>
                              ) : (
                                <Chip
                                  label="Deactivated"
                                  size="small"
                                  sx={{ backgroundColor: '#FEE2E2', color: '#DC2626', fontWeight: 700, fontSize: '0.68rem', height: 22 }}
                                />
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {filteredUsers.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7} sx={{ textAlign: 'center', py: 4, color: C.muted }}>
                            No users found matching current filters.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            )}

            {/* ── Tab 1: Pending Doctor Approvals ─────────────────────────────── */}
            {activeTab === 1 && (
              <Box>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="subtitle2" sx={{ color: C.muted, fontWeight: 700 }}>
                    DOCTOR APPROVAL QUEUE ({pending.length})
                  </Typography>
                  <Button size="small" startIcon={<Refresh />} onClick={loadData} sx={{ fontWeight: 700, color: C.muted }}>
                    Refresh
                  </Button>
                </Box>
                {pending.length === 0 ? (
                  <Alert severity="success" sx={{ borderRadius: '12px' }}>
                    No pending doctor applications — all caught up!
                  </Alert>
                ) : (
                  <Box display="flex" flexDirection="column" gap={2}>
                    {pending.map((doc) => (
                      <Paper
                        key={doc.id}
                        elevation={0}
                        sx={{
                          p: 2.5,
                          borderRadius: '16px',
                          border: `1px solid ${C.amber}30`,
                          backgroundColor: `${C.amber}04`,
                        }}
                      >
                        <Box display="flex" gap={2} alignItems="flex-start" flexWrap="wrap">
                          <Avatar sx={{ backgroundColor: `${C.teal}18`, color: C.teal, fontWeight: 800, width: 48, height: 48 }}>
                            {doc.name?.charAt(0)}
                          </Avatar>
                          <Box flex={1} minWidth={200}>
                            <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                              <Typography variant="body1" sx={{ fontWeight: 800, color: C.slate }}>
                                {doc.name}
                              </Typography>
                              {statusChip(doc.status || 'pending')}
                            </Box>
                            <Typography variant="caption" sx={{ color: C.muted, display: 'block' }}>
                              {doc.email}
                            </Typography>
                            <Typography variant="caption" sx={{ color: C.muted, display: 'block' }}>
                              📞 {doc.phone || '—'}
                            </Typography>
                            <Box display="flex" gap={1} mt={1} flexWrap="wrap">
                              {doc.specialization && (
                                <Chip label={doc.specialization} size="small" sx={{ backgroundColor: `${C.teal}12`, color: C.teal, fontWeight: 700, fontSize: '0.7rem' }} />
                              )}
                              {doc.licenseNumber && (
                                <Chip label={`License: ${doc.licenseNumber}`} size="small" sx={{ backgroundColor: '#F1F5F9', fontSize: '0.7rem', fontWeight: 600 }} />
                              )}
                              {(doc.registeredDate || doc.registrationDate) && (
                                <Chip
                                  label={`Reg. Date: ${fmtDate(doc.registeredDate || doc.registrationDate)}`}
                                  size="small"
                                  sx={{ backgroundColor: '#EFF6FF', color: C.primary, fontSize: '0.7rem', fontWeight: 600 }}
                                />
                              )}
                              {doc.yearsExperience && (
                                <Chip label={`${doc.yearsExperience}yr experience`} size="small" sx={{ backgroundColor: '#F1F5F9', fontSize: '0.7rem', fontWeight: 600 }} />
                              )}
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
                              sx={{
                                borderRadius: '999px',
                                backgroundColor: C.green,
                                '&:hover': { backgroundColor: '#047857' },
                                fontWeight: 700,
                                boxShadow: 'none',
                                fontSize: '0.82rem',
                                minWidth: 110,
                              }}
                            >
                              Approve
                            </Button>
                            <Button
                              variant="outlined"
                              startIcon={<Cancel />}
                              onClick={() => openReject(doc)}
                              disabled={processing === doc.id}
                              sx={{
                                borderRadius: '999px',
                                borderColor: C.red,
                                color: C.red,
                                fontWeight: 700,
                                fontSize: '0.82rem',
                                '&:hover': { backgroundColor: 'rgba(220,38,38,0.05)' },
                                minWidth: 110,
                              }}
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

            {/* ── Tab 2: All Doctors ──────────────────────────────────────────── */}
            {activeTab === 2 && (
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
                            <Avatar sx={{ width: 32, height: 32, backgroundColor: `${C.teal}18`, color: C.teal, fontSize: '0.85rem', fontWeight: 800 }}>
                              {d.name?.charAt(0)}
                            </Avatar>
                            <Box>
                              <Typography variant="body2" sx={{ fontWeight: 700, color: C.slate }}>
                                {d.name}
                              </Typography>
                              <Typography variant="caption" sx={{ color: C.muted, display: { sm: 'none' } }}>
                                {d.phone}
                              </Typography>
                            </Box>
                          </Box>
                        </TableCell>
                        <TableCell sx={{ color: C.muted }}>{d.email}</TableCell>
                        <TableCell>{d.specialization || '—'}</TableCell>
                        <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{d.licenseNumber || '—'}</TableCell>
                        <TableCell sx={{ color: C.muted }}>{fmtDate(d.registeredDate || d.registrationDate || d.createdAt || '')}</TableCell>
                        <TableCell>{statusChip(d.status || 'pending')}</TableCell>
                        <TableCell align="right">
                          <Box display="flex" gap={1} justifyContent="flex-end">
                            {d.status === 'pending' || !d.status ? (
                              <>
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
                              </>
                            ) : (
                              <Chip label="Verified" size="small" sx={{ backgroundColor: `${C.green}12`, color: C.green, fontWeight: 700, fontSize: '0.68rem', height: 22 }} />
                            )}
                            <Button
                              size="small"
                              variant="outlined"
                              color="error"
                              startIcon={<Block />}
                              onClick={() => setDeactivateDialog({ open: true, userId: d.id, userName: d.name })}
                              disabled={processing === d.id}
                              sx={{ fontSize: '0.72rem', fontWeight: 700, borderRadius: '6px', py: 0.25, px: 1 }}
                            >
                              Deactivate
                            </Button>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))}
                    {allDoctors.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} sx={{ textAlign: 'center', py: 3, color: C.muted }}>
                          No doctors registered yet.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}

            {/* ── Tab 3: All Patients ─────────────────────────────────────────── */}
            {activeTab === 3 && (
              <TableContainer component={Paper} elevation={0} sx={{ borderRadius: '14px', border: `1px solid ${C.border}` }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ '& th': { backgroundColor: '#F8FAFC', fontWeight: 700, color: C.muted, fontSize: '0.75rem', py: 1.5 } }}>
                      <TableCell>Patient ID</TableCell>
                      <TableCell>Name</TableCell>
                      <TableCell>Email</TableCell>
                      <TableCell>Phone</TableCell>
                      <TableCell>Registered</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {allPatients.map((p) => (
                      <TableRow key={p.uid} hover sx={{ '& td': { py: 1.5, fontSize: '0.82rem' } }}>
                        <TableCell sx={{ fontFamily: 'monospace', fontWeight: 700, color: C.primary }}>
                          {p.patientId}
                        </TableCell>
                        <TableCell>
                          <Box display="flex" alignItems="center" gap={1.5}>
                            <Avatar sx={{ width: 32, height: 32, backgroundColor: `${C.primary}18`, color: C.primary, fontSize: '0.85rem', fontWeight: 800 }}>
                              {p.name?.charAt(0)}
                            </Avatar>
                            <Typography variant="body2" sx={{ fontWeight: 700, color: C.slate }}>
                              {p.name}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell sx={{ color: C.muted }}>{p.email}</TableCell>
                        <TableCell sx={{ color: C.muted }}>{p.phone || '—'}</TableCell>
                        <TableCell sx={{ color: C.muted }}>{fmtDate(p.createdAt || '')}</TableCell>
                        <TableCell align="right">
                          <Button
                            size="small"
                            variant="outlined"
                            color="error"
                            startIcon={<Block />}
                            onClick={() => setDeactivateDialog({ open: true, userId: p.uid, userName: p.name })}
                            disabled={processing === p.uid}
                            sx={{ fontSize: '0.72rem', fontWeight: 700, borderRadius: '6px', py: 0.25, px: 1 }}
                          >
                            Deactivate
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {allPatients.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} sx={{ textAlign: 'center', py: 3, color: C.muted }}>
                          No patients registered yet.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </>
        )}
      </Container>

      {/* ── Reject Doctor Dialog ────────────────────────────────────────────── */}
      <Dialog
        open={rejectDialog.open}
        onClose={() => setRejectDialog({ open: false, doctorId: '', doctorName: '' })}
        maxWidth="sm"
        fullWidth
      >
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
          <Button onClick={() => setRejectDialog({ open: false, doctorId: '', doctorName: '' })} sx={{ borderRadius: '999px' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleReject}
            disabled={!rejectReason.trim() || processing !== null}
            sx={{
              borderRadius: '999px',
              backgroundColor: C.red,
              '&:hover': { backgroundColor: '#B91C1C' },
              fontWeight: 700,
              boxShadow: 'none',
            }}
          >
            Confirm Rejection
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Deactivate User Confirmation Dialog (PUT /api/admin/users/:id/deactivate) */}
      <Dialog
        open={deactivateDialog.open}
        onClose={() => setDeactivateDialog({ open: false, userId: '', userName: '' })}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 800, color: C.red, display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningAmber sx={{ color: C.red }} /> Deactivate User Account
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: C.slate, mb: 1 }}>
            Are you sure you want to deactivate the user account for <strong>{deactivateDialog.userName}</strong>?
          </Typography>
          <Typography variant="caption" sx={{ color: C.muted }}>
            This will mark the account as inactive in the system and restrict access to patient records and clinical services.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button
            onClick={() => setDeactivateDialog({ open: false, userId: '', userName: '' })}
            sx={{ borderRadius: '999px', color: C.muted }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleDeactivate}
            disabled={processing === deactivateDialog.userId}
            sx={{
              borderRadius: '999px',
              backgroundColor: C.red,
              '&:hover': { backgroundColor: '#B91C1C' },
              fontWeight: 700,
              boxShadow: 'none',
            }}
          >
            {processing === deactivateDialog.userId ? (
              <CircularProgress size={16} color="inherit" />
            ) : (
              'Confirm Deactivate'
            )}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
