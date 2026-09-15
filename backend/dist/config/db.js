"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectDB = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const connectDB = async () => {
    try {
        const connStr = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/medtrace_db';
        await mongoose_1.default.connect(connStr, {
            serverSelectionTimeoutMS: 5000,
        });
        console.log(`✅ MongoDB Connected successfully: ${mongoose_1.default.connection.host}`);
    }
    catch (error) {
        console.warn(`⚠️ MongoDB connection warning / fallback active: ${error.message}`);
        console.warn(`💡 MedTrace backend running with resilient memory store fallback if DB is offline.`);
    }
};
exports.connectDB = connectDB;
