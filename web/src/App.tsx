import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { theme } from './theme/theme';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { RoleDashboard } from './pages/dashboards/RoleDashboards';
import { MedicalReportPage } from './pages/MedicalReportPage';
import { CSIBreathingMonitor } from './pages/CSIBreathingMonitor';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

export const App: React.FC = () => {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route
              path="/dashboard/:roleName"
              element={
                <ProtectedRoute>
                  <RoleDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/report/analysis"
              element={
                <ProtectedRoute>
                  <MedicalReportPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/csi/monitoring"
              element={
                <ProtectedRoute>
                  <CSIBreathingMonitor />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
};
export default App;
