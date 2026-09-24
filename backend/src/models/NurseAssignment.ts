import mongoose, { Schema, Document } from 'mongoose';

export type NurseAssignmentShift = 'day' | 'night' | 'other';
export type NurseAssignmentStatus = 'active' | 'revoked';

export interface INurseAssignment extends Document {
  _id: mongoose.Types.ObjectId;
  nurseId: mongoose.Types.ObjectId;
  patientId: mongoose.Types.ObjectId;
  assignedBy: mongoose.Types.ObjectId;
  ward?: string;
  shift?: NurseAssignmentShift;
  status: NurseAssignmentStatus;
  createdAt: Date;
  updatedAt: Date;
}

const NurseAssignmentSchema: Schema = new Schema(
  {
    nurseId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    patientId: {
      type: Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
    },
    assignedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    ward: {
      type: String,
    },
    shift: {
      type: String,
      enum: ['day', 'night', 'other'],
    },
    status: {
      type: String,
      enum: ['active', 'revoked'],
      default: 'active',
    },
  },
  {
    timestamps: true,
  }
);

NurseAssignmentSchema.index({ nurseId: 1, patientId: 1 });

export const NurseAssignment = mongoose.model<INurseAssignment>(
  'NurseAssignment',
  NurseAssignmentSchema
);