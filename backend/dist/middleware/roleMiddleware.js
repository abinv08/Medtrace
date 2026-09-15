"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireHospitalAdmin = exports.requireRole = void 0;
/**
 * Role-based access control middleware.
 * Checks req.user.role (set by authenticateJWT) against allowed roles.
 * Returns 403 Forbidden if the user's role does not match.
 */
const requireRole = (...roles) => {
    return (req, res, next) => {
        if (!req.user || !req.user.role) {
            res.status(403).json({
                success: false,
                message: 'Access denied: user role not specified in authentication token',
            });
            return;
        }
        const normalize = (r) => r.toLowerCase().replace(/[\s_-]+/g, '');
        const userRoleNormalized = normalize(req.user.role);
        const hasPermission = roles.some((role) => {
            const roleNormalized = normalize(role);
            return (userRoleNormalized === roleNormalized ||
                req.user?.role.toLowerCase() === role.toLowerCase());
        });
        if (!hasPermission) {
            res.status(403).json({
                success: false,
                message: `Access denied: requires one of the following roles: [${roles.join(', ')}]`,
            });
            return;
        }
        next();
    };
};
exports.requireRole = requireRole;
exports.requireHospitalAdmin = (0, exports.requireRole)('hospital_admin', 'Hospital Administrator', 'admin');
