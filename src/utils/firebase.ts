import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  onSnapshot, 
  getDocFromServer,
  collection,
  query,
  where
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { UserStats, OnlineUserPresence } from '../types';

export function getTodayDateString(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// 1. Initialize Firebase
const app = initializeApp(firebaseConfig);

// CRITICAL: The app will break without this line
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// 2. Validate Connection to Firestore (Skill Mandatory Requirement)
export async function testConnection(): Promise<void> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

// 3. Structured Firestore Error Handling (Skill Mandatory Requirement)
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map((provider) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// 4. Google Authentication
const googleProvider = new GoogleAuthProvider();

export async function loginWithGoogle(): Promise<FirebaseUser | null> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error('Google Sign-in failed:', error);
    throw error;
  }
}

export async function logoutUser(): Promise<void> {
  try {
    if (auth.currentUser) {
      await setOnlineStatus(auth.currentUser.uid, false);
    }
    await signOut(auth);
  } catch (error) {
    console.error('Sign-out error:', error);
  }
}

// 5. Cloud Database Synchronization for User Stats
export async function syncUserStatsToFirestore(stats: UserStats, isNewUser = false): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) return;

  const targetPath = `users/${currentUser.uid}`;
  const now = new Date().toISOString();

  // Strip undefined/invalid values and conform to blueprint schema
  const payload: Record<string, unknown> = {
    userId: currentUser.uid,
    userName: stats.userName?.slice(0, 30) || currentUser.displayName?.slice(0, 30) || 'うおwりんご会員',
    avatarUrl: stats.avatarUrl || currentUser.photoURL || null,
    energy: Math.max(0, stats.energy ?? 10),
    streak: Math.max(0, stats.streak ?? 1),
    lastDailyDate: stats.lastDailyDate || null,
    completedSessions: Math.max(0, stats.completedSessions ?? 0),
    perfectSessions: Math.max(0, stats.perfectSessions ?? 0),
    rating: Math.max(0, stats.rating ?? 0),
    rankTier: stats.rankTier || 'bronze',
    equippedMainGoods: stats.equippedMainGoods === 'marker' ? 'marker' : 'pencil',
    equippedSubGoods: stats.equippedSubGoods === 'ruler' ? 'ruler' : stats.equippedSubGoods === 'hat' ? 'hat' : 'eraser',
    unlockedGoods: stats.unlockedGoods?.slice(0, 20) || ['pencil', 'eraser'],
    lastActive: Date.now(),
    isOnline: true,
    updatedAt: now,
  };

  if (isNewUser) {
    payload.createdAt = now;
  }

  try {
    const userDocRef = doc(db, 'users', currentUser.uid);
    const existing = await getDoc(userDocRef);
    if (!existing.exists()) {
      payload.createdAt = now;
      await setDoc(userDocRef, payload);
    } else {
      await updateDoc(userDocRef, payload);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, targetPath);
  }
}

export async function fetchUserStatsFromFirestore(userId: string): Promise<UserStats | null> {
  const targetPath = `users/${userId}`;
  try {
    const snap = await getDoc(doc(db, 'users', userId));
    if (!snap.exists()) return null;
    const data = snap.data();
    return {
      userId: data.userId,
      userName: data.userName,
      avatarUrl: data.avatarUrl || null,
      energy: data.energy ?? 10,
      streak: data.streak ?? 1,
      lastDailyDate: data.lastDailyDate || null,
      completedSessions: data.completedSessions ?? 0,
      perfectSessions: data.perfectSessions ?? 0,
      rating: data.rating ?? 0,
      rankTier: data.rankTier || 'bronze',
      equippedMainGoods: data.equippedMainGoods || 'pencil',
      equippedSubGoods: data.equippedSubGoods || 'eraser',
      unlockedGoods: data.unlockedGoods || ['pencil', 'eraser'],
      claimedBonusCodes: [],
      hasOpenedRewardModal: false,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, targetPath);
  }
}

