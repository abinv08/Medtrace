import { Router } from 'express';
import {
  createAppointment,
  getAppointments,
  updateAppointmentStatus,
  deleteAppointment,
} from '../controllers/appointmentController';
import { authenticateJWT } from '../middleware/authMiddleware';

const router = Router();

// Protect all appointment routes with JWT authentication
router.use(authenticateJWT);

// Endpoint: POST /api/appointments (book appointment)
router.post('/', createAppointment);

// Endpoint: GET /api/appointments (list, filterable by ?patientId= or ?doctorId=)
router.get('/', getAppointments);

// Endpoint: PUT /api/appointments/:id/status (update status: pending | confirmed | completed | cancelled)
router.put('/:id/status', updateAppointmentStatus);

// Endpoint: DELETE /api/appointments/:id (cancel appointment)
router.delete('/:id', deleteAppointment);

export default router;
