import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

export const authenticateJWT = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ success: false, message: 'Access token missing or invalid format' });
    return;
  }

  const token = authHeader.split(' ')[1];
  const secret = process.env.JWT_ACCESS_SECRET || 'medtrace_super_secret_access_key_2026';

  try {
    const decoded = jwt.verify(token, secret) as { id: string; email: string; role: string };
    req.user = decoded;
    next();
  } catch (error) {
    res.status(403).json({ success: false, message: 'Invalid or expired access token' });
  }
};

export const requireRole = (...allowedRoles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !req.user.role) {
      res.status(403).json({
        success: false,
        message: 'Access denied: role not specified in authentication token',
      });
      return;
    }

    const normalize = (r: string) => r.toLowerCase().replace(/[\s_-]+/g, '');
    const userRoleNormalized = normalize(req.user.role);

    const isAuthorized = allowedRoles.some((role) => {
      const allowedNormalized = normalize(role);
      return (
        userRoleNormalized === allowedNormalized ||
        req.user?.role.toLowerCase() === role.toLowerCase()
      );
    });

    if (!isAuthorized) {
      res.status(403).json({
        success: false,
        message: `Access denied: requires one of the following roles: [${allowedRoles.join(', ')}]`,
      });
      return;
    }

    next();
  };
};

export const requireHospitalAdmin = requireRole(
  'hospital_admin',
  'Hospital Administrator',
  'admin'
);

