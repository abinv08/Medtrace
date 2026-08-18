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
  role: 'Patient' | 'Guardian' | 'Doctor' | 'Nurse' | 'Hospital Administrator' | 'Admin' | 'Caretaker';
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

// ─── Helper: map Firebase error codes to human-readable messages ──────────────
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
    default:
      if (message) {
        return code ? `Error [${code}]: ${message}` : message;
      }
      return 'An unexpected error occurred. Please try again.';
  }
};

// ─── Helper: fetch user profile from Firestore ────────────────────────────────
export const fetchUserProfile = async (uid: string): Promise<UserProfile | null> => {
  try {
    const ref = doc(db, 'users', uid);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const data = snap.data() as UserProfile;
      if (data.email && data.role !== 'Caretaker') {
        const isCaretaker = await checkIsAssignedCaretaker(data.email);
        if (isCaretaker) {
          data.role = 'Caretaker';
          updateDoc(ref, { role: 'Caretaker', updatedAt: serverTimestamp() }).catch(() => {});
        }
      }
      return data;
    }
    return null;
  } catch {
    return null;
  }
};

// ─── Patient ID Generator (MT-YYYY-XXXXXX) ────────────────────────────────────
// Uses a Firestore transaction on a counter document to guarantee uniqueness
export const generatePatientId = async (): Promise<string> => {
  const year = new Date().getFullYear();
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
};

// ─── Auth Service ─────────────────────────────────────────────────────────────
export const authService = {
  // ── Email/Password Registration ──────────────────────────────────────────────
  register: async (payload: RegisterPayload): Promise<AuthResponse> => {
    try {
      // 1. Create Firebase Auth user
      const credential = await createUserWithEmailAndPassword(
        auth,
        payload.email,
        payload.password
      );
      const firebaseUser = credential.user;

      // 2. Set display name in Firebase Auth
      await updateProfile(firebaseUser, { displayName: payload.name });

      // 3. Check if assigned caretaker
      const isCaretaker = await checkIsAssignedCaretaker(payload.email);
      const effectiveRole = isCaretaker ? 'Caretaker' : (payload.role as UserProfile['role']);

      let patientId: string | undefined;
      if (effectiveRole === 'Patient' || effectiveRole === 'Guardian') {
        patientId = await generatePatientId();
      }

      // 4. Build the profile — doctor gets status=pending, others active
      const roleLower = (effectiveRole || '').toLowerCase();
      const isDoctor = roleLower === 'doctor' || roleLower === 'nurse';
      const regDate = payload.registeredDate || payload.registrationDate;
      const profileData: Omit<UserProfile, 'id'> & { createdAt: any; updatedAt: any } = {
        name: payload.name,
        email: payload.email.toLowerCase().trim(),
        phone: payload.phone,
        hospitalName: HOSPITAL_NAME,
        role: effectiveRole,
        patientId,
        status: isDoctor ? 'pending' : undefined,
        specialization: payload.specialization,
        licenseNumber: payload.licenseNumber,
        registeredDate: regDate,
        registrationDate: regDate,
        yearsExperience: payload.yearsExperience,
        qualifications: payload.qualifications,
        createdAt: serverTimestamp() as any,
        updatedAt: serverTimestamp() as any,
      };

      // Remove undefined keys so Firestore doesn't complain
      Object.keys(profileData).forEach((k) => {
        if ((profileData as any)[k] === undefined) delete (profileData as any)[k];
      });

      // 5. Save to Firestore users collection
      await setDoc(doc(db, 'users', firebaseUser.uid), profileData);

      // 6. If patient, also create a patient health record stub
      if (payload.role === 'Patient' && patientId) {
        await setDoc(doc(db, 'patientRecords', firebaseUser.uid), {
          uid: firebaseUser.uid,
          patientId,
          name: payload.name,
          email: payload.email.toLowerCase().trim(),
          phone: payload.phone,
          bloodGroup: '',
          dateOfBirth: '',
          gender: '',
          address: '',
          allergies: '',
          chronicConditions: '',
          emergencyContact: '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      return {
        success: true,
        message:
          payload.role === 'Doctor'
            ? 'Account created. Your profile is pending admin approval. You will be notified once approved.'
            : 'Account created successfully',
        user: {
          id: firebaseUser.uid,
          ...profileData,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      };
    } catch (error: any) {
      return {
        success: false,
        message: firebaseErrorMessage(error),
      };
    }
  },

  // ── Email/Password Login ─────────────────────────────────────────────────────
  login: async (payload: LoginPayload): Promise<AuthResponse> => {
    try {
      // Set session persistence based on rememberMe
      await setPersistence(
        auth,
        payload.rememberMe ? browserLocalPersistence : browserSessionPersistence
      );

      const credential = await signInWithEmailAndPassword(
        auth,
        payload.email,
        payload.password
      );

      // Fetch extended profile from Firestore
      const profile = await fetchUserProfile(credential.user.uid);
      if (!profile) {
        return { success: false, message: 'User profile not found. Please re-register.' };
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
  googleAuth: async (role?: string): Promise<AuthResponse> => {
    try {
      const provider = new GoogleAuthProvider();
      provider.addScope('profile');
      provider.addScope('email');

      const credential = await signInWithPopup(auth, provider);
      const firebaseUser = credential.user;

      // Check if profile already exists in Firestore
      let profile = await fetchUserProfile(firebaseUser.uid);

      if (!profile) {
        // New Google user — check if email is an assigned caretaker
        const isCaretaker = await checkIsAssignedCaretaker(firebaseUser.email || '');
        const resolvedRole = isCaretaker ? 'Caretaker' : ((role as UserProfile['role']) || 'Patient');
        let patientId: string | undefined;
        if (resolvedRole === 'Patient' || resolvedRole === 'Guardian') {
          patientId = await generatePatientId();
        }

        const newProfile: Omit<UserProfile, 'id'> & { createdAt: any } = {
          name: firebaseUser.displayName || 'Google User',
          email: firebaseUser.email || '',
          phone: firebaseUser.phoneNumber || '',
          hospitalName: HOSPITAL_NAME,
          role: resolvedRole,
          patientId,
          createdAt: serverTimestamp() as any,
        };
        await setDoc(doc(db, 'users', firebaseUser.uid), newProfile);

        if (resolvedRole === 'Patient' && patientId) {
          await setDoc(doc(db, 'patientRecords', firebaseUser.uid), {
            uid: firebaseUser.uid,
            patientId,
            name: newProfile.name,
            email: newProfile.email,
            phone: newProfile.phone,
            createdAt: serverTimestamp(),
          });
        }

        profile = { id: firebaseUser.uid, ...newProfile, createdAt: new Date().toISOString() };
      } else {
        profile = { ...profile, id: firebaseUser.uid };
      }

      return {
        success: true,
        message: 'Google authentication successful',
        user: profile,
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
      await updateDoc(ref, { ...updates, updatedAt: serverTimestamp() });
      return { success: true, message: 'Profile updated successfully.' };
    } catch (error: any) {
      return { success: false, message: firebaseErrorMessage(error) };
    }
  },

  // ── Logout ────────────────────────────────────────────────────────────────────
  logout: async (): Promise<void> => {
    await signOut(auth);
  },
};
