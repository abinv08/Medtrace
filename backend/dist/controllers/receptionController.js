"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateReceptionStaffStatus = exports.getReceptionStaff = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const User_1 = require("../models/User");
const staffRoles = ['Doctor', 'Nurse', 'Head Nurse'];
const getReceptionStaff = async (req, res) => {
    try {
        const staff = await User_1.User.find({ role: { $in: staffRoles } })
            .select('-password -resetPasswordToken -refreshToken')
            .sort({ role: 1, name: 1 });
        res.status(200).json({ success: true, staff });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Error retrieving clinical staff', error: error.message });
    }
};
exports.getReceptionStaff = getReceptionStaff;
const updateReceptionStaffStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { isActive } = req.body;
        if (!mongoose_1.default.isValidObjectId(id)) {
            res.status(400).json({ success: false, message: 'Invalid user ID format' });
            return;
        }
        if (typeof isActive !== 'boolean') {
            res.status(400).json({ success: false, message: 'isActive must be a boolean' });
            return;
        }
        const staff = await User_1.User.findOneAndUpdate({ _id: id, role: { $in: staffRoles } }, { isActive }, { new: true }).select('-password -resetPasswordToken -refreshToken');
        if (!staff) {
            res.status(404).json({ success: false, message: 'Doctor or nurse not found' });
            return;
        }
        res.status(200).json({ success: true, message: `${staff.name} is now ${isActive ? 'active' : 'inactive'}`, staff });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Error updating clinical staff status', error: error.message });
    }
};
exports.updateReceptionStaffStatus = updateReceptionStaffStatus;
