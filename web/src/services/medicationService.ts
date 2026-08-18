import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { getTimestampMillis } from './doctorService';
import { createNotification } from './notificationService';

export interface MedicationItem {
  id: string;
  patientId: string;
  name: string;
  dosage: string;
  frequency: 'Once Daily' | 'Twice Daily' | 'Three Times Daily' | 'Four Times Daily' | 'As Needed' | 'Weekly';
  timeSlots: ('Morning' | 'Afternoon' | 'Evening' | 'Night')[];
  prescribingDoctor?: string;
  instructions: string;
  status: 'active' | 'completed' | 'discontinued';
  startDate: string;
  endDate?: string;
  refillsRemaining?: number;
  category?: 'Cardiovascular' | 'Antidiabetic' | 'Antibiotic' | 'Analgesic' | 'Respiratory' | 'Supplement' | 'Other';
  createdAt?: any;
  updatedAt?: any;
}

export interface MedicationDoseLog {
  id: string;
  patientId: string;
  medicationId: string;
  medicationName: string;
  date: string; // YYYY-MM-DD
  timeSlot: 'Morning' | 'Afternoon' | 'Evening' | 'Night';
  status: 'taken' | 'skipped' | 'pending';
  loggedAt?: string;
  notes?: string;
}

const DEFAULT_MEDICATIONS: MedicationItem[] = [
  {
    id: 'med-1',
    patientId: 'default',
    name: 'Metformin Hydrochloride',
    dosage: '500 mg',
    frequency: 'Twice Daily',
    timeSlots: ['Morning', 'Evening'],
    prescribingDoctor: 'Dr. Sarah Jenkins',
    instructions: 'Take orally with meals to reduce gastrointestinal upset.',
    status: 'active',
    startDate: '2026-01-15',
    category: 'Antidiabetic',
    refillsRemaining: 3,
  },
  {
    id: 'med-2',
    patientId: 'default',
    name: 'Amlodipine Besylate',
    dosage: '5 mg',
    frequency: 'Once Daily',
    timeSlots: ['Morning'],
    prescribingDoctor: 'Dr. Alexander Wright',
    instructions: 'Take every morning at the same time for blood pressure control.',
    status: 'active',
    startDate: '2026-02-01',
    category: 'Cardiovascular',
    refillsRemaining: 5,
  },
  {
    id: 'med-3',
    patientId: 'default',
    name: 'Atorvastatin Calcium',
    dosage: '20 mg',
    frequency: 'Once Daily',
    timeSlots: ['Night'],
    prescribingDoctor: 'Dr. Alexander Wright',
    instructions: 'Take at bedtime. Avoid grapefruit juice.',
    status: 'active',
    startDate: '2026-02-10',
    category: 'Cardiovascular',
    refillsRemaining: 2,
  },
  {
    id: 'med-4',
    patientId: 'default',
    name: 'Vitamin D3 & Omega-3',
    dosage: '1000 IU',
    frequency: 'Once Daily',
    timeSlots: ['Morning'],
    prescribingDoctor: 'Dr. Robert Chen',
    instructions: 'Dietary supplement with breakfast.',
    status: 'active',
    startDate: '2026-01-01',
    category: 'Supplement',
    refillsRemaining: 6,
  },
];

const LOCAL_MED_CACHE: Record<string, MedicationItem[]> = {};
const LOCAL_DOSE_LOGS: Record<string, MedicationDoseLog[]> = {};

export const fetchPatientMedications = async (patientId: string): Promise<MedicationItem[]> => {
  try {
    const q = query(
      collection(db, 'medications'),
      where('patientId', '==', patientId)
    );
    const snap = await getDocs(q);
    if (snap.empty) {
      return LOCAL_MED_CACHE[patientId] || [];
    }
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as MedicationItem));
    LOCAL_MED_CACHE[patientId] = list;
    return list;
  } catch (err) {
    console.warn('fetchPatientMedications fallback:', err);
    return LOCAL_MED_CACHE[patientId] || [];
  }
};

