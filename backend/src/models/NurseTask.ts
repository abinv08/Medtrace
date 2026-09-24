import mongoose, { Schema, Document } from 'mongoose';

export type NurseTaskStatus =
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'completed';

export interface INurseTask extends Document {
  _id: mongoose.Types.ObjectId;
  patientId: mongoose.Types.ObjectId;
  assignedNurse: mongoose.Types.ObjectId;
  assignedBy: mongoose.Types.ObjectId;
  taskDescription: string;
  dueAt?: Date;
  status: NurseTaskStatus;
  approvedBy?: mongoose.Types.ObjectId;
  approvalNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const NurseTaskSchema: Schema = new Schema(
  {
    patientId: {
      type: Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
    },
    assignedNurse: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    assignedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    taskDescription: {
      type: String,
      required: true,
      trim: true,
    },
    dueAt: {
      type: Date,
    },
    status: {
      type: String,
      enum: ['pending_approval', 'approved', 'rejected', 'completed'],
      default: 'pending_approval',
    },
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    approvalNotes: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

NurseTaskSchema.index({ assignedNurse: 1, status: 1 });

export const NurseTask = mongoose.model<INurseTask>('NurseTask', NurseTaskSchema);