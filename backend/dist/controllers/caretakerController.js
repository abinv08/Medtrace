"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPatientCaretakers = exports.getAssignedPatients = exports.revokeCaretakerAssignment = exports.assignCaretaker = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const CaretakerAssignment_1 = require("../models/CaretakerAssignment");
const Patient_1 = require("../models/Patient");
const User_1 = require("../models/User");
// In-Memory Fallback Store if MongoDB is disconnected
const memoryAssignments = new Map();
// POST /api/caretaker/assign - Assign a caretaker to a patient
const assignCaretaker = async (req, res) => {
    try {
        let { caretakerId, patientId, relationship, permissions, status, caretakerEmail, email, caretakerName, name, caretakerPhone, phone, } = req.body;
        const normalizedEmail = (caretakerEmail || email || '').trim().toLowerCase();
        // If caretakerId is not provided or not an ObjectId, try finding or auto-provisioning a User by email
        if (!caretakerId && normalizedEmail) {
            try {
                let existingUser = await User_1.User.findOne({ email: normalizedEmail });
                if (!existingUser) {
                    existingUser = await User_1.User.create({
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
            }
            catch (userErr) {
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
        let assignment = null;
        try {
            // If patientId is a User ID instead of Patient._id, resolve Patient doc
            let resolvedPatientId = patientId;
            if (mongoose_1.default.isValidObjectId(patientId)) {
                const patientDoc = await Patient_1.Patient.findById(patientId);
                if (patientDoc) {
                    resolvedPatientId = patientDoc._id;
                }
                else {
                    let patientByUser = await Patient_1.Patient.findOne({ userId: patientId });
                    if (!patientByUser) {
                        patientByUser = await Patient_1.Patient.create({
                            userId: patientId,
                            assignedCaretakers: [],
                        });
                    }
                    resolvedPatientId = patientByUser._id;
                }
            }
            // Check if assignment already exists
            const existing = await CaretakerAssignment_1.CaretakerAssignment.findOne({
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
                    patientId: resolvedPatientId,
                    relationship: relationship ? relationship.trim() : '',
                    permissions: permissions || [],
                    status: assignmentStatus,
                });
            }
            // If active, sync patient's assignedCaretakers array
            if (assignment.status === 'active') {
                await Patient_1.Patient.findByIdAndUpdate(resolvedPatientId, {
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
        }
        catch (dbErr) {
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
// GET /api/caretaker/patient/:patientId - List caretakers assigned to this patient
const getPatientCaretakers = async (req, res) => {
    try {
        const { patientId } = req.params;
        const { status } = req.query;
        let resolvedPatientId = patientId;
        try {
            if (mongoose_1.default.isValidObjectId(patientId)) {
                const patientDoc = await Patient_1.Patient.findById(patientId);
                if (patientDoc) {
                    resolvedPatientId = patientDoc._id.toString();
                }
                else {
                    const patientByUser = await Patient_1.Patient.findOne({ userId: patientId });
                    if (patientByUser) {
                        resolvedPatientId = patientByUser._id.toString();
                    }
                }
            }
        }
        catch {
            // ignore
        }
        const filter = {
            $or: [
                { patientId: resolvedPatientId },
                { patientId: patientId },
            ],
        };
        if (status) {
            filter.status = status;
        }
        else {
            filter.status = { $ne: 'revoked' };
        }
        let assignments = [];
        try {
            assignments = await CaretakerAssignment_1.CaretakerAssignment.find(filter)
                .populate('caretakerId', 'name email phone hospitalName department role')
                .populate({
                path: 'patientId',
                populate: { path: 'userId', select: 'name email phone' },
            })
                .sort({ updatedAt: -1 });
        }
        catch {
            assignments = Array.from(memoryAssignments.values()).filter((item) => {
                const pId = item.patientId?.toString();
                const matches = pId === resolvedPatientId?.toString() || pId === patientId?.toString();
                if (!matches)
                    return false;
                if (status && item.status !== status)
                    return false;
                if (!status && item.status === 'revoked')
                    return false;
                return true;
            });
        }
        res.status(200).json({
            success: true,
            count: assignments.length,
            assignments,
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error retrieving patient caretakers',
            error: error.message,
        });
    }
};
exports.getPatientCaretakers = getPatientCaretakers;
