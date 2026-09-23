import { Response } from 'express';
import mongoose from 'mongoose';
import { ClinicalNote } from '../models/ClinicalNote';
import { AuthenticatedRequest } from '../middleware/authMiddleware';

export const createClinicalNote = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { patientId, doctorId, appointmentId, content } = req.body;
    const resolvedDoctorId = doctorId || req.user?.id;
    if (!patientId || !resolvedDoctorId || !content?.trim()) {
      res.status(400).json({ success: false, message: 'patientId, doctorId, and content are required' });
      return;
    }
    if (!mongoose.isValidObjectId(patientId) || !mongoose.isValidObjectId(resolvedDoctorId)) {
      res.status(400).json({ success: false, message: 'patientId and doctorId must be MongoDB ObjectIds' });
      return;
    }
    const note = await ClinicalNote.create({
      patientId,
      doctorId: resolvedDoctorId,
      appointmentId: appointmentId || undefined,
      content: content.trim(),
    });
    res.status(201).json({ success: true, clinicalNote: note });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Error creating clinical note', error: error.message });
  }
};

export const getClinicalNotesByPatientId = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { patientId } = req.params;
    if (!mongoose.isValidObjectId(patientId)) {
      res.status(400).json({ success: false, message: 'patientId must be a MongoDB ObjectId' });
      return;
    }
    const notes = await ClinicalNote.find({ patientId })
      .populate('doctorId', 'name email')
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: notes.length, clinicalNotes: notes });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Error retrieving clinical notes', error: error.message });
  }
};
