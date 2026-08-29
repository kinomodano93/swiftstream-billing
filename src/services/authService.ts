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
  isApproved?: boolean;
  status?: 'active' | 'pending_approval' | 'suspended';
  planId?: string;
  planName?: string;
  mobile?: string;
  address?: {
    street: string;
    barangay: string;
    landmark?: string;
  };
  createdAt: string;
  lastLoginAt: string;
}

const googleProvider = new GoogleAuthProvider();

/**
 * Sign In with Email and Password
 */
export const signInWithEmail = async (email: string, password: string): Promise<AppUserProfile> => {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const profile = await fetchOrCreateUserProfile(cred.user);

  // Check if subscriber application is still pending admin approval
  if (profile.role === 'subscriber' && (profile.status === 'pending_approval' || profile.isApproved === false)) {
    await signOut(auth);
    throw new Error('Your subscriber registration is currently under review by our Admin team. You will receive an SMS when your connection is approved.');
  }

  return profile;
};

/**
 * Sign Up / Register with Email, Password, Full Name, Role and Internet Plan
 */
export const signUpWithEmail = async (
  email: string,
  password: string,
  fullName: string,
  role: UserRole = 'admin',
  options?: {
    accountNo?: string;
    planId?: string;
    planName?: string;
    monthlyFee?: number;
    mobile?: string;
    address?: {
      street: string;
      barangay: string;
      landmark?: string;
    };
  }
): Promise<{ profile: AppUserProfile; isPendingApproval: boolean }> => {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  
  // Update display name in Firebase Auth
  await updateProfile(cred.user, { displayName: fullName });

  const isSubscriber = role === 'subscriber';
  const isApproved = !isSubscriber;

  // Store user role and metadata in Firestore
  const profile: AppUserProfile = {
    uid: cred.user.uid,
    email: cred.user.email,
    displayName: fullName,
    role,
    photoURL: cred.user.photoURL,
    accountNo: options?.accountNo,
    isApproved,
    status: isApproved ? 'active' : 'pending_approval',
    planId: options?.planId,
    planName: options?.planName,
    mobile: options?.mobile,
    address: options?.address,
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
  };

  try {
    const userDocRef = doc(db, 'system_users', cred.user.uid);
    await setDoc(userDocRef, profile, { merge: true });

    // If subscriber, also create customer record in customers collection with status 'pending_approval'
    if (isSubscriber) {
      const generatedAccountNo = options?.accountNo || `SWIFT-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;
      const customerDocRef = doc(db, 'customers', cred.user.uid);
      await setDoc(customerDocRef, {
        id: cred.user.uid,
        accountNo: generatedAccountNo,
        fullName,
        email,
        mobile: options?.mobile || '',
        address: {
          street: options?.address?.street || '',
          barangay: options?.address?.barangay || 'Binauahan',
          city: 'Lagonoy',
          province: 'Camarines Sur',
          landmark: options?.address?.landmark || '',
        },
        planId: options?.planId || 'plan-fib-35',
        planName: options?.planName || 'Fiber Power 35 Mbps',
        monthlyFee: options?.monthlyFee || 1299,
        billingDay: 15,
        status: 'pending_approval',
        installationDate: '',
        balance: 0,
        walletBalance: 0,
        advanceDeposit: 0,
        network: {
          pppoeUsername: email.split('@')[0],
          ipAddress: '192.168.10.1',
          napBoxId: '',
          napPortNumber: 0,
          isMikrotikSynced: false,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    }
  } catch (error) {
    console.warn('Firestore user profile write warning:', error);
  }

  // If subscriber, immediately sign out so they do not auto-login
  if (isSubscriber) {
    try {
      await signOut(auth);
    } catch {
      // ignore
    }
  }

  return { profile, isPendingApproval: isSubscriber };
};

/**
 * Sign In with Google Popup
 */
export const signInWithGoogle = async (): Promise<AppUserProfile> => {
  const cred = await signInWithPopup(auth, googleProvider);
  const profile = await fetchOrCreateUserProfile(cred.user);

  if (profile.role === 'subscriber' && (profile.status === 'pending_approval' || profile.isApproved === false)) {
    await signOut(auth);
    throw new Error('Your subscriber registration is currently under review by our Admin team. Please wait for approval.');
  }

  return profile;
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
      await setDoc(userDocRef, { lastLoginAt: new Date().toISOString() }, { merge: true });
      return data;
    }

    const isOwner = user.email?.includes('admin') || user.email?.includes('swiftstream') || false;
    const defaultProfile: AppUserProfile = {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName || user.email?.split('@')[0] || 'SwiftStream Staff',
      role: isOwner ? 'admin' : 'cashier',
      isApproved: true,
      status: 'active',
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
      isApproved: true,
      status: 'active',
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
      if (profile.role === 'subscriber' && (profile.status === 'pending_approval' || profile.isApproved === false)) {
        onUserChanged(null);
      } else {
        onUserChanged(profile);
      }
    } else {
      onUserChanged(null);
    }
  });
};
