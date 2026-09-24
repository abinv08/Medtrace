"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAdminStats = exports.deactivateUser = exports.getAllUsers = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const User_1 = require("../models/User");
const Patient_1 = require("../models/Patient");
const Appointment_1 = require("../models/Appointment");
const Vitals_1 = require("../models/Vitals");
const Medication_1 = require("../models/Medication");
const TestResult_1 = require("../models/TestResult");
// GET /api/admin/users - List all users, filterable by role
const getAllUsers = async (req, res) => {
    try {
        const { role } = req.query;
        const filter = {};
        if (role) {
            filter.role = new RegExp(`^${role}$`, 'i');
        }
        const users = await User_1.User.find(filter)
            .select('-password -resetPasswordToken -refreshToken')
            .sort({ createdAt: -1 });
        res.status(200).json({
            success: true,
            count: users.length,
            users,
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error retrieving users list',
            error: error.message,
        });
    }
};
exports.getAllUsers = getAllUsers;
// PUT /api/admin/users/:id/deactivate - Deactivate a user account
const deactivateUser = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose_1.default.isValidObjectId(id)) {
            res.status(400).json({ success: false, message: 'Invalid user ID format' });
            return;
        }
        const user = await User_1.User.findById(id);
        if (!user) {
            res.status(404).json({ success: false, message: 'User not found' });
            return;
        }
        user.isActive = false;
        await user.save();
        res.status(200).json({
            success: true,
            message: `User ${user.email} has been deactivated successfully`,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                isActive: user.isActive,
            },
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error deactivating user',
            error: error.message,
        });
    }
};
exports.deactivateUser = deactivateUser;
// GET /api/admin/stats - Counts of patients, doctors, appointments this week, etc.
const getAdminStats = async (req, res) => {
    try {
        // Current week boundary calculations
        const now = new Date();
        const dayOfWeek = now.getDay();
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - dayOfWeek);
        startOfWeek.setHours(0, 0, 0, 0);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 7);
        // Run parallel count aggregations
        const [totalUsers, totalDoctors, totalNurses, totalCaregivers, totalPatientProfiles, totalPatientUsers, totalAppointments, appointmentsThisWeek, pendingAppointments, completedAppointments, totalVitals, activeMedications, totalTestResults,] = await Promise.all([
            User_1.User.countDocuments().catch(() => 0),
            User_1.User.countDocuments({ role: 'Doctor' }).catch(() => 0),
            User_1.User.countDocuments({ role: { $in: ['Nurse', 'Head Nurse'] } }).catch(() => 0),
            User_1.User.countDocuments({ role: { $in: ['Caregiver', 'Guardian'] } }).catch(() => 0),
            Patient_1.Patient.countDocuments().catch(() => 0),
            User_1.User.countDocuments({ role: 'Patient' }).catch(() => 0),
            Appointment_1.Appointment.countDocuments().catch(() => 0),
            Appointment_1.Appointment.countDocuments({
                dateTime: { $gte: startOfWeek, $lt: endOfWeek },
            }).catch(() => 0),
            Appointment_1.Appointment.countDocuments({ status: 'pending' }).catch(() => 0),
            Appointment_1.Appointment.countDocuments({ status: 'completed' }).catch(() => 0),
            Vitals_1.Vitals.countDocuments().catch(() => 0),
            Medication_1.Medication.countDocuments({ status: 'active' }).catch(() => 0),
            TestResult_1.TestResult.countDocuments().catch(() => 0),
        ]);
        const stats = {
            users: {
                total: totalUsers,
                doctors: totalDoctors,
                nurses: totalNurses,
                caregivers: totalCaregivers,
                patients: Math.max(totalPatientProfiles, totalPatientUsers),
            },
            appointments: {
                total: totalAppointments,
                thisWeek: appointmentsThisWeek,
                pending: pendingAppointments,
                completed: completedAppointments,
            },
            clinical: {
                vitalsRecorded: totalVitals,
                activePrescriptions: activeMedications,
                uploadedReports: totalTestResults,
            },
        };
        res.status(200).json({
            success: true,
            stats,
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error aggregating admin statistics',
            error: error.message,
        });
    }
};
exports.getAdminStats = getAdminStats;
