import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  sendPasswordResetEmail as firebaseSendPasswordResetEmail,
  signOut,
  updateProfile,
  browserLocalPersistence,
  browserSessionPersistence,
  setPersistence,
} from 'firebase/auth';
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  runTransaction,
  serverTimestamp,
  collection,
} from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import api from './api';
import { checkIsAssignedCaretaker } from './caretakerService';

// ─── Single hospital name (fixed for this system) ─────────────────────────────
export const HOSPITAL_NAME = 'MedTrace General Hospital';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  hospitalName: string;
  role: 'Patient' | 'Guardian' | 'Doctor' | 'Nurse' | 'Hospital Administrator' | 'Admin' | 'Caretaker' | string;
  patientId?: string;           // MT-2026-000001 (patients only)
  dateOfBirth?: string;
  gender?: string;
  bloodGroup?: string;
  address?: string;
  emergencyContact?: string;
  allergies?: string;
  chronicConditions?: string;
  // Doctor-specific
  specialization?: string;
  licenseNumber?: string;
  registeredDate?: string;
  registrationDate?: string;
  yearsExperience?: number;
  qualifications?: string;
  status?: 'pending' | 'approved' | 'rejected';  // doctors need admin approval
  approvedAt?: unknown;
  approvedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  phone: string;
  password: string;
  role: string;
  // Doctor extra fields
  specialization?: string;
  licenseNumber?: string;
  registeredDate?: string;
  registrationDate?: string;
  yearsExperience?: number;
  qualifications?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  user?: UserProfile;
}

// ─── Helper: map error codes to human-readable messages ──────────────────────
const firebaseErrorMessage = (error: any): string => {
  if (!error) return 'An unexpected error occurred. Please try again.';
  const code = typeof error === 'string' ? error : error?.code;
  const message = error?.message;

  switch (code) {
    case 'auth/email-already-in-use':
      return 'An account with this email address already exists.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Invalid email or password credentials.';
    case 'auth/too-many-requests':
      return 'Too many failed attempts. Please try again later.';
    case 'auth/popup-closed-by-user':
      return 'Google Sign-In was cancelled.';
    case 'auth/network-request-failed':
      return 'Network error. Please check your connection.';
    case 'permission-denied':
    case 'PERMISSION_DENIED':
      return 'Firestore permission denied. Publish the project Firestore rules, then try again.';
    default:
      if (typeof message === 'string' && (message.includes('permission') || message.includes('Missing or insufficient'))) {
        return 'Firestore permission denied. Publish the project Firestore rules, then try again.';
      }
      if (message) {
        return code ? `Error [${code}]: ${message}` : message;
      }
      return 'An unexpected error occurred. Please try again.';
  }
};

// ─── Helper: fetch user profile — Firestore is authoritative source of truth for role ───────
export const fetchUserProfile = async (uid: string): Promise<UserProfile | null> => {
  // 1. Firestore first — this is where registration stores the role (Doctor, Patient, Admin, etc.)
  if (uid) {
    try {
      const ref = doc(db, 'users', uid);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data();
        const profile: UserProfile = {
          id: uid,
          name: data.name || '',
          email: data.email || '',
          phone: data.phone || '',
          hospitalName: data.hospitalName || HOSPITAL_NAME,
          role: data.role || 'Patient',
          patientId: data.patientId,
          dateOfBirth: data.dateOfBirth,
          gender: data.gender,
          bloodGroup: data.bloodGroup,
          specialization: data.specialization || data.department,
          licenseNumber: data.licenseNumber,
          status: data.status || 'approved',
          approvedAt: data.approvedAt,
          approvedBy: data.approvedBy,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        };

        // Check caretaker assignment
        if (profile.email && profile.role !== 'Caretaker') {
          const isCaretaker = await checkIsAssignedCaretaker(profile.email).catch(() => false);
          if (isCaretaker) {
            profile.role = 'Caretaker';
            updateDoc(ref, { role: 'Caretaker', updatedAt: serverTimestamp() }).catch(() => {});
          }
        }

        // Cache the fresh Firestore data
        localStorage.setItem('medtrace_user', JSON.stringify(profile));
        return profile;
      }
    } catch {
      // Firestore permission-denied or offline — fall through
    }
  }

  return null;
};

