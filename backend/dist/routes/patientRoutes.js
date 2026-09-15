"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const patientController_1 = require("../controllers/patientController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = (0, express_1.Router)();
// Protect all routes with JWT authentication
router.use(authMiddleware_1.authenticateJWT);
// Endpoint: GET /api/patients (list, filterable by ?doctorId=... or ?caretakerId=...)
router.get('/', patientController_1.getPatients);
// Endpoint: GET /api/patients/:id (get one by patient ID or user ID)
router.get('/:id', patientController_1.getPatientById);
// Endpoint: POST /api/patients (create patient profile)
router.post('/', patientController_1.createPatient);
// Endpoint: PUT /api/patients/:id (update patient profile)
router.put('/:id', patientController_1.updatePatient);
exports.default = router;
