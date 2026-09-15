import api from './api';
import { createNotification } from './notificationService';

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

/**
 * Normalizes backend appointment data into a uniform Appointment object.
 */
export const normalizeAppointment = (raw: any): Appointment => {
  const id = raw._id || raw.id || `apt-${Date.now()}`;
  const docObj = typeof raw.doctorId === 'object' && raw.doctorId !== null ? raw.doctorId : null;
  const patientObj = typeof raw.patientId === 'object' && raw.patientId !== null ? raw.patientId : null;
  const userObj = patientObj?.userId || null;

  const rawDate = raw.dateTime ? new Date(raw.dateTime) : (raw.date ? new Date(raw.date) : new Date());
  const dateStr = !isNaN(rawDate.getTime()) ? rawDate.toISOString().split('T')[0] : (raw.date || '');
  const timeSlotStr = raw.timeSlot || (!isNaN(rawDate.getTime())
    ? rawDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '10:00 AM');

  const notesStr: string = raw.notes || '';
  const formatMatch = notesStr.match(/Format:\s*([^|]+)/i);
  const linkMatch = notesStr.match(/Link:\s*([^|]+)/i);
  const docNotesMatch = notesStr.match(/Notes?:\s*([^|]+)/i);

  const consultationType = raw.consultationType || (formatMatch ? formatMatch[1].trim() : 'In-Person Consultation');
  const meetingLink = raw.meetingLink || (linkMatch ? linkMatch[1].trim() : undefined);

  return {
    id,
    patientId: patientObj?._id || patientObj?.id || raw.patientId || 'default',
    patientName: userObj?.name || raw.patientName || 'Patient',
    patientPhone: userObj?.phone || raw.patientPhone,
    patientEmail: userObj?.email || raw.patientEmail,
    doctorId: docObj?._id || docObj?.id || raw.doctorId || 'doc-1',
    doctorName: docObj?.name || raw.doctorName || 'Dr. Specialist',
    doctorSpecialization: docObj?.department || raw.doctorSpecialization || 'Clinical Medicine',
    hospitalName: docObj?.hospitalName || raw.hospitalName || 'MedTrace General Hospital',
    date: dateStr,
    timeSlot: timeSlotStr,
    consultationType: consultationType as any,
    reason: raw.reason || 'General clinical consultation',
    status: raw.status || 'pending',
    doctorNotes: raw.doctorNotes || (docNotesMatch ? docNotesMatch[1].trim() : raw.notes),
    meetingLink,
    createdAt: raw.createdAt || new Date().toISOString(),
    updatedAt: raw.updatedAt || new Date().toISOString(),
  };
};

/**
 * Fetch appointments for a patient using GET /api/appointments?patientId=:patientId
 */
