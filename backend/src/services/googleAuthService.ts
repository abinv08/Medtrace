import { OAuth2Client } from 'google-auth-library';

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export interface GooglePayload {
  googleId: string;
  email: string;
  name: string;
  picture?: string;
}

export const verifyGoogleIdToken = async (idToken: string): Promise<GooglePayload | null> => {
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
  } catch (error) {
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
