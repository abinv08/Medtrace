import { Router } from 'express';
import {
  register,
  login,
  googleAuth,
  forgotPassword,
  resetPassword,
  refreshToken,
  logout,
  getMe,
} from '../controllers/authController';
import {
  registerValidationRules,
  loginValidationRules,
  handleValidationErrors,
} from '../middleware/validationMiddleware';
import { authenticateJWT } from '../middleware/authMiddleware';

const router = Router();

// Endpoint: POST /api/auth/register
router.post('/register', registerValidationRules, handleValidationErrors, register);

// Endpoint: POST /api/auth/login
router.post('/login', loginValidationRules, handleValidationErrors, login);

// Endpoint: POST /api/auth/google
router.post('/google', googleAuth);

// Endpoint: POST /api/auth/forgot-password
router.post('/forgot-password', forgotPassword);

// Endpoint: POST /api/auth/reset-password
router.post('/reset-password', resetPassword);

// Endpoint: POST /api/auth/refresh-token
router.post('/refresh-token', refreshToken);

// Endpoint: POST /api/auth/logout
router.post('/logout', logout);

// Endpoint: GET /api/auth/me
router.get('/me', authenticateJWT, getMe);

export default router;
