import React, { useState, useEffect } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { PatientDashboard } from './PatientDashboard';
import { DoctorDashboard } from './DoctorDashboard';
import { AdminDashboard } from './AdminDashboard';
import { CaretakerDashboard } from './CaretakerDashboard';
import { checkIsAssignedCaretaker } from '../../services/caretakerService';

// ─── Role → Dashboard mapping ─────────────────────────────────────────────────
export const RoleDashboard: React.FC = () => {
  const { roleName } = useParams<{ roleName: string }>();
  const { user, loading } = useAuth();
  const [isCaretaker, setIsCaretaker] = useState<boolean | null>(null);

  useEffect(() => {
    if (user?.email) {
      checkIsAssignedCaretaker(user.email).then((res) => setIsCaretaker(res));
    } else {
      setIsCaretaker(false);
    }
  }, [user?.email]);

  if (loading || (user?.email && isCaretaker === null)) return null;

  // Determine effective role from the authenticated user or email matching
  const role = (user?.role || roleName || '').toLowerCase().replace(/-/g, ' ');

  if (role === 'caretaker' || role === 'caregiver' || isCaretaker) {
    return <CaretakerDashboard />;
  }

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

    default:
      return <Navigate to="/login" replace />;
  }
};
