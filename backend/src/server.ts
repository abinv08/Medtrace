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
import clinicalNoteRoutes from './routes/clinicalNoteRoutes';
import messageRoutes from './routes/messageRoutes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Allow the React dev server and Flutter web's changing local dev ports.
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      const configuredOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:3000')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
      const isLocalDevelopmentOrigin = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

      if (configuredOrigins.includes(origin) || isLocalDevelopmentOrigin) {
        callback(null, true);
        return;
      }

      callback(new Error('Origin not allowed by CORS'));
    },
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
app.use('/api/clinical-notes', clinicalNoteRoutes);
app.use('/api/messages', messageRoutes);

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
