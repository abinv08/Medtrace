import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './config/db';
import authRoutes from './routes/authRoutes';
import patientRoutes from './routes/patientRoutes';
import vitalsRoutes from './routes/vitalsRoutes';
import medicationRoutes from './routes/medicationRoutes';
import appointmentRoutes from './routes/appointmentRoutes';
import testResultRoutes from './routes/testResultRoutes';
import caretakerRoutes from './routes/caretakerRoutes';
import adminRoutes from './routes/adminRoutes';
import exercisePlanRoutes from './routes/exercisePlanRoutes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// CORS configuration for React Web & mobile clients
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || 'http://localhost:3000',
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/vitals', vitalsRoutes);
app.use('/api/medications', medicationRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/test-results', testResultRoutes);
app.use('/api/caretaker', caretakerRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/exercise-plans', exercisePlanRoutes);

// System Health Endpoint
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'OK',
    service: 'MedTrace AI Clinical Intelligence Auth API',
    timestamp: new Date().toISOString(),
  });
});

// Start DB connection & Express Listener
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 MedTrace Auth Central Backend running on port ${PORT}`);
    console.log(`🔗 Health Check: http://localhost:${PORT}/api/health`);
    console.log(`🔗 API Base: http://localhost:${PORT}/api/auth`);
  });
});
