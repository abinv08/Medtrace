import React from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { PatientDashboard } from './PatientDashboard';
import { DoctorDashboard } from './DoctorDashboard';
import { AdminDashboard } from './AdminDashboard';
import { CaretakerDashboard } from './CaretakerDashboard';

// ─── Role → Dashboard mapping ─────────────────────────────────────────────────
export const RoleDashboard: React.FC = () => {
  const { roleName } = useParams<{ roleName: string }>();
  const { user, loading } = useAuth();

  if (loading) return null;

  // Determine effective role from the authenticated user (not just URL param)
  const role = (user?.role || roleName || '').toLowerCase().replace(/-/g, ' ');

  switch (role) {
    case 'patient':
    case 'guardian':
      return <PatientDashboard />;

    case 'doctor':
    case 'nurse':
      return <DoctorDashboard />;

    case 'admin':
    case 'hospital administrator':
    case 'hospital admin':
      return <AdminDashboard />;

    case 'caretaker':
    case 'caregiver':
      return <CaretakerDashboard />;

    default:
      return <Navigate to="/login" replace />;
  }
};
