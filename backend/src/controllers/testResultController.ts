import { Response } from 'express';
import mongoose from 'mongoose';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import crypto from 'crypto';
import { TestResult, ITestResult } from '../models/TestResult';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { UPLOADS_DIR, storageService } from '../services/storageService';

// Configure Multer Disk Storage
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
    const ext = path.extname(file.originalname);
    cb(null, `test-result-${uniqueSuffix}${ext}`);
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB max
});

// In-Memory Fallback Store if MongoDB is disconnected
const memoryTestResults = new Map<string, any>();

// POST /api/test-results - Upload file + metadata
export const uploadTestResult = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({
        success: false,
        message: 'No file uploaded. Please attach a file using the "file" field.',
      });
      return;
    }

    const { patientId, category, notes, uploadedBy } = req.body;

    if (!patientId) {
      res.status(400).json({
        success: false,
        message: 'patientId is required',
      });
      return;
    }

    const storedFileName = req.file.filename;
    const fileUrl = `/api/test-results/file/${storedFileName}`;
    const uploaderId = uploadedBy || req.user?.id;

    const testResultData = {
      patientId,
      fileUrl,
      fileType: req.file.mimetype || path.extname(req.file.originalname).slice(1),
      uploadedBy: uploaderId && mongoose.isValidObjectId(uploaderId) ? uploaderId : undefined,
      category: category ? category.trim() : 'General',
      notes: notes ? notes.trim() : '',
      uploadDate: new Date(),
      status: 'completed',
    };

    let newTestResult: any = null;
    try {
      newTestResult = await TestResult.create(testResultData);
      await newTestResult.populate('uploadedBy', 'name email hospitalName department');
    } catch (dbErr) {
      const id = 'tr_' + Date.now();
      newTestResult = {
        _id: id,
        id,
        ...testResultData,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      memoryTestResults.set(id, newTestResult);
    }

    res.status(201).json({
      success: true,
      message: 'Test result uploaded successfully',
      testResult: newTestResult,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Error uploading test result',
      error: error.message,
    });
  }
};

// POST /api/test-results/request - Request a lab test without a file
export const requestTestResult = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { patientId, category, notes, requestedBy } = req.body;
    const requesterId = requestedBy || req.user?.id;
    if (!patientId || !category || !requesterId) {
      res.status(400).json({ success: false, message: 'patientId, category, and requestedBy are required' });
      return;
    }
    const testResultData = {
      patientId,
      category: category.trim(),
      notes: notes ? notes.trim() : '',
      requestedBy: mongoose.isValidObjectId(requesterId) ? requesterId : undefined,
      status: 'requested',
      uploadDate: new Date(),
    };
    const testResult = await TestResult.create(testResultData);
    res.status(201).json({ success: true, message: 'Test requested successfully', testResult });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Error requesting test', error: error.message });
  }
};

// GET /api/test-results/:patientId - List test results for a patient
export const getTestResultsByPatientId = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { patientId } = req.params;
    const { category } = req.query;

    const filter: any = { patientId };
    if (category) {
      filter.category = category;
    }

    let results: any[] = [];
    try {
      results = await TestResult.find(filter)
        .populate('uploadedBy', 'name email hospitalName department')
        .sort({ uploadDate: -1 });
    } catch {
      results = Array.from(memoryTestResults.values())
        .filter((tr) => {
          if (tr.patientId?.toString() !== patientId.toString()) return false;
          if (category && tr.category !== category) return false;
          return true;
        })
        .sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime());
    }

    res.status(200).json({
      success: true,
      count: results.length,
      testResults: results,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving test results',
      error: error.message,
    });
  }
};

// GET /api/test-results/file/:id - Download/stream the file
export const downloadTestResultFile = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    let targetFilename = id;

    // Check if :id is a TestResult document ID
    if (mongoose.isValidObjectId(id)) {
      try {
        const doc = await TestResult.findById(id);
        if (doc && doc.fileUrl) {
          targetFilename = path.basename(doc.fileUrl);
        }
      } catch {
        const memoryDoc = memoryTestResults.get(id);
        if (memoryDoc && memoryDoc.fileUrl) {
          targetFilename = path.basename(memoryDoc.fileUrl);
        }
      }
    }

    const filePath = storageService.getFilePath(targetFilename);

    if (!fs.existsSync(filePath)) {
      res.status(404).json({
        success: false,
        message: 'File not found on storage server',
      });
      return;
    }

    // Stream the file directly
    res.sendFile(filePath);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving file',
      error: error.message,
    });
  }
};
