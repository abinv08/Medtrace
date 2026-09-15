"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const caretakerController_1 = require("../controllers/caretakerController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = (0, express_1.Router)();
// Protect all caretaker routes with JWT authentication
router.use(authMiddleware_1.authenticateJWT);
// Endpoint: POST /api/caretaker/assign (assign a caretaker to a patient)
router.post('/assign', caretakerController_1.assignCaretaker);
// Endpoint: PUT /api/caretaker/:id/revoke (revoke access)
router.put('/:id/revoke', caretakerController_1.revokeCaretakerAssignment);
// Endpoint: GET /api/caretaker/:caretakerId/patients (list patients assigned to this caretaker)
router.get('/:caretakerId/patients', caretakerController_1.getAssignedPatients);
exports.default = router;
