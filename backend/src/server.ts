import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './config/db';
import authRoutes from './routes/authRoutes';

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

// Auth Routes
app.use('/api/auth', authRoutes);

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
