"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const adminController_1 = require("../controllers/adminController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = (0, express_1.Router)();
// Protect all admin endpoints with authentication and hospital_admin role check
router.use(authMiddleware_1.authenticateJWT);
router.use(authMiddleware_1.requireHospitalAdmin);
// Endpoint: GET /api/admin/users (list all users, filterable by role: ?role=Doctor)
router.get('/users', adminController_1.getAllUsers);
// Endpoint: PUT /api/admin/users/:id/deactivate (deactivate user account)
router.put('/users/:id/deactivate', adminController_1.deactivateUser);
// Endpoint: GET /api/admin/stats (aggregate metrics: counts of patients, doctors, appointments this week, etc.)
router.get('/stats', adminController_1.getAdminStats);
exports.default = router;
