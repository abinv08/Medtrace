"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logExerciseProgress = exports.getExercisePlanByPatientId = exports.createExercisePlan = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const ExercisePlan_1 = require("../models/ExercisePlan");
// In-Memory Fallback Store if MongoDB is disconnected
const memoryExercisePlans = new Map();
// POST /api/exercise-plans - Create/assign an exercise plan
const createExercisePlan = async (req, res) => {
    try {
        const { patientId, exercises, frequency, assignedBy } = req.body;
        if (!patientId) {
            res.status(400).json({
                success: false,
                message: 'patientId is required',
            });
            return;
        }
        const doctorOrAssignerId = assignedBy || req.user?.id;
        const planData = {
            patientId,
            exercises: exercises || [],
            frequency: frequency ? frequency.trim() : '',
            assignedBy: doctorOrAssignerId && mongoose_1.default.isValidObjectId(doctorOrAssignerId)
                ? doctorOrAssignerId
                : undefined,
            progressLog: [],
        };
        let newPlan = null;
        try {
            newPlan = await ExercisePlan_1.ExercisePlan.create(planData);
            await newPlan.populate('assignedBy', 'name email hospitalName department');
        }
        catch (dbErr) {
            const id = 'plan_' + Date.now();
            newPlan = {
                _id: id,
                id,
                ...planData,
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            memoryExercisePlans.set(id, newPlan);
        }
        res.status(201).json({
            success: true,
            message: 'Exercise plan created successfully',
            exercisePlan: newPlan,
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error creating exercise plan',
            error: error.message,
        });
    }
};
exports.createExercisePlan = createExercisePlan;
// GET /api/exercise-plans/:patientId - Get exercise plan for a patient
const getExercisePlanByPatientId = async (req, res) => {
    try {
        const { patientId } = req.params;
        let plan = null;
        try {
            plan = await ExercisePlan_1.ExercisePlan.findOne({ patientId })
                .sort({ createdAt: -1 })
                .populate('assignedBy', 'name email hospitalName department');
        }
        catch {
            const patientPlans = Array.from(memoryExercisePlans.values())
                .filter((p) => p.patientId?.toString() === patientId.toString())
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            plan = patientPlans[0] || null;
        }
        if (!plan) {
            res.status(404).json({
                success: false,
                message: 'No exercise plan found for this patient',
            });
            return;
        }
        res.status(200).json({
            success: true,
            exercisePlan: plan,
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error retrieving exercise plan',
            error: error.message,
        });
    }
};
exports.getExercisePlanByPatientId = getExercisePlanByPatientId;
// PUT /api/exercise-plans/:id/progress - Log a completed exercise session
const logExerciseProgress = async (req, res) => {
    try {
        const { id } = req.params;
        const { date, completed, notes } = req.body;
        const progressEntry = {
            date: date ? new Date(date) : new Date(),
            completed: completed !== undefined ? Boolean(completed) : true,
            notes: notes ? notes.trim() : '',
        };
        let plan = null;
        try {
            if (mongoose_1.default.isValidObjectId(id)) {
                plan = await ExercisePlan_1.ExercisePlan.findById(id);
            }
            if (!plan && mongoose_1.default.isValidObjectId(id)) {
                // In case id passed is patientId
                plan = await ExercisePlan_1.ExercisePlan.findOne({ patientId: id }).sort({ createdAt: -1 });
            }
            if (!plan) {
                res.status(404).json({
                    success: false,
                    message: 'Exercise plan not found',
                });
                return;
            }
            plan.progressLog.push(progressEntry);
            await plan.save();
            await plan.populate('assignedBy', 'name email hospitalName department');
        }
        catch (dbErr) {
            plan = memoryExercisePlans.get(id);
            if (!plan) {
                for (const p of memoryExercisePlans.values()) {
                    if (p.patientId?.toString() === id.toString()) {
                        plan = p;
                        break;
                    }
                }
            }
            if (!plan) {
                res.status(404).json({
                    success: false,
                    message: 'Exercise plan not found',
                });
                return;
            }
            if (!plan.progressLog) {
                plan.progressLog = [];
            }
            plan.progressLog.push(progressEntry);
            plan.updatedAt = new Date();
            memoryExercisePlans.set(plan._id?.toString() || id, plan);
        }
        res.status(200).json({
            success: true,
            message: 'Exercise progress logged successfully',
            exercisePlan: plan,
            progressEntry,
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error logging exercise progress',
            error: error.message,
        });
    }
};
exports.logExerciseProgress = logExerciseProgress;
