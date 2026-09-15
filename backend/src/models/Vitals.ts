import mongoose, { Schema, Document } from 'mongoose';

export type VitalsSource = 'manual' | 'csi' | 'device';

export interface IVitals extends Document {
  _id: mongoose.Types.ObjectId;
  patientId: mongoose.Types.ObjectId;
  heartRate?: number;
  spo2?: number;
  bloodPressureSystolic?: number;
  bloodPressureDiastolic?: number;
  temperature?: number;
  source: VitalsSource;
  recordedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const VitalsSchema: Schema = new Schema(
  {
    patientId: {
      type: Schema.Types.ObjectId,
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
  },
  {
    timestamps: true,
  }
);

// Compound index for fast chronological history queries per patient
VitalsSchema.index({ patientId: 1, recordedAt: -1 });

export const Vitals = mongoose.model<IVitals>('Vitals', VitalsSchema);