export async function setOnlineStatus(userId: string, isOnline: boolean): Promise<void> {
  const targetPath = `users/${userId}`;
  try {
    const userDocRef = doc(db, 'users', userId);
    await updateDoc(userDocRef, {
      isOnline,
      lastActive: Date.now(),
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    // If doc doesn't exist yet, we log error cleanly with handleFirestoreError or warn
    console.warn(`Could not update online status for ${targetPath}:`, error);
  }
}

export function subscribeToUserStats(userId: string, callback: (stats: UserStats | null) => void): () => void {
  const targetPath = `users/${userId}`;
  return onSnapshot(
    doc(db, 'users', userId),
    (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        callback({
          userId: data.userId,
          userName: data.userName,
          avatarUrl: data.avatarUrl || null,
          energy: data.energy ?? 10,
          streak: data.streak ?? 1,
          lastDailyDate: data.lastDailyDate || null,
          completedSessions: data.completedSessions ?? 0,
          perfectSessions: data.perfectSessions ?? 0,
          rating: data.rating ?? 0,
          rankTier: data.rankTier || 'bronze',
          equippedMainGoods: data.equippedMainGoods || 'pencil',
          equippedSubGoods: data.equippedSubGoods || 'eraser',
          unlockedGoods: data.unlockedGoods || ['pencil', 'eraser'],
          claimedBonusCodes: [],
          hasOpenedRewardModal: false,
        });
      } else {
        callback(null);
      }
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, targetPath);
    }
  );
}

export function subscribeToOnlineUsers(callback: (users: Record<string, unknown>[]) => void): () => void {
  const targetPath = 'users';
  const q = query(collection(db, 'users'), where('isOnline', '==', true));
  return onSnapshot(
    q,
    (snapshot) => {
      const results: Record<string, unknown>[] = [];
      snapshot.forEach((docSnap) => {
        results.push(docSnap.data());
      });
      callback(results);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, targetPath);
    }
  );
}

// 6. Real-time Firebase Presence & Daily Login Tracking (No Google Login Required)
export interface FirebasePresenceRecord {
  userId: string;
  userName: string;
  avatarUrl: string | null;
  rating: number;
  rankTier: string;
  lastActive: number;
  lastLoginDate: string;
  isOnline: boolean;
  updatedAt: string;
}

export async function reportFirebasePresence(stats: UserStats, isOnline = true): Promise<void> {
  if (!stats.userId) return;
  const targetPath = `presence/${stats.userId}`;
  try {
    const presenceRef = doc(db, 'presence', stats.userId);
    const todayStr = getTodayDateString();
    const payload = {
      userId: stats.userId,
      userName: (stats.userName || 'うおwりんご会員').substring(0, 30),
      avatarUrl: stats.avatarUrl || null,
      rating: typeof stats.rating === 'number' ? stats.rating : 0,
      rankTier: stats.rankTier || 'bronze',
      lastActive: Date.now(),
      lastLoginDate: todayStr,
      isOnline,
      updatedAt: new Date().toISOString(),
    };
    await setDoc(presenceRef, payload, { merge: true });
  } catch (error) {
    console.warn(`[Firebase Presence] could not sync presence to ${targetPath}:`, error);
  }
}

export function subscribeToFirebasePresence(
  callback: (onlineUsers: OnlineUserPresence[], todayUsers: OnlineUserPresence[]) => void
): () => void {
  const targetPath = 'presence';
  try {
    const q = collection(db, 'presence');
    return onSnapshot(
      q,
      (snapshot) => {
        const now = Date.now();
        const todayStr = getTodayDateString();
        const onlineList: OnlineUserPresence[] = [];
        const todayList: OnlineUserPresence[] = [];

        snapshot.forEach((docSnap) => {
          const d = docSnap.data() as Partial<FirebasePresenceRecord>;
          if (!d.userId || !d.userName) return;

          const lastActive = typeof d.lastActive === 'number' ? d.lastActive : 0;
          // Online condition: isOnline flag is true AND active within the last 2 minutes
          const isOnlineNow = !!d.isOnline && (now - lastActive) < 120_000;
          // Today login condition: logged in on today's date or active within last 24 hours
          const isTodayLogin = d.lastLoginDate === todayStr || (now - lastActive) < 86_400_000;

          const item: OnlineUserPresence = {
            id: d.userId,
            name: d.userName,
            avatarUrl: d.avatarUrl || null,
            rating: typeof d.rating === 'number' ? d.rating : 0,
            rankTier: (d.rankTier as any) || 'bronze',
            lastActive,
            isOnline: isOnlineNow,
            lastLoginDate: d.lastLoginDate || todayStr,
            activity: isOnlineNow ? '学習受講中 ✏️' : '学習完了 ✨',
          };

          if (isOnlineNow) {
            onlineList.push(item);
          }
          if (isTodayLogin) {
            todayList.push(item);
          }
        });

        // Sort by last active descending
        onlineList.sort((a, b) => b.lastActive - a.lastActive);
        todayList.sort((a, b) => b.lastActive - a.lastActive);

        callback(onlineList, todayList);
      },
      (error) => {
        console.warn(`[Firebase Presence] subscription notice on ${targetPath}:`, error);
      }
    );
  } catch (error) {
    console.warn('[Firebase Presence] subscription failed:', error);
    return () => {};
  }
}

export { onAuthStateChanged };
export type { FirebaseUser };
