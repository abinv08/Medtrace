import mongoose, { Schema, Document } from 'mongoose';

export type MedicationStatus = 'active' | 'completed' | 'stopped';

export interface IMedicationLog {
  date: Date;
  taken: boolean;
}

export interface IMedication extends Document {
  _id: mongoose.Types.ObjectId;
  patientId: mongoose.Types.ObjectId;
  name: string;
  dosage?: string;
  frequency?: string;
  startDate?: Date;
  endDate?: Date;
  prescribedBy?: mongoose.Types.ObjectId;
  status: MedicationStatus;
  takenLog: IMedicationLog[];
  createdAt: Date;
  updatedAt: Date;
}

const MedicationLogSchema: Schema = new Schema(
  {
    date: { type: Date, required: true },
    taken: { type: Boolean, required: true, default: false },
  },
  { _id: false }
);

const MedicationSchema: Schema = new Schema(
  {
    patientId: {
      type: Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    dosage: {
      type: String,
      trim: true,
    },
    frequency: {
      type: String,
      trim: true,
    },
    startDate: {
      type: Date,
    },
    endDate: {
      type: Date,
    },
    prescribedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    status: {
      type: String,
      enum: ['active', 'completed', 'stopped'],
      default: 'active',
    },
    takenLog: [MedicationLogSchema],
  },
  {
    timestamps: true,
  }
);

export const Medication = mongoose.model<IMedication>('Medication', MedicationSchema);
