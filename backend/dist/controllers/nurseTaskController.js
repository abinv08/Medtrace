"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.completeNurseTask = exports.rejectNurseTask = exports.approveNurseTask = exports.listNurseTasks = exports.createNurseTask = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const NurseTask_1 = require("../models/NurseTask");
const taskStatuses = [
    'pending_approval',
    'approved',
    'rejected',
    'completed',
];
const populateTask = (query) => query
    .populate('patientId')
    .populate('assignedNurse', 'name email phone role')
    .populate('assignedBy', 'name email role')
    .populate('approvedBy', 'name email role');
const createNurseTask = async (req, res) => {
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
        if (!mongoose_1.default.isValidObjectId(patientId) ||
            !mongoose_1.default.isValidObjectId(assignedNurse) ||
            !mongoose_1.default.isValidObjectId(assignedBy)) {
            res.status(400).json({ success: false, message: 'Invalid ID format' });
            return;
        }
        const task = await NurseTask_1.NurseTask.create({
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
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error creating nurse task',
            error: error.message,
        });
    }
};
exports.createNurseTask = createNurseTask;
const listNurseTasks = async (req, res) => {
    try {
        const { status, assignedNurse, assignedBy } = req.query;
        const filter = {};
        if (status !== undefined) {
            if (typeof status !== 'string' || !taskStatuses.includes(status)) {
                res.status(400).json({ success: false, message: 'Invalid task status' });
                return;
            }
            filter.status = status;
        }
        for (const [field, value] of [
            ['assignedNurse', assignedNurse],
            ['assignedBy', assignedBy],
        ]) {
            if (value !== undefined) {
                if (typeof value !== 'string' || !mongoose_1.default.isValidObjectId(value)) {
                    res.status(400).json({ success: false, message: `Invalid ${field} format` });
                    return;
                }
                filter[field] = value;
            }
        }
        const tasks = await populateTask(NurseTask_1.NurseTask.find(filter).sort({ createdAt: -1 }));
        res.status(200).json({
            success: true,
            count: tasks.length,
            tasks,
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error retrieving nurse tasks',
            error: error.message,
        });
    }
};
exports.listNurseTasks = listNurseTasks;
const approveNurseTask = async (req, res) => {
    try {
        const { id } = req.params;
        const approvedBy = req.user?.id;
        if (!mongoose_1.default.isValidObjectId(id) || !approvedBy || !mongoose_1.default.isValidObjectId(approvedBy)) {
            res.status(400).json({ success: false, message: 'Invalid task or user ID format' });
            return;
        }
        const task = await NurseTask_1.NurseTask.findOne({ _id: id, status: 'pending_approval' });
        if (!task) {
            res.status(404).json({
                success: false,
                message: 'Pending nurse task not found',
            });
            return;
        }
        task.status = 'approved';
        task.approvedBy = new mongoose_1.default.Types.ObjectId(approvedBy);
        await task.save();
        await populateTask(task);
        res.status(200).json({ success: true, message: 'Nurse task approved successfully', task });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error approving nurse task',
            error: error.message,
        });
    }
};
exports.approveNurseTask = approveNurseTask;
const rejectNurseTask = async (req, res) => {
    try {
        const { id } = req.params;
        const approvalNotes = typeof req.body.approvalNotes === 'string'
            ? req.body.approvalNotes.trim()
            : '';
        if (!mongoose_1.default.isValidObjectId(id)) {
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
        const task = await NurseTask_1.NurseTask.findOne({ _id: id, status: 'pending_approval' });
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
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error rejecting nurse task',
            error: error.message,
        });
    }
};
exports.rejectNurseTask = rejectNurseTask;
const completeNurseTask = async (req, res) => {
    try {
        const { id } = req.params;
        const nurseId = req.user?.id;
        if (!mongoose_1.default.isValidObjectId(id) || !nurseId || !mongoose_1.default.isValidObjectId(nurseId)) {
            res.status(400).json({ success: false, message: 'Invalid task or user ID format' });
            return;
        }
        const task = await NurseTask_1.NurseTask.findOne({
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
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error completing nurse task',
            error: error.message,
        });
    }
};
exports.completeNurseTask = completeNurseTask;
