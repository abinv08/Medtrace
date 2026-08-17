import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { createNotification } from './notificationService';
import { getTimestampMillis } from './doctorService';

export interface Appointment {
  id: string;
  patientId: string;
  patientName: string;
  patientPhone?: string;
  patientEmail?: string;
  doctorId: string;
  doctorName: string;
  doctorSpecialization?: string;
  hospitalName?: string;
  date: string; // YYYY-MM-DD
  timeSlot: string; // e.g. "10:30 AM"
  consultationType: 'In-Person Consultation' | 'Teleconsultation / Video' | 'Follow-up Checkup' | 'Emergency / Urgent';
  reason: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  doctorNotes?: string;
  meetingLink?: string;
  createdAt?: any;
  updatedAt?: any;
}

const DEFAULT_APPOINTMENTS: Appointment[] = [
  {
    id: 'apt-1',
    patientId: 'default',
    patientName: 'Johnathan Doe',
    patientPhone: '+1 (555) 234-5678',
    doctorId: 'doc-alexander-wright',
    doctorName: 'Dr. Alexander Wright',
    doctorSpecialization: 'Cardiology',
    hospitalName: 'MedTrace General Hospital',
    date: '2026-02-24',
    timeSlot: '10:30 AM',
    consultationType: 'In-Person Consultation',
    reason: 'Routine quarterly cardiovascular review & BP check',
    status: 'confirmed',
    doctorNotes: 'Please bring recent lipid profile results.',
  },
  {
    id: 'apt-2',
    patientId: 'default',
    patientName: 'Johnathan Doe',
    doctorId: 'doc-sarah-jenkins',
    doctorName: 'Dr. Sarah Jenkins',
    doctorSpecialization: 'Endocrinology & Diabetes',
    hospitalName: 'MedTrace General Hospital',
    date: '2026-03-02',
    timeSlot: '02:30 PM',
    consultationType: 'Teleconsultation / Video',
    reason: 'HbA1c & fasting glucose titration follow-up',
    status: 'pending',
    meetingLink: 'https://meet.medtrace.health/clinical-room-884',
  },
  {
    id: 'apt-3',
    patientId: 'default',
    patientName: 'Johnathan Doe',
    doctorId: 'doc-alexander-wright',
    doctorName: 'Dr. Alexander Wright',
    doctorSpecialization: 'Cardiology',
    date: '2026-01-10',
    timeSlot: '11:00 AM',
    consultationType: 'In-Person Consultation',
    reason: 'Initial consultation for elevated resting BP',
    status: 'completed',
    doctorNotes: 'Prescribed Amlodipine 5mg once daily. Advised 30 min daily walking.',
  },
];

// Shared global memory store across sessions
const GLOBAL_APPOINTMENTS_STORE: Appointment[] = [...DEFAULT_APPOINTMENTS];
const LOCAL_APPOINTMENTS: Record<string, Appointment[]> = {};

export const fetchPatientAppointments = async (patientId: string): Promise<Appointment[]> => {
  try {
    const snap = await getDocs(collection(db, 'appointments'));
    if (!snap.empty) {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as Appointment))
        .filter((a) => a.patientId === patientId || a.patientId === 'default');

      if (list.length > 0) {
        return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      }
    }
    const memList = GLOBAL_APPOINTMENTS_STORE.filter((a) => a.patientId === patientId || a.patientId === 'default');
    return memList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  } catch (err) {
    console.warn('fetchPatientAppointments fallback:', err);
    const memList = GLOBAL_APPOINTMENTS_STORE.filter((a) => a.patientId === patientId || a.patientId === 'default');
    return memList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }
};

