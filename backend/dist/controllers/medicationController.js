"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logMedicationTaken = exports.deleteMedication = exports.updateMedication = exports.createMedication = exports.getMedicationsByPatientId = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const Medication_1 = require("../models/Medication");
// In-Memory Fallback Store if MongoDB is disconnected
const memoryMedications = new Map();
// GET /api/medications/:patientId - List medications for a patient
const getMedicationsByPatientId = async (req, res) => {
    try {
        const { patientId } = req.params;
        const { status } = req.query;
        const filter = { patientId };
        if (status) {
            filter.status = status;
        }
        let medications = [];
        try {
            medications = await Medication_1.Medication.find(filter)
                .populate('prescribedBy', 'name email hospitalName department')
                .sort({ createdAt: -1 });
        }
        catch {
            medications = Array.from(memoryMedications.values())
                .filter((med) => {
                if (med.patientId?.toString() !== patientId.toString())
                    return false;
                if (status && med.status !== status)
                    return false;
                return true;
            })
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        }
        res.status(200).json({
            success: true,
            count: medications.length,
            medications,
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error retrieving medications',
            error: error.message,
        });
    }
};
exports.getMedicationsByPatientId = getMedicationsByPatientId;
// POST /api/medications - Create medication
const createMedication = async (req, res) => {
    try {
        const { patientId, name, dosage, frequency, startDate, endDate, prescribedBy, status, takenLog, } = req.body;
        if (!patientId || !name) {
            res.status(400).json({
                success: false,
                message: 'patientId and name are required fields',
            });
            return;
        }
        const doctorId = prescribedBy || req.user?.id;
        const medicationData = {
            patientId,
            name: name.trim(),
            dosage: dosage ? dosage.trim() : '',
            frequency: frequency ? frequency.trim() : '',
            startDate: startDate ? new Date(startDate) : new Date(),
            endDate: endDate ? new Date(endDate) : undefined,
            prescribedBy: doctorId && mongoose_1.default.isValidObjectId(doctorId) ? doctorId : undefined,
            status: status || 'active',
            takenLog: takenLog || [],
        };
        let newMedication = null;
        try {
            newMedication = await Medication_1.Medication.create(medicationData);
            await newMedication.populate('prescribedBy', 'name email hospitalName department');
        }
        catch (dbErr) {
            const id = 'med_' + Date.now();
            newMedication = {
                _id: id,
                id,
                ...medicationData,
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            memoryMedications.set(id, newMedication);
        }
        res.status(201).json({
            success: true,
            message: 'Medication created successfully',
            medication: newMedication,
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error creating medication',
            error: error.message,
        });
    }
};
exports.createMedication = createMedication;
// PUT /api/medications/:id - Update medication
const updateMedication = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, dosage, frequency, startDate, endDate, prescribedBy, status, takenLog, } = req.body;
        let medication = null;
        try {
            if (mongoose_1.default.isValidObjectId(id)) {
                medication = await Medication_1.Medication.findById(id);
            }
            if (!medication) {
                res.status(404).json({ success: false, message: 'Medication not found' });
                return;
            }
            if (name !== undefined)
                medication.name = name.trim();
            if (dosage !== undefined)
                medication.dosage = dosage.trim();
            if (frequency !== undefined)
                medication.frequency = frequency.trim();
            if (startDate !== undefined)
                medication.startDate = new Date(startDate);
            if (endDate !== undefined)
                medication.endDate = endDate ? new Date(endDate) : undefined;
            if (prescribedBy !== undefined)
                medication.prescribedBy = prescribedBy;
            if (status !== undefined)
                medication.status = status;
            if (takenLog !== undefined)
                medication.takenLog = takenLog;
            await medication.save();
            await medication.populate('prescribedBy', 'name email hospitalName department');
        }
        catch (dbErr) {
            medication = memoryMedications.get(id);
            if (!medication) {
                res.status(404).json({ success: false, message: 'Medication not found' });
                return;
            }
            if (name !== undefined)
                medication.name = name.trim();
            if (dosage !== undefined)
                medication.dosage = dosage.trim();
            if (frequency !== undefined)
                medication.frequency = frequency.trim();
            if (startDate !== undefined)
                medication.startDate = new Date(startDate);
            if (endDate !== undefined)
                medication.endDate = endDate ? new Date(endDate) : undefined;
            if (prescribedBy !== undefined)
                medication.prescribedBy = prescribedBy;
            if (status !== undefined)
                medication.status = status;
            if (takenLog !== undefined)
                medication.takenLog = takenLog;
            medication.updatedAt = new Date();
            memoryMedications.set(id, medication);
        }
        res.status(200).json({
            success: true,
            message: 'Medication updated successfully',
            medication,
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error updating medication',
            error: error.message,
        });
    }
};
exports.updateMedication = updateMedication;
// DELETE /api/medications/:id - Delete medication
const deleteMedication = async (req, res) => {
    try {
        const { id } = req.params;
        let deleted = false;
        try {
            if (mongoose_1.default.isValidObjectId(id)) {
                const result = await Medication_1.Medication.findByIdAndDelete(id);
                deleted = !!result;
            }
        }
        catch {
            deleted = memoryMedications.delete(id);
        }
        if (!deleted && memoryMedications.has(id)) {
            memoryMedications.delete(id);
            deleted = true;
        }
        if (!deleted) {
            res.status(404).json({ success: false, message: 'Medication not found' });
            return;
        }
        res.status(200).json({
            success: true,
            message: 'Medication deleted successfully',
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error deleting medication',
            error: error.message,
        });
    }
};
exports.deleteMedication = deleteMedication;
// POST /api/medications/:id/taken - Log a dose as taken with today's date
const logMedicationTaken = async (req, res) => {
    try {
        const { id } = req.params;
        const { date, taken } = req.body;
        const logEntry = {
            date: date ? new Date(date) : new Date(),
            taken: taken !== undefined ? Boolean(taken) : true,
        };
        let medication = null;
        try {
            if (mongoose_1.default.isValidObjectId(id)) {
                medication = await Medication_1.Medication.findById(id);
            }
            if (!medication) {
                res.status(404).json({ success: false, message: 'Medication not found' });
                return;
            }
            medication.takenLog.push(logEntry);
            await medication.save();
        }
        catch (dbErr) {
            medication = memoryMedications.get(id);
            if (!medication) {
                res.status(404).json({ success: false, message: 'Medication not found' });
                return;
            }
            if (!medication.takenLog) {
                medication.takenLog = [];
            }
            medication.takenLog.push(logEntry);
            medication.updatedAt = new Date();
            memoryMedications.set(id, medication);
        }
        res.status(200).json({
            success: true,
            message: 'Dose logged successfully',
            medication,
            logEntry,
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error logging medication dose',
            error: error.message,
        });
    }
};
exports.logMedicationTaken = logMedicationTaken;
