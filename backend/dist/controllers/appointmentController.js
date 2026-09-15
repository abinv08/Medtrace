"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteAppointment = exports.updateAppointmentStatus = exports.getAppointments = exports.createAppointment = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const Appointment_1 = require("../models/Appointment");
// In-Memory Fallback Store if MongoDB is disconnected
const memoryAppointments = new Map();
// POST /api/appointments - Book a new appointment
const createAppointment = async (req, res) => {
    try {
        const { patientId, doctorId, dateTime, reason, notes, status } = req.body;
        if (!patientId || !doctorId || !dateTime) {
            res.status(400).json({
                success: false,
                message: 'patientId, doctorId, and dateTime are required',
            });
            return;
        }
        const appointmentData = {
            patientId,
            doctorId,
            dateTime: new Date(dateTime),
            reason: reason ? reason.trim() : '',
            notes: notes ? notes.trim() : '',
            status: status || 'pending',
        };
        let newAppointment = null;
        try {
            newAppointment = await Appointment_1.Appointment.create(appointmentData);
            await newAppointment.populate([
                {
                    path: 'patientId',
                    populate: { path: 'userId', select: 'name email phone' },
                },
                { path: 'doctorId', select: 'name email phone hospitalName department' },
            ]);
        }
        catch (dbErr) {
            const id = 'apt_' + Date.now();
            newAppointment = {
                _id: id,
                id,
                ...appointmentData,
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            memoryAppointments.set(id, newAppointment);
        }
        res.status(201).json({
            success: true,
            message: 'Appointment booked successfully',
            appointment: newAppointment,
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error booking appointment',
            error: error.message,
        });
    }
};
exports.createAppointment = createAppointment;
// GET /api/appointments - List appointments (filterable by patientId or doctorId)
const getAppointments = async (req, res) => {
    try {
        const { patientId, doctorId, status } = req.query;
        const filter = {};
        if (patientId) {
            filter.patientId = patientId;
        }
        if (doctorId) {
            filter.doctorId = doctorId;
        }
        if (status) {
            filter.status = status;
        }
        let appointments = [];
        try {
            appointments = await Appointment_1.Appointment.find(filter)
                .populate([
                {
                    path: 'patientId',
                    populate: { path: 'userId', select: 'name email phone' },
                },
                { path: 'doctorId', select: 'name email phone hospitalName department' },
            ])
                .sort({ dateTime: 1 });
        }
        catch {
            appointments = Array.from(memoryAppointments.values())
                .filter((apt) => {
                if (patientId && apt.patientId?.toString() !== patientId.toString())
                    return false;
                if (doctorId && apt.doctorId?.toString() !== doctorId.toString())
                    return false;
                if (status && apt.status !== status)
                    return false;
                return true;
            })
                .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());
        }
        res.status(200).json({
            success: true,
            count: appointments.length,
            appointments,
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error retrieving appointments',
            error: error.message,
        });
    }
};
exports.getAppointments = getAppointments;
// PUT /api/appointments/:id/status - Update appointment status
const updateAppointmentStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const allowedStatuses = [
            'pending',
            'confirmed',
            'completed',
            'cancelled',
        ];
        if (!status || !allowedStatuses.includes(status)) {
            res.status(400).json({
                success: false,
                message: `Invalid status. Must be one of: ${allowedStatuses.join(', ')}`,
            });
            return;
        }
        let appointment = null;
        try {
            if (mongoose_1.default.isValidObjectId(id)) {
                appointment = await Appointment_1.Appointment.findById(id);
            }
            if (!appointment) {
                res.status(404).json({ success: false, message: 'Appointment not found' });
                return;
            }
            appointment.status = status;
            await appointment.save();
            await appointment.populate([
                {
                    path: 'patientId',
                    populate: { path: 'userId', select: 'name email phone' },
                },
                { path: 'doctorId', select: 'name email phone hospitalName department' },
            ]);
        }
        catch (dbErr) {
            appointment = memoryAppointments.get(id);
            if (!appointment) {
                res.status(404).json({ success: false, message: 'Appointment not found' });
                return;
            }
            appointment.status = status;
            appointment.updatedAt = new Date();
            memoryAppointments.set(id, appointment);
        }
        res.status(200).json({
            success: true,
            message: 'Appointment status updated successfully',
            appointment,
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error updating appointment status',
            error: error.message,
        });
    }
};
exports.updateAppointmentStatus = updateAppointmentStatus;
// DELETE /api/appointments/:id - Cancel/remove appointment
const deleteAppointment = async (req, res) => {
    try {
        const { id } = req.params;
        let deleted = false;
        try {
            if (mongoose_1.default.isValidObjectId(id)) {
                const result = await Appointment_1.Appointment.findByIdAndDelete(id);
                deleted = !!result;
            }
        }
        catch {
            deleted = memoryAppointments.delete(id);
        }
        if (!deleted && memoryAppointments.has(id)) {
            memoryAppointments.delete(id);
            deleted = true;
        }
        if (!deleted) {
            res.status(404).json({ success: false, message: 'Appointment not found' });
            return;
        }
        res.status(200).json({
            success: true,
            message: 'Appointment cancelled successfully',
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error cancelling appointment',
            error: error.message,
        });
    }
};
exports.deleteAppointment = deleteAppointment;
