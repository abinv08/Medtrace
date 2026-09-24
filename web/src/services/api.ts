import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
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

const all = async (name: string) => (await getDocs(collection(db, name))).docs.map(withId);
const filtered = async (name: string, field: string, value: unknown) => {
  const snapshots = await getDocs(query(collection(db, name), where(field, '==', value)));
  return snapshots.docs.map(withId);
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
    let patients = (await all('users')).filter((item: any) => ['patient', 'guardian'].includes(String(item.role || 'patient').toLowerCase()));
    if (params.doctorId) patients = patients.filter((item: any) => item.doctorId === params.doctorId);
    return success({ patients });
  }
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
  return success({});
};

const post = async <T = any>(url: string, body: any = {}, _config: RequestConfig = {}): Promise<ApiResponse<T>> => {
  const { parts } = pathParts(url);
  const resource = parts[0];
  if (resource === 'auth') return success({ accessToken: body?.idToken || '', user: body });
  const collectionName = resource === 'nurse-tasks' ? 'nurseTasks' : resource === 'nurse-assignments' ? 'nurseAssignments' : resource === 'clinical-notes' ? 'clinicalNotes' : resource === 'test-results' ? 'testResults' : resource === 'messages' ? 'messages' : resource === 'caretaker' ? 'caretakerAssignments' : resource === 'exercise-plans' ? 'exercisePlans' : resource;
  const record = { ...body, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  const created = await addDoc(collection(db, collectionName), record);
  return success({ [resource === 'appointments' ? 'appointment' : resource === 'nurse-tasks' ? 'task' : resource === 'test-results' ? 'testResult' : resource === 'messages' ? 'message' : resource === 'clinical-notes' ? 'clinicalNote' : resource === 'caretaker' ? 'assignment' : resource === 'exercise-plans' ? 'exercisePlan' : resource]: { id: created.id, _id: created.id, ...record } });
};

const put = async <T = any>(url: string, body: any = {}, _config: RequestConfig = {}): Promise<ApiResponse<T>> => {
  const { parts } = pathParts(url);
  const resource = parts[0];
  const id = parts[1];
  const collectionName = resource === 'nurse-tasks' ? 'nurseTasks' : resource === 'nurse-assignments' ? 'nurseAssignments' : resource === 'admin' ? 'users' : resource === 'exercise-plans' ? 'exercisePlans' : resource;
  if (resource === 'admin' && parts[1] === 'users') return put(`/users/${parts[2]}`, { isActive: false });
  if (resource === 'nurse-tasks' && parts[2] === 'complete') body = { status: 'completed' };
  if (resource === 'nurse-tasks' && (parts[2] === 'approve' || parts[2] === 'reject')) body = { ...body, status: parts[2] === 'approve' ? 'approved' : 'rejected' };
  if (resource === 'appointments' && parts[2] === 'status') body = { ...body, status: body.status, doctorNotes: body.notes };
  if (resource === 'exercise-plans' && parts[2] === 'progress') {
    const plans = await listByPatient('exercisePlans', id);
    if (plans[0]) body = { progressLog: [...(plans[0].progressLog || []), body] };
    else return success({});
  }
  await updateDoc(doc(db, collectionName, id), { ...body, updatedAt: new Date().toISOString() });
  return success({});
};

const remove = async (url: string, _config: RequestConfig = {}): Promise<ApiResponse> => {
  const { parts } = pathParts(url);
  await deleteDoc(doc(db, parts[0], parts[1]));
  return success({});
};

const api = { get, post, put, delete: remove };
export default api;
