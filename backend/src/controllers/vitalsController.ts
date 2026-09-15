import { Response } from 'express';
import mongoose from 'mongoose';
import { Vitals, IVitals } from '../models/Vitals';
import { AuthenticatedRequest } from '../middleware/authMiddleware';

// In-Memory Fallback Store if MongoDB is disconnected
const memoryVitals: any[] = [];

// POST /api/vitals - Add a new vitals reading
export const createVitals = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const {
      patientId,
      heartRate,
      spo2,
      bloodPressureSystolic,
      bloodPressureDiastolic,
      temperature,
      source,
      recordedAt,
    } = req.body;

    if (!patientId) {
      res.status(400).json({ success: false, message: 'patientId is required' });
      return;
    }

    let newVitals: any = null;
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
      newVitals = await Vitals.create(vitalsData);
    } catch (dbErr) {
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
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Error recording vitals',
      error: error.message,
    });
  }
};

// GET /api/vitals/:patientId - History of vitals with optional ?from=&to= date range
export const getVitalsHistory = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { patientId } = req.params;
    const { from, to, limit } = req.query;

    const filter: any = { patientId };

    if (from || to) {
      filter.recordedAt = {};
      if (from) {
        filter.recordedAt.$gte = new Date(from as string);
      }
      if (to) {
        filter.recordedAt.$lte = new Date(to as string);
      }
    }

    let history: any[] = [];
    try {
      const query = Vitals.find(filter).sort({ recordedAt: -1 });
      if (limit) {
        query.limit(Number(limit));
      }
      history = await query.exec();
    } catch {
      history = memoryVitals.filter((item) => {
        if (item.patientId?.toString() !== patientId.toString()) return false;
        const recTime = new Date(item.recordedAt).getTime();
        if (from && recTime < new Date(from as string).getTime()) return false;
        if (to && recTime > new Date(to as string).getTime()) return false;
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
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving vitals history',
      error: error.message,
    });
  }
};

// GET /api/vitals/:patientId/latest - Most recent vitals reading
export const getLatestVitals = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { patientId } = req.params;

    let latest: any = null;
    try {
      latest = await Vitals.findOne({ patientId }).sort({ recordedAt: -1 });
    } catch {
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
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving latest vitals',
      error: error.message,
    });
  }
};
