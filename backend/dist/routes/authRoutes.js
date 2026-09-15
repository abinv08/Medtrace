"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authController_1 = require("../controllers/authController");
const validationMiddleware_1 = require("../middleware/validationMiddleware");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = (0, express_1.Router)();
// Endpoint: POST /api/auth/register
router.post('/register', validationMiddleware_1.registerValidationRules, validationMiddleware_1.handleValidationErrors, authController_1.register);
// Endpoint: POST /api/auth/login
router.post('/login', validationMiddleware_1.loginValidationRules, validationMiddleware_1.handleValidationErrors, authController_1.login);
// Endpoint: POST /api/auth/google
router.post('/google', authController_1.googleAuth);
// Endpoint: POST /api/auth/forgot-password
router.post('/forgot-password', authController_1.forgotPassword);
// Endpoint: POST /api/auth/reset-password
router.post('/reset-password', authController_1.resetPassword);
// Endpoint: POST /api/auth/refresh-token
router.post('/refresh-token', authController_1.refreshToken);
// Endpoint: POST /api/auth/logout
router.post('/logout', authController_1.logout);
// Endpoint: GET /api/auth/me
router.get('/me', authMiddleware_1.authenticateJWT, authController_1.getMe);
exports.default = router;
