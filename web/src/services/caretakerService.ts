import api from './api';
import { createNotification } from './notificationService';

export interface CaretakerLink {
  id: string; // The assignment _id
  assignmentId?: string;
  patientId: string;
  patientName: string;
  patientPatientId?: string;
  caretakerId?: string;
  caretakerEmail: string;
  caretakerName: string;
  caretakerPhone?: string;
  relationship: 'Spouse' | 'Parent' | 'Child' | 'Sibling' | 'Professional Caregiver' | 'Guardian / Legal' | 'Other' | string;
  accessLevel: 'Full Access (Vitals, Meds, Appointments)' | 'View Only' | 'Emergency Alerts Only' | string;
  status: 'active' | 'pending' | 'revoked' | string;
  assignedAt: string;
}

export interface AssignCaretakerPayload {
  patientId: string;
  patientName?: string;
  patientPatientId?: string;
  caretakerId?: string;
  caretakerName: string;
  caretakerEmail: string;
  caretakerPhone?: string;
  relationship: string;
  accessLevel: string;
}

/**
 * Normalizes backend assignment document into CaretakerLink interface
 */
export const normalizeAssignmentToLink = (
  assignment: any,
  fallbackPatientId?: string,
  fallbackPatientName?: string
): CaretakerLink => {
  const cUser = typeof assignment.caretakerId === 'object' && assignment.caretakerId ? assignment.caretakerId : {};
  const pDoc = typeof assignment.patientId === 'object' && assignment.patientId ? assignment.patientId : {};
  const pUser = typeof pDoc.userId === 'object' && pDoc.userId ? pDoc.userId : {};

  const id = String(assignment._id || assignment.id || '');
  const caretakerId = typeof assignment.caretakerId === 'string'
    ? assignment.caretakerId
    : (cUser._id ? String(cUser._id) : undefined);

  const caretakerName = cUser.name || assignment.caretakerName || 'Assigned Caretaker';
  const caretakerEmail = cUser.email || assignment.caretakerEmail || '';
  const caretakerPhone = cUser.phone || assignment.caretakerPhone || '';
  const patientId = String(pDoc._id || pDoc.id || fallbackPatientId || assignment.patientId || '');
  const patientName = pUser.name || fallbackPatientName || 'Patient';

  let accessLevel = 'Full Access (Vitals, Meds, Appointments)';
  const perms = Array.isArray(assignment.permissions) ? assignment.permissions : [];
  if (perms.length === 1 && perms[0] === 'alerts') {
    accessLevel = 'Emergency Alerts Only';
  } else if (perms.includes('vitals_read') && !perms.includes('vitals')) {
    accessLevel = 'View Only';
  }

  return {
    id,
    assignmentId: id,
    caretakerId,
    patientId,
    patientName,
    caretakerName,
    caretakerEmail,
    caretakerPhone,
    relationship: assignment.relationship || 'Spouse',
    accessLevel,
    status: assignment.status || 'active',
    assignedAt: assignment.createdAt || assignment.assignedAt || new Date().toISOString(),
  };
};

/**
 * Fetch caretakers assigned to a patient via GET /api/caretaker/patient/:patientId
 * (with fallback to GET /api/patients/:patientId)
 */
export const fetchPatientCaretakers = async (
  patientId: string,
  patientName?: string
): Promise<CaretakerLink[]> => {
  if (!patientId) return [];

  try {
    const res = await api.get(`/api/caretaker/patient/${encodeURIComponent(patientId)}`);
    if (res.data?.success && Array.isArray(res.data.assignments)) {
      return res.data.assignments
        .filter((a: any) => a.status !== 'revoked')
        .map((a: any) => normalizeAssignmentToLink(a, patientId, patientName));
    }
  } catch (err) {
    // Secondary fallback: check patient document assignedCaretakers
    try {
      const patientRes = await api.get(`/api/patients/${encodeURIComponent(patientId)}`);
      const patient = patientRes.data?.patient;
      if (patient && Array.isArray(patient.assignedCaretakers)) {
        return patient.assignedCaretakers.map((c: any) => ({
          id: String(c._id || c.id || c),
          assignmentId: String(c._id || c.id || c),
          patientId: String(patient._id || patientId),
          patientName: patientName || patient.userId?.name || 'Patient',
          caretakerId: String(c._id || c.id || c),
          caretakerEmail: c.email || '',
          caretakerName: c.name || 'Assigned Caretaker',
          caretakerPhone: c.phone || '',
          relationship: 'Professional Caregiver',
          accessLevel: 'Full Access (Vitals, Meds, Appointments)',
          status: 'active',
          assignedAt: c.createdAt || new Date().toISOString(),
        }));
      }
    } catch {
      // ignore
    }
  }

  return [];
};

