import { Router } from 'express';
import {
  upload,
  uploadTestResult,
  getTestResultsByPatientId,
  downloadTestResultFile,
  requestTestResult,
} from '../controllers/testResultController';
import { authenticateJWT } from '../middleware/authMiddleware';

const router = Router();

// Protect all test result routes with JWT authentication
router.use(authenticateJWT);

// Endpoint: POST /api/test-results (upload file + metadata)
router.post('/', upload.single('file'), uploadTestResult);
router.post('/request', requestTestResult);

// Endpoint: GET /api/test-results/file/:id (download/stream the file)
router.get('/file/:id', downloadTestResultFile);

// Endpoint: GET /api/test-results/:patientId (list for a patient)
router.get('/:patientId', getTestResultsByPatientId);

export default router;
