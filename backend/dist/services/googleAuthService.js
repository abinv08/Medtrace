"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyGoogleIdToken = void 0;
const google_auth_library_1 = require("google-auth-library");
const client = new google_auth_library_1.OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const verifyGoogleIdToken = async (idToken) => {
    try {
        const ticket = await client.verifyIdToken({
            idToken,
            audience: process.env.GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        if (!payload || !payload.email) {
            return null;
        }
        return {
            googleId: payload.sub,
            email: payload.email,
            name: payload.name || payload.email.split('@')[0],
            picture: payload.picture,
        };
    }
    catch (error) {
        console.warn('[Google Auth Service] Token verification failed or demo token used:', error);
        // Return mock verified google user for demo tokens / dev testing
        if (idToken.startsWith('demo-google-token-')) {
            return {
                googleId: 'google-user-123456789',
                email: 'doctor.demo@medtrace.ai',
                name: 'Dr. Sarah Jenkins',
            };
        }
        return null;
    }
};
exports.verifyGoogleIdToken = verifyGoogleIdToken;
