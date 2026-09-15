import { Response } from 'express';
import mongoose from 'mongoose';
import { Medication, IMedication } from '../models/Medication';
import { AuthenticatedRequest } from '../middleware/authMiddleware';

// In-Memory Fallback Store if MongoDB is disconnected
const memoryMedications = new Map<string, any>();

// GET /api/medications/:patientId - List medications for a patient
export const getMedicationsByPatientId = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { patientId } = req.params;
    const { status } = req.query;

    const filter: any = { patientId };
    if (status) {
      filter.status = status;
    }

    let medications: any[] = [];
    try {
      medications = await Medication.find(filter)
        .populate('prescribedBy', 'name email hospitalName department')
        .sort({ createdAt: -1 });
    } catch {
      medications = Array.from(memoryMedications.values())
        .filter((med) => {
          if (med.patientId?.toString() !== patientId.toString()) return false;
          if (status && med.status !== status) return false;
          return true;
        })
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    res.status(200).json({
      success: true,
      count: medications.length,
      medications,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving medications',
      error: error.message,
    });
  }
};

// POST /api/medications - Create medication
export const createMedication = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const {
      patientId,
      name,
      dosage,
      frequency,
      startDate,
      endDate,
      prescribedBy,
      status,
      takenLog,
    } = req.body;

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
      prescribedBy: doctorId && mongoose.isValidObjectId(doctorId) ? doctorId : undefined,
      status: status || 'active',
      takenLog: takenLog || [],
    };

    let newMedication: any = null;
    try {
      newMedication = await Medication.create(medicationData);
      await newMedication.populate('prescribedBy', 'name email hospitalName department');
    } catch (dbErr) {
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
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Error creating medication',
      error: error.message,
    });
  }
};

// PUT /api/medications/:id - Update medication
export const updateMedication = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      name,
      dosage,
      frequency,
      startDate,
      endDate,
      prescribedBy,
      status,
      takenLog,
    } = req.body;

    let medication: any = null;
    try {
      if (mongoose.isValidObjectId(id)) {
        medication = await Medication.findById(id);
      }

      if (!medication) {
        res.status(404).json({ success: false, message: 'Medication not found' });
        return;
      }

      if (name !== undefined) medication.name = name.trim();
      if (dosage !== undefined) medication.dosage = dosage.trim();
      if (frequency !== undefined) medication.frequency = frequency.trim();
      if (startDate !== undefined) medication.startDate = new Date(startDate);
      if (endDate !== undefined) medication.endDate = endDate ? new Date(endDate) : undefined;
      if (prescribedBy !== undefined) medication.prescribedBy = prescribedBy;
      if (status !== undefined) medication.status = status;
      if (takenLog !== undefined) medication.takenLog = takenLog;

      await medication.save();
      await medication.populate('prescribedBy', 'name email hospitalName department');
    } catch (dbErr) {
      medication = memoryMedications.get(id);
      if (!medication) {
        res.status(404).json({ success: false, message: 'Medication not found' });
        return;
      }

      if (name !== undefined) medication.name = name.trim();
      if (dosage !== undefined) medication.dosage = dosage.trim();
      if (frequency !== undefined) medication.frequency = frequency.trim();
      if (startDate !== undefined) medication.startDate = new Date(startDate);
      if (endDate !== undefined) medication.endDate = endDate ? new Date(endDate) : undefined;
      if (prescribedBy !== undefined) medication.prescribedBy = prescribedBy;
      if (status !== undefined) medication.status = status;
      if (takenLog !== undefined) medication.takenLog = takenLog;
      medication.updatedAt = new Date();

      memoryMedications.set(id, medication);
    }

    res.status(200).json({
      success: true,
      message: 'Medication updated successfully',
      medication,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Error updating medication',
      error: error.message,
    });
  }
};

// DELETE /api/medications/:id - Delete medication
export const deleteMedication = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    let deleted = false;
    try {
      if (mongoose.isValidObjectId(id)) {
        const result = await Medication.findByIdAndDelete(id);
        deleted = !!result;
      }
    } catch {
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
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Error deleting medication',
      error: error.message,
    });
  }
};

// POST /api/medications/:id/taken - Log a dose as taken with today's date
export const logMedicationTaken = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const { date, taken } = req.body;

    const logEntry = {
      date: date ? new Date(date) : new Date(),
      taken: taken !== undefined ? Boolean(taken) : true,
    };

    let medication: any = null;
    try {
      if (mongoose.isValidObjectId(id)) {
        medication = await Medication.findById(id);
      }

      if (!medication) {
        res.status(404).json({ success: false, message: 'Medication not found' });
        return;
      }

      medication.takenLog.push(logEntry);
      await medication.save();
    } catch (dbErr) {
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
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Error logging medication dose',
      error: error.message,
    });
  }
};
