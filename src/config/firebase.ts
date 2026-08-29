import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  initializeFirestore,
  getFirestore,
  Firestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  doc,
  getDoc,
  setDoc,
} from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';
import { getStorage, FirebaseStorage } from 'firebase/storage';

export const firebaseConfig = {
  apiKey: "AIzaSyA098ugdgGoFJuWipYPJ368dBITZHWD4zI",
  authDomain: "swiftstream-portal.firebaseapp.com",
  projectId: "swiftstream-portal",
  storageBucket: "swiftstream-portal.firebasestorage.app",
  messagingSenderId: "104878342051",
  appId: "1:104878342051:web:b1c499cb7408ee13dc2416"
};

let app: FirebaseApp;
let db: Firestore;
let auth: Auth;
let storage: FirebaseStorage;

try {
  if (!getApps().length) {
    app = initializeApp(firebaseConfig);
    // Initialize Firestore with robust multi-tab offline persistence
    try {
      db = initializeFirestore(app, {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager(),
        }),
      });
    } catch {
      db = getFirestore(app);
    }
  } else {
    app = getApp();
    db = getFirestore(app);
  }

  auth = getAuth(app);
  storage = getStorage(app);
} catch (error) {
  console.warn('Firebase initialization warning:', error);
  app = {} as FirebaseApp;
  db = {} as Firestore;
  auth = {} as Auth;
  storage = {} as FirebaseStorage;
}

export { app, db, auth, storage };

export interface FirebaseConnectionTestResult {
  success: boolean;
  message: string;
  latencyMs?: number;
  projectId: string;
}

/**
 * Tests live connection to Cloud Firestore
 */
export const testFirebaseConnection = async (): Promise<FirebaseConnectionTestResult> => {
  const startTime = Date.now();
  try {
    const testDocRef = doc(db, '_system_health', 'handshake');
    await setDoc(testDocRef, {
      lastChecked: new Date().toISOString(),
      system: 'SwiftStream ISP Billing',
      status: 'online',
    }, { merge: true });

    const snap = await getDoc(testDocRef);
    const latencyMs = Date.now() - startTime;

    if (snap.exists()) {
      return {
        success: true,
        message: `Successfully connected to Cloud Firestore (Database: ${firebaseConfig.projectId})`,
        latencyMs,
        projectId: firebaseConfig.projectId,
      };
    } else {
      return {
        success: false,
        message: 'Could not verify test document in Cloud Firestore.',
        latencyMs,
        projectId: firebaseConfig.projectId,
      };
    }
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'Failed to establish Cloud Firestore connection. Check internet or security rules.',
      latencyMs: Date.now() - startTime,
      projectId: firebaseConfig.projectId,
    };
  }
};

