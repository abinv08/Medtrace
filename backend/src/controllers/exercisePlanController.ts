import { Response } from 'express';
import mongoose from 'mongoose';
import { ExercisePlan, IExercisePlan } from '../models/ExercisePlan';
import { AuthenticatedRequest } from '../middleware/authMiddleware';

// In-Memory Fallback Store if MongoDB is disconnected
const memoryExercisePlans = new Map<string, any>();

// POST /api/exercise-plans - Create/assign an exercise plan
export const createExercisePlan = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { patientId, exercises, frequency, assignedBy } = req.body;

    if (!patientId) {
      res.status(400).json({
        success: false,
        message: 'patientId is required',
      });
      return;
    }

    const doctorOrAssignerId = assignedBy || req.user?.id;

    const planData = {
      patientId,
      exercises: exercises || [],
      frequency: frequency ? frequency.trim() : '',
      assignedBy:
        doctorOrAssignerId && mongoose.isValidObjectId(doctorOrAssignerId)
          ? doctorOrAssignerId
          : undefined,
      progressLog: [],
    };

    let newPlan: any = null;
    try {
      newPlan = await ExercisePlan.create(planData);
      await newPlan.populate('assignedBy', 'name email hospitalName department');
    } catch (dbErr) {
      const id = 'plan_' + Date.now();
      newPlan = {
        _id: id,
        id,
        ...planData,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      memoryExercisePlans.set(id, newPlan);
    }

    res.status(201).json({
      success: true,
      message: 'Exercise plan created successfully',
      exercisePlan: newPlan,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Error creating exercise plan',
      error: error.message,
    });
  }
};

// GET /api/exercise-plans/:patientId - Get exercise plan for a patient
export const getExercisePlanByPatientId = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { patientId } = req.params;

    let plan: any = null;
    try {
      plan = await ExercisePlan.findOne({ patientId })
        .sort({ createdAt: -1 })
        .populate('assignedBy', 'name email hospitalName department');
    } catch {
      const patientPlans = Array.from(memoryExercisePlans.values())
        .filter((p) => p.patientId?.toString() === patientId.toString())
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      plan = patientPlans[0] || null;
    }

    if (!plan) {
      res.status(404).json({
        success: false,
        message: 'No exercise plan found for this patient',
      });
      return;
    }

    res.status(200).json({
      success: true,
      exercisePlan: plan,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving exercise plan',
      error: error.message,
    });
  }
};

// PUT /api/exercise-plans/:id/progress - Log a completed exercise session
export const logExerciseProgress = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const { date, completed, notes } = req.body;

    const progressEntry = {
      date: date ? new Date(date) : new Date(),
      completed: completed !== undefined ? Boolean(completed) : true,
      notes: notes ? notes.trim() : '',
    };

    let plan: any = null;
    try {
      if (mongoose.isValidObjectId(id)) {
        plan = await ExercisePlan.findById(id);
      }
      if (!plan && mongoose.isValidObjectId(id)) {
        // In case id passed is patientId
        plan = await ExercisePlan.findOne({ patientId: id }).sort({ createdAt: -1 });
      }

      if (!plan) {
        res.status(404).json({
          success: false,
          message: 'Exercise plan not found',
        });
        return;
      }

      plan.progressLog.push(progressEntry);
      await plan.save();
      await plan.populate('assignedBy', 'name email hospitalName department');
    } catch (dbErr) {
      plan = memoryExercisePlans.get(id);
      if (!plan) {
        for (const p of memoryExercisePlans.values()) {
          if (p.patientId?.toString() === id.toString()) {
            plan = p;
            break;
          }
        }
      }

      if (!plan) {
        res.status(404).json({
          success: false,
          message: 'Exercise plan not found',
        });
        return;
      }

      if (!plan.progressLog) {
        plan.progressLog = [];
      }
      plan.progressLog.push(progressEntry);
      plan.updatedAt = new Date();
      memoryExercisePlans.set(plan._id?.toString() || id, plan);
    }

    res.status(200).json({
      success: true,
      message: 'Exercise progress logged successfully',
      exercisePlan: plan,
      progressEntry,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Error logging exercise progress',
      error: error.message,
    });
  }
};