const isApprovedProfessional = (profile: UserProfile): boolean => {
  const role = profile.role.toLowerCase().trim();
  return !['doctor', 'nurse'].includes(role) || profile.status === 'approved';
};

// ─── Patient ID Generator (MT-YYYY-XXXXXX) ────────────────────────────────────
export const generatePatientId = async (): Promise<string> => {
  const year = new Date().getFullYear();
  try {
    const counterRef = doc(db, 'system', 'patientIdCounter');
    const newCount = await runTransaction(db, async (tx) => {
      const snap = await tx.get(counterRef);
      let current = 0;
      if (snap.exists()) {
        current = (snap.data().count as number) || 0;
      }
      const next = current + 1;
      tx.set(counterRef, { count: next, updatedAt: serverTimestamp() }, { merge: true });
      return next;
    });

    const padded = String(newCount).padStart(6, '0');
    return `MT-${year}-${padded}`;
  } catch {
    const randomNum = Math.floor(100000 + Math.random() * 900000);
    return `MT-${year}-${randomNum}`;
  }
};

// ─── Auth Service ─────────────────────────────────────────────────────────────
export const authService = {
  // ── Email/Password Registration ──────────────────────────────────────────────
  register: async (payload: RegisterPayload): Promise<AuthResponse> => {
    const normalizedEmail = payload.email.toLowerCase().trim();
    const roleLower = (payload.role || '').toLowerCase();
    const isDoctor = roleLower === 'doctor' || roleLower === 'nurse';

    // Firebase is the source of truth for a fresh registration.
    let firebaseUid = '';
    try {
      const credential = await createUserWithEmailAndPassword(auth, normalizedEmail, payload.password);
      firebaseUid = credential.user.uid;
      await updateProfile(credential.user, { displayName: payload.name }).catch(() => {});

      const isCaretaker = await checkIsAssignedCaretaker(normalizedEmail).catch(() => false);
      const effectiveRole = isCaretaker ? 'Caretaker' : (payload.role as UserProfile['role']);
      let patientId: string | undefined;
      if (effectiveRole === 'Patient' || effectiveRole === 'Guardian') {
        patientId = await generatePatientId().catch(() => `MT-2026-${Math.floor(100000 + Math.random() * 900000)}`);
      }

      const regDate = payload.registeredDate || payload.registrationDate;
      const profileData: any = {
        name: payload.name,
        email: normalizedEmail,
        phone: payload.phone,
        hospitalName: HOSPITAL_NAME,
        role: effectiveRole,
        patientId,
        status: isDoctor ? 'pending' : 'approved',
        specialization: payload.specialization,
        licenseNumber: payload.licenseNumber,
        registeredDate: regDate,
        registrationDate: regDate,
        yearsExperience: payload.yearsExperience,
        qualifications: payload.qualifications,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      Object.keys(profileData).forEach((key) => {
        if (profileData[key] === undefined) delete profileData[key];
      });

      await setDoc(doc(db, 'users', firebaseUid), profileData);

      if ((effectiveRole === 'Patient' || effectiveRole === 'Guardian') && patientId) {
        await setDoc(doc(db, 'patientRecords', firebaseUid), {
          uid: firebaseUid,
          patientId,
          name: payload.name,
          email: normalizedEmail,
          phone: payload.phone,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    } catch (fbErr: any) {
      await signOut(auth).catch(() => {});
      return { success: false, message: firebaseErrorMessage(fbErr) };
    }

    const finalProfile: UserProfile = {
      id: firebaseUid,
      name: payload.name,
      email: normalizedEmail,
      phone: payload.phone,
      hospitalName: HOSPITAL_NAME,
      role: (payload.role as UserProfile['role']) || 'Doctor',
      specialization: payload.specialization,
      licenseNumber: payload.licenseNumber,
      status: isDoctor ? 'pending' : 'approved',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    localStorage.setItem('medtrace_user', JSON.stringify(finalProfile));

    return {
      success: true,
      message: isDoctor
        ? 'Account created. Your profile is pending admin approval. You will be notified once approved.'
        : 'Account created successfully',
      user: finalProfile,
    };
  },

  // ── Email/Password Login ─────────────────────────────────────────────────────
  login: async (payload: LoginPayload): Promise<AuthResponse> => {
    const normalizedEmail = payload.email.toLowerCase().trim();
    try {
      // Do not let a token from the removed MongoDB login flow survive into this session.
      localStorage.removeItem('medtrace_access_token');
      localStorage.removeItem('token');
      await setPersistence(
        auth,
        payload.rememberMe ? browserLocalPersistence : browserSessionPersistence
      ).catch(() => {});

      const credential = await signInWithEmailAndPassword(
        auth,
        normalizedEmail,
        payload.password
      );

      // Clear stale cache so fetchUserProfile goes to Firestore
      localStorage.removeItem('medtrace_user');

      // fetchUserProfile now reads Firestore first — role is always correct
      const profile = await fetchUserProfile(credential.user.uid).catch(() => null);

      if (!profile) {
        await signOut(auth).catch(() => {});
        return {
          success: false,
          message: 'Your Firebase account has no role profile in Firestore. Please contact an administrator.',
        };
      }

      if (!isApprovedProfessional(profile)) {
        await signOut(auth).catch(() => {});
        return {
          success: false,
          message: profile.status === 'rejected'
            ? 'Your professional account was not approved. Please contact an administrator.'
            : 'Your professional account is awaiting administrator approval.',
        };
      }

      return {
        success: true,
        message: 'Login successful',
        user: { ...profile, id: credential.user.uid },
      };
    } catch (error: any) {
      return {
        success: false,
        message: firebaseErrorMessage(error),
      };
    }
  },

  // ── Google Sign-In / Sign-Up ─────────────────────────────────────────────────
  googleAuth: async (_role?: string, registrationDetails?: Partial<RegisterPayload>): Promise<AuthResponse> => {
    try {
      const provider = new GoogleAuthProvider();
      provider.addScope('profile');
      provider.addScope('email');

      const credential = await signInWithPopup(auth, provider);
      const firebaseUser = credential.user;
      const idToken = await firebaseUser.getIdToken();

      // 1. Check Firestore for an existing profile (has their registered role)
      const userRef = doc(db, 'users', firebaseUser.uid);
      let existingFirestoreData: UserProfile | null = null;
      try {
        const snap = await getDoc(userRef);
        if (snap.exists()) {
          existingFirestoreData = snap.data() as UserProfile;
        }
      } catch (fsErr) {
        console.warn('Firestore read in googleAuth:', fsErr);
      }

      // 2. Call backend — pass existing role so the backend doesn't overwrite it
      //    For brand-new accounts, default to 'Patient' (never 'Admin' via Google)
      const roleHintForNewAccount = existingFirestoreData?.role || 'Patient';
      let backendUser: any = null;
      try {
        const res = await api.post('/api/auth/google', { idToken, role: roleHintForNewAccount });
        if (res.data?.success && res.data.user) {
          backendUser = res.data.user;
          if (res.data.accessToken) {
            localStorage.setItem('medtrace_access_token', res.data.accessToken);
          }
        }
      } catch (bErr) {
        console.warn('Backend Google Auth issue:', bErr);
      }

      // 3. Authoritative role: FIRESTORE > backend DB > default Patient
      //    Firestore is the source of truth because that's where registration writes the role.
      //    Backend MongoDB may not have these users or may have a stale/default role.
      const isRegistration = Boolean(registrationDetails);
      const effectiveRole: string =
        existingFirestoreData?.role || registrationDetails?.role || _role || backendUser?.role || 'Patient';

      let patientId = existingFirestoreData?.patientId;
      if (!patientId && (effectiveRole === 'Patient' || effectiveRole === 'Guardian')) {
        patientId = await generatePatientId().catch(() => `MT-2026-${Math.floor(100000 + Math.random() * 900000)}`);
      }

      const updatedProfile: UserProfile = {
        id: backendUser?.id || firebaseUser.uid,
        name: registrationDetails?.name || firebaseUser.displayName || backendUser?.name || existingFirestoreData?.name || 'Google User',
        email: firebaseUser.email || backendUser?.email || existingFirestoreData?.email || '',
        phone: registrationDetails?.phone || firebaseUser.phoneNumber || backendUser?.phone || existingFirestoreData?.phone || '',
        hospitalName: HOSPITAL_NAME,
        role: effectiveRole as UserProfile['role'],
        patientId,
        status: existingFirestoreData?.status || (isRegistration && ['Doctor', 'Nurse'].includes(effectiveRole) ? 'pending' : 'approved'),
        specialization: registrationDetails?.specialization || existingFirestoreData?.specialization,
        licenseNumber: registrationDetails?.licenseNumber || existingFirestoreData?.licenseNumber,
        registeredDate: registrationDetails?.registeredDate || existingFirestoreData?.registeredDate,
        registrationDate: registrationDetails?.registrationDate || existingFirestoreData?.registrationDate,
        approvedAt: existingFirestoreData?.approvedAt,
        approvedBy: existingFirestoreData?.approvedBy,
        createdAt: existingFirestoreData?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // 4. Persist to Firestore (merge — never wipe existing fields)
      const firestoreProfile = Object.fromEntries(
        Object.entries(updatedProfile).filter(([, value]) => value !== undefined)
      );
      await setDoc(userRef, {
        ...firestoreProfile,
        updatedAt: serverTimestamp(),
      }, { merge: true });

      localStorage.setItem('medtrace_user', JSON.stringify(updatedProfile));
      if (!isRegistration && !isApprovedProfessional(updatedProfile)) {
        await signOut(auth).catch(() => {});
        return {
          success: false,
          message: updatedProfile.status === 'rejected'
            ? 'Your professional account was not approved. Please contact an administrator.'
            : 'Your professional account is awaiting administrator approval.',
        };
      }
      return {
        success: true,
        message: 'Google authentication successful',
        user: updatedProfile,
      };
    } catch (error: any) {
      return {
        success: false,
        message: firebaseErrorMessage(error),
      };
    }
  },

  // ── Forgot Password ───────────────────────────────────────────────────────────
  forgotPassword: async (email: string): Promise<AuthResponse> => {
    try {
      await firebaseSendPasswordResetEmail(auth, email);
      return {
        success: true,
        message: 'Password reset email sent! Please check your inbox.',
      };
    } catch (error: any) {
      return {
        success: false,
        message: firebaseErrorMessage(error),
      };
    }
  },

  // ── Update Profile ────────────────────────────────────────────────────────────
  updateProfile: async (uid: string, updates: Partial<UserProfile>): Promise<AuthResponse> => {
    try {
      const ref = doc(db, 'users', uid);
      await updateDoc(ref, { ...updates, updatedAt: serverTimestamp() }).catch(() => {});
      const cached = localStorage.getItem('medtrace_user');
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          localStorage.setItem('medtrace_user', JSON.stringify({ ...parsed, ...updates }));
        } catch {}
      }
      return { success: true, message: 'Profile updated successfully.' };
    } catch (error: any) {
      return { success: false, message: firebaseErrorMessage(error) };
    }
  },

  // ── Logout ────────────────────────────────────────────────────────────────────
  logout: async (): Promise<void> => {
    try {
      await api.post('/api/auth/logout').catch(() => {});
    } catch {}
    try {
      await signOut(auth).catch(() => {});
    } catch {}
    localStorage.removeItem('medtrace_access_token');
    localStorage.removeItem('medtrace_user');
    localStorage.removeItem('token');
  },
};

