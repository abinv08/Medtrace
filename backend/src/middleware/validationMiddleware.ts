import { Request, Response, NextFunction } from 'express';
import { validationResult, body } from 'express-validator';

export const handleValidationErrors = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const errors = validationResult(req);
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

export const registerValidationRules = [
  body('name').trim().notEmpty().withMessage('Full Name is required'),
  body('email').isEmail().withMessage('Please provide a valid email address'),
  body('phone').trim().notEmpty().withMessage('Phone number is required'),
  body('hospitalName').trim().notEmpty().withMessage('Hospital Name is required'),
  body('department').trim().notEmpty().withMessage('Department is required'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  body('role')
    .isIn([
      'Doctor',
      'Nurse',
      'Patient',
      'Caregiver',
      'Guardian',
      'Hospital Administrator',
    ])
    .withMessage('Invalid role specified'),
];

export const loginValidationRules = [
  body('email').isEmail().withMessage('Please provide a valid email address'),
  body('password').notEmpty().withMessage('Password is required'),
];
