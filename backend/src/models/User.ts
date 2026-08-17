import mongoose, { Schema, Document } from 'mongoose';

export type UserRole =
  | 'Doctor'
  | 'Nurse'
  | 'Patient'
  | 'Caregiver'
  | 'Guardian'
  | 'Hospital Administrator';

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  email: string;
  phone: string;
  hospitalName: string;
  department: string;
  professionalId?: string;
  password?: string;
  role: UserRole;
  googleId?: string;
  refreshToken?: string;
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema: Schema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, required: true, trim: true },
    hospitalName: { type: String, required: true, trim: true },
    department: { type: String, required: true, trim: true },
    professionalId: { type: String, trim: true, default: '' },
    password: { type: String, required: false },
    role: {
      type: String,
      required: true,
      enum: [
        'Doctor',
        'Nurse',
        'Patient',
        'Caregiver',
        'Guardian',
        'Hospital Administrator',
      ],
      default: 'Doctor',
    },
    googleId: { type: String, default: null },
    refreshToken: { type: String, default: null },
    resetPasswordToken: { type: String, default: null },
    resetPasswordExpires: { type: Date, default: null },
  },
  {
    timestamps: true,
  }
);

export const User = mongoose.model<IUser>('User', UserSchema);
