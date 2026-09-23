"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPatientMessages = exports.sendMessage = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const Message_1 = require("../models/Message");
const sendMessage = async (req, res) => {
    try {
        const { patientId, senderId, recipientId, content } = req.body;
        const resolvedSenderId = senderId || req.user?.id;
        if (!patientId || !resolvedSenderId || !recipientId || !content?.trim()) {
            res.status(400).json({ success: false, message: 'patientId, senderId, recipientId, and content are required' });
            return;
        }
        if (![patientId, resolvedSenderId, recipientId].every((id) => mongoose_1.default.isValidObjectId(id))) {
            res.status(400).json({ success: false, message: 'Message identifiers must be MongoDB ObjectIds' });
            return;
        }
        const message = await Message_1.Message.create({ patientId, senderId: resolvedSenderId, recipientId, content: content.trim() });
        res.status(201).json({ success: true, message });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Error sending message', error: error.message });
    }
};
exports.sendMessage = sendMessage;
const getPatientMessages = async (req, res) => {
    try {
        const { patientId } = req.params;
        if (!mongoose_1.default.isValidObjectId(patientId)) {
            res.status(400).json({ success: false, message: 'patientId must be a MongoDB ObjectId' });
            return;
        }
        const messages = await Message_1.Message.find({ patientId }).sort({ createdAt: 1 });
        res.status(200).json({ success: true, count: messages.length, messages });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Error retrieving messages', error: error.message });
    }
};
exports.getPatientMessages = getPatientMessages;
