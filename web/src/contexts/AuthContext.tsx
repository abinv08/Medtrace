import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../config/firebase';
import {
  authService,
  fetchUserProfile,
  UserProfile,
  RegisterPayload,
  LoginPayload,
  AuthResponse,
} from '../services/authService';

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  loading: boolean;
  login: (payload: LoginPayload) => Promise<AuthResponse>;
  register: (payload: RegisterPayload) => Promise<AuthResponse>;
  googleLogin: (role?: string) => Promise<AuthResponse>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  getToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('medtrace_access_token'));
  const [loading, setLoading] = useState<boolean>(true);

  // ─── Listen to Firebase auth state changes ────────────────────────────────
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const idToken = await firebaseUser.getIdToken();
          setToken(idToken);
          localStorage.setItem('medtrace_access_token', idToken);
        } catch {
          // ignore
        }
        // User is signed in — fetch their Firestore profile
        const profile = await fetchUserProfile(firebaseUser.uid);
        setUser(profile ? { ...profile, id: firebaseUser.uid } : null);
      } else {
        // User is signed out
        setUser(null);
        setToken(null);
        localStorage.removeItem('medtrace_access_token');
      }
      setLoading(false);
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []);

  // ─── Get/Refresh Auth Token ───────────────────────────────────────────────
  const getToken = async (): Promise<string | null> => {
    if (auth.currentUser) {
      try {
        const idToken = await auth.currentUser.getIdToken(true);
        setToken(idToken);
        localStorage.setItem('medtrace_access_token', idToken);
        return idToken;
      } catch {
        return token;
      }
    }
    return token || localStorage.getItem('medtrace_access_token');
  };

  // ─── Refresh user profile from Firestore ──────────────────────────────────
  const refreshUser = async () => {
    if (!auth.currentUser) return;
    const profile = await fetchUserProfile(auth.currentUser.uid);
    if (profile) {
      setUser({ ...profile, id: auth.currentUser.uid });
    }
  };

  // ─── Auth actions ─────────────────────────────────────────────────────────
  const login = async (payload: LoginPayload): Promise<AuthResponse> => {
    const res = await authService.login(payload);
    if (res.success && res.user) {
      setUser(res.user);
      if (auth.currentUser) {
        const idToken = await auth.currentUser.getIdToken();
        setToken(idToken);
        localStorage.setItem('medtrace_access_token', idToken);
      }
    }
    return res;
  };

  const register = async (payload: RegisterPayload): Promise<AuthResponse> => {
    const res = await authService.register(payload);
    if (res.success && res.user) {
      setUser(res.user);
      if (auth.currentUser) {
        const idToken = await auth.currentUser.getIdToken();
        setToken(idToken);
        localStorage.setItem('medtrace_access_token', idToken);
      }
    }
    return res;
  };

  const googleLogin = async (role?: string): Promise<AuthResponse> => {
    const res = await authService.googleAuth(role);
    if (res.success && res.user) {
      setUser(res.user);
      if (auth.currentUser) {
        const idToken = await auth.currentUser.getIdToken();
        setToken(idToken);
        localStorage.setItem('medtrace_access_token', idToken);
      }
    }
    return res;
  };

  const logout = () => {
    authService.logout();
    setUser(null);
    setToken(null);
    localStorage.removeItem('medtrace_access_token');
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, googleLogin, logout, refreshUser, getToken }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
