import { Response } from 'express';
import mongoose from 'mongoose';
import { NurseTask, NurseTaskStatus } from '../models/NurseTask';
import { AuthenticatedRequest } from '../middleware/authMiddleware';

const taskStatuses: NurseTaskStatus[] = [
  'pending_approval',
  'approved',
  'rejected',
  'completed',
];

const populateTask = (query: any) =>
  query
    .populate('patientId')
    .populate('assignedNurse', 'name email phone role')
    .populate('assignedBy', 'name email role')
    .populate('approvedBy', 'name email role');

export const createNurseTask = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { patientId, assignedNurse, taskDescription, dueAt } = req.body;
    const assignedBy = req.user?.id;

    if (!patientId || !assignedNurse || !taskDescription || !assignedBy) {
      res.status(400).json({
        success: false,
        message: 'patientId, assignedNurse, and taskDescription are required',
      });
      return;
    }

    if (
      !mongoose.isValidObjectId(patientId) ||
      !mongoose.isValidObjectId(assignedNurse) ||
      !mongoose.isValidObjectId(assignedBy)
    ) {
      res.status(400).json({ success: false, message: 'Invalid ID format' });
      return;
    }

    const task = await NurseTask.create({
      patientId,
      assignedNurse,
      assignedBy,
      taskDescription,
      dueAt,
      status: 'pending_approval',
    });

    await populateTask(task);

    res.status(201).json({
      success: true,
      message: 'Nurse task created successfully',
      task,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Error creating nurse task',
      error: error.message,
    });
  }
};

export const listNurseTasks = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { status, assignedNurse, assignedBy } = req.query;
    const filter: Record<string, unknown> = {};

    if (status !== undefined) {
      if (typeof status !== 'string' || !taskStatuses.includes(status as NurseTaskStatus)) {
        res.status(400).json({ success: false, message: 'Invalid task status' });
        return;
      }
      filter.status = status;
    }

    for (const [field, value] of [
      ['assignedNurse', assignedNurse],
      ['assignedBy', assignedBy],
    ] as const) {
      if (value !== undefined) {
        if (typeof value !== 'string' || !mongoose.isValidObjectId(value)) {
          res.status(400).json({ success: false, message: `Invalid ${field} format` });
          return;
        }
        filter[field] = value;
      }
    }

    const tasks = await populateTask(NurseTask.find(filter).sort({ createdAt: -1 }));

    res.status(200).json({
      success: true,
      count: tasks.length,
      tasks,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving nurse tasks',
      error: error.message,
    });
  }
};

export const approveNurseTask = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const approvedBy = req.user?.id;

    if (!mongoose.isValidObjectId(id) || !approvedBy || !mongoose.isValidObjectId(approvedBy)) {
      res.status(400).json({ success: false, message: 'Invalid task or user ID format' });
      return;
    }

    const task = await NurseTask.findOne({ _id: id, status: 'pending_approval' });
    if (!task) {
      res.status(404).json({
        success: false,
        message: 'Pending nurse task not found',
      });
      return;
    }

    task.status = 'approved';
    task.approvedBy = new mongoose.Types.ObjectId(approvedBy);
    await task.save();
    await populateTask(task);

    res.status(200).json({ success: true, message: 'Nurse task approved successfully', task });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Error approving nurse task',
      error: error.message,
    });
  }
};

export const rejectNurseTask = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const approvalNotes = typeof req.body.approvalNotes === 'string'
      ? req.body.approvalNotes.trim()
      : '';

    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({ success: false, message: 'Invalid task ID format' });
      return;
    }

    if (!approvalNotes) {
      res.status(400).json({
        success: false,
        message: 'approvalNotes are required when rejecting a task',
      });
      return;
    }

    const task = await NurseTask.findOne({ _id: id, status: 'pending_approval' });
    if (!task) {
      res.status(404).json({
        success: false,
        message: 'Pending nurse task not found',
      });
      return;
    }

    task.status = 'rejected';
    task.approvalNotes = approvalNotes;
    await task.save();
    await populateTask(task);

    res.status(200).json({ success: true, message: 'Nurse task rejected successfully', task });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Error rejecting nurse task',
      error: error.message,
    });
  }
};

export const completeNurseTask = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const nurseId = req.user?.id;

    if (!mongoose.isValidObjectId(id) || !nurseId || !mongoose.isValidObjectId(nurseId)) {
      res.status(400).json({ success: false, message: 'Invalid task or user ID format' });
      return;
    }

    const task = await NurseTask.findOne({
      _id: id,
      assignedNurse: nurseId,
      status: 'approved',
    });

    if (!task) {
      res.status(404).json({
        success: false,
        message: 'Approved task assigned to the current nurse not found',
      });
      return;
    }

    task.status = 'completed';
    await task.save();
    await populateTask(task);

    res.status(200).json({ success: true, message: 'Nurse task completed successfully', task });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Error completing nurse task',
      error: error.message,
    });
  }
};