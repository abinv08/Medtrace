"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLatestVitals = exports.getVitalsHistory = exports.createVitals = void 0;
const Vitals_1 = require("../models/Vitals");
// In-Memory Fallback Store if MongoDB is disconnected
const memoryVitals = [];
// POST /api/vitals - Add a new vitals reading
const createVitals = async (req, res) => {
    try {
        const { patientId, heartRate, spo2, bloodPressureSystolic, bloodPressureDiastolic, temperature, source, recordedAt, } = req.body;
        if (!patientId) {
            res.status(400).json({ success: false, message: 'patientId is required' });
            return;
        }
        let newVitals = null;
        const vitalsData = {
            patientId,
            heartRate,
            spo2,
            bloodPressureSystolic,
            bloodPressureDiastolic,
            temperature,
            source: source || 'manual',
            recordedAt: recordedAt ? new Date(recordedAt) : new Date(),
        };
        try {
            newVitals = await Vitals_1.Vitals.create(vitalsData);
        }
        catch (dbErr) {
            const id = 'vitals_' + Date.now();
            newVitals = {
                _id: id,
                id,
                ...vitalsData,
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            memoryVitals.push(newVitals);
        }
        res.status(201).json({
            success: true,
            message: 'Vitals recorded successfully',
            vitals: newVitals,
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error recording vitals',
            error: error.message,
        });
    }
};
exports.createVitals = createVitals;
// GET /api/vitals/:patientId - History of vitals with optional ?from=&to= date range
const getVitalsHistory = async (req, res) => {
    try {
        const { patientId } = req.params;
        const { from, to, limit } = req.query;
        const filter = { patientId };
        if (from || to) {
            filter.recordedAt = {};
            if (from) {
                filter.recordedAt.$gte = new Date(from);
            }
            if (to) {
                filter.recordedAt.$lte = new Date(to);
            }
        }
        let history = [];
        try {
            const query = Vitals_1.Vitals.find(filter).sort({ recordedAt: -1 });
            if (limit) {
                query.limit(Number(limit));
            }
            history = await query.exec();
        }
        catch {
            history = memoryVitals.filter((item) => {
                if (item.patientId?.toString() !== patientId.toString())
                    return false;
                const recTime = new Date(item.recordedAt).getTime();
                if (from && recTime < new Date(from).getTime())
                    return false;
                if (to && recTime > new Date(to).getTime())
                    return false;
                return true;
            }).sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime());
            if (limit) {
                history = history.slice(0, Number(limit));
            }
        }
        res.status(200).json({
            success: true,
            count: history.length,
            vitals: history,
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error retrieving vitals history',
            error: error.message,
        });
    }
};
exports.getVitalsHistory = getVitalsHistory;
// GET /api/vitals/:patientId/latest - Most recent vitals reading
const getLatestVitals = async (req, res) => {
    try {
        const { patientId } = req.params;
        let latest = null;
        try {
            latest = await Vitals_1.Vitals.findOne({ patientId }).sort({ recordedAt: -1 });
        }
        catch {
            const patientRecords = memoryVitals
                .filter((item) => item.patientId?.toString() === patientId.toString())
                .sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime());
            latest = patientRecords[0] || null;
        }
        if (!latest) {
            res.status(404).json({
                success: false,
                message: 'No vitals records found for this patient',
            });
            return;
        }
        res.status(200).json({
            success: true,
            vitals: latest,
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error retrieving latest vitals',
            error: error.message,
        });
    }
};
exports.getLatestVitals = getLatestVitals;
