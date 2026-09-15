"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireHospitalAdmin = exports.requireRole = exports.authenticateJWT = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const authenticateJWT = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ success: false, message: 'Access token missing or invalid format' });
        return;
    }
    const token = authHeader.split(' ')[1];
    const secret = process.env.JWT_ACCESS_SECRET || 'medtrace_super_secret_access_key_2026';
    try {
        const decoded = jsonwebtoken_1.default.verify(token, secret);
        req.user = decoded;
        next();
    }
    catch (error) {
        res.status(403).json({ success: false, message: 'Invalid or expired access token' });
    }
};
exports.authenticateJWT = authenticateJWT;
const requireRole = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user || !req.user.role) {
            res.status(403).json({
                success: false,
                message: 'Access denied: role not specified in authentication token',
            });
            return;
        }
        const normalize = (r) => r.toLowerCase().replace(/[\s_-]+/g, '');
        const userRoleNormalized = normalize(req.user.role);
        const isAuthorized = allowedRoles.some((role) => {
            const allowedNormalized = normalize(role);
            return (userRoleNormalized === allowedNormalized ||
                req.user?.role.toLowerCase() === role.toLowerCase());
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
exports.requireRole = requireRole;
exports.requireHospitalAdmin = (0, exports.requireRole)('hospital_admin', 'Hospital Administrator', 'admin');
