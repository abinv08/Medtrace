import { Response } from 'express';
import mongoose from 'mongoose';
import { CaretakerAssignment, ICaretakerAssignment } from '../models/CaretakerAssignment';
import { Patient } from '../models/Patient';
import { User } from '../models/User';
import { AuthenticatedRequest } from '../middleware/authMiddleware';

// In-Memory Fallback Store if MongoDB is disconnected
const memoryAssignments = new Map<string, any>();

// POST /api/caretaker/assign - Assign a caretaker to a patient
export const assignCaretaker = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    let {
      caretakerId,
      patientId,
      relationship,
      permissions,
      status,
      caretakerEmail,
      email,
      caretakerName,
      name,
      caretakerPhone,
      phone,
    } = req.body;

    const normalizedEmail = (caretakerEmail || email || '').trim().toLowerCase();

    // If caretakerId is not provided or not an ObjectId, try finding or auto-provisioning a User by email
    if (!caretakerId && normalizedEmail) {
      try {
        let existingUser = await User.findOne({ email: normalizedEmail });
        if (!existingUser) {
          existingUser = await User.create({
            name: caretakerName || name || 'Caretaker',
            email: normalizedEmail,
            phone: caretakerPhone || phone || 'N/A',
            hospitalName: 'MedTrace Network',
            department: 'Caregiving',
            role: 'Caregiver',
            isActive: true,
          });
        }
        caretakerId = existingUser._id;
      } catch (userErr) {
        caretakerId = 'caretaker_' + normalizedEmail.replace(/[^a-zA-Z0-9]/g, '_');
      }
    }

    if (!caretakerId || !patientId) {
      res.status(400).json({
        success: false,
        message: 'caretakerId (or caretakerEmail) and patientId are required',
      });
      return;
    }

    const assignmentStatus = status || 'active';

    let assignment: any = null;
    try {
      // If patientId is a User ID instead of Patient._id, resolve Patient doc
      let resolvedPatientId = patientId;
      if (mongoose.isValidObjectId(patientId)) {
        const patientDoc = await Patient.findById(patientId);
        if (patientDoc) {
          resolvedPatientId = patientDoc._id;
        } else {
          let patientByUser = await Patient.findOne({ userId: patientId });
          if (!patientByUser) {
            patientByUser = await Patient.create({
              userId: patientId,
              assignedCaretakers: [],
            });
          }
          resolvedPatientId = patientByUser._id;
        }
      }

      // Check if assignment already exists
      const existing = await CaretakerAssignment.findOne({
        caretakerId,
        patientId: resolvedPatientId,
      });

      if (existing) {
        if (existing.status === 'active') {
          res.status(400).json({
            success: false,
            message: 'Caretaker is already actively assigned to this patient',
            assignment: existing,
          });
          return;
        }

        // Reactivate previously revoked or pending assignment
        existing.status = assignmentStatus;
        if (relationship) existing.relationship = relationship;
        if (permissions) existing.permissions = permissions;
        await existing.save();
        assignment = existing;
      } else {
        assignment = await CaretakerAssignment.create({
          caretakerId,
          patientId: resolvedPatientId,
          relationship: relationship ? relationship.trim() : '',
          permissions: permissions || [],
          status: assignmentStatus,
        });
      }

      // If active, sync patient's assignedCaretakers array
      if (assignment.status === 'active') {
        await Patient.findByIdAndUpdate(resolvedPatientId, {
          $addToSet: { assignedCaretakers: caretakerId },
        });
      }

      await assignment.populate([
        { path: 'caretakerId', select: 'name email phone hospitalName department role' },
        {
          path: 'patientId',
          populate: { path: 'userId', select: 'name email phone' },
        },
      ]);
    } catch (dbErr) {
      const id = 'assign_' + Date.now();
      assignment = {
        _id: id,
        id,
        caretakerId: typeof caretakerId === 'object' ? caretakerId : {
          _id: caretakerId,
          name: caretakerName || name || 'Assigned Caretaker',
          email: normalizedEmail || 'caretaker@medtrace.org',
          phone: caretakerPhone || phone || '',
          role: 'Caregiver',
        },
        patientId,
        relationship: relationship || '',
        permissions: permissions || [],
        status: assignmentStatus,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      memoryAssignments.set(id, assignment);
    }

    res.status(201).json({
      success: true,
      message: 'Caretaker assigned successfully',
      assignment,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Error assigning caretaker',
      error: error.message,
    });
  }
};

