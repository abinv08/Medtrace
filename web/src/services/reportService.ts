import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { storage, db } from '../config/firebase';
import { ReportSummary } from './geminiService';

// ─── Types ─────────────────────────────────────────────────────────────────────
export type ReportType = 'lab' | 'radiology' | 'discharge' | 'prescription' | 'other';

export interface StoredReport {
  id: string;
  uid: string;
  patientId: string;
  fileName: string;
  fileType: string;
  fileSizeBytes: number;
  storageUrl: string;
  storagePath: string;
  reportType: ReportType;
  reportDate?: string;        // date on the actual report (user-specified)
  uploadedAt: string;         // ISO string
  analysisResult?: ReportSummary;
  analysisGeneratedAt?: string;
  tags?: string[];
  notes?: string;
}

export interface UploadReportPayload {
  uid: string;
  patientId: string;
  file: File;
  reportType?: ReportType;
  reportDate?: string;
  notes?: string;
  analysisResult?: ReportSummary;
}

// ─── Upload report file + save metadata ───────────────────────────────────────
export const uploadReport = async (payload: UploadReportPayload): Promise<StoredReport> => {
  const { uid, patientId, file, reportType = 'other', reportDate, notes, analysisResult } = payload;

  // 1. Upload file to Firebase Storage under patients/{uid}/reports/{timestamp}_{fileName}
  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `patients/${uid}/reports/${timestamp}_${safeName}`;
  const storageRef = ref(storage, storagePath);

  await uploadBytes(storageRef, file);
  const storageUrl = await getDownloadURL(storageRef);

  // 2. Save metadata to Firestore
  const reportData = {
    uid,
    patientId,
    fileName: file.name,
    fileType: file.type,
    fileSizeBytes: file.size,
    storageUrl,
    storagePath,
    reportType,
    reportDate: reportDate || null,
    uploadedAt: serverTimestamp(),
    analysisResult: analysisResult || null,
    analysisGeneratedAt: analysisResult ? serverTimestamp() : null,
    notes: notes || '',
    tags: [],
  };

  const docRef = await addDoc(collection(db, 'reports'), reportData);

  // 3. Also write a timeline event
  await addTimelineEvent({
    uid,
    patientId,
    eventType: 'report_uploaded',
    title: 'Medical Report Uploaded',
    description: `${file.name} (${reportType})`,
    referenceId: docRef.id,
    referenceCollection: 'reports',
    metadata: {
      fileName: file.name,
      reportType,
      hasAIAnalysis: !!analysisResult,
      urgencyLevel: analysisResult?.urgencyLevel,
    },
  });

  return {
    id: docRef.id,
    ...reportData,
    uploadedAt: new Date().toISOString(),
    analysisGeneratedAt: analysisResult ? new Date().toISOString() : undefined,
  } as StoredReport;
};

// ─── Fetch reports for a patient ──────────────────────────────────────────────
export const fetchPatientReports = async (uid: string, maxResults = 50): Promise<StoredReport[]> => {
  try {
    const q = query(
      collection(db, 'reports'),
      where('uid', '==', uid),
      orderBy('uploadedAt', 'desc'),
      limit(maxResults)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        ...data,
        uploadedAt: data.uploadedAt instanceof Timestamp
          ? data.uploadedAt.toDate().toISOString()
          : data.uploadedAt,
        analysisGeneratedAt: data.analysisGeneratedAt instanceof Timestamp
          ? data.analysisGeneratedAt.toDate().toISOString()
          : data.analysisGeneratedAt,
      } as StoredReport;
    });
  } catch (err) {
    console.error('fetchPatientReports error:', err);
    return [];
  }
};

// ─── Fetch single report by ID ─────────────────────────────────────────────────
export const fetchReport = async (reportId: string): Promise<StoredReport | null> => {
  try {
    const snap = await getDoc(doc(db, 'reports', reportId));
    if (!snap.exists()) return null;
    const data = snap.data();
    return {
      id: snap.id,
      ...data,
      uploadedAt: data.uploadedAt instanceof Timestamp
        ? data.uploadedAt.toDate().toISOString()
        : data.uploadedAt,
    } as StoredReport;
  } catch {
    return null;
  }
};

// ─── Timeline Event ────────────────────────────────────────────────────────────
export type TimelineEventType =
  | 'report_uploaded'
  | 'test_result_added'
  | 'appointment_booked'
  | 'appointment_completed'
  | 'medication_started'
  | 'medication_ended'
  | 'doctor_consultation'
  | 'monitoring_alert'
  | 'ai_analysis'
  | 'profile_updated'
  | 'caretaker_assigned'
  | 'exercise_recommended';

export interface TimelineEvent {
  id: string;
  uid: string;
  patientId: string;
  eventType: TimelineEventType;
  title: string;
  description: string;
  referenceId?: string;
  referenceCollection?: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

interface TimelinePayload {
  uid: string;
  patientId: string;
  eventType: TimelineEventType;
  title: string;
  description: string;
  referenceId?: string;
  referenceCollection?: string;
  metadata?: Record<string, any>;
}

export const addTimelineEvent = async (payload: TimelinePayload): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, 'timeline'), {
      ...payload,
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (err) {
    console.error('addTimelineEvent error:', err);
    return '';
  }
};

// ─── Fetch patient timeline ────────────────────────────────────────────────────
export const fetchPatientTimeline = async (uid: string, maxResults = 50): Promise<TimelineEvent[]> => {
  try {
    const q = query(
      collection(db, 'timeline'),
      where('uid', '==', uid),
      orderBy('createdAt', 'desc'),
      limit(maxResults)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        ...data,
        createdAt: data.createdAt instanceof Timestamp
          ? data.createdAt.toDate().toISOString()
          : data.createdAt || new Date().toISOString(),
      } as TimelineEvent;
    });
  } catch (err) {
    console.error('fetchPatientTimeline error:', err);
    return [];
  }
};
