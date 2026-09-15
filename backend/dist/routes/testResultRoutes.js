"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const testResultController_1 = require("../controllers/testResultController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = (0, express_1.Router)();
// Protect all test result routes with JWT authentication
router.use(authMiddleware_1.authenticateJWT);
// Endpoint: POST /api/test-results (upload file + metadata)
router.post('/', testResultController_1.upload.single('file'), testResultController_1.uploadTestResult);
// Endpoint: GET /api/test-results/file/:id (download/stream the file)
router.get('/file/:id', testResultController_1.downloadTestResultFile);
// Endpoint: GET /api/test-results/:patientId (list for a patient)
router.get('/:patientId', testResultController_1.getTestResultsByPatientId);
exports.default = router;
