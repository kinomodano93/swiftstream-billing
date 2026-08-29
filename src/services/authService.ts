import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

export type UserRole = 'admin' | 'cashier' | 'tech' | 'subscriber';

export interface AppUserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  role: UserRole;
  photoURL?: string | null;
  accountNo?: string;
  createdAt: string;
  lastLoginAt: string;
}

const googleProvider = new GoogleAuthProvider();

/**
 * Sign In with Email and Password
 */
export const signInWithEmail = async (email: string, password: string): Promise<AppUserProfile> => {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return await fetchOrCreateUserProfile(cred.user);
};

/**
 * Sign Up / Register with Email, Password, Full Name and Role
 */
export const signUpWithEmail = async (
  email: string,
  password: string,
  fullName: string,
  role: UserRole = 'admin',
  accountNo?: string
): Promise<AppUserProfile> => {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  
  // Update display name in Firebase Auth
  await updateProfile(cred.user, { displayName: fullName });

  // Store user role and metadata in Firestore
  const profile: AppUserProfile = {
    uid: cred.user.uid,
    email: cred.user.email,
    displayName: fullName,
    role,
    photoURL: cred.user.photoURL,
    accountNo,
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
  };

  try {
    const userDocRef = doc(db, 'system_users', cred.user.uid);
    await setDoc(userDocRef, profile, { merge: true });
  } catch (error) {
    console.warn('Firestore user profile write warning:', error);
  }

  return profile;
};

/**
 * Sign In with Google Popup
 */
export const signInWithGoogle = async (): Promise<AppUserProfile> => {
  const cred = await signInWithPopup(auth, googleProvider);
  return await fetchOrCreateUserProfile(cred.user);
};

/**
 * Sign Out from Firebase
 */
export const signOutUser = async (): Promise<void> => {
  await signOut(auth);
};

/**
 * Send Password Reset Email
 */
export const resetUserPassword = async (email: string): Promise<void> => {
  await sendPasswordResetEmail(auth, email);
};

/**
 * Fetches user profile from Firestore or creates a default one
 */
export const fetchOrCreateUserProfile = async (user: User): Promise<AppUserProfile> => {
  try {
    const userDocRef = doc(db, 'system_users', user.uid);
    const snap = await getDoc(userDocRef);

    if (snap.exists()) {
      const data = snap.data() as AppUserProfile;
      // Update last login
      await setDoc(userDocRef, { lastLoginAt: new Date().toISOString() }, { merge: true });
      return data;
    }

    // Default admin if first user or email matches admin pattern
    const isOwner = user.email?.includes('admin') || user.email?.includes('swiftstream') || false;
    const defaultProfile: AppUserProfile = {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName || user.email?.split('@')[0] || 'SwiftStream Staff',
      role: isOwner ? 'admin' : 'cashier',
      photoURL: user.photoURL,
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    };

    await setDoc(userDocRef, defaultProfile, { merge: true });
    return defaultProfile;
  } catch (err) {
    console.warn('Could not retrieve remote user profile, using fallback:', err);
    return {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName || user.email?.split('@')[0] || 'Staff User',
      role: 'admin',
      photoURL: user.photoURL,
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    };
  }
};

/**
 * Listener for Firebase Auth state changes
 */
export const subscribeToAuth = (
  onUserChanged: (profile: AppUserProfile | null) => void
) => {
  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      const profile = await fetchOrCreateUserProfile(user);
      onUserChanged(profile);
    } else {
      onUserChanged(null);
    }
  });
};

