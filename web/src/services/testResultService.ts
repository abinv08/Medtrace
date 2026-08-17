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
import { getTimestampMillis } from './doctorService';
import { createNotification } from './notificationService';

export interface TestBiomarker {
  name: string;
  value: number | string;
  unit: string;
  referenceRange: string;
  status: 'normal' | 'high' | 'low' | 'critical';
}

export interface TestResult {
  id: string;
  patientId: string;
  testName: string;
  category: 'Blood Chemistry' | 'Lipid Panel' | 'Endocrine / Glucose' | 'Renal & Kidney' | 'Liver Function' | 'Complete Blood Count (CBC)' | 'Cardiology / ECG' | 'Radiology / Imaging' | 'Urinalysis' | 'Other';
  testDate: string;
  labName: string;
  doctorName?: string;
  summary: string;
  biomarkers: TestBiomarker[];
  fileName?: string;
  fileSize?: string;
  status: 'final' | 'preliminary' | 'abnormal_flagged';
  createdAt?: any;
}

const DEFAULT_TEST_RESULTS: TestResult[] = [
  {
    id: 'test-1',
    patientId: 'default',
    testName: 'Comprehensive Metabolic Panel & Lipid Profile',
    category: 'Lipid Panel',
    testDate: '2026-02-12',
    labName: 'MedTrace Central Pathology Lab',
    doctorName: 'Dr. Alexander Wright',
    summary: 'Elevated total cholesterol and borderline fasting blood sugar. Electrolytes within normal limits.',
    status: 'abnormal_flagged',
    fileName: 'CMP_Lipid_Report_20260212.pdf',
    fileSize: '1.4 MB',
    biomarkers: [
      { name: 'Fasting Blood Glucose', value: 108, unit: 'mg/dL', referenceRange: '70 - 99', status: 'high' },
      { name: 'HbA1c', value: 5.8, unit: '%', referenceRange: '< 5.7', status: 'high' },
      { name: 'Total Cholesterol', value: 218, unit: 'mg/dL', referenceRange: '< 200', status: 'high' },
      { name: 'HDL (Good) Cholesterol', value: 52, unit: 'mg/dL', referenceRange: '> 40', status: 'normal' },
      { name: 'LDL (Bad) Cholesterol', value: 138, unit: 'mg/dL', referenceRange: '< 100', status: 'high' },
      { name: 'Triglycerides', value: 140, unit: 'mg/dL', referenceRange: '< 150', status: 'normal' },
      { name: 'Serum Creatinine', value: 0.95, unit: 'mg/dL', referenceRange: '0.7 - 1.3', status: 'normal' },
      { name: 'eGFR', value: 92, unit: 'mL/min/1.73m²', referenceRange: '> 60', status: 'normal' },
    ],
  },
  {
    id: 'test-2',
    patientId: 'default',
    testName: 'Complete Blood Count (CBC) with Differential',
    category: 'Complete Blood Count (CBC)',
    testDate: '2026-01-20',
    labName: 'Apollo Diagnostics Laboratory',
    doctorName: 'Dr. Sarah Jenkins',
    summary: 'Hemoglobin and red blood cell counts are stable. No signs of infection or acute anemia.',
    status: 'final',
    fileName: 'CBC_Analysis_20260120.pdf',
    fileSize: '890 KB',
    biomarkers: [
      { name: 'Hemoglobin', value: 14.2, unit: 'g/dL', referenceRange: '13.5 - 17.5', status: 'normal' },
      { name: 'WBC Count', value: 6.8, unit: '10³/µL', referenceRange: '4.5 - 11.0', status: 'normal' },
      { name: 'Platelets', value: 245, unit: '10³/µL', referenceRange: '150 - 450', status: 'normal' },
      { name: 'Hematocrit', value: 42.5, unit: '%', referenceRange: '41 - 50', status: 'normal' },
    ],
  },
  {
    id: 'test-3',
    patientId: 'default',
    testName: '12-Lead Electrocardiogram (ECG) & Rhythm Analysis',
    category: 'Cardiology / ECG',
    testDate: '2026-01-08',
    labName: 'CardioCare Clinical Diagnostics',
    doctorName: 'Dr. Alexander Wright',
    summary: 'Normal sinus rhythm at 72 bpm. PR and QTc intervals within standard bounds.',
    status: 'final',
    fileName: '12Lead_ECG_20260108.pdf',
    fileSize: '2.1 MB',
    biomarkers: [
      { name: 'Resting Heart Rate', value: 72, unit: 'bpm', referenceRange: '60 - 100', status: 'normal' },
      { name: 'PR Interval', value: 160, unit: 'ms', referenceRange: '120 - 200', status: 'normal' },
      { name: 'QRS Duration', value: 88, unit: 'ms', referenceRange: '80 - 120', status: 'normal' },
      { name: 'QTc Interval', value: 410, unit: 'ms', referenceRange: '< 440', status: 'normal' },
    ],
  },
];

const LOCAL_TESTS: Record<string, TestResult[]> = {};

export const fetchPatientTestResults = async (patientId: string): Promise<TestResult[]> => {
  try {
    const q = query(
      collection(db, 'testResults'),
      where('patientId', '==', patientId)
    );
    const snap = await getDocs(q);
    if (snap.empty) {
      if (!LOCAL_TESTS[patientId]) {
        LOCAL_TESTS[patientId] = DEFAULT_TEST_RESULTS.map((t) => ({ ...t, patientId }));
      }
      return LOCAL_TESTS[patientId];
    }
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as TestResult));
    LOCAL_TESTS[patientId] = list;
    return list.sort((a, b) => new Date(b.testDate).getTime() - new Date(a.testDate).getTime());
  } catch (err) {
    console.warn('fetchPatientTestResults fallback:', err);
    if (!LOCAL_TESTS[patientId]) {
      LOCAL_TESTS[patientId] = DEFAULT_TEST_RESULTS.map((t) => ({ ...t, patientId }));
    }
    return LOCAL_TESTS[patientId];
  }
};

export const addTestResult = async (
  result: Omit<TestResult, 'id' | 'createdAt'>
): Promise<TestResult> => {
  const id = `test-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const newResult: TestResult = {
    ...result,
    id,
    createdAt: new Date().toISOString(),
  };

  try {
    await setDoc(doc(db, 'testResults', id), {
      ...newResult,
      createdAt: serverTimestamp(),
    });
  } catch {
    if (!LOCAL_TESTS[result.patientId]) {
      LOCAL_TESTS[result.patientId] = [...DEFAULT_TEST_RESULTS.map((t) => ({ ...t, patientId: result.patientId }))];
    }
    LOCAL_TESTS[result.patientId].unshift(newResult);
  }

  // Generate in-app alert
  await createNotification({
    userId: result.patientId,
    title: `Lab Test Uploaded: ${result.testName}`,
    message: `${result.biomarkers.length} biomarkers logged from ${result.labName}.`,
    category: 'test_result',
    priority: result.status === 'abnormal_flagged' ? 'high' : 'normal',
  });

  return newResult;
};

export const deleteTestResult = async (id: string, patientId: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, 'testResults', id));
  } catch {
    if (LOCAL_TESTS[patientId]) {
      LOCAL_TESTS[patientId] = LOCAL_TESTS[patientId].filter((t) => t.id !== id);
    }
  }
};
