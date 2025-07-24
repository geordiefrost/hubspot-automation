const express = require('express');
const joi = require('joi');
const router = express.Router();
const authController = require('../controllers/authController');
const { validate, schemas } = require('../middleware/validation');
const { authenticateToken, requireAdmin, authRateLimit } = require('../middleware/auth');
const { strictRateLimit } = require('../middleware/security');

// Public authentication routes
router.post('/register', 
  authRateLimit,
  validate(schemas.userRegistration),
  authController.register
);

router.post('/login',
  authRateLimit,
  validate(schemas.userLogin),
  authController.login
);

router.post('/refresh-token',
  authRateLimit,
  authController.refreshToken
);

router.post('/forgot-password',
  strictRateLimit,
  validate(joi.object({
    email: joi.string().email().required()
  })),
  authController.forgotPassword
);

router.post('/reset-password',
  strictRateLimit,
  validate(joi.object({
    token: joi.string().required(),
    newPassword: joi.string().min(8).pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#\$%\^&\*])')).required()
  })),
  authController.resetPassword
);

// Protected routes (require authentication)
router.use(authenticateToken);

router.post('/logout', authController.logout);

router.get('/profile', authController.profile);

router.put('/profile',
  validate(joi.object({
    firstName: joi.string().min(1).max(50).optional(),
    lastName: joi.string().min(1).max(50).optional()
  })),
  authController.updateProfile
);

router.put('/change-password',
  strictRateLimit,
  validate(joi.object({
    currentPassword: joi.string().required(),
    newPassword: joi.string().min(8).pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#\$%\^&\*])')).required()
  })),
  authController.changePassword
);

// Admin-only routes
router.get('/admin/users',
  requireAdmin,
  validate(joi.object({
    page: joi.number().integer().min(1).default(1),
    limit: joi.number().integer().min(1).max(100).default(20),
    search: joi.string().max(255).optional(),
    role: joi.string().valid('admin', 'user').optional(),
    isActive: joi.boolean().optional()
  }), 'query'),
  authController.listUsers
);

router.put('/admin/users/:userId',
  requireAdmin,
  validate(joi.object({
    userId: joi.string().uuid().required()
  }), 'params'),
  validate(joi.object({
    role: joi.string().valid('admin', 'user').optional(),
    isActive: joi.boolean().optional()
  })),
  authController.updateUser
);

module.exports = router;