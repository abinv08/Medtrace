import { Response } from 'express';
import mongoose from 'mongoose';
import { Message } from '../models/Message';
import { AuthenticatedRequest } from '../middleware/authMiddleware';

export const sendMessage = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { patientId, senderId, recipientId, content } = req.body;
    const resolvedSenderId = senderId || req.user?.id;
    if (!patientId || !resolvedSenderId || !recipientId || !content?.trim()) {
      res.status(400).json({ success: false, message: 'patientId, senderId, recipientId, and content are required' });
      return;
    }
    if (![patientId, resolvedSenderId, recipientId].every((id) => mongoose.isValidObjectId(id))) {
      res.status(400).json({ success: false, message: 'Message identifiers must be MongoDB ObjectIds' });
      return;
    }
    const message = await Message.create({ patientId, senderId: resolvedSenderId, recipientId, content: content.trim() });
    res.status(201).json({ success: true, message });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Error sending message', error: error.message });
  }
};

export const getPatientMessages = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { patientId } = req.params;
    if (!mongoose.isValidObjectId(patientId)) {
      res.status(400).json({ success: false, message: 'patientId must be a MongoDB ObjectId' });
      return;
    }
    const messages = await Message.find({ patientId }).sort({ createdAt: 1 });
    res.status(200).json({ success: true, count: messages.length, messages });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Error retrieving messages', error: error.message });
  }
};