/**
 * Check if an email belongs to an assigned caretaker
 */
export const checkIsAssignedCaretaker = async (email: string): Promise<boolean> => {
  if (!email) return false;
  try {
    const patients = await fetchAssignedPatientsForCaretaker(email);
    return patients.length > 0;
  } catch {
    return false;
  }
};

/**
 * Fetch assigned patients for a caretaker via GET /api/caretaker/:caretakerId/patients
 */
export const fetchAssignedPatientsForCaretaker = async (
  caretakerIdOrEmail: string
): Promise<CaretakerLink[]> => {
  if (!caretakerIdOrEmail) return [];

  try {
    const res = await api.get(`/api/caretaker/${encodeURIComponent(caretakerIdOrEmail)}/patients`);
    if (res.data?.success && Array.isArray(res.data.assignments)) {
      return res.data.assignments
        .filter((a: any) => a.status !== 'revoked')
        .map((a: any) => normalizeAssignmentToLink(a));
    }
  } catch {
    // ignore
  }

  return [];
};

/**
 * Assign a caretaker via POST /api/caretaker/assign
 */
export const assignCaretaker = async (
  payload: AssignCaretakerPayload
): Promise<CaretakerLink> => {
  const normalizedEmail = payload.caretakerEmail.toLowerCase().trim();

  // Map accessLevel to permissions array
  let permissions: string[] = ['vitals', 'medications', 'appointments', 'reports', 'alerts'];
  if (payload.accessLevel === 'View Only') {
    permissions = ['vitals_read', 'medications_read', 'appointments_read'];
  } else if (payload.accessLevel === 'Emergency Alerts Only') {
    permissions = ['alerts', 'sos'];
  }

  // Real backend call: POST /api/caretaker/assign
  const response = await api.post('/api/caretaker/assign', {
    caretakerId: payload.caretakerId || undefined,
    caretakerEmail: normalizedEmail,
    caretakerName: payload.caretakerName.trim(),
    caretakerPhone: payload.caretakerPhone?.trim(),
    patientId: payload.patientId,
    relationship: payload.relationship,
    permissions,
    status: 'active',
  });

  const assignment = response.data?.assignment;
  const newLink = assignment
    ? normalizeAssignmentToLink(assignment, payload.patientId, payload.patientName)
    : {
        id: `care-${Date.now()}`,
        assignmentId: `care-${Date.now()}`,
        patientId: payload.patientId,
        patientName: payload.patientName || 'Patient',
        caretakerName: payload.caretakerName,
        caretakerEmail: normalizedEmail,
        caretakerPhone: payload.caretakerPhone,
        relationship: payload.relationship,
        accessLevel: payload.accessLevel,
        status: 'active',
        assignedAt: new Date().toISOString(),
      };

  try {
    await createNotification({
      userId: payload.patientId,
      title: 'Caretaker Connected',
      message: `${payload.caretakerName} (${payload.relationship}) was granted ${payload.accessLevel} access.`,
      category: 'general',
      priority: 'normal',
    });
  } catch (notifErr) {
    console.warn('Failed to send caretaker notification:', notifErr);
  }

  return newLink;
};

/**
 * Revoke caretaker access via PUT /api/caretaker/:id/revoke
 */
export const revokeCaretaker = async (assignmentId: string): Promise<void> => {
  await api.put(`/api/caretaker/${encodeURIComponent(assignmentId)}/revoke`);
};

/**
 * Alias for revokeCaretaker
 */
export const removeCaretaker = async (
  assignmentId: string,
  _patientId?: string
): Promise<void> => {
  return revokeCaretaker(assignmentId);
};

/**
 * Trigger emergency SOS broadcast
 */
export const triggerEmergencySOS = async (
  patientId: string,
  patientName: string
): Promise<{ success: boolean; notifiedCount: number }> => {
  const caretakers = await fetchPatientCaretakers(patientId, patientName);

  await createNotification({
    userId: patientId,
    title: 'EMERGENCY SOS ALERT BROADCASTED',
    message: `Urgent emergency assistance alert sent to ${caretakers.length} connected caretakers & hospital response team.`,
    category: 'anomaly',
    priority: 'urgent',
  });

  return { success: true, notifiedCount: caretakers.length };
};
