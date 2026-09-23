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
  googleLogin: (role?: string, registrationDetails?: Partial<RegisterPayload>) => Promise<AuthResponse>;
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
          if (!localStorage.getItem('medtrace_access_token')) {
            setToken(idToken);
            localStorage.setItem('medtrace_access_token', idToken);
          }
        } catch {
          // ignore
        }
        // User is signed in — try to fetch or update their profile
        const profile = await fetchUserProfile(firebaseUser.uid).catch(() => null);
        if (profile) {
          setUser(profile);
          localStorage.setItem('medtrace_user', JSON.stringify(profile));
        }
      } else {
        setUser(null);
        setToken(null);
        localStorage.removeItem('medtrace_access_token');
        localStorage.removeItem('medtrace_user');
      }
      setLoading(false);
    });

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
        // ignore
      }
    }
    const currentToken = localStorage.getItem('medtrace_access_token') || token;
    return currentToken;
  };

  // ─── Refresh user profile ────────────────────────────────────────────────
  const refreshUser = async () => {
    const uid = auth.currentUser?.uid || user?.id || '';
    if (!uid) return;
    const profile = await fetchUserProfile(uid);
    if (profile) {
      setUser(profile);
      localStorage.setItem('medtrace_user', JSON.stringify(profile));
    }
  };

  // ─── Auth actions ─────────────────────────────────────────────────────────
  const login = async (payload: LoginPayload): Promise<AuthResponse> => {
    const res = await authService.login(payload);
    if (res.success && res.user) {
      setUser(res.user);
      const activeToken = localStorage.getItem('medtrace_access_token');
      if (activeToken) {
        setToken(activeToken);
      } else if (auth.currentUser) {
        const idToken = await auth.currentUser.getIdToken().catch(() => null);
        if (idToken) {
          setToken(idToken);
          localStorage.setItem('medtrace_access_token', idToken);
        }
      }
    }
    return res;
  };

  const register = async (payload: RegisterPayload): Promise<AuthResponse> => {
    const res = await authService.register(payload);
    if (res.success && res.user) {
      setUser(res.user);
      const activeToken = localStorage.getItem('medtrace_access_token');
      if (activeToken) {
        setToken(activeToken);
      } else if (auth.currentUser) {
        const idToken = await auth.currentUser.getIdToken().catch(() => null);
        if (idToken) {
          setToken(idToken);
          localStorage.setItem('medtrace_access_token', idToken);
        }
      }
    }
    return res;
  };

  const googleLogin = async (role?: string, registrationDetails?: Partial<RegisterPayload>): Promise<AuthResponse> => {
    const res = await authService.googleAuth(role, registrationDetails);
    if (res.success && res.user) {
      setUser(res.user);
      const activeToken = localStorage.getItem('medtrace_access_token');
      if (activeToken) {
        setToken(activeToken);
      } else if (auth.currentUser) {
        const idToken = await auth.currentUser.getIdToken().catch(() => null);
        if (idToken) {
          setToken(idToken);
          localStorage.setItem('medtrace_access_token', idToken);
        }
      }
    }
    return res;
  };

  const logout = () => {
    authService.logout();
    setUser(null);
    setToken(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        register,
        googleLogin,
        logout,
        refreshUser,
        getToken,
      }}
    >
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

