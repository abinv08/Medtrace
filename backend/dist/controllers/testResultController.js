"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.downloadTestResultFile = exports.getTestResultsByPatientId = exports.uploadTestResult = exports.upload = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const multer_1 = __importDefault(require("multer"));
const crypto_1 = __importDefault(require("crypto"));
const TestResult_1 = require("../models/TestResult");
const storageService_1 = require("../services/storageService");
// Configure Multer Disk Storage
const storage = multer_1.default.diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, storageService_1.UPLOADS_DIR);
    },
    filename: (_req, file, cb) => {
        const uniqueSuffix = `${Date.now()}-${crypto_1.default.randomBytes(6).toString('hex')}`;
        const ext = path_1.default.extname(file.originalname);
        cb(null, `test-result-${uniqueSuffix}${ext}`);
    },
});
exports.upload = (0, multer_1.default)({
    storage,
    limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB max
});
// In-Memory Fallback Store if MongoDB is disconnected
const memoryTestResults = new Map();
// POST /api/test-results - Upload file + metadata
const uploadTestResult = async (req, res) => {
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
            fileType: req.file.mimetype || path_1.default.extname(req.file.originalname).slice(1),
            uploadedBy: uploaderId && mongoose_1.default.isValidObjectId(uploaderId) ? uploaderId : undefined,
            category: category ? category.trim() : 'General',
            notes: notes ? notes.trim() : '',
            uploadDate: new Date(),
        };
        let newTestResult = null;
        try {
            newTestResult = await TestResult_1.TestResult.create(testResultData);
            await newTestResult.populate('uploadedBy', 'name email hospitalName department');
        }
        catch (dbErr) {
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
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error uploading test result',
            error: error.message,
        });
    }
};
exports.uploadTestResult = uploadTestResult;
// GET /api/test-results/:patientId - List test results for a patient
const getTestResultsByPatientId = async (req, res) => {
    try {
        const { patientId } = req.params;
        const { category } = req.query;
        const filter = { patientId };
        if (category) {
            filter.category = category;
        }
        let results = [];
        try {
            results = await TestResult_1.TestResult.find(filter)
                .populate('uploadedBy', 'name email hospitalName department')
                .sort({ uploadDate: -1 });
        }
        catch {
            results = Array.from(memoryTestResults.values())
                .filter((tr) => {
                if (tr.patientId?.toString() !== patientId.toString())
                    return false;
                if (category && tr.category !== category)
                    return false;
                return true;
            })
                .sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime());
        }
        res.status(200).json({
            success: true,
            count: results.length,
            testResults: results,
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error retrieving test results',
            error: error.message,
        });
    }
};
exports.getTestResultsByPatientId = getTestResultsByPatientId;
// GET /api/test-results/file/:id - Download/stream the file
const downloadTestResultFile = async (req, res) => {
    try {
        const { id } = req.params;
        let targetFilename = id;
        // Check if :id is a TestResult document ID
        if (mongoose_1.default.isValidObjectId(id)) {
            try {
                const doc = await TestResult_1.TestResult.findById(id);
                if (doc && doc.fileUrl) {
                    targetFilename = path_1.default.basename(doc.fileUrl);
                }
            }
            catch {
                const memoryDoc = memoryTestResults.get(id);
                if (memoryDoc && memoryDoc.fileUrl) {
                    targetFilename = path_1.default.basename(memoryDoc.fileUrl);
                }
            }
        }
        const filePath = storageService_1.storageService.getFilePath(targetFilename);
        if (!fs_1.default.existsSync(filePath)) {
            res.status(404).json({
                success: false,
                message: 'File not found on storage server',
            });
            return;
        }
        // Stream the file directly
        res.sendFile(filePath);
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error retrieving file',
            error: error.message,
        });
    }
};
exports.downloadTestResultFile = downloadTestResultFile;
