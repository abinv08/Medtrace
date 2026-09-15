import mongoose, { Schema, Document } from 'mongoose';

export type Gender = 'male' | 'female' | 'other';

export interface IMedicalHistory {
  condition: string;
  diagnosedDate?: Date;
  notes?: string;
}

export interface IPatient extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  dateOfBirth?: Date;
  gender?: Gender;
  bloodGroup?: string;
  assignedDoctor?: mongoose.Types.ObjectId;
  assignedCaretakers: mongoose.Types.ObjectId[];
  medicalHistory: IMedicalHistory[];
  createdAt: Date;
  updatedAt: Date;
}

const MedicalHistorySchema: Schema = new Schema(
  {
    condition: { type: String, required: true, trim: true },
    diagnosedDate: { type: Date },
    notes: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const PatientSchema: Schema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    dateOfBirth: {
      type: Date,
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'other'],
    },
    bloodGroup: {
      type: String,
      trim: true,
    },
    assignedDoctor: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    assignedCaretakers: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    medicalHistory: [MedicalHistorySchema],
  },
  {
    timestamps: true,
  }
);

export const Patient = mongoose.model<IPatient>('Patient', PatientSchema);
