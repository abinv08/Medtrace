import { Response } from 'express';
import mongoose from 'mongoose';
import { NurseAssignment } from '../models/NurseAssignment';
import { Patient } from '../models/Patient';
import { User } from '../models/User';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { Vitals } from '../models/Vitals';

const latestVitalsForPatients = async (patientIds: mongoose.Types.ObjectId[]) => {
  const readings = await Promise.all(patientIds.map((patientId) =>
    Vitals.findOne({ patientId }).sort({ recordedAt: -1 }).lean()
  ));
  return new Map(readings.filter(Boolean).map((reading: any) => [reading.patientId.toString(), reading]));
};

export const assignNurse = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { nurseId, patientId, ward, shift } = req.body;
    const assignedBy = req.user?.id;

    if (!nurseId || !patientId || !assignedBy) {
      res.status(400).json({
        success: false,
        message: 'nurseId and patientId are required',
      });
      return;
    }

    if (
      !mongoose.isValidObjectId(nurseId) ||
      !mongoose.isValidObjectId(patientId) ||
      !mongoose.isValidObjectId(assignedBy)
    ) {
      res.status(400).json({ success: false, message: 'Invalid ID format' });
      return;
    }

    const [nurse, patient] = await Promise.all([
      User.findOne({ _id: nurseId, role: { $in: ['Nurse', 'Head Nurse'] } }),
      Patient.findById(patientId),
    ]);

    if (!nurse) {
      res.status(404).json({ success: false, message: 'Nurse not found' });
      return;
    }

    if (!patient) {
      res.status(404).json({ success: false, message: 'Patient not found' });
      return;
    }

    const assignment = await NurseAssignment.create({
      nurseId,
      patientId,
      assignedBy,
      ward,
      shift,
    });

    await assignment.populate([
      { path: 'nurseId', select: 'name email phone role' },
      { path: 'patientId', populate: { path: 'userId', select: 'name email phone' } },
      { path: 'assignedBy', select: 'name email role' },
    ]);

    res.status(201).json({
      success: true,
      message: 'Nurse assigned successfully',
      assignment,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Error assigning nurse',
      error: error.message,
    });
  }
};

export const revokeNurseAssignment = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({ success: false, message: 'Invalid assignment ID format' });
      return;
    }

    const assignment = await NurseAssignment.findById(id);
    if (!assignment) {
      res.status(404).json({ success: false, message: 'Nurse assignment not found' });
      return;
    }

    assignment.status = 'revoked';
    await assignment.save();

    await assignment.populate([
      { path: 'nurseId', select: 'name email phone role' },
      { path: 'patientId', populate: { path: 'userId', select: 'name email phone' } },
      { path: 'assignedBy', select: 'name email role' },
    ]);

    res.status(200).json({
      success: true,
      message: 'Nurse assignment revoked successfully',
      assignment,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Error revoking nurse assignment',
      error: error.message,
    });
  }
};

export const getAssignedPatients = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { nurseId } = req.params;

    if (!mongoose.isValidObjectId(nurseId)) {
      res.status(400).json({ success: false, message: 'Invalid nurse ID format' });
      return;
    }

    const assignments = await NurseAssignment.find({ nurseId, status: 'active' })
      .populate({
        path: 'patientId',
        populate: { path: 'userId', select: 'name email phone hospitalName department' },
      })
      .sort({ updatedAt: -1 });

    res.status(200).json({
      success: true,
      count: assignments.length,
      assignments,
      patients: assignments.map((assignment) => assignment.patientId).filter(Boolean),
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving assigned patients',
      error: error.message,
    });
  }
};

export const getHeadNurseRoster = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const [nurses, patients, assignments] = await Promise.all([
      User.find({ role: { $in: ['Nurse', 'Head Nurse'] }, isActive: { $ne: false } })
        .select('name email phone department role').sort({ name: 1 }).lean(),
      Patient.find().populate({ path: 'userId', select: 'name email phone' }).sort({ updatedAt: -1 }).lean(),
      NurseAssignment.find({ status: 'active' }).select('nurseId patientId ward shift').lean(),
    ]);

    const vitalsByPatient = await latestVitalsForPatients(patients.map((patient) => patient._id));
    const assignmentByPatient = new Map<string, any[]>();
    assignments.forEach((assignment: any) => {
      const key = assignment.patientId.toString();
      assignmentByPatient.set(key, [...(assignmentByPatient.get(key) || []), assignment]);
    });

    res.status(200).json({
      success: true,
      nurses,
      patients: patients.map((patient: any) => ({
        ...patient,
        assignments: assignmentByPatient.get(patient._id.toString()) || [],
        latestVitals: vitalsByPatient.get(patient._id.toString()) || null,
      })),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Error retrieving head nurse roster', error: error.message });
  }
};