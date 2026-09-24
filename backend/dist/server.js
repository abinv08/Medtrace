"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const db_1 = require("./config/db");
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const patientRoutes_1 = __importDefault(require("./routes/patientRoutes"));
const vitalsRoutes_1 = __importDefault(require("./routes/vitalsRoutes"));
const medicationRoutes_1 = __importDefault(require("./routes/medicationRoutes"));
const appointmentRoutes_1 = __importDefault(require("./routes/appointmentRoutes"));
const testResultRoutes_1 = __importDefault(require("./routes/testResultRoutes"));
const caretakerRoutes_1 = __importDefault(require("./routes/caretakerRoutes"));
const adminRoutes_1 = __importDefault(require("./routes/adminRoutes"));
const exercisePlanRoutes_1 = __importDefault(require("./routes/exercisePlanRoutes"));
const clinicalNoteRoutes_1 = __importDefault(require("./routes/clinicalNoteRoutes"));
const messageRoutes_1 = __importDefault(require("./routes/messageRoutes"));
const nurseAssignmentRoutes_1 = __importDefault(require("./routes/nurseAssignmentRoutes"));
const nurseTaskRoutes_1 = __importDefault(require("./routes/nurseTaskRoutes"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
// Allow the React dev server and Flutter web's changing local dev ports.
app.use((0, cors_1.default)({
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
}));
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// Routes
app.use('/api/auth', authRoutes_1.default);
app.use('/api/patients', patientRoutes_1.default);
app.use('/api/vitals', vitalsRoutes_1.default);
app.use('/api/medications', medicationRoutes_1.default);
app.use('/api/appointments', appointmentRoutes_1.default);
app.use('/api/test-results', testResultRoutes_1.default);
app.use('/api/caretaker', caretakerRoutes_1.default);
app.use('/api/admin', adminRoutes_1.default);
app.use('/api/exercise-plans', exercisePlanRoutes_1.default);
app.use('/api/clinical-notes', clinicalNoteRoutes_1.default);
app.use('/api/messages', messageRoutes_1.default);
app.use('/api/nurse-assignments', nurseAssignmentRoutes_1.default);
app.use('/api/nurse-tasks', nurseTaskRoutes_1.default);
// System Health Endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        service: 'MedTrace AI Clinical Intelligence Auth API',
        timestamp: new Date().toISOString(),
    });
});
// Start DB connection & Express Listener
(0, db_1.connectDB)().then(() => {
    app.listen(PORT, () => {
        console.log(`🚀 MedTrace Auth Central Backend running on port ${PORT}`);
        console.log(`🔗 Health Check: http://localhost:${PORT}/api/health`);
        console.log(`🔗 API Base: http://localhost:${PORT}/api/auth`);
    });
});
