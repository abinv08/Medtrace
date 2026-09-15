"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const vitalsController_1 = require("../controllers/vitalsController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = (0, express_1.Router)();
// Protect all vitals routes with JWT authentication
router.use(authMiddleware_1.authenticateJWT);
// Endpoint: POST /api/vitals (add a new vitals reading)
router.post('/', vitalsController_1.createVitals);
// Endpoint: GET /api/vitals/:patientId/latest (most recent vitals reading)
router.get('/:patientId/latest', vitalsController_1.getLatestVitals);
// Endpoint: GET /api/vitals/:patientId (vitals history with optional ?from=&to=)
router.get('/:patientId', vitalsController_1.getVitalsHistory);
exports.default = router;
