import { Response } from 'express';
import mongoose from 'mongoose';
import { Appointment, IAppointment, AppointmentStatus } from '../models/Appointment';
import { AuthenticatedRequest } from '../middleware/authMiddleware';

// In-Memory Fallback Store if MongoDB is disconnected
const memoryAppointments = new Map<string, any>();

// POST /api/appointments - Book a new appointment
export const createAppointment = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
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

    let newAppointment: any = null;
    try {
      newAppointment = await Appointment.create(appointmentData);
      await newAppointment.populate([
        {
          path: 'patientId',
          populate: { path: 'userId', select: 'name email phone' },
        },
        { path: 'doctorId', select: 'name email phone hospitalName department' },
      ]);
    } catch (dbErr) {
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
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Error booking appointment',
      error: error.message,
    });
  }
};

// GET /api/appointments - List appointments (filterable by patientId or doctorId)
export const getAppointments = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { patientId, doctorId, status } = req.query;

    const filter: any = {};
    if (patientId) {
      filter.patientId = patientId;
    }
    if (doctorId) {
      filter.doctorId = doctorId;
    }
    if (status) {
      filter.status = status;
    }

    let appointments: any[] = [];
    try {
      appointments = await Appointment.find(filter)
        .populate([
          {
            path: 'patientId',
            populate: { path: 'userId', select: 'name email phone' },
          },
          { path: 'doctorId', select: 'name email phone hospitalName department' },
        ])
        .sort({ dateTime: 1 });
    } catch {
      appointments = Array.from(memoryAppointments.values())
        .filter((apt) => {
          if (patientId && apt.patientId?.toString() !== patientId.toString()) return false;
          if (doctorId && apt.doctorId?.toString() !== doctorId.toString()) return false;
          if (status && apt.status !== status) return false;
          return true;
        })
        .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());
    }

    res.status(200).json({
      success: true,
      count: appointments.length,
      appointments,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving appointments',
      error: error.message,
    });
  }
};

// PUT /api/appointments/:id/status - Update appointment status
export const updateAppointmentStatus = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const allowedStatuses: AppointmentStatus[] = [
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

    let appointment: any = null;
    try {
      if (mongoose.isValidObjectId(id)) {
        appointment = await Appointment.findById(id);
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
    } catch (dbErr) {
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
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Error updating appointment status',
      error: error.message,
    });
  }
};

// DELETE /api/appointments/:id - Cancel/remove appointment
export const deleteAppointment = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    let deleted = false;
    try {
      if (mongoose.isValidObjectId(id)) {
        const result = await Appointment.findByIdAndDelete(id);
        deleted = !!result;
      }
    } catch {
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
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Error cancelling appointment',
      error: error.message,
    });
  }
};
