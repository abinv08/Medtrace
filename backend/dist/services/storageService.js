"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.storageService = exports.LocalStorageService = exports.UPLOADS_DIR = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
// Upload directory (backend/uploads)
exports.UPLOADS_DIR = path_1.default.resolve(__dirname, '../../uploads');
// Ensure directory exists
if (!fs_1.default.existsSync(exports.UPLOADS_DIR)) {
    fs_1.default.mkdirSync(exports.UPLOADS_DIR, { recursive: true });
}
class LocalStorageService {
    getFilePath(fileIdentifier) {
        const filename = path_1.default.basename(fileIdentifier);
        return path_1.default.join(exports.UPLOADS_DIR, filename);
    }
    fileExists(fileIdentifier) {
        const filePath = this.getFilePath(fileIdentifier);
        return fs_1.default.existsSync(filePath);
    }
    async deleteFile(fileIdentifier) {
        const filePath = this.getFilePath(fileIdentifier);
        if (fs_1.default.existsSync(filePath)) {
            await fs_1.default.promises.unlink(filePath);
        }
    }
}
exports.LocalStorageService = LocalStorageService;
exports.storageService = new LocalStorageService();
