"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMe = exports.logout = exports.refreshToken = exports.resetPassword = exports.forgotPassword = exports.googleAuth = exports.login = exports.register = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_1 = __importDefault(require("crypto"));
const User_1 = require("../models/User");
const emailService_1 = require("../services/emailService");
const googleAuthService_1 = require("../services/googleAuthService");
// In-Memory Fallback Store if MongoDB is disconnected
const memoryUsers = new Map();
// Helper to generate access & refresh tokens
const generateTokens = (user, rememberMe = false) => {
    const accessSecret = process.env.JWT_ACCESS_SECRET || 'medtrace_super_secret_access_key_2026';
    const refreshSecret = process.env.JWT_REFRESH_SECRET || 'medtrace_super_secret_refresh_key_2026';
    const accessToken = jsonwebtoken_1.default.sign({ id: user.id, email: user.email, role: user.role }, accessSecret, { expiresIn: '15m' });
    const refreshTokenExpiry = rememberMe ? '30d' : '7d';
    const refreshToken = jsonwebtoken_1.default.sign({ id: user.id, email: user.email }, refreshSecret, { expiresIn: refreshTokenExpiry });
    return { accessToken, refreshToken };
};
const register = async (req, res) => {
    try {
        const { name, email, phone, hospitalName, department, professionalId, password, role, } = req.body;
        const normalizedEmail = email.toLowerCase().trim();
        // Check if user already exists
        let existingUser = null;
        try {
            existingUser = await User_1.User.findOne({ email: normalizedEmail });
        }
        catch {
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
        const salt = await bcrypt_1.default.genSalt(10);
        const hashedPassword = await bcrypt_1.default.hash(password, salt);
        let newUser;
        try {
            newUser = await User_1.User.create({
                name,
                email: normalizedEmail,
                phone,
                hospitalName,
                department,
                professionalId: professionalId || '',
                password: hashedPassword,
                role: role,
            });
        }
        catch (dbErr) {
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
                role: role,
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
        }
        catch (e) {
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
    }
    catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error during registration',
            error: error.message,
        });
    }
};
exports.register = register;
const login = async (req, res) => {
    try {
        const { email, password, rememberMe } = req.body;
        const normalizedEmail = email.toLowerCase().trim();
        let user = null;
        try {
            user = await User_1.User.findOne({ email: normalizedEmail });
        }
        catch {
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
        const isMatch = await bcrypt_1.default.compare(password, user.password || '');
        if (!isMatch) {
            res.status(401).json({
                success: false,
                message: 'Invalid email or password credentials',
            });
            return;
        }
        const userId = user._id ? user._id.toString() : user.id;
        const { accessToken, refreshToken } = generateTokens({ id: userId, email: user.email, role: user.role }, Boolean(rememberMe));
        // Save refresh token
        try {
            if (user.save) {
                user.refreshToken = refreshToken;
                await user.save();
            }
        }
        catch (e) {
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
    }
    catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error during login',
            error: error.message,
        });
    }
};
exports.login = login;
const googleAuth = async (req, res) => {
    try {
        const { idToken, role } = req.body;
        if (!idToken) {
            res.status(400).json({ success: false, message: 'Google ID Token is required' });
            return;
        }
        const googlePayload = await (0, googleAuthService_1.verifyGoogleIdToken)(idToken);
        if (!googlePayload) {
            res.status(401).json({ success: false, message: 'Google authentication failed / invalid token' });
            return;
        }
        const normalizedEmail = googlePayload.email.toLowerCase().trim();
        let user = null;
        try {
            user = await User_1.User.findOne({ email: normalizedEmail });
        }
        catch {
            user = memoryUsers.get(normalizedEmail) || null;
        }
        if (!user) {
            // Brand-new account via Google: use provided role hint but NEVER allow Admin
            // Admin accounts must be created via the explicit registration flow
            const safeRole = role && role !== 'Admin' && ['Doctor', 'Nurse', 'Patient', 'Guardian', 'Caregiver', 'Hospital Administrator'].includes(role)
                ? role
                : 'Patient';
            try {
                user = await User_1.User.create({
                    name: googlePayload.name,
                    email: normalizedEmail,
                    phone: '+1 800 555 0199',
                    hospitalName: 'MedTrace General Hospital',
                    department: safeRole === 'Doctor' ? 'General Medicine' : 'General Care',
                    role: safeRole,
                    googleId: googlePayload.googleId,
                });
            }
            catch (dbErr) {
                const id = 'google_user_' + Date.now();
                user = {
                    _id: id,
                    id,
                    name: googlePayload.name,
                    email: normalizedEmail,
                    phone: '+1 800 555 0199',
                    hospitalName: 'MedTrace General Hospital',
                    department: safeRole === 'Doctor' ? 'General Medicine' : 'General Care',
                    role: safeRole,
                    googleId: googlePayload.googleId,
                    createdAt: new Date(),
                };
                memoryUsers.set(normalizedEmail, user);
            }
        }
        // Existing users: role is NEVER modified here — it stays exactly as registered
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
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Google Auth error', error: error.message });
    }
};
exports.googleAuth = googleAuth;
const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            res.status(400).json({ success: false, message: 'Email address is required' });
            return;
        }
        const normalizedEmail = email.toLowerCase().trim();
        let user = null;
        try {
            user = await User_1.User.findOne({ email: normalizedEmail });
        }
        catch {
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
        const resetToken = crypto_1.default.randomBytes(32).toString('hex');
        const resetTokenHash = crypto_1.default.createHash('sha256').update(resetToken).digest('hex');
        const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
        try {
            if (user.save) {
                user.resetPasswordToken = resetTokenHash;
                user.resetPasswordExpires = expires;
                await user.save();
            }
        }
        catch (e) {
            user.resetPasswordToken = resetTokenHash;
            user.resetPasswordExpires = expires;
        }
        await (0, emailService_1.sendPasswordResetEmail)(user.email, resetToken);
        res.status(200).json({
            success: true,
            message: 'If an account with that email exists, a password reset link has been sent.',
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Forgot password request failed', error: error.message });
    }
};
exports.forgotPassword = forgotPassword;
const resetPassword = async (req, res) => {
    try {
        const { token, email, newPassword } = req.body;
        if (!token || !newPassword) {
            res.status(400).json({ success: false, message: 'Reset token and new password are required' });
            return;
        }
        const resetTokenHash = crypto_1.default.createHash('sha256').update(token).digest('hex');
        const normalizedEmail = (email || '').toLowerCase().trim();
        let user = null;
        try {
            user = await User_1.User.findOne({
                email: normalizedEmail,
                resetPasswordToken: resetTokenHash,
                resetPasswordExpires: { $gt: new Date() },
            });
        }
        catch {
            const memUser = memoryUsers.get(normalizedEmail);
            if (memUser && memUser.resetPasswordToken === resetTokenHash) {
                user = memUser;
            }
        }
        if (!user) {
            res.status(400).json({ success: false, message: 'Password reset token is invalid or has expired.' });
            return;
        }
        const salt = await bcrypt_1.default.genSalt(10);
        user.password = await bcrypt_1.default.hash(newPassword, salt);
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        try {
            if (user.save) {
                await user.save();
            }
        }
        catch (e) {
            memoryUsers.set(normalizedEmail, user);
        }
        res.status(200).json({
            success: true,
            message: 'Password reset successful. You can now log in with your new password.',
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Password reset error', error: error.message });
    }
};
exports.resetPassword = resetPassword;
const refreshToken = async (req, res) => {
    try {
        const token = req.cookies.refreshToken || req.body.refreshToken;
        if (!token) {
            res.status(401).json({ success: false, message: 'Refresh token missing' });
            return;
        }
        const secret = process.env.JWT_REFRESH_SECRET || 'medtrace_super_secret_refresh_key_2026';
        let decoded;
        try {
            decoded = jsonwebtoken_1.default.verify(token, secret);
        }
        catch (err) {
            res.status(403).json({ success: false, message: 'Invalid or expired refresh token' });
            return;
        }
        let user = null;
        try {
            user = await User_1.User.findById(decoded.id);
        }
        catch {
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
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Token refresh error', error: error.message });
    }
};
exports.refreshToken = refreshToken;
const logout = async (req, res) => {
    res.clearCookie('refreshToken');
    res.status(200).json({ success: true, message: 'Logged out successfully' });
};
exports.logout = logout;
const getMe = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }
        let user = null;
        try {
            user = await User_1.User.findById(req.user.id).select('-password -resetPasswordToken -refreshToken');
        }
        catch {
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
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Error retrieving user profile', error: error.message });
    }
};
exports.getMe = getMe;
