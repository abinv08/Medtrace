"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loginValidationRules = exports.registerValidationRules = exports.handleValidationErrors = void 0;
const express_validator_1 = require("express-validator");
const handleValidationErrors = (req, res, next) => {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors: errors.array().map((err) => ({
                field: err.type === 'field' ? err.path : err.type,
                message: err.msg,
            })),
        });
        return;
    }
    next();
};
exports.handleValidationErrors = handleValidationErrors;
exports.registerValidationRules = [
    (0, express_validator_1.body)('name').trim().notEmpty().withMessage('Full Name is required'),
    (0, express_validator_1.body)('email').isEmail().withMessage('Please provide a valid email address'),
    (0, express_validator_1.body)('phone').trim().notEmpty().withMessage('Phone number is required'),
    (0, express_validator_1.body)('hospitalName').trim().notEmpty().withMessage('Hospital Name is required'),
    (0, express_validator_1.body)('department').trim().notEmpty().withMessage('Department is required'),
    (0, express_validator_1.body)('password')
        .isLength({ min: 8 })
        .withMessage('Password must be at least 8 characters long')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
    (0, express_validator_1.body)('role')
        .isIn([
        'Doctor',
        'Nurse',
        'Patient',
        'Caregiver',
        'Guardian',
        'Hospital Administrator',
        'Admin',
    ])
        .withMessage('Invalid role specified'),
];
exports.loginValidationRules = [
    (0, express_validator_1.body)('email').isEmail().withMessage('Please provide a valid email address'),
    (0, express_validator_1.body)('password').notEmpty().withMessage('Password is required'),
];