export const addMedication = async (med: Omit<MedicationItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<MedicationItem> => {
  const id = `med-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const newMed: MedicationItem = {
    ...med,
    id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  try {
    await setDoc(doc(db, 'medications', id), {
      ...newMed,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch {
    if (!LOCAL_MED_CACHE[med.patientId]) {
      LOCAL_MED_CACHE[med.patientId] = [];
    }
    LOCAL_MED_CACHE[med.patientId].unshift(newMed);
  }

  // Create automatic reminder notification
  await createNotification({
    userId: med.patientId,
    title: `New Prescription Added: ${med.name}`,
    message: `${med.dosage} (${med.frequency}) prescribed by ${med.prescribingDoctor || 'Doctor'}.`,
    category: 'medication',
    priority: 'normal',
  });

  return newMed;
};

export const updateMedication = async (id: string, updates: Partial<MedicationItem>, patientId: string): Promise<void> => {
  try {
    await updateDoc(doc(db, 'medications', id), {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  } catch {
    if (LOCAL_MED_CACHE[patientId]) {
      const idx = LOCAL_MED_CACHE[patientId].findIndex((m) => m.id === id);
      if (idx !== -1) {
        LOCAL_MED_CACHE[patientId][idx] = { ...LOCAL_MED_CACHE[patientId][idx], ...updates };
      }
    }
  }
};

export const deleteMedication = async (id: string, patientId: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, 'medications', id));
  } catch {
    if (LOCAL_MED_CACHE[patientId]) {
      LOCAL_MED_CACHE[patientId] = LOCAL_MED_CACHE[patientId].filter((m) => m.id !== id);
    }
  }
};

export const logDoseAdherence = async (
  log: Omit<MedicationDoseLog, 'id' | 'loggedAt'>
): Promise<MedicationDoseLog> => {
  const logId = `doselog-${log.patientId}-${log.medicationId}-${log.date}-${log.timeSlot}`;
  const newLog: MedicationDoseLog = {
    ...log,
    id: logId,
    loggedAt: new Date().toISOString(),
  };

  try {
    await setDoc(doc(db, 'medicationLogs', logId), {
      ...newLog,
      loggedAt: serverTimestamp(),
    });
  } catch {
    if (!LOCAL_DOSE_LOGS[log.patientId]) {
      LOCAL_DOSE_LOGS[log.patientId] = [];
    }
    const existing = LOCAL_DOSE_LOGS[log.patientId].findIndex((l) => l.id === logId);
    if (existing !== -1) {
      LOCAL_DOSE_LOGS[log.patientId][existing] = newLog;
    } else {
      LOCAL_DOSE_LOGS[log.patientId].push(newLog);
    }
  }

  return newLog;
};

export const fetchDoseLogs = async (patientId: string, date: string): Promise<MedicationDoseLog[]> => {
  try {
    const q = query(
      collection(db, 'medicationLogs'),
      where('patientId', '==', patientId),
      where('date', '==', date)
    );
    const snap = await getDocs(q);
    if (snap.empty) {
      return (LOCAL_DOSE_LOGS[patientId] || []).filter((l) => l.date === date);
    }
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as MedicationDoseLog));
  } catch {
    return (LOCAL_DOSE_LOGS[patientId] || []).filter((l) => l.date === date);
  }
};

export const calculateAdherenceRate = async (patientId: string): Promise<number> => {
  const meds = await fetchPatientMedications(patientId);
  if (meds.length === 0) return 100;
  // Compute recent logs (last 7 days)
  const logs = LOCAL_DOSE_LOGS[patientId] || [];
  const taken = logs.filter((l) => l.status === 'taken').length;
  const total = logs.length;
  if (total === 0) return 92; // default high initial score
  return Math.min(100, Math.round((taken / total) * 100));
};
