const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const { User } = require('../models');
const { generateToken, generateRefreshToken, verifyRefreshToken } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validation');
const logger = require('../utils/logger');

class AuthController {
  async register(req, res, next) {
    try {
      const { email, password, firstName, lastName } = req.body;

      // Check if user already exists
      const existingUser = await User.findByEmail(email);
      if (existingUser) {
        return res.status(409).json({
          error: 'User with this email already exists'
        });
      }

      // Create new user
      const user = await User.create({
        email: email.toLowerCase().trim(),
        password,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        role: 'user' // Default role
      });

      // Generate tokens
      const accessToken = generateToken(user);
      const refreshToken = generateRefreshToken(user);

      logger.info('User registered successfully', {
        userId: user.id,
        email: user.email,
        ip: req.ip
      });

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        user: user.toSafeJSON(),
        tokens: {
          accessToken,
          refreshToken,
          expiresIn: '24h'
        }
      });

    } catch (error) {
      next(error);
    }
  }

  async login(req, res, next) {
    try {
      const { email, password } = req.body;

      // Find user by email
      const user = await User.findByEmail(email);
      if (!user) {
        logger.warn('Login attempt with non-existent email', {
          email,
          ip: req.ip
        });
        return res.status(401).json({
          error: 'Invalid email or password'
        });
      }

      // Check if user is active
      if (!user.isActive) {
        logger.warn('Login attempt with inactive account', {
          userId: user.id,
          email,
          ip: req.ip
        });
        return res.status(401).json({
          error: 'Account is deactivated'
        });
      }

      // Verify password
      const isValidPassword = await user.validatePassword(password);
      if (!isValidPassword) {
        logger.warn('Login attempt with invalid password', {
          userId: user.id,
          email,
          ip: req.ip
        });
        return res.status(401).json({
          error: 'Invalid email or password'
        });
      }

      // Update login statistics
      await user.update({
        lastLogin: new Date(),
        loginCount: user.loginCount + 1
      });

      // Generate tokens
      const accessToken = generateToken(user);
      const refreshToken = generateRefreshToken(user);

      logger.info('User logged in successfully', {
        userId: user.id,
        email: user.email,
        ip: req.ip,
        loginCount: user.loginCount + 1
      });

      res.json({
        success: true,
        message: 'Login successful',
        user: user.toSafeJSON(),
        tokens: {
          accessToken,
          refreshToken,
          expiresIn: '24h'
        }
      });

    } catch (error) {
      next(error);
    }
  }

  async refreshToken(req, res, next) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({
          error: 'Refresh token is required'
        });
      }

      // Verify refresh token
      const decoded = verifyRefreshToken(refreshToken);
      
      // Get user
      const user = await User.findByPk(decoded.userId, {
        attributes: { exclude: ['password'] }
      });

      if (!user || !user.isActive) {
        return res.status(401).json({
          error: 'Invalid refresh token'
        });
      }

      // Generate new tokens
      const newAccessToken = generateToken(user);
      const newRefreshToken = generateRefreshToken(user);

      logger.info('Token refreshed successfully', {
        userId: user.id,
        ip: req.ip
      });

      res.json({
        success: true,
        tokens: {
          accessToken: newAccessToken,
          refreshToken: newRefreshToken,
          expiresIn: '24h'
        }
      });

    } catch (error) {
      logger.warn('Refresh token validation failed', {
        error: error.message,
        ip: req.ip
      });

      res.status(401).json({
        error: 'Invalid refresh token'
      });
    }
  }

  async logout(req, res, next) {
    try {
      // In a more sophisticated implementation, you might:
      // 1. Add the token to a blacklist
      // 2. Store refresh tokens in database and remove them
      // 3. Notify other services of logout

      logger.info('User logged out', {
        userId: req.user?.id,
        ip: req.ip
      });

      res.json({
        success: true,
        message: 'Logged out successfully'
      });

    } catch (error) {
      next(error);
    }
  }

  async profile(req, res, next) {
    try {
      const user = await User.findByPk(req.user.id, {
        attributes: { exclude: ['password'] }
      });

      if (!user) {
        return res.status(404).json({
          error: 'User not found'
        });
      }

      res.json({
        success: true,
        user: user.toSafeJSON()
      });

    } catch (error) {
      next(error);
    }
  }

  async updateProfile(req, res, next) {
    try {
      const { firstName, lastName } = req.body;
      const user = req.user;

      // Update user profile
      const updatedUser = await User.findByPk(user.id);
      await updatedUser.update({
        firstName: firstName?.trim() || user.firstName,
        lastName: lastName?.trim() || user.lastName
      });

      logger.info('User profile updated', {
        userId: user.id,
        ip: req.ip
      });

      res.json({
        success: true,
        message: 'Profile updated successfully',
        user: updatedUser.toSafeJSON()
      });

    } catch (error) {
      next(error);
    }
  }

  async changePassword(req, res, next) {
    try {
      const { currentPassword, newPassword } = req.body;
      const user = await User.findByPk(req.user.id);

      // Verify current password
      const isValidPassword = await user.validatePassword(currentPassword);
      if (!isValidPassword) {
        logger.warn('Password change attempt with invalid current password', {
          userId: user.id,
          ip: req.ip
        });
        return res.status(400).json({
          error: 'Current password is incorrect'
        });
      }

      // Update password
      await user.update({ password: newPassword });

      logger.info('User password changed', {
        userId: user.id,
        ip: req.ip
      });

      res.json({
        success: true,
        message: 'Password changed successfully'
      });

    } catch (error) {
      next(error);
    }
  }

  async forgotPassword(req, res, next) {
    try {
      const { email } = req.body;

      const user = await User.findByEmail(email);
      if (!user) {
        // Return success even if user doesn't exist to prevent email enumeration
        return res.json({
          success: true,
          message: 'If an account with that email exists, a password reset link has been sent.'
        });
      }

      // In a real implementation, you would:
      // 1. Generate a secure reset token
      // 2. Store it in the database with expiration
      // 3. Send an email with the reset link

      logger.info('Password reset requested', {
        userId: user.id,
        email,
        ip: req.ip
      });

      res.json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.'
      });

    } catch (error) {
      next(error);
    }
  }

  async resetPassword(req, res, next) {
    try {
      const { token, newPassword } = req.body;

      // In a real implementation, you would:
      // 1. Verify the reset token
      // 2. Check if it's not expired
      // 3. Update the user's password
      // 4. Invalidate the reset token

      res.json({
        success: true,
        message: 'Password reset successfully'
      });

    } catch (error) {
      next(error);
    }
  }

  // Admin endpoints
  async listUsers(req, res, next) {
    try {
      const { page = 1, limit = 20, search, role, isActive } = req.query;

      const where = {};
      
      if (search) {
        where[Op.or] = [
          { firstName: { [Op.iLike]: `%${search}%` } },
          { lastName: { [Op.iLike]: `%${search}%` } },
          { email: { [Op.iLike]: `%${search}%` } }
        ];
      }
      
      if (role) where.role = role;
      if (isActive !== undefined) where.isActive = isActive === 'true';

      const offset = (parseInt(page) - 1) * parseInt(limit);

      const { rows: users, count } = await User.findAndCountAll({
        where,
        order: [['createdAt', 'DESC']],
        limit: parseInt(limit),
        offset,
        attributes: { exclude: ['password'] }
      });

      res.json({
        success: true,
        users: users.map(user => user.toSafeJSON()),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          pages: Math.ceil(count / parseInt(limit))
        }
      });

    } catch (error) {
      next(error);
    }
  }

  async updateUser(req, res, next) {
    try {
      const { userId } = req.params;
      const { role, isActive } = req.body;

      const user = await User.findByPk(userId);
      if (!user) {
        return res.status(404).json({
          error: 'User not found'
        });
      }

      await user.update({
        role: role || user.role,
        isActive: isActive !== undefined ? isActive : user.isActive
      });

      logger.info('User updated by admin', {
        adminId: req.user.id,
        targetUserId: userId,
        changes: { role, isActive },
        ip: req.ip
      });

      res.json({
        success: true,
        message: 'User updated successfully',
        user: user.toSafeJSON()
      });

    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AuthController();