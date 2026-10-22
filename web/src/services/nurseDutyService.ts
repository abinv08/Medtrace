import api from './api';
import { addDoc, collection, getDocs, onSnapshot, query, serverTimestamp, where } from 'firebase/firestore';
import { db } from '../config/firebase';

export type DutyStatus = 'scheduled' | 'active' | 'completed' | 'cancelled';
export type AttendanceStatus = 'not_checked_in' | 'checked_in' | 'on_break' | 'checked_out' | 'absent';

export interface NurseDuty {
  id: string;
  _id: string;
  nurseId: string;
  wardId?: string | null;
  wardName?: string | null;
  assignedBy?: string;
  dutyDate: string;
  shift?: 'morning' | 'evening' | 'night' | 'custom';
  startTime: string;
  endTime: string;
  status: DutyStatus;
  attendanceStatus: AttendanceStatus;
  checkInAt?: unknown;
  checkOutAt?: unknown;
  breakStartedAt?: unknown;
  breakEndedAt?: unknown;
  notes?: string;
}

export const dutyWindow = (duty: NurseDuty, now = new Date()) => {
  const start = new Date(`${duty.dutyDate}T${duty.startTime}:00`);
  const end = new Date(`${duty.dutyDate}T${duty.endTime}:00`);
  if (end <= start) end.setDate(end.getDate() + 1);
  const state: DutyStatus = duty.status === 'cancelled'
    ? 'cancelled'
    : now < start
      ? 'scheduled'
      : now <= end
        ? 'active'
        : 'completed';
  return { start, end, state };
};

export const getNurseDuties = async (nurseId?: string) => {
  const response = await api.get('/api/nurse-duties', nurseId ? { params: { nurseId } } : {});
  return (response.data?.duties || []) as NurseDuty[];
};

export const subscribeToNurseDuties = (nurseId: string | undefined, onChange: (duties: NurseDuty[]) => void) => {
  const dutiesQuery = nurseId
    ? query(collection(db, 'nurseDuties'), where('nurseId', '==', nurseId))
    : collection(db, 'nurseDuties');
  return onSnapshot(dutiesQuery, (snapshot) => onChange(snapshot.docs.map((item) => ({ id: item.id, _id: item.id, ...item.data() } as NurseDuty))));
};

export const createNurseDuty = async (duty: Partial<NurseDuty>) => {
  const response = await api.post('/api/nurse-duties', duty);
  return response.data?.duty as NurseDuty;
};

export const updateNurseDuty = async (dutyId: string, updates: Partial<NurseDuty>) => api.put(`/api/nurse-duties/${dutyId}`, updates);

export const updateDutyAttendance = async (dutyId: string, action: 'checkIn' | 'startBreak' | 'endBreak' | 'checkOut', userId: string) => api.put(`/api/nurse-duties/${dutyId}/${action}`, { userId });

export const cancelNurseDuty = async (dutyId: string) => api.put(`/api/nurse-duties/${dutyId}/cancel`);

export interface ShiftHandover {
  id: string;
  dutyId: string;
  nurseId: string;
  patientId: string;
  condition: string;
  observations: string;
  medicationStatus: string;
  pendingTasks: string;
  specialInstructions: string;
  notes: string;
  createdAt?: unknown;
}

export const createShiftHandover = async (handover: Omit<ShiftHandover, 'id' | 'createdAt'>) => {
  const reference = await addDoc(collection(db, 'shiftHandovers'), { ...handover, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  return { id: reference.id, ...handover };
};

export const getLatestShiftHandover = async (patientId: string) => {
  const snapshot = await getDocs(query(collection(db, 'shiftHandovers'), where('patientId', '==', patientId)));
  const handovers = snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as ShiftHandover));
  handovers.sort((left, right) => String(right.createdAt || '').localeCompare(String(left.createdAt || '')));
  return handovers[0] || null;
};
