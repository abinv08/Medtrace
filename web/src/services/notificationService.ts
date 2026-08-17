import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { getTimestampMillis } from './doctorService';

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  category: 'medication' | 'appointment' | 'anomaly' | 'test_result' | 'doctor_approval' | 'general';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  read: boolean;
  link?: string;
  createdAt: any;
}

// In-memory / local fallback notifications for instant preview
const MOCK_NOTIFICATIONS: Record<string, AppNotification[]> = {
  default: [
    {
      id: 'notif-1',
      userId: 'default',
      title: 'Medication Due: Metformin 500mg',
      message: 'It is time for your afternoon dose with a meal.',
      category: 'medication',
      priority: 'high',
      read: false,
      createdAt: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
    },
    {
      id: 'notif-2',
      userId: 'default',
      title: 'Lab Test Ready: Comprehensive Metabolic Panel',
      message: 'Your recent blood work has been uploaded and analyzed.',
      category: 'test_result',
      priority: 'normal',
      read: false,
      createdAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    },
    {
      id: 'notif-3',
      userId: 'default',
      title: 'Upcoming Appointment: Dr. Alexander Wright',
      message: 'Cardiology follow-up scheduled for tomorrow at 10:30 AM.',
      category: 'appointment',
      priority: 'normal',
      read: true,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    },
    {
      id: 'notif-4',
      userId: 'default',
      title: 'Vitals Notice: Mild Systolic Elevation',
      message: 'Your resting blood pressure was 138/88 mmHg. Keep monitoring daily.',
      category: 'anomaly',
      priority: 'high',
      read: false,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    },
  ],
};

export const fetchUserNotifications = async (userId: string): Promise<AppNotification[]> => {
  try {
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId)
    );
    const snap = await getDocs(q);
    if (snap.empty) {
      // Return user specific mock or default
      return (MOCK_NOTIFICATIONS[userId] || MOCK_NOTIFICATIONS.default).map((n) => ({
        ...n,
        userId,
      }));
    }
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as AppNotification));
    return items.sort((a, b) => getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt));
  } catch (err) {
    console.warn('fetchUserNotifications fallback to mock data:', err);
    return (MOCK_NOTIFICATIONS[userId] || MOCK_NOTIFICATIONS.default).map((n) => ({
      ...n,
      userId,
    }));
  }
};

export const markNotificationRead = async (notificationId: string): Promise<void> => {
  try {
    await updateDoc(doc(db, 'notifications', notificationId), {
      read: true,
      updatedAt: serverTimestamp(),
    });
  } catch {
    // Update locally
    Object.keys(MOCK_NOTIFICATIONS).forEach((key) => {
      const target = MOCK_NOTIFICATIONS[key].find((n) => n.id === notificationId);
      if (target) target.read = true;
    });
  }
};

export const markAllNotificationsRead = async (userId: string): Promise<void> => {
  try {
    const notifications = await fetchUserNotifications(userId);
    await Promise.all(
      notifications.filter((n) => !n.read).map((n) => markNotificationRead(n.id))
    );
  } catch {
    if (MOCK_NOTIFICATIONS[userId]) {
      MOCK_NOTIFICATIONS[userId].forEach((n) => (n.read = true));
    }
    MOCK_NOTIFICATIONS.default.forEach((n) => (n.read = true));
  }
};

export const createNotification = async (
  notification: Omit<AppNotification, 'id' | 'createdAt' | 'read'>
): Promise<AppNotification> => {
  const notifId = `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const newNotif: AppNotification = {
    ...notification,
    id: notifId,
    read: false,
    createdAt: new Date().toISOString(),
  };

  try {
    await setDoc(doc(db, 'notifications', notifId), {
      ...newNotif,
      createdAt: serverTimestamp(),
    });
  } catch {
    if (!MOCK_NOTIFICATIONS[notification.userId]) {
      MOCK_NOTIFICATIONS[notification.userId] = [];
    }
    MOCK_NOTIFICATIONS[notification.userId].unshift(newNotif);
  }

  return newNotif;
};
