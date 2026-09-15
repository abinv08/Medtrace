import mongoose, { Schema, Document } from 'mongoose';

export interface ITestResult extends Document {
  _id: mongoose.Types.ObjectId;
  patientId: mongoose.Types.ObjectId;
  fileUrl: string;
  fileType?: string;
  uploadedBy?: mongoose.Types.ObjectId;
  category?: string;
  notes?: string;
  uploadDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

const TestResultSchema: Schema = new Schema(
  {
    patientId: {
      type: Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
      index: true,
    },
    fileUrl: {
      type: String,
      required: true,
      trim: true,
    },
    fileType: {
      type: String,
      trim: true,
    },
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    category: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    uploadDate: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

export const TestResult = mongoose.model<ITestResult>('TestResult', TestResultSchema);
