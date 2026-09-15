"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updatePatient = exports.createPatient = exports.getPatients = exports.getPatientById = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const Patient_1 = require("../models/Patient");
// In-Memory Fallback Store if MongoDB is disconnected
const memoryPatients = new Map();
// GET /api/patients/:id - Get one patient by ID or userId
const getPatientById = async (req, res) => {
    try {
        const { id } = req.params;
        let patient = null;
        try {
            if (mongoose_1.default.isValidObjectId(id)) {
                patient = await Patient_1.Patient.findById(id)
                    .populate('userId', 'name email phone hospitalName department role')
                    .populate('assignedDoctor', 'name email phone hospitalName department')
                    .populate('assignedCaretakers', 'name email phone hospitalName department');
            }
            if (!patient && mongoose_1.default.isValidObjectId(id)) {
                patient = await Patient_1.Patient.findOne({ userId: id })
                    .populate('userId', 'name email phone hospitalName department role')
                    .populate('assignedDoctor', 'name email phone hospitalName department')
                    .populate('assignedCaretakers', 'name email phone hospitalName department');
            }
        }
        catch {
            patient = memoryPatients.get(id) || null;
            if (!patient) {
                for (const p of memoryPatients.values()) {
                    if (p.userId === id || (p.userId?._id && p.userId._id.toString() === id)) {
                        patient = p;
                        break;
                    }
                }
            }
        }
        if (!patient) {
            res.status(404).json({ success: false, message: 'Patient profile not found' });
            return;
        }
        res.status(200).json({ success: true, patient });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error retrieving patient profile',
            error: error.message,
        });
    }
};
exports.getPatientById = getPatientById;
// GET /api/patients - List patients, filterable by doctorId or caretakerId
const getPatients = async (req, res) => {
    try {
        const { doctorId, caretakerId } = req.query;
        const filter = {};
        if (doctorId) {
            filter.assignedDoctor = doctorId;
        }
        if (caretakerId) {
            filter.assignedCaretakers = caretakerId;
        }
        let patients = [];
        try {
            patients = await Patient_1.Patient.find(filter)
                .populate('userId', 'name email phone hospitalName department role')
                .populate('assignedDoctor', 'name email phone hospitalName department')
                .populate('assignedCaretakers', 'name email phone hospitalName department')
                .sort({ createdAt: -1 });
        }
        catch {
            patients = Array.from(memoryPatients.values()).filter((p) => {
                let match = true;
                if (doctorId && p.assignedDoctor?.toString() !== doctorId.toString()) {
                    match = false;
                }
                if (caretakerId &&
                    !p.assignedCaretakers?.some((c) => (c._id?.toString() || c.toString()) === caretakerId.toString())) {
                    match = false;
                }
                return match;
            });
        }
        res.status(200).json({ success: true, count: patients.length, patients });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error retrieving patients list',
            error: error.message,
        });
    }
};
exports.getPatients = getPatients;
// POST /api/patients - Create patient profile
const createPatient = async (req, res) => {
    try {
        const { userId, dateOfBirth, gender, bloodGroup, assignedDoctor, assignedCaretakers, medicalHistory, } = req.body;
        if (!userId) {
            res.status(400).json({ success: false, message: 'userId is required' });
            return;
        }
        // Check if patient profile already exists for this user
        let existingPatient = null;
        try {
            existingPatient = await Patient_1.Patient.findOne({ userId });
        }
        catch {
            for (const p of memoryPatients.values()) {
                if (p.userId === userId || (p.userId?._id && p.userId._id.toString() === userId)) {
                    existingPatient = p;
                    break;
                }
            }
        }
        if (existingPatient) {
            res.status(400).json({
                success: false,
                message: 'A patient profile already exists for this user',
            });
            return;
        }
        let newPatient = null;
        try {
            newPatient = await Patient_1.Patient.create({
                userId,
                dateOfBirth,
                gender,
                bloodGroup,
                assignedDoctor,
                assignedCaretakers: assignedCaretakers || [],
                medicalHistory: medicalHistory || [],
            });
            await newPatient.populate([
                { path: 'userId', select: 'name email phone hospitalName department role' },
                { path: 'assignedDoctor', select: 'name email phone hospitalName department' },
                { path: 'assignedCaretakers', select: 'name email phone hospitalName department' },
            ]);
        }
        catch (dbErr) {
            const id = 'patient_' + Date.now();
            newPatient = {
                _id: id,
                id,
                userId,
                dateOfBirth,
                gender,
                bloodGroup,
                assignedDoctor,
                assignedCaretakers: assignedCaretakers || [],
                medicalHistory: medicalHistory || [],
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            memoryPatients.set(id, newPatient);
        }
        res.status(201).json({
            success: true,
            message: 'Patient profile created successfully',
            patient: newPatient,
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error creating patient profile',
            error: error.message,
        });
    }
};
exports.createPatient = createPatient;
// PUT /api/patients/:id - Update patient profile
const updatePatient = async (req, res) => {
    try {
        const { id } = req.params;
        const { dateOfBirth, gender, bloodGroup, assignedDoctor, assignedCaretakers, medicalHistory, } = req.body;
        let patient = null;
        try {
            if (mongoose_1.default.isValidObjectId(id)) {
                patient = await Patient_1.Patient.findById(id);
            }
            if (!patient && mongoose_1.default.isValidObjectId(id)) {
                patient = await Patient_1.Patient.findOne({ userId: id });
            }
            if (!patient) {
                res.status(404).json({ success: false, message: 'Patient profile not found' });
                return;
            }
            if (dateOfBirth !== undefined)
                patient.dateOfBirth = dateOfBirth;
            if (gender !== undefined)
                patient.gender = gender;
            if (bloodGroup !== undefined)
                patient.bloodGroup = bloodGroup;
            if (assignedDoctor !== undefined)
                patient.assignedDoctor = assignedDoctor;
            if (assignedCaretakers !== undefined)
                patient.assignedCaretakers = assignedCaretakers;
            if (medicalHistory !== undefined)
                patient.medicalHistory = medicalHistory;
            await patient.save();
            await patient.populate([
                { path: 'userId', select: 'name email phone hospitalName department role' },
                { path: 'assignedDoctor', select: 'name email phone hospitalName department' },
                { path: 'assignedCaretakers', select: 'name email phone hospitalName department' },
            ]);
        }
        catch (dbErr) {
            patient = memoryPatients.get(id);
            if (!patient) {
                for (const p of memoryPatients.values()) {
                    if (p.userId === id || (p.userId?._id && p.userId._id.toString() === id)) {
                        patient = p;
                        break;
                    }
                }
            }
            if (!patient) {
                res.status(404).json({ success: false, message: 'Patient profile not found' });
                return;
            }
            if (dateOfBirth !== undefined)
                patient.dateOfBirth = dateOfBirth;
            if (gender !== undefined)
                patient.gender = gender;
            if (bloodGroup !== undefined)
                patient.bloodGroup = bloodGroup;
            if (assignedDoctor !== undefined)
                patient.assignedDoctor = assignedDoctor;
            if (assignedCaretakers !== undefined)
                patient.assignedCaretakers = assignedCaretakers;
            if (medicalHistory !== undefined)
                patient.medicalHistory = medicalHistory;
            patient.updatedAt = new Date();
            memoryPatients.set(patient._id?.toString() || id, patient);
        }
        res.status(200).json({
            success: true,
            message: 'Patient profile updated successfully',
            patient,
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error updating patient profile',
            error: error.message,
        });
    }
};
exports.updatePatient = updatePatient;
