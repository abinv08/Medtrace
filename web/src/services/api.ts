import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../config/firebase';

export const BACKEND_URL = '';
export const API_BASE_URL = '';

type RequestConfig = { params?: Record<string, unknown>; headers?: Record<string, string | undefined>; responseType?: string };
type ApiResponse<T = any> = { data: T; headers: Record<string, string> };

const unwrap = (value: any) => typeof value?.toDate === 'function' ? value.toDate().toISOString() : value;
const withId = (snapshot: any) => ({ id: snapshot.id, _id: snapshot.id, ...snapshot.data() });

const withTimeout = <T>(promise: Promise<T>, ms = 1200): Promise<T> =>
  Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);

const localCache: Record<string, any[]> = {};

const all = async (name: string) => {
  try {
    const snap = await withTimeout(getDocs(collection(db, name)), 1200);
    const docs = snap.docs.map(withId);
    localCache[name] = docs;
    return docs;
  } catch {
    return localCache[name] || [];
  }
};

const filtered = async (name: string, field: string, value: unknown) => {
  try {
    const snap = await withTimeout(getDocs(query(collection(db, name), where(field, '==', value))), 1200);
    return snap.docs.map(withId);
  } catch {
    return (localCache[name] || []).filter((item: any) => item[field] === value);
  }
};

const listByPatient = async (name: string, patientId: string) => {
  const direct = await filtered(name, 'patientId', patientId);
  return direct.length ? direct : filtered(name, 'uid', patientId);
};

const pathParts = (url: string) => {
  const [path, queryString] = url.split('?');
  return { parts: path.replace(/^\/?api\/?/, '').split('/').filter(Boolean), query: new URLSearchParams(queryString || '') };
};

const success = (data: Record<string, unknown>): ApiResponse => ({ data: { success: true, ...data }, headers: {} });

const dutyCollection = 'nurseDuties';
const dutyTime = (duty: any) => {
  const date = String(duty.dutyDate || '');
  const startTime = duty.startTime || '00:00';
  const endTime = duty.endTime || '23:59';
  const start = new Date(`${date}T${startTime}:00`);
  const end = new Date(`${date}T${endTime}:00`);
  if (end <= start) end.setDate(end.getDate() + 1);
  return {
    start: start.getTime(),
    end: end.getTime(),
  };
};

const overlapsDuty = (left: any, right: any) => {
  const a = dutyTime(left);
  const b = dutyTime(right);
  return a.start < b.end && b.start < a.end;
};

const assertDutyTransition = (duty: any, action: string, userId?: string) => {
  if (userId && duty.nurseId !== userId) throw new Error('You can only update your own duty attendance.');
  const transitions: Record<string, [string, string[]]> = {
    checkIn: ['checked_in', ['not_checked_in']],
    startBreak: ['on_break', ['checked_in']],
    endBreak: ['checked_in', ['on_break']],
    checkOut: ['checked_out', ['checked_in']],
  };
  const transition = transitions[action];
  if (!transition) return;
  if (!transition[1].includes(duty.attendanceStatus || 'not_checked_in')) {
    throw new Error(`Duty cannot ${action.replace(/([A-Z])/g, ' $1').toLowerCase()} from its current attendance state.`);
  }
};

