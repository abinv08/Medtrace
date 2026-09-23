import mongoose, { Schema, Document } from 'mongoose';

export interface IClinicalNote extends Document {
  _id: mongoose.Types.ObjectId;
  patientId: mongoose.Types.ObjectId;
  doctorId: mongoose.Types.ObjectId;
  appointmentId?: mongoose.Types.ObjectId;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

const ClinicalNoteSchema: Schema = new Schema(
  {
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    doctorId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    appointmentId: { type: Schema.Types.ObjectId, ref: 'Appointment' },
    content: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

export const ClinicalNote = mongoose.model<IClinicalNote>('ClinicalNote', ClinicalNoteSchema);
