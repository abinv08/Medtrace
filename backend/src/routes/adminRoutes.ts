import { Router } from 'express';
import {
  getAllUsers,
  deactivateUser,
  getAdminStats,
} from '../controllers/adminController';
import { authenticateJWT, requireHospitalAdmin } from '../middleware/authMiddleware';

const router = Router();

// Protect all admin endpoints with authentication and hospital_admin role check
router.use(authenticateJWT);
router.use(requireHospitalAdmin);

// Endpoint: GET /api/admin/users (list all users, filterable by role: ?role=Doctor)
router.get('/users', getAllUsers);

// Endpoint: PUT /api/admin/users/:id/deactivate (deactivate user account)
router.put('/users/:id/deactivate', deactivateUser);

// Endpoint: GET /api/admin/stats (aggregate metrics: counts of patients, doctors, appointments this week, etc.)
router.get('/stats', getAdminStats);

export default router;