const get = async <T = any>(url: string, config: RequestConfig = {}): Promise<ApiResponse<T>> => {
  const { parts, query: urlQuery } = pathParts(url);
  const params = { ...Object.fromEntries(urlQuery.entries()), ...(config.params || {}) } as Record<string, string>;
  const resource = parts[0];

  if (resource === 'admin' && parts[1] === 'users') {
    let users = await all('users');
    if (params.role) users = users.filter((item: any) => String(item.role || '').toLowerCase() === params.role.toLowerCase());
    return success({ users });
  }
  if (resource === 'admin' && parts[1] === 'stats') {
    const [users, appointments, vitals, medications, reports] = await Promise.all([
      all('users'), all('appointments'), all('vitals'), all('medications'), all('medicalReports'),
    ]);
    const count = (role: string) => users.filter((item: any) => String(item.role || '').toLowerCase() === role).length;
    const now = new Date();
    const weekStart = new Date(now); weekStart.setDate(now.getDate() - 7);
    return success({ stats: {
      users: { total: users.length, doctors: count('doctor'), nurses: count('nurse'), caregivers: count('caretaker'), patients: count('patient') },
      appointments: { total: appointments.length, thisWeek: appointments.filter((item: any) => new Date(unwrap(item.createdAt || item.date)).getTime() >= weekStart.getTime()).length, pending: appointments.filter((item: any) => item.status === 'pending').length, completed: appointments.filter((item: any) => item.status === 'completed').length },
      clinical: { vitalsRecorded: vitals.length, activePrescriptions: medications.filter((item: any) => item.status === 'active').length, uploadedReports: reports.length },
    }});
  }
  if (resource === 'patients') {
    const patientRecords = await all('patients');
    const userRecords = (await all('users')).filter((item: any) => ['patient', 'guardian'].includes(String(item.role || 'patient').toLowerCase()));
    let patients = patientRecords.map((patient: any) => {
      const userId = typeof patient.userId === 'object' ? patient.userId?.id || patient.userId?._id : patient.userId;
      const user = userRecords.find((item: any) => item.id === userId || item._id === userId);
      return user ? { ...user, ...patient, name: patient.name || user.name, phone: patient.phone || user.phone, patientId: patient.patientId || user.patientId } : patient;
    });
    const knownUserIds = new Set(patients.map((patient: any) => patient.userId || patient.id || patient._id));
    patients.push(...userRecords.filter((user: any) => !knownUserIds.has(user.id || user._id)));
    if (params.doctorId) patients = patients.filter((item: any) => item.doctorId === params.doctorId);
    return success({ patients });
  }
  if (resource === 'payments') return success({ payments: await all('payments') });
  if (resource === 'appointments') {
    let appointments = await all('appointments');
    if (params.patientId) appointments = appointments.filter((item: any) => item.patientId === params.patientId);
    if (params.doctorId) appointments = appointments.filter((item: any) => item.doctorId === params.doctorId);
    if (params.status) appointments = appointments.filter((item: any) => item.status === params.status);
    return success({ appointments });
  }
  if (resource === 'vitals') {
    const patientId = parts[1];
    const vitals = patientId ? await listByPatient('vitals', decodeURIComponent(patientId)) : await all('vitals');
    vitals.sort((a: any, b: any) => new Date(unwrap(b.recordedAt || b.date)).getTime() - new Date(unwrap(a.recordedAt || a.date)).getTime());
    return success({ vitals: parts[2] === 'latest' ? (vitals[0] || null) : vitals });
  }
  if (resource === 'medications') return success({ medications: await listByPatient('medications', decodeURIComponent(parts[1] || '')) });
  if (resource === 'exercise-plans') {
    const plans = await listByPatient('exercisePlans', decodeURIComponent(parts[1] || ''));
    return success({ exercisePlan: plans[0] || null });
  }
  if (resource === 'test-results') return success({ testResults: await listByPatient('testResults', decodeURIComponent(parts[1] || '')) });
  if (resource === 'clinical-notes') return success({ clinicalNotes: await listByPatient('clinicalNotes', decodeURIComponent(parts[1] || '')) });
  if (resource === 'messages') return success({ messages: await listByPatient('messages', decodeURIComponent(parts[1] || '')) });
  if (resource === 'caretaker' && parts[1] === 'patient') return success({ assignments: await listByPatient('caretakerAssignments', decodeURIComponent(parts[2] || '')) });
  if (resource === 'caretaker') {
    const id = decodeURIComponent(parts[1] || '');
    let assignments = await filtered('caretakerAssignments', 'caretakerId', id);
    if (!assignments.length && id.includes('@')) assignments = await filtered('caretakerAssignments', 'caretakerEmail', id.toLowerCase());
    return success({ assignments });
  }
  if (resource === 'nurse-assignments') {
    const assignments = parts[2] === 'patients' ? await filtered('nurseAssignments', 'nurseId', parts[1]) : await all('nurseAssignments');
    const users = await all('users');
    const patients = assignments.map((assignment: any) => {
      const patientId = typeof assignment.patientId === 'object' ? assignment.patientId?.id || assignment.patientId?._id : assignment.patientId;
      const patient = users.find((item: any) => item.id === patientId || item._id === patientId || item.patientId === patientId);
      return patient ? { ...patient, _id: patient.id, assignmentId: assignment.id } : { _id: patientId, id: patientId };
    });
    const enrichedAssignments = assignments.map((assignment: any) => {
      const patientId = typeof assignment.patientId === 'object' ? assignment.patientId?.id || assignment.patientId?._id : assignment.patientId;
      const patient = patients.find((item: any) => item.id === patientId || item._id === patientId);
      return { ...assignment, patientId: patient || assignment.patientId };
    });
    return success({ assignments: enrichedAssignments, patients });
  }
  if (resource === 'nurse-tasks') {
    let tasks = await all('nurseTasks');
    Object.entries(params).forEach(([key, value]) => { tasks = tasks.filter((item: any) => String(item[key] || '') === String(value)); });
    return success({ tasks });
  }
  if (resource === 'nurse-duties') {
    let duties = await all(dutyCollection);
    if (params.nurseId) duties = duties.filter((duty: any) => duty.nurseId === params.nurseId);
    if (params.status) duties = duties.filter((duty: any) => duty.status === params.status);
    duties.sort((a: any, b: any) => `${a.dutyDate}T${a.startTime}`.localeCompare(`${b.dutyDate}T${b.startTime}`));
    return success({ duties });
  }
  return success({});
};

