import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { User, IUser, UserRole } from '../models/User';
import { sendPasswordResetEmail } from '../services/emailService';
import { verifyGoogleIdToken } from '../services/googleAuthService';
import { AuthenticatedRequest } from '../middleware/authMiddleware';

// In-Memory Fallback Store if MongoDB is disconnected
const memoryUsers = new Map<string, any>();

// Helper to generate access & refresh tokens
const generateTokens = (user: { id: string; email: string; role: string }, rememberMe = false) => {
  const accessSecret = process.env.JWT_ACCESS_SECRET || 'medtrace_super_secret_access_key_2026';
  const refreshSecret = process.env.JWT_REFRESH_SECRET || 'medtrace_super_secret_refresh_key_2026';

  const accessToken = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    accessSecret,
    { expiresIn: '15m' }
  );

  const refreshTokenExpiry = rememberMe ? '30d' : '7d';
  const refreshToken = jwt.sign(
    { id: user.id, email: user.email },
    refreshSecret,
    { expiresIn: refreshTokenExpiry }
  );

  return { accessToken, refreshToken };
};

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      name,
      email,
      phone,
      hospitalName,
      department,
      professionalId,
      password,
      role,
    } = req.body;

    const normalizedEmail = email.toLowerCase().trim();

    // Check if user already exists
    let existingUser = null;
    try {
      existingUser = await User.findOne({ email: normalizedEmail });
    } catch {
      existingUser = memoryUsers.get(normalizedEmail) || null;
    }

    if (existingUser) {
      res.status(400).json({
        success: false,
        message: 'An account with this email address already exists.',
      });
      return;
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    let newUser: any;
    try {
      newUser = await User.create({
        name,
        email: normalizedEmail,
        phone,
        hospitalName,
        department,
        professionalId: professionalId || '',
        password: hashedPassword,
        role: role as UserRole,
      });
    } catch (dbErr) {
      // Fallback to memory store if DB is unavailable
      const id = 'user_' + Date.now();
      newUser = {
        _id: id,
        id,
        name,
        email: normalizedEmail,
        phone,
        hospitalName,
        department,
        professionalId: professionalId || '',
        password: hashedPassword,
        role: role as UserRole,
        createdAt: new Date(),
      };
      memoryUsers.set(normalizedEmail, newUser);
    }

    const userId = newUser._id ? newUser._id.toString() : newUser.id;
    const { accessToken, refreshToken } = generateTokens({
      id: userId,
      email: newUser.email,
      role: newUser.role,
    });

    // Save refresh token
    try {
      if (newUser.save) {
        newUser.refreshToken = refreshToken;
        await newUser.save();
      }
    } catch (e) {
      newUser.refreshToken = refreshToken;
    }

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      accessToken,
      refreshToken,
      user: {
        id: userId,
        name: newUser.name,
        email: newUser.email,
        phone: newUser.phone,
        hospitalName: newUser.hospitalName,
        department: newUser.department,
        professionalId: newUser.professionalId,
        role: newUser.role,
        createdAt: newUser.createdAt,
      },
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during registration',
      error: error.message,
    });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, rememberMe } = req.body;
    const normalizedEmail = email.toLowerCase().trim();

    let user: any = null;
    try {
      user = await User.findOne({ email: normalizedEmail });
    } catch {
      user = memoryUsers.get(normalizedEmail) || null;
    }

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'Invalid email or password credentials',
      });
      return;
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password || '');
    if (!isMatch) {
      res.status(401).json({
        success: false,
        message: 'Invalid email or password credentials',
      });
      return;
    }

    const userId = user._id ? user._id.toString() : user.id;
    const { accessToken, refreshToken } = generateTokens(
      { id: userId, email: user.email, role: user.role },
      Boolean(rememberMe)
    );

    // Save refresh token
    try {
      if (user.save) {
        user.refreshToken = refreshToken;
        await user.save();
      }
    } catch (e) {
      user.refreshToken = refreshToken;
    }

    const cookieMaxAge = rememberMe
      ? 30 * 24 * 60 * 60 * 1000
      : 7 * 24 * 60 * 60 * 1000;

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: cookieMaxAge,
    });

    res.status(200).json({
      success: true,
      message: 'Login successful',
      accessToken,
      refreshToken,
      user: {
        id: userId,
        name: user.name,
        email: user.email,
        phone: user.phone,
        hospitalName: user.hospitalName,
        department: user.department,
        professionalId: user.professionalId,
        role: user.role,
        createdAt: user.createdAt,
      },
    });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during login',
      error: error.message,
    });
  }
};

