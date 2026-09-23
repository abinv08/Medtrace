"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getClinicalNotesByPatientId = exports.createClinicalNote = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const ClinicalNote_1 = require("../models/ClinicalNote");
const createClinicalNote = async (req, res) => {
    try {
        const { patientId, doctorId, appointmentId, content } = req.body;
        const resolvedDoctorId = doctorId || req.user?.id;
        if (!patientId || !resolvedDoctorId || !content?.trim()) {
            res.status(400).json({ success: false, message: 'patientId, doctorId, and content are required' });
            return;
        }
        if (!mongoose_1.default.isValidObjectId(patientId) || !mongoose_1.default.isValidObjectId(resolvedDoctorId)) {
            res.status(400).json({ success: false, message: 'patientId and doctorId must be MongoDB ObjectIds' });
            return;
        }
        const note = await ClinicalNote_1.ClinicalNote.create({
            patientId,
            doctorId: resolvedDoctorId,
            appointmentId: appointmentId || undefined,
            content: content.trim(),
        });
        res.status(201).json({ success: true, clinicalNote: note });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Error creating clinical note', error: error.message });
    }
};
exports.createClinicalNote = createClinicalNote;
const getClinicalNotesByPatientId = async (req, res) => {
    try {
        const { patientId } = req.params;
        if (!mongoose_1.default.isValidObjectId(patientId)) {
            res.status(400).json({ success: false, message: 'patientId must be a MongoDB ObjectId' });
            return;
        }
        const notes = await ClinicalNote_1.ClinicalNote.find({ patientId })
            .populate('doctorId', 'name email')
            .sort({ createdAt: -1 });
        res.status(200).json({ success: true, count: notes.length, clinicalNotes: notes });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Error retrieving clinical notes', error: error.message });
    }
};
exports.getClinicalNotesByPatientId = getClinicalNotesByPatientId;
