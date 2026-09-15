"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAssignedPatients = exports.revokeCaretakerAssignment = exports.assignCaretaker = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const CaretakerAssignment_1 = require("../models/CaretakerAssignment");
const Patient_1 = require("../models/Patient");
// In-Memory Fallback Store if MongoDB is disconnected
const memoryAssignments = new Map();
// POST /api/caretaker/assign - Assign a caretaker to a patient
const assignCaretaker = async (req, res) => {
    try {
        const { caretakerId, patientId, relationship, permissions, status } = req.body;
        if (!caretakerId || !patientId) {
            res.status(400).json({
                success: false,
                message: 'caretakerId and patientId are required',
            });
            return;
        }
        const assignmentStatus = status || 'active';
        let assignment = null;
        try {
            // Check if assignment already exists
            const existing = await CaretakerAssignment_1.CaretakerAssignment.findOne({ caretakerId, patientId });
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
                if (relationship)
                    existing.relationship = relationship;
                if (permissions)
                    existing.permissions = permissions;
                await existing.save();
                assignment = existing;
            }
            else {
                assignment = await CaretakerAssignment_1.CaretakerAssignment.create({
                    caretakerId,
                    patientId,
                    relationship: relationship ? relationship.trim() : '',
                    permissions: permissions || [],
                    status: assignmentStatus,
                });
            }
            // If active, sync patient's assignedCaretakers array
            if (assignment.status === 'active') {
                await Patient_1.Patient.findByIdAndUpdate(patientId, {
                    $addToSet: { assignedCaretakers: caretakerId },
                });
            }
            await assignment.populate([
                { path: 'caretakerId', select: 'name email phone hospitalName department' },
                {
                    path: 'patientId',
                    populate: { path: 'userId', select: 'name email phone' },
                },
            ]);
        }
        catch (dbErr) {
            const id = 'assign_' + Date.now();
            assignment = {
                _id: id,
                id,
                caretakerId,
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
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error assigning caretaker',
            error: error.message,
        });
    }
};
exports.assignCaretaker = assignCaretaker;
// PUT /api/caretaker/:id/revoke - Revoke caretaker access
const revokeCaretakerAssignment = async (req, res) => {
    try {
        const { id } = req.params;
        let assignment = null;
        try {
            if (mongoose_1.default.isValidObjectId(id)) {
                assignment = await CaretakerAssignment_1.CaretakerAssignment.findById(id);
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
                await Patient_1.Patient.findByIdAndUpdate(assignment.patientId, {
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
        }
        catch (dbErr) {
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
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error revoking caretaker assignment',
            error: error.message,
        });
    }
};
exports.revokeCaretakerAssignment = revokeCaretakerAssignment;
// GET /api/caretaker/:caretakerId/patients - List patients assigned to this caretaker
const getAssignedPatients = async (req, res) => {
    try {
        const { caretakerId } = req.params;
        const { status } = req.query;
        const filter = { caretakerId };
        if (status) {
            filter.status = status;
        }
        else {
            // Default to active assignments unless explicitly requested
            filter.status = 'active';
        }
        let assignments = [];
        try {
            assignments = await CaretakerAssignment_1.CaretakerAssignment.find(filter)
                .populate({
                path: 'patientId',
                populate: { path: 'userId', select: 'name email phone hospitalName department' },
            })
                .populate('caretakerId', 'name email phone')
                .sort({ updatedAt: -1 });
        }
        catch {
            assignments = Array.from(memoryAssignments.values()).filter((item) => {
                if (item.caretakerId?.toString() !== caretakerId.toString())
                    return false;
                if (status && item.status !== status)
                    return false;
                if (!status && item.status !== 'active')
                    return false;
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
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error retrieving assigned patients',
            error: error.message,
        });
    }
};
exports.getAssignedPatients = getAssignedPatients;