export const fetchPatientAppointments = async (patientId: string): Promise<Appointment[]> => {
  try {
    const res = await api.get('/api/appointments', {
      params: { patientId },
    });
    if (res.data?.success && Array.isArray(res.data?.appointments)) {
      return res.data.appointments
        .map(normalizeAppointment)
        .sort((a: Appointment, b: Appointment) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }
    return [];
  } catch (err: any) {
    console.warn('fetchPatientAppointments error:', err);
    return [];
  }
};

/**
 * Fetch appointments for a doctor using GET /api/appointments?doctorId=:doctorId
 */
export const fetchDoctorAppointments = async (doctorId?: string, doctorName?: string): Promise<Appointment[]> => {
  try {
    const params: Record<string, string> = {};
    if (doctorId) params.doctorId = doctorId;

    const res = await api.get('/api/appointments', { params });
    if (res.data?.success && Array.isArray(res.data?.appointments)) {
      let list = res.data.appointments.map(normalizeAppointment);
      if (doctorName && !doctorId) {
        const cleanName = doctorName.toLowerCase().trim();
        list = list.filter((a: Appointment) =>
          a.doctorName.toLowerCase().includes(cleanName) || cleanName.includes(a.doctorName.toLowerCase())
        );
      }
      return list.sort((a: Appointment, b: Appointment) => {
        if (a.status === 'pending' && b.status !== 'pending') return -1;
        if (b.status === 'pending' && a.status !== 'pending') return 1;
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });
    }
    return [];
  } catch (err) {
    console.warn('fetchDoctorAppointments error:', err);
    return [];
  }
};

/**
 * Book an appointment using POST /api/appointments
 */
export const bookAppointment = async (
  apt: Omit<Appointment, 'id' | 'status' | 'createdAt' | 'updatedAt'>
): Promise<Appointment> => {
  // Convert date & timeSlot to ISO dateTime string
  let appointmentDateTime: Date;
  try {
    const [timeStr, period] = (apt.timeSlot || '10:00 AM').split(' ');
    let [hours, minutes] = (timeStr || '10:00').split(':').map(Number);
    if (period === 'PM' && hours < 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    appointmentDateTime = new Date(apt.date);
    appointmentDateTime.setHours(hours || 10, minutes || 0, 0, 0);
  } catch {
    appointmentDateTime = new Date(apt.date || Date.now());
  }

  const notes = [
    apt.consultationType ? `Format: ${apt.consultationType}` : '',
    apt.doctorName ? `Doctor: ${apt.doctorName}` : '',
    apt.doctorSpecialization ? `Specialization: ${apt.doctorSpecialization}` : '',
    apt.hospitalName ? `Hospital: ${apt.hospitalName}` : '',
    apt.timeSlot ? `Slot: ${apt.timeSlot}` : '',
    apt.meetingLink ? `Link: ${apt.meetingLink}` : '',
  ].filter(Boolean).join(' | ');

  const payload = {
    patientId: apt.patientId,
    doctorId: apt.doctorId,
    dateTime: appointmentDateTime.toISOString(),
    reason: apt.reason,
    notes,
    status: 'pending',
  };

  const res = await api.post('/api/appointments', payload);

  let createdApt: Appointment;
  if (res.data?.success && res.data?.appointment) {
    createdApt = normalizeAppointment({
      ...res.data.appointment,
      patientName: apt.patientName,
      patientPhone: apt.patientPhone,
      patientEmail: apt.patientEmail,
      doctorName: apt.doctorName,
      doctorSpecialization: apt.doctorSpecialization,
      hospitalName: apt.hospitalName,
      date: apt.date,
      timeSlot: apt.timeSlot,
      consultationType: apt.consultationType,
      meetingLink: apt.meetingLink,
    });
  } else {
    createdApt = normalizeAppointment({
      id: `apt-${Date.now()}`,
      ...apt,
      status: 'pending',
      dateTime: appointmentDateTime.toISOString(),
    });
  }

  // Send notifications for patient & doctor
  try {
    await createNotification({
      userId: apt.patientId,
      title: 'Appointment Request Submitted',
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
  } catch (notifErr) {
    console.warn('Could not post appointment in-app notification:', notifErr);
  }

  return createdApt;
};

/**
 * Update appointment status using PUT /api/appointments/:id/status
 */
export const updateAppointmentStatus = async (
  appointmentId: string,
  status: Appointment['status'],
  doctorNotes?: string,
  patientId?: string
): Promise<void> => {
  try {
    await api.put(`/api/appointments/${appointmentId}/status`, {
      status,
      notes: doctorNotes,
    });
  } catch (err) {
    console.warn('updateAppointmentStatus api call error:', err);
  }

  if (patientId) {
    try {
      await createNotification({
        userId: patientId,
        title: `Appointment ${status === 'confirmed' ? 'CONFIRMED' : status.toUpperCase()}`,
        message: `Your consultation status has been updated to ${status}.${doctorNotes ? ` Note: ${doctorNotes}` : ''}`,
        category: 'appointment',
        priority: status === 'confirmed' ? 'high' : 'normal',
      });
    } catch {
      // ignore notification errors
    }
  }
};
