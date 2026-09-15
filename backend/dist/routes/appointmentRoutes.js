"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const appointmentController_1 = require("../controllers/appointmentController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = (0, express_1.Router)();
// Protect all appointment routes with JWT authentication
router.use(authMiddleware_1.authenticateJWT);
// Endpoint: POST /api/appointments (book appointment)
router.post('/', appointmentController_1.createAppointment);
// Endpoint: GET /api/appointments (list, filterable by ?patientId= or ?doctorId=)
router.get('/', appointmentController_1.getAppointments);
// Endpoint: PUT /api/appointments/:id/status (update status: pending | confirmed | completed | cancelled)
router.put('/:id/status', appointmentController_1.updateAppointmentStatus);
// Endpoint: DELETE /api/appointments/:id (cancel appointment)
router.delete('/:id', appointmentController_1.deleteAppointment);
exports.default = router;
