"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getHeadNurseRoster = exports.getAssignedPatients = exports.revokeNurseAssignment = exports.assignNurse = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const NurseAssignment_1 = require("../models/NurseAssignment");
const Patient_1 = require("../models/Patient");
const User_1 = require("../models/User");
const Vitals_1 = require("../models/Vitals");
const latestVitalsForPatients = async (patientIds) => {
    const readings = await Promise.all(patientIds.map((patientId) => Vitals_1.Vitals.findOne({ patientId }).sort({ recordedAt: -1 }).lean()));
    return new Map(readings.filter(Boolean).map((reading) => [reading.patientId.toString(), reading]));
};
const assignNurse = async (req, res) => {
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
        if (!mongoose_1.default.isValidObjectId(nurseId) ||
            !mongoose_1.default.isValidObjectId(patientId) ||
            !mongoose_1.default.isValidObjectId(assignedBy)) {
            res.status(400).json({ success: false, message: 'Invalid ID format' });
            return;
        }
        const [nurse, patient] = await Promise.all([
            User_1.User.findOne({ _id: nurseId, role: { $in: ['Nurse', 'Head Nurse'] } }),
            Patient_1.Patient.findById(patientId),
        ]);
        if (!nurse) {
            res.status(404).json({ success: false, message: 'Nurse not found' });
            return;
        }
        if (!patient) {
            res.status(404).json({ success: false, message: 'Patient not found' });
            return;
        }
        const assignment = await NurseAssignment_1.NurseAssignment.create({
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
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error assigning nurse',
            error: error.message,
        });
    }
};
exports.assignNurse = assignNurse;
const revokeNurseAssignment = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose_1.default.isValidObjectId(id)) {
            res.status(400).json({ success: false, message: 'Invalid assignment ID format' });
            return;
        }
        const assignment = await NurseAssignment_1.NurseAssignment.findById(id);
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
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error revoking nurse assignment',
            error: error.message,
        });
    }
};
exports.revokeNurseAssignment = revokeNurseAssignment;
const getAssignedPatients = async (req, res) => {
    try {
        const { nurseId } = req.params;
        if (!mongoose_1.default.isValidObjectId(nurseId)) {
            res.status(400).json({ success: false, message: 'Invalid nurse ID format' });
            return;
        }
        const assignments = await NurseAssignment_1.NurseAssignment.find({ nurseId, status: 'active' })
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
const getHeadNurseRoster = async (req, res) => {
    try {
        const [nurses, patients, assignments] = await Promise.all([
            User_1.User.find({ role: { $in: ['Nurse', 'Head Nurse'] }, isActive: { $ne: false } })
                .select('name email phone department role').sort({ name: 1 }).lean(),
            Patient_1.Patient.find().populate({ path: 'userId', select: 'name email phone' }).sort({ updatedAt: -1 }).lean(),
            NurseAssignment_1.NurseAssignment.find({ status: 'active' }).select('nurseId patientId ward shift').lean(),
        ]);
        const vitalsByPatient = await latestVitalsForPatients(patients.map((patient) => patient._id));
        const assignmentByPatient = new Map();
        assignments.forEach((assignment) => {
            const key = assignment.patientId.toString();
            assignmentByPatient.set(key, [...(assignmentByPatient.get(key) || []), assignment]);
        });
        res.status(200).json({
            success: true,
            nurses,
            patients: patients.map((patient) => ({
                ...patient,
                assignments: assignmentByPatient.get(patient._id.toString()) || [],
                latestVitals: vitalsByPatient.get(patient._id.toString()) || null,
            })),
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Error retrieving head nurse roster', error: error.message });
    }
};
exports.getHeadNurseRoster = getHeadNurseRoster;