const post = async <T = any>(url: string, body: any = {}, _config: RequestConfig = {}): Promise<ApiResponse<T>> => {
  const { parts } = pathParts(url);
  const resource = parts[0];
  if (resource === 'auth') return success({ accessToken: body?.idToken || '', user: body });
  if (resource === 'nurse-duties') {
    const duties = await all(dutyCollection);
    const candidate = { ...body, status: 'scheduled', attendanceStatus: 'not_checked_in' };
    if (!candidate.nurseId || !candidate.dutyDate || !candidate.startTime || !candidate.endTime) throw new Error('Nurse, date, start time, and end time are required.');
    if (dutyTime(candidate).start >= dutyTime(candidate).end) throw new Error('Duty end time must be after its start time.');
    if (duties.some((duty: any) => duty.nurseId === candidate.nurseId && duty.status !== 'cancelled' && overlapsDuty(duty, candidate))) throw new Error('This nurse already has an overlapping duty.');
    let createdId = `local-${Date.now()}`;
    try {
      const created = await withTimeout(addDoc(collection(db, dutyCollection), candidate), 1500);
      createdId = created.id;
    } catch {}
    const dutyItem = { id: createdId, _id: createdId, ...candidate };
    if (!localCache[dutyCollection]) localCache[dutyCollection] = [];
    localCache[dutyCollection].push(dutyItem);
    return success({ duty: dutyItem });
  }
  const collectionName = resource === 'nurse-tasks' ? 'nurseTasks' : resource === 'nurse-assignments' ? 'nurseAssignments' : resource === 'clinical-notes' ? 'clinicalNotes' : resource === 'test-results' ? 'testResults' : resource === 'messages' ? 'messages' : resource === 'caretaker' ? 'caretakerAssignments' : resource === 'exercise-plans' ? 'exercisePlans' : resource;
  const record = Object.fromEntries(
    Object.entries({
      ...body,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }).filter(([, value]) => value !== undefined)
  );
  let createdId = `local-${Date.now()}`;
  try {
    const created = await withTimeout(addDoc(collection(db, collectionName), record), 1500);
    createdId = created.id;
  } catch {}
  const item = { id: createdId, _id: createdId, ...record };
  if (!localCache[collectionName]) localCache[collectionName] = [];
  localCache[collectionName].push(item);
  return success({ [resource === 'appointments' ? 'appointment' : resource === 'nurse-tasks' ? 'task' : resource === 'test-results' ? 'testResult' : resource === 'messages' ? 'message' : resource === 'clinical-notes' ? 'clinicalNote' : resource === 'caretaker' ? 'assignment' : resource === 'exercise-plans' ? 'exercisePlan' : resource]: item });
};

