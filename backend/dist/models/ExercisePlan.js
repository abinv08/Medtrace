"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExercisePlan = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const ExerciseItemSchema = new mongoose_1.Schema({
    name: { type: String, required: true, trim: true },
    sets: { type: Number },
    reps: { type: Number },
    notes: { type: String, trim: true },
}, { _id: false });
const ExerciseProgressLogSchema = new mongoose_1.Schema({
    date: { type: Date, required: true, default: Date.now },
    completed: { type: Boolean, required: true, default: false },
    notes: { type: String, trim: true },
}, { _id: false });
const ExercisePlanSchema = new mongoose_1.Schema({
    patientId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Patient',
        required: true,
        index: true,
    },
    exercises: [ExerciseItemSchema],
    frequency: {
        type: String,
        trim: true,
    },
    assignedBy: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
    },
    progressLog: [ExerciseProgressLogSchema],
}, {
    timestamps: true,
});
exports.ExercisePlan = mongoose_1.default.model('ExercisePlan', ExercisePlanSchema);
