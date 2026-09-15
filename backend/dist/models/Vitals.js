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
exports.Vitals = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const VitalsSchema = new mongoose_1.Schema({
    patientId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Patient',
        required: true,
        index: true,
    },
    heartRate: {
        type: Number,
    },
    spo2: {
        type: Number,
    },
    bloodPressureSystolic: {
        type: Number,
    },
    bloodPressureDiastolic: {
        type: Number,
    },
    temperature: {
        type: Number,
    },
    source: {
        type: String,
        enum: ['manual', 'csi', 'device'],
        default: 'manual',
    },
    recordedAt: {
        type: Date,
        default: Date.now,
    },
}, {
    timestamps: true,
});
// Compound index for fast chronological history queries per patient
VitalsSchema.index({ patientId: 1, recordedAt: -1 });
exports.Vitals = mongoose_1.default.model('Vitals', VitalsSchema);