const put = async <T = any>(url: string, body: any = {}, _config: RequestConfig = {}): Promise<ApiResponse<T>> => {
  const { parts } = pathParts(url);
  const resource = parts[0];
  const id = parts[1];
  if (resource === 'nurse-duties') {
    const dutyRef = doc(db, dutyCollection, id);
    const current = (await getDocs(query(collection(db, dutyCollection), where('__name__', '==', id)))).docs[0];
    if (!current) throw new Error('Duty not found.');
    const duty = withId(current);
    const action = parts[2];
    if (['checkIn', 'startBreak', 'endBreak', 'checkOut'].includes(action)) {
      assertDutyTransition(duty, action, body.userId);
      const updates: Record<string, unknown> = { updatedAt: serverTimestamp() };
      if (action === 'checkIn') updates.attendanceStatus = 'checked_in';
      if (action === 'startBreak') { updates.attendanceStatus = 'on_break'; updates.breakStartedAt = serverTimestamp(); }
      if (action === 'endBreak') { updates.attendanceStatus = 'checked_in'; updates.breakEndedAt = serverTimestamp(); }
      if (action === 'checkOut') { updates.attendanceStatus = 'checked_out'; updates.checkOutAt = serverTimestamp(); updates.status = 'completed'; }
      if (action === 'cancel') updates.status = 'cancelled';
      if (action === 'complete') updates.status = 'completed';
      await updateDoc(dutyRef, updates);
      return success({});
    }
    await updateDoc(dutyRef, { ...body, updatedAt: serverTimestamp() });
    return success({});
  }
  const collectionName = resource === 'nurse-tasks' ? 'nurseTasks' : resource === 'nurse-assignments' ? 'nurseAssignments' : resource === 'admin' ? 'users' : resource === 'caretaker' ? 'caretakerAssignments' : resource === 'exercise-plans' ? 'exercisePlans' : resource;
  if (resource === 'admin' && parts[1] === 'users') return put(`/users/${parts[2]}`, { isActive: false });
  if (resource === 'nurse-tasks' && parts[2] === 'complete') body = { status: 'completed' };
  if (resource === 'nurse-tasks' && (parts[2] === 'approve' || parts[2] === 'reject')) body = { ...body, status: parts[2] === 'approve' ? 'approved' : 'rejected' };
  if (resource === 'caretaker' && parts[2] === 'revoke') body = { ...body, status: 'revoked' };
  if (resource === 'patients' && parts[2] === 'status') {
    const patients = await all('patients');
    const patient = patients.find((item: any) => item.id === id || item._id === id);
    const updates = { ...body, updatedAt: new Date().toISOString() };
    await setDoc(doc(db, 'patients', id), { ...(patient || {}), userId: patient?.userId || id, ...updates }, { merge: true });
    if (!localCache.patients) localCache.patients = [];
    const cachedPatient = { id, _id: id, ...(patient || {}), userId: patient?.userId || id, ...updates };
    localCache.patients = localCache.patients.some((item) => item.id === id || item._id === id)
      ? localCache.patients.map((item) => item.id === id || item._id === id ? { ...item, ...cachedPatient } : item)
      : [...localCache.patients, cachedPatient];
    return success({ patient: cachedPatient });
  }
  if (resource === 'appointments' && parts[2] === 'status') body = { ...body, status: body.status, doctorNotes: body.notes };
  if (resource === 'exercise-plans' && parts[2] === 'progress') {
    const plans = await listByPatient('exercisePlans', id);
    if (plans[0]) body = { progressLog: [...(plans[0].progressLog || []), body] };
    else return success({});
  }
  const updates = { ...body, updatedAt: new Date().toISOString() };
  await updateDoc(doc(db, collectionName, id), updates);
  if (localCache[collectionName]) {
    localCache[collectionName] = localCache[collectionName].map((item) =>
      item.id === id || item._id === id ? { ...item, ...updates } : item
    );
  }
  return success({});
};

const remove = async (url: string, _config: RequestConfig = {}): Promise<ApiResponse> => {
  const { parts } = pathParts(url);
  await deleteDoc(doc(db, parts[0], parts[1]));
  return success({});
};

const api = { get, post, put, delete: remove };
export default api;
