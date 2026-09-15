import mongoose, { Schema, Document } from 'mongoose';

export type CaretakerAssignmentStatus = 'active' | 'pending' | 'revoked';

export interface ICaretakerAssignment extends Document {
  _id: mongoose.Types.ObjectId;
  caretakerId: mongoose.Types.ObjectId;
  patientId: mongoose.Types.ObjectId;
  relationship?: string;
  permissions: string[];
  status: CaretakerAssignmentStatus;
  createdAt: Date;
  updatedAt: Date;
}

const CaretakerAssignmentSchema: Schema = new Schema(
  {
    caretakerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    patientId: {
      type: Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
    },
    relationship: {
      type: String,
      trim: true,
    },
    permissions: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: ['active', 'pending', 'revoked'],
      default: 'pending',
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index ensuring a caretaker cannot be assigned multiple times to the same patient
CaretakerAssignmentSchema.index({ caretakerId: 1, patientId: 1 }, { unique: true });

export const CaretakerAssignment = mongoose.model<ICaretakerAssignment>(
  'CaretakerAssignment',
  CaretakerAssignmentSchema
);
