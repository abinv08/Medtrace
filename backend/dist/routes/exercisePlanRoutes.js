"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const exercisePlanController_1 = require("../controllers/exercisePlanController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = (0, express_1.Router)();
// Protect all exercise plan routes with JWT authentication
router.use(authMiddleware_1.authenticateJWT);
// Endpoint: POST /api/exercise-plans (create/assign a plan)
router.post('/', exercisePlanController_1.createExercisePlan);
// Endpoint: GET /api/exercise-plans/:patientId (get plan for patient)
router.get('/:patientId', exercisePlanController_1.getExercisePlanByPatientId);
// Endpoint: PUT /api/exercise-plans/:id/progress (log a completed session)
router.put('/:id/progress', exercisePlanController_1.logExerciseProgress);
exports.default = router;
