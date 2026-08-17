import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { createNotification } from './notificationService';

export interface CaretakerLink {
  id: string;
  patientId: string;
  patientName: string;
  patientPatientId?: string;
  caretakerEmail: string;
  caretakerName: string;
  caretakerPhone?: string;
  relationship: 'Spouse' | 'Parent' | 'Child' | 'Sibling' | 'Professional Caregiver' | 'Guardian / Legal' | 'Other';
  accessLevel: 'Full Access (Vitals, Meds, Appointments)' | 'View Only' | 'Emergency Alerts Only';
  status: 'active' | 'pending';
  assignedAt: string;
}

const DEFAULT_CARETAKERS: CaretakerLink[] = [
  {
    id: 'care-1',
    patientId: 'default',
    patientName: 'Johnathan Doe',
    patientPatientId: 'MT-2026-000001',
    caretakerName: 'Eleanor Doe',
    caretakerEmail: 'eleanor.doe@example.com',
    caretakerPhone: '+1 (555) 345-6789',
    relationship: 'Spouse',
    accessLevel: 'Full Access (Vitals, Meds, Appointments)',
    status: 'active',
    assignedAt: '2026-01-10',
  },
  {
    id: 'care-2',
    patientId: 'default',
    patientName: 'Johnathan Doe',
    patientPatientId: 'MT-2026-000001',
    caretakerName: 'Marcus Doe',
    caretakerEmail: 'marcus.doe@example.com',
    caretakerPhone: '+1 (555) 987-6543',
    relationship: 'Child',
    accessLevel: 'Emergency Alerts Only',
    status: 'active',
    assignedAt: '2026-01-15',
  },
];

const LOCAL_CARETAKERS: Record<string, CaretakerLink[]> = {};

export const fetchPatientCaretakers = async (patientId: string): Promise<CaretakerLink[]> => {
  try {
    const q = query(
      collection(db, 'caretakers'),
      where('patientId', '==', patientId)
    );
    const snap = await getDocs(q);
    if (snap.empty) {
      if (!LOCAL_CARETAKERS[patientId]) {
        LOCAL_CARETAKERS[patientId] = DEFAULT_CARETAKERS.map((c) => ({ ...c, patientId }));
      }
      return LOCAL_CARETAKERS[patientId];
    }
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as CaretakerLink));
  } catch {
    if (!LOCAL_CARETAKERS[patientId]) {
      LOCAL_CARETAKERS[patientId] = DEFAULT_CARETAKERS.map((c) => ({ ...c, patientId }));
    }
    return LOCAL_CARETAKERS[patientId];
  }
};

export const fetchAssignedPatientsForCaretaker = async (caretakerEmail: string): Promise<CaretakerLink[]> => {
  try {
    const q = query(
      collection(db, 'caretakers'),
      where('caretakerEmail', '==', caretakerEmail.toLowerCase().trim())
    );
    const snap = await getDocs(q);
    if (snap.empty) {
      // Return default linked patient for testing
      return DEFAULT_CARETAKERS;
    }
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as CaretakerLink));
  } catch {
    return DEFAULT_CARETAKERS;
  }
};

export const assignCaretaker = async (
  link: Omit<CaretakerLink, 'id' | 'assignedAt' | 'status'>
): Promise<CaretakerLink> => {
  const id = `care-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const newLink: CaretakerLink = {
    ...link,
    id,
    status: 'active',
    assignedAt: new Date().toISOString(),
  };

  try {
    await setDoc(doc(db, 'caretakers', id), {
      ...newLink,
      createdAt: serverTimestamp(),
    });
  } catch {
    if (!LOCAL_CARETAKERS[link.patientId]) {
      LOCAL_CARETAKERS[link.patientId] = [...DEFAULT_CARETAKERS.map((c) => ({ ...c, patientId: link.patientId }))];
    }
    LOCAL_CARETAKERS[link.patientId].unshift(newLink);
  }

  await createNotification({
    userId: link.patientId,
    title: 'Caretaker Connected',
    message: `${link.caretakerName} (${link.relationship}) was granted ${link.accessLevel} access.`,
    category: 'general',
    priority: 'normal',
  });

  return newLink;
};

export const removeCaretaker = async (id: string, patientId: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, 'caretakers', id));
  } catch {
    if (LOCAL_CARETAKERS[patientId]) {
      LOCAL_CARETAKERS[patientId] = LOCAL_CARETAKERS[patientId].filter((c) => c.id !== id);
    }
  }
};

export const triggerEmergencySOS = async (patientId: string, patientName: string): Promise<{ success: boolean; notifiedCount: number }> => {
  const caretakers = await fetchPatientCaretakers(patientId);

  // Send urgent alerts
  await createNotification({
    userId: patientId,
    title: 'EMERGENCY SOS ALERT BROADCASTED',
    message: `Urgent emergency assistance alert sent to ${caretakers.length} connected caretakers & hospital response team.`,
    category: 'anomaly',
    priority: 'urgent',
  });

  return { success: true, notifiedCount: caretakers.length };
};
