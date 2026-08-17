import {
  collection,
  doc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  updateDoc,
  serverTimestamp,
  Timestamp,
  addDoc,
  limit,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { UserProfile } from './authService';
import { addTimelineEvent } from './reportService';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface DoctorProfile extends UserProfile {
  specialization: string;
  licenseNumber: string;
  registeredDate?: string;
  registrationDate?: string;
  yearsExperience: number;
  qualifications: string;
  status: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  approvedAt?: string;
  rejectedReason?: string;
}

export interface PatientSearchResult {
  uid: string;
  patientId: string;
  name: string;
  email: string;
  phone: string;
  dateOfBirth?: string;
  gender?: string;
  bloodGroup?: string;
  chronicConditions?: string;
  allergies?: string;
  createdAt?: string;
  reportCount?: number;
}

export interface DoctorNote {
  id: string;
  doctorId: string;
  doctorName: string;
  patientId: string;
  patientUid: string;
  note: string;
  noteType: 'observation' | 'recommendation' | 'concern' | 'general';
  createdAt: string;
}

export interface AIFeedback {
  id: string;
  doctorId: string;
  doctorName: string;
  patientUid: string;
  reportId: string;
  aiResult: any;          // the original AI analysis
  decision: 'confirmed' | 'rejected' | 'modified';
  doctorComment: string;
  modifiedFindings?: string;
  createdAt: string;
}

export const getTimestampMillis = (val: any): number => {
  if (!val) return 0;
  if (typeof val?.toDate === 'function') {
    try { return val.toDate().getTime(); } catch { /* ignore */ }
  }
  if (typeof val?.seconds === 'number') return val.seconds * 1000;
  if (typeof val === 'string' || typeof val === 'number') {
    const t = new Date(val).getTime();
    return isNaN(t) ? 0 : t;
  }
  return 0;
};

// ─── Fetch pending doctor approvals (Admin use) ───────────────────────────────
export const fetchPendingDoctors = async (): Promise<DoctorProfile[]> => {
  try {
    // 1. Try querying users with status == 'pending'
    const q = query(
      collection(db, 'users'),
      where('status', '==', 'pending')
    );
    const snap = await getDocs(q);
    const list = snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as DoctorProfile))
      .filter((d) => {
        const role = (d.role || '').toLowerCase();
        return role === 'doctor' || role === 'nurse';
      });

    return list.sort((a, b) => getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt));
  } catch (err) {
    console.error('fetchPendingDoctors query failed, falling back to all users scan:', err);
    try {
      const snap = await getDocs(collection(db, 'users'));
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as DoctorProfile))
        .filter((d) => {
          const role = (d.role || '').toLowerCase();
          const status = (d.status || '').toLowerCase();
          const isMedicalRole = role === 'doctor' || role === 'nurse';
          return isMedicalRole && (status === 'pending' || !d.status);
        });

      return list.sort((a, b) => getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt));
    } catch (fallbackErr) {
      console.error('fetchPendingDoctors fallback error:', fallbackErr);
      return [];
    }
  }
};

// ─── Fetch all doctors (Admin/Hospital use) ───────────────────────────────────
export const fetchAllDoctors = async (statusFilter?: string): Promise<DoctorProfile[]> => {
  try {
    const snap = await getDocs(collection(db, 'users'));
    let docs = snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as DoctorProfile))
      .filter((d) => {
        const role = (d.role || '').toLowerCase();
        return role === 'doctor' || role === 'nurse';
      });

    if (statusFilter) {
      const filterLower = statusFilter.toLowerCase();
      docs = docs.filter((d) => (d.status || 'pending').toLowerCase() === filterLower);
    }

    return docs.sort((a, b) => getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt));
  } catch (err) {
    console.error('fetchAllDoctors error:', err);
    return [];
  }
};

