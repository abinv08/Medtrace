import api from './api';
import { createNotification } from './notificationService';

export interface TestBiomarker {
  name: string;
  value: number | string;
  unit: string;
  referenceRange: string;
  status: 'normal' | 'high' | 'low' | 'critical';
}

export interface TestResult {
  _id: string;
  id?: string;
  patientId: string;
  fileUrl: string;
  fileType?: string;
  category?: string;
  notes?: string;
  uploadDate: string;
  uploadedBy?: {
    _id?: string;
    name?: string;
    email?: string;
    hospitalName?: string;
    department?: string;
  } | string;
  createdAt?: string;
  updatedAt?: string;

  // Optional convenience fields for display
  testName?: string;
  labName?: string;
  doctorName?: string;
  summary?: string;
  fileName?: string;
  fileSize?: string;
  status?: 'final' | 'preliminary' | 'abnormal_flagged';
  biomarkers?: TestBiomarker[];
}

export interface GetTestResultsResponse {
  success: boolean;
  count: number;
  testResults: TestResult[];
}

export interface UploadTestResultResponse {
  success: boolean;
  message: string;
  testResult: TestResult;
}

/**
 * Fetch test results for a patient via GET /api/test-results/:patientId
 */
export const fetchPatientTestResults = async (
  patientId: string,
  category?: string
): Promise<TestResult[]> => {
  if (!patientId) return [];

  const response = await api.get<GetTestResultsResponse>(
    `/api/test-results/${encodeURIComponent(patientId)}`,
    {
      params: category ? { category } : undefined,
    }
  );

  return response.data.testResults || [];
};

/**
 * Upload a test result file and metadata via POST /api/test-results (multipart/form-data)
 */
export const uploadTestResult = async (
  formData: FormData
): Promise<TestResult> => {
  const response = await api.post<UploadTestResultResponse>(
    '/api/test-results',
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  );

  const newResult = response.data.testResult;

  // Trigger non-blocking notification if patient ID is available
  try {
    const patientId = formData.get('patientId') as string;
    const category = formData.get('category') as string;
    if (patientId) {
      await createNotification({
        userId: patientId,
        title: `Lab Test Uploaded: ${category || 'Diagnostic Report'}`,
        message: 'A new laboratory test report was uploaded to your medical record.',
        category: 'test_result',
        priority: 'normal',
      });
    }
  } catch (notifErr) {
    console.warn('Failed to send upload notification:', notifErr);
  }

  return newResult;
};

/**
 * Download test result file via GET /api/test-results/file/:id
 */
export const downloadTestResultFile = async (
  fileIdOrName: string,
  preferredFileName?: string
): Promise<void> => {
  const response = await api.get(`/api/test-results/file/${encodeURIComponent(fileIdOrName)}`, {
    responseType: 'blob',
  });

  let filename = preferredFileName;
  if (!filename) {
    const contentDisposition = (response.headers['content-disposition'] as string | undefined);
    if (contentDisposition && typeof contentDisposition === 'string') {
      const match = contentDisposition.match(/filename="?([^"]+)"?/);
      if (match && match[1]) {
        filename = match[1];
      }
    }
  }

  if (!filename) {
    filename = fileIdOrName.includes('.') ? fileIdOrName : `test-result-${fileIdOrName}.pdf`;
  }

  const contentType = (response.headers['content-type'] as string) || 'application/octet-stream';
  const blob = new Blob([response.data], {
    type: contentType,
  });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

/**
 * Helper to parse structured title, summary, lab name, and biomarkers from notes
 */
export const parseTestResultDetails = (test: TestResult): {
  title: string;
  summary: string;
  labName: string;
  biomarkers: TestBiomarker[];
} => {
  let title = test.testName || `${test.category || 'Diagnostic'} Report`;
  let summary = test.notes || '';
  let labName = test.labName || 'MedTrace Pathology Laboratory';
  let biomarkers: TestBiomarker[] = test.biomarkers || [];

  if (test.notes) {
    let raw = test.notes;
    const titleMatch = raw.match(/^\[(.*?)\]\s*(.*)/s);
    if (titleMatch) {
      title = titleMatch[1];
      raw = titleMatch[2];
    }

    if (raw.includes(' | Lab: ')) {
      const parts = raw.split(' | Lab: ');
      raw = parts[0];
      const labAndAfter = parts[1];
      if (labAndAfter.includes(' | Biomarkers: ')) {
        const subparts = labAndAfter.split(' | Biomarkers: ');
        labName = subparts[0];
        try {
          biomarkers = JSON.parse(subparts[1]);
        } catch {
          // ignore
        }
      } else {
        labName = labAndAfter;
      }
    } else if (raw.includes(' | Biomarkers: ')) {
      const parts = raw.split(' | Biomarkers: ');
      raw = parts[0];
      try {
        biomarkers = JSON.parse(parts[1]);
      } catch {
        // ignore
      }
    }
    summary = raw;
  }

  return { title, summary, labName, biomarkers };
};