export const fetchDoctorAppointments = async (doctorId?: string, doctorName?: string): Promise<Appointment[]> => {
  try {
    const snap = await getDocs(collection(db, 'appointments'));
    let liveList: Appointment[] = [];
    if (!snap.empty) {
      liveList = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Appointment));
    }

    // Merge live Firestore appointments with global store
    const existingIds = new Set(liveList.map((a) => a.id));
    const merged = [
      ...liveList,
      ...GLOBAL_APPOINTMENTS_STORE.filter((a) => !existingIds.has(a.id)),
    ];

    if (doctorId || doctorName) {
      const docNameClean = (doctorName || '').toLowerCase().trim();
      const docIdClean = (doctorId || '').toLowerCase().trim();

      const specific = merged.filter((a) => {
        const matchesId = docIdClean && (a.doctorId?.toLowerCase() === docIdClean || a.doctorId === doctorId);
        const matchesName = docNameClean && (a.doctorName?.toLowerCase().includes(docNameClean) || docNameClean.includes(a.doctorName?.toLowerCase()));
        return matchesId || matchesName;
      });

      // If doctor has specific appointments, return them; otherwise return all available appointments for triage
      if (specific.length > 0) {
        return specific.sort((a, b) => {
          if (a.status === 'pending' && b.status !== 'pending') return -1;
          if (b.status === 'pending' && a.status !== 'pending') return 1;
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        });
      }
    }

    return merged.sort((a, b) => {
      if (a.status === 'pending' && b.status !== 'pending') return -1;
      if (b.status === 'pending' && a.status !== 'pending') return 1;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
  } catch (err) {
    console.warn('fetchDoctorAppointments fallback:', err);
    return GLOBAL_APPOINTMENTS_STORE.sort((a, b) => {
      if (a.status === 'pending' && b.status !== 'pending') return -1;
      if (b.status === 'pending' && a.status !== 'pending') return 1;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
  }
};

export const bookAppointment = async (
  apt: Omit<Appointment, 'id' | 'status' | 'createdAt' | 'updatedAt'>
): Promise<Appointment> => {
  const id = `apt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const newApt: Appointment = {
    ...apt,
    id,
    status: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Add to global store immediately
  GLOBAL_APPOINTMENTS_STORE.unshift(newApt);

  try {
    await setDoc(doc(db, 'appointments', id), {
      ...newApt,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn('bookAppointment firestore write failed, saved to global store:', err);
  }

  // Create notifications for patient and doctor
  await createNotification({
    userId: apt.patientId,
    title: `Appointment Request Submitted`,
    message: `Requested consultation with ${apt.doctorName} on ${apt.date} at ${apt.timeSlot}.`,
    category: 'appointment',
    priority: 'normal',
  });

  if (apt.doctorId) {
    await createNotification({
      userId: apt.doctorId,
      title: `New Appointment Booking: ${apt.patientName}`,
      message: `Requested ${apt.consultationType} on ${apt.date} at ${apt.timeSlot}.`,
      category: 'appointment',
      priority: 'high',
    });
  }

  return newApt;
};

export const updateAppointmentStatus = async (
  appointmentId: string,
  status: Appointment['status'],
  doctorNotes?: string,
  patientId?: string
): Promise<void> => {
  // Update in global memory store
  const target = GLOBAL_APPOINTMENTS_STORE.find((a) => a.id === appointmentId);
  if (target) {
    target.status = status;
    if (doctorNotes) target.doctorNotes = doctorNotes;
    target.updatedAt = new Date().toISOString();
  }

  try {
    await updateDoc(doc(db, 'appointments', appointmentId), {
      status,
      doctorNotes: doctorNotes || '',
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn('updateAppointmentStatus firestore update fallback:', err);
  }

  if (patientId || target?.patientId) {
    const pId = patientId || target?.patientId || '';
    await createNotification({
      userId: pId,
      title: `Appointment ${status === 'confirmed' ? 'CONFIRMED' : status.toUpperCase()}`,
      message: `Your consultation on ${target?.date || 'scheduled date'} has been ${status}.${doctorNotes ? ` Note: ${doctorNotes}` : ''}`,
      category: 'appointment',
      priority: status === 'confirmed' ? 'high' : 'normal',
    });
  }
};