// PUT /api/caretaker/:id/revoke - Revoke caretaker access
export const revokeCaretakerAssignment = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    let assignment: any = null;
    try {
      if (mongoose.isValidObjectId(id)) {
        assignment = await CaretakerAssignment.findById(id);
      }

      if (!assignment) {
        res.status(404).json({
          success: false,
          message: 'Caretaker assignment not found',
        });
        return;
      }

      assignment.status = 'revoked';
      await assignment.save();

      // Remove from patient's assignedCaretakers array
      if (assignment.patientId && assignment.caretakerId) {
        await Patient.findByIdAndUpdate(assignment.patientId, {
          $pull: { assignedCaretakers: assignment.caretakerId },
        });
      }

      await assignment.populate([
        { path: 'caretakerId', select: 'name email phone' },
        {
          path: 'patientId',
          populate: { path: 'userId', select: 'name email phone' },
        },
      ]);
    } catch (dbErr) {
      assignment = memoryAssignments.get(id);
      if (!assignment) {
        res.status(404).json({
          success: false,
          message: 'Caretaker assignment not found',
        });
        return;
      }

      assignment.status = 'revoked';
      assignment.updatedAt = new Date();
      memoryAssignments.set(id, assignment);
    }

    res.status(200).json({
      success: true,
      message: 'Caretaker assignment revoked successfully',
      assignment,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Error revoking caretaker assignment',
      error: error.message,
    });
  }
};

// GET /api/caretaker/:caretakerId/patients - List patients assigned to this caretaker
export const getAssignedPatients = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { caretakerId } = req.params;
    const { status } = req.query;

    const filter: any = { caretakerId };
    if (status) {
      filter.status = status;
    } else {
      // Default to active assignments unless explicitly requested
      filter.status = 'active';
    }

    let assignments: any[] = [];
    try {
      assignments = await CaretakerAssignment.find(filter)
        .populate({
          path: 'patientId',
          populate: { path: 'userId', select: 'name email phone hospitalName department' },
        })
        .populate('caretakerId', 'name email phone')
        .sort({ updatedAt: -1 });
    } catch {
      assignments = Array.from(memoryAssignments.values()).filter((item) => {
        if (item.caretakerId?.toString() !== caretakerId.toString()) return false;
        if (status && item.status !== status) return false;
        if (!status && item.status !== 'active') return false;
        return true;
      });
    }

    const patients = assignments.map((a) => a.patientId).filter(Boolean);

    res.status(200).json({
      success: true,
      count: assignments.length,
      assignments,
      patients,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving assigned patients',
      error: error.message,
    });
  }
};

// GET /api/caretaker/patient/:patientId - List caretakers assigned to this patient
export const getPatientCaretakers = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { patientId } = req.params;
    const { status } = req.query;

    let resolvedPatientId = patientId;
    try {
      if (mongoose.isValidObjectId(patientId)) {
        const patientDoc = await Patient.findById(patientId);
        if (patientDoc) {
          resolvedPatientId = patientDoc._id.toString();
        } else {
          const patientByUser = await Patient.findOne({ userId: patientId });
          if (patientByUser) {
            resolvedPatientId = patientByUser._id.toString();
          }
        }
      }
    } catch {
      // ignore
    }

    const filter: any = {
      $or: [
        { patientId: resolvedPatientId },
        { patientId: patientId },
      ],
    };

    if (status) {
      filter.status = status;
    } else {
      filter.status = { $ne: 'revoked' };
    }

    let assignments: any[] = [];
    try {
      assignments = await CaretakerAssignment.find(filter)
        .populate('caretakerId', 'name email phone hospitalName department role')
        .populate({
          path: 'patientId',
          populate: { path: 'userId', select: 'name email phone' },
        })
        .sort({ updatedAt: -1 });
    } catch {
      assignments = Array.from(memoryAssignments.values()).filter((item) => {
        const pId = item.patientId?.toString();
        const matches = pId === resolvedPatientId?.toString() || pId === patientId?.toString();
        if (!matches) return false;
        if (status && item.status !== status) return false;
        if (!status && item.status === 'revoked') return false;
        return true;
      });
    }

    res.status(200).json({
      success: true,
      count: assignments.length,
      assignments,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving patient caretakers',
      error: error.message,
    });
  }
};

