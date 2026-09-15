import { Response } from 'express';
import mongoose from 'mongoose';
import { User, IUser } from '../models/User';
import { Patient } from '../models/Patient';
import { Appointment } from '../models/Appointment';
import { Vitals } from '../models/Vitals';
import { Medication } from '../models/Medication';
import { TestResult } from '../models/TestResult';
import { AuthenticatedRequest } from '../middleware/authMiddleware';

// GET /api/admin/users - List all users, filterable by role
export const getAllUsers = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { role } = req.query;

    const filter: any = {};
    if (role) {
      filter.role = new RegExp(`^${role}$`, 'i');
    }

    const users = await User.find(filter)
      .select('-password -resetPasswordToken -refreshToken')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: users.length,
      users,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving users list',
      error: error.message,
    });
  }
};

// PUT /api/admin/users/:id/deactivate - Deactivate a user account
export const deactivateUser = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({ success: false, message: 'Invalid user ID format' });
      return;
    }

    const user = await User.findById(id);

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
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Error deactivating user',
      error: error.message,
    });
  }
};

// GET /api/admin/stats - Counts of patients, doctors, appointments this week, etc.
export const getAdminStats = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
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
    const [
      totalUsers,
      totalDoctors,
      totalNurses,
      totalCaregivers,
      totalPatientProfiles,
      totalPatientUsers,
      totalAppointments,
      appointmentsThisWeek,
      pendingAppointments,
      completedAppointments,
      totalVitals,
      activeMedications,
      totalTestResults,
    ] = await Promise.all([
      User.countDocuments().catch(() => 0),
      User.countDocuments({ role: 'Doctor' }).catch(() => 0),
      User.countDocuments({ role: 'Nurse' }).catch(() => 0),
      User.countDocuments({ role: { $in: ['Caregiver', 'Guardian'] } }).catch(() => 0),
      Patient.countDocuments().catch(() => 0),
      User.countDocuments({ role: 'Patient' }).catch(() => 0),
      Appointment.countDocuments().catch(() => 0),
      Appointment.countDocuments({
        dateTime: { $gte: startOfWeek, $lt: endOfWeek },
      }).catch(() => 0),
      Appointment.countDocuments({ status: 'pending' }).catch(() => 0),
      Appointment.countDocuments({ status: 'completed' }).catch(() => 0),
      Vitals.countDocuments().catch(() => 0),
      Medication.countDocuments({ status: 'active' }).catch(() => 0),
      TestResult.countDocuments().catch(() => 0),
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
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Error aggregating admin statistics',
      error: error.message,
    });
  }
};
