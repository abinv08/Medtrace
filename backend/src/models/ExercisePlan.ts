import mongoose, { Schema, Document } from 'mongoose';

export interface IExerciseItem {
  name: string;
  sets?: number;
  reps?: number;
  notes?: string;
}

export interface IExerciseProgressLog {
  date: Date;
  completed: boolean;
  notes?: string;
}

export interface IExercisePlan extends Document {
  _id: mongoose.Types.ObjectId;
  patientId: mongoose.Types.ObjectId;
  exercises: IExerciseItem[];
  frequency?: string;
  assignedBy?: mongoose.Types.ObjectId;
  progressLog: IExerciseProgressLog[];
  createdAt: Date;
  updatedAt: Date;
}

const ExerciseItemSchema: Schema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    sets: { type: Number },
    reps: { type: Number },
    notes: { type: String, trim: true },
  },
  { _id: false }
);

const ExerciseProgressLogSchema: Schema = new Schema(
  {
    date: { type: Date, required: true, default: Date.now },
    completed: { type: Boolean, required: true, default: false },
    notes: { type: String, trim: true },
  },
  { _id: false }
);

const ExercisePlanSchema: Schema = new Schema(
  {
    patientId: {
      type: Schema.Types.ObjectId,
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
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    progressLog: [ExerciseProgressLogSchema],
  },
  {
    timestamps: true,
  }
);

export const ExercisePlan = mongoose.model<IExercisePlan>('ExercisePlan', ExercisePlanSchema);