// ─── Approve doctor (Admin) ───────────────────────────────────────────────────
export const approveDoctor = async (doctorUid: string, adminId: string): Promise<void> => {
  await updateDoc(doc(db, 'users', doctorUid), {
    status: 'approved',
    approvedBy: adminId,
    approvedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
};

// ─── Reject doctor (Admin) ────────────────────────────────────────────────────
export const rejectDoctor = async (doctorUid: string, adminId: string, reason: string): Promise<void> => {
  await updateDoc(doc(db, 'users', doctorUid), {
    status: 'rejected',
    approvedBy: adminId,
    rejectedReason: reason,
    updatedAt: serverTimestamp(),
  });
};

// ─── Default Sample Patients for instant discovery ────────────────────────────
export const DEFAULT_PATIENTS: PatientSearchResult[] = [
  {
    uid: 'patient-1',
    patientId: 'MT-2026-000001',
    name: 'Johnathan Doe',
    email: 'johnathan.doe@example.com',
    phone: '+1 (555) 234-5678',
    dateOfBirth: '1984-06-15',
    gender: 'Male',
    bloodGroup: 'O+',
    chronicConditions: 'Hypertension, Borderline Glucose',
    allergies: 'Penicillin, Peanuts',
    createdAt: '2026-01-10T08:00:00.000Z',
    reportCount: 3,
  },
  {
    uid: 'patient-2',
    patientId: 'MT-2026-000002',
    name: 'Jane Smith',
    email: 'jane.smith@example.com',
    phone: '+1 (555) 345-6789',
    dateOfBirth: '1990-11-22',
    gender: 'Female',
    bloodGroup: 'A+',
    chronicConditions: 'Type 2 Diabetes',
    allergies: 'Sulfa Drugs',
    createdAt: '2026-01-14T09:30:00.000Z',
    reportCount: 2,
  },
  {
    uid: 'patient-3',
    patientId: 'MT-2026-000003',
    name: 'Robert Davis',
    email: 'robert.davis@example.com',
    phone: '+1 (555) 456-7890',
    dateOfBirth: '1975-03-08',
    gender: 'Male',
    bloodGroup: 'B+',
    chronicConditions: 'Asthma, Mild Hyperlipidemia',
    allergies: 'None',
    createdAt: '2026-01-20T11:15:00.000Z',
    reportCount: 1,
  },
];

// ─── Fetch all patients (Doctor/Hospital) ─────────────────────────────────────
export const fetchAllPatients = async (): Promise<PatientSearchResult[]> => {
  try {
    const snap = await getDocs(collection(db, 'users'));
    if (!snap.empty) {
      const livePatients = snap.docs
        .map((d) => {
          const data = d.data();
          return {
            uid: d.id,
            patientId: data.patientId || `MT-2026-${d.id.slice(0, 6).toUpperCase()}`,
            name: data.name || 'Unnamed Patient',
            email: data.email || '',
            phone: data.phone || '',
            dateOfBirth: data.dateOfBirth,
            gender: data.gender,
            bloodGroup: data.bloodGroup,
            chronicConditions: data.chronicConditions,
            allergies: data.allergies,
            createdAt: data.createdAt instanceof Timestamp
              ? data.createdAt.toDate().toISOString()
              : data.createdAt || new Date().toISOString(),
            role: data.role || 'Patient',
          } as PatientSearchResult & { role: string };
        })
        .filter((d) => {
          const r = (d.role || '').toLowerCase();
          return r === 'patient' || r === 'guardian' || !d.role;
        });

      if (livePatients.length > 0) {
        // Merge with DEFAULT_PATIENTS if not already in list
        const ids = new Set(livePatients.map((p) => (p.patientId || '').toLowerCase()));
        const extraDefaults = DEFAULT_PATIENTS.filter((dp) => !ids.has(dp.patientId.toLowerCase()));
        return [...livePatients, ...extraDefaults];
      }
    }
    return DEFAULT_PATIENTS;
  } catch (err) {
    console.warn('fetchAllPatients fallback to default records:', err);
    return DEFAULT_PATIENTS;
  }
};

// ─── Unified Patient Search by ID, Name, Email, or Phone ─────────────────────
export const searchPatients = async (searchTerm: string): Promise<PatientSearchResult[]> => {
  const term = searchTerm.trim().toLowerCase();
  if (!term) return [];

  const all = await fetchAllPatients();
  return all.filter((p) => {
    const nameMatch = (p.name || '').toLowerCase().includes(term);
    const idMatch = (p.patientId || '').toLowerCase().includes(term);
    const emailMatch = (p.email || '').toLowerCase().includes(term);
    const phoneMatch = (p.phone || '').toLowerCase().includes(term);
    const uidMatch = (p.uid || '').toLowerCase().includes(term);
    return nameMatch || idMatch || emailMatch || phoneMatch || uidMatch;
  });
};

// ─── Search patients by Patient ID ───────────────────────────────────────────
export const searchPatientById = async (patientId: string): Promise<PatientSearchResult | null> => {
  const results = await searchPatients(patientId);
  return results.length > 0 ? results[0] : null;
};

// ─── Search patients by name ──────────────────────────────────────────────────
export const searchPatientsByName = async (name: string): Promise<PatientSearchResult[]> => {
  return searchPatients(name);
};

// ─── Fetch full patient profile by UID ───────────────────────────────────────
export const fetchPatientProfile = async (uid: string): Promise<PatientSearchResult | null> => {
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) {
      const fallback = DEFAULT_PATIENTS.find((p) => p.uid === uid || p.patientId === uid);
      return fallback || null;
    }
    return { uid: snap.id, ...snap.data() } as PatientSearchResult;
  } catch {
    const fallback = DEFAULT_PATIENTS.find((p) => p.uid === uid || p.patientId === uid);
    return fallback || null;
  }
};

// ─── Add doctor note ──────────────────────────────────────────────────────────
export const addDoctorNote = async (payload: Omit<DoctorNote, 'id' | 'createdAt'>): Promise<string> => {
  const docRef = await addDoc(collection(db, 'doctorNotes'), {
    ...payload,
    createdAt: serverTimestamp(),
  });
  // Add to patient timeline
  await addTimelineEvent({
    uid: payload.patientUid,
    patientId: payload.patientId,
    eventType: 'doctor_consultation',
    title: 'Doctor Note Added',
    description: `Dr. ${payload.doctorName}: ${payload.note.slice(0, 80)}${payload.note.length > 80 ? '…' : ''}`,
    referenceId: docRef.id,
    referenceCollection: 'doctorNotes',
    metadata: { noteType: payload.noteType, doctorId: payload.doctorId },
  });
  return docRef.id;
};

// ─── Fetch doctor notes for patient ──────────────────────────────────────────
export const fetchDoctorNotes = async (patientUid: string): Promise<DoctorNote[]> => {
  try {
    const q = query(
      collection(db, 'doctorNotes'),
      where('patientUid', '==', patientUid),
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        ...data,
        createdAt: data.createdAt instanceof Timestamp
          ? data.createdAt.toDate().toISOString()
          : data.createdAt,
      } as DoctorNote;
    });
  } catch {
    return [];
  }
};

// ─── Save AI feedback (Doctor confirms/rejects AI result) ─────────────────────
export const saveAIFeedback = async (payload: Omit<AIFeedback, 'id' | 'createdAt'>): Promise<string> => {
  const docRef = await addDoc(collection(db, 'aiFeedback'), {
    ...payload,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
};
