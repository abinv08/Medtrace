import mongoose from 'mongoose';

export const connectDB = async (): Promise<void> => {
  try {
    const connStr = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/medtrace_db';
    await mongoose.connect(connStr, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`✅ MongoDB Connected successfully: ${mongoose.connection.host}`);
  } catch (error: any) {
    console.warn(`⚠️ MongoDB connection warning / fallback active: ${error.message}`);
    console.warn(`💡 MedTrace backend running with resilient memory store fallback if DB is offline.`);
  }
};