export const googleAuth = async (req: Request, res: Response): Promise<void> => {
  try {
    const { idToken, role = 'Doctor' } = req.body;
    if (!idToken) {
      res.status(400).json({ success: false, message: 'Google ID Token is required' });
      return;
    }

    const googlePayload = await verifyGoogleIdToken(idToken);
    if (!googlePayload) {
      res.status(401).json({ success: false, message: 'Google authentication failed / invalid token' });
      return;
    }

    const normalizedEmail = googlePayload.email.toLowerCase().trim();
    let user: any = null;
    try {
      user = await User.findOne({ email: normalizedEmail });
    } catch {
      user = memoryUsers.get(normalizedEmail) || null;
    }

    if (!user) {
      // Create new user for Google login
      try {
        user = await User.create({
          name: googlePayload.name,
          email: normalizedEmail,
          phone: '+1 800 555 0199',
          hospitalName: 'General Hospital',
          department: 'Clinical Intelligence',
          role: role as UserRole,
          googleId: googlePayload.googleId,
        });
      } catch (dbErr) {
        const id = 'google_user_' + Date.now();
        user = {
          _id: id,
          id,
          name: googlePayload.name,
          email: normalizedEmail,
          phone: '+1 800 555 0199',
          hospitalName: 'General Hospital',
          department: 'Clinical Intelligence',
          role: role as UserRole,
          googleId: googlePayload.googleId,
          createdAt: new Date(),
        };
        memoryUsers.set(normalizedEmail, user);
      }
    }

    const userId = user._id ? user._id.toString() : user.id;
    const { accessToken, refreshToken } = generateTokens({
      id: userId,
      email: user.email,
      role: user.role,
    });

    res.status(200).json({
      success: true,
      message: 'Google login successful',
      accessToken,
      refreshToken,
      user: {
        id: userId,
        name: user.name,
        email: user.email,
        phone: user.phone,
        hospitalName: user.hospitalName,
        department: user.department,
        professionalId: user.professionalId,
        role: user.role,
        createdAt: user.createdAt,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Google Auth error', error: error.message });
  }
};

export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ success: false, message: 'Email address is required' });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();
    let user: any = null;
    try {
      user = await User.findOne({ email: normalizedEmail });
    } catch {
      user = memoryUsers.get(normalizedEmail) || null;
    }

    if (!user) {
      // Return success even if user not found to prevent email enumeration
      res.status(200).json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.',
      });
      return;
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    try {
      if (user.save) {
        user.resetPasswordToken = resetTokenHash;
        user.resetPasswordExpires = expires;
        await user.save();
      }
    } catch (e) {
      user.resetPasswordToken = resetTokenHash;
      user.resetPasswordExpires = expires;
    }

    await sendPasswordResetEmail(user.email, resetToken);

    res.status(200).json({
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent.',
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Forgot password request failed', error: error.message });
  }
};

export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, email, newPassword } = req.body;
    if (!token || !newPassword) {
      res.status(400).json({ success: false, message: 'Reset token and new password are required' });
      return;
    }

    const resetTokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const normalizedEmail = (email || '').toLowerCase().trim();

    let user: any = null;
    try {
      user = await User.findOne({
        email: normalizedEmail,
        resetPasswordToken: resetTokenHash,
        resetPasswordExpires: { $gt: new Date() },
      });
    } catch {
      const memUser = memoryUsers.get(normalizedEmail);
      if (memUser && memUser.resetPasswordToken === resetTokenHash) {
        user = memUser;
      }
    }

    if (!user) {
      res.status(400).json({ success: false, message: 'Password reset token is invalid or has expired.' });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    try {
      if (user.save) {
        await user.save();
      }
    } catch (e) {
      memoryUsers.set(normalizedEmail, user);
    }

    res.status(200).json({
      success: true,
      message: 'Password reset successful. You can now log in with your new password.',
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Password reset error', error: error.message });
  }
};

export const refreshToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const token = req.cookies.refreshToken || req.body.refreshToken;
    if (!token) {
      res.status(401).json({ success: false, message: 'Refresh token missing' });
      return;
    }

    const secret = process.env.JWT_REFRESH_SECRET || 'medtrace_super_secret_refresh_key_2026';
    let decoded: any;
    try {
      decoded = jwt.verify(token, secret);
    } catch (err) {
      res.status(403).json({ success: false, message: 'Invalid or expired refresh token' });
      return;
    }

    let user: any = null;
    try {
      user = await User.findById(decoded.id);
    } catch {
      for (const u of memoryUsers.values()) {
        if (u.id === decoded.id || (u._id && u._id.toString() === decoded.id)) {
          user = u;
          break;
        }
      }
    }

    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    const userId = user._id ? user._id.toString() : user.id;
    const { accessToken: newAccessToken, refreshToken: newRefreshToken } = generateTokens({
      id: userId,
      email: user.email,
      role: user.role,
    });

    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(200).json({
      success: true,
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Token refresh error', error: error.message });
  }
};

export const logout = async (req: Request, res: Response): Promise<void> => {
  res.clearCookie('refreshToken');
  res.status(200).json({ success: true, message: 'Logged out successfully' });
};

export const getMe = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    let user: any = null;
    try {
      user = await User.findById(req.user.id).select('-password -resetPasswordToken -refreshToken');
    } catch {
      for (const u of memoryUsers.values()) {
        if (u.id === req.user.id || (u._id && u._id.toString() === req.user.id)) {
          user = u;
          break;
        }
      }
    }

    if (!user) {
      res.status(404).json({ success: false, message: 'User profile not found' });
      return;
    }

    const userId = user._id ? user._id.toString() : user.id;
    res.status(200).json({
      success: true,
      user: {
        id: userId,
        name: user.name,
        email: user.email,
        phone: user.phone,
        hospitalName: user.hospitalName,
        department: user.department,
        professionalId: user.professionalId,
        role: user.role,
        createdAt: user.createdAt,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Error retrieving user profile', error: error.message });
  }
};
