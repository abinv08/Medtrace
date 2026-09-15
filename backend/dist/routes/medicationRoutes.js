"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const medicationController_1 = require("../controllers/medicationController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = (0, express_1.Router)();
// Protect all medication routes with JWT authentication
router.use(authMiddleware_1.authenticateJWT);
// Endpoint: POST /api/medications (create medication)
router.post('/', medicationController_1.createMedication);
// Endpoint: GET /api/medications/:patientId (list medications for a patient)
router.get('/:patientId', medicationController_1.getMedicationsByPatientId);
// Endpoint: PUT /api/medications/:id (update medication)
router.put('/:id', medicationController_1.updateMedication);
// Endpoint: DELETE /api/medications/:id (delete medication)
router.delete('/:id', medicationController_1.deleteMedication);
// Endpoint: POST /api/medications/:id/taken (log a dose as taken)
router.post('/:id/taken', medicationController_1.logMedicationTaken);
exports.default = router;
