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

export type UserRole = 'admin' | 'tech' | 'subscriber';

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

// Default Pre-Authorized Administrator Emails (Can be updated in Settings)
export const DEFAULT_AUTHORIZED_ADMIN_EMAILS = [
  'swiftstream.telecom@gmail.com',
  'admin@swiftstream.ph',
];

/**
 * Fetches pre-authorized admin emails from Firestore / LocalStorage
 */
export const getAuthorizedAdminEmails = async (): Promise<string[]> => {
  try {
    const configDoc = doc(db, 'system_config', 'auth_whitelist');
    const snap = await getDoc(configDoc);
    if (snap.exists() && Array.isArray(snap.data()?.emails)) {
      return snap.data().emails;
    }
  } catch (err) {
    console.warn('Could not load remote admin whitelist, using local defaults:', err);
  }

  const stored = localStorage.getItem('swiftstream_authorized_admin_emails');
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      // ignore
    }
  }

  return DEFAULT_AUTHORIZED_ADMIN_EMAILS;
};

/**
 * Saves authorized admin emails to Firestore and LocalStorage
 */
export const saveAuthorizedAdminEmails = async (emails: string[]): Promise<void> => {
  localStorage.setItem('swiftstream_authorized_admin_emails', JSON.stringify(emails));
  try {
    const configDoc = doc(db, 'system_config', 'auth_whitelist');
    await setDoc(
      configDoc,
      {
        emails,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('Could not write remote admin whitelist:', err);
  }
};

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
  role: UserRole = 'subscriber',
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
 * Sign In with Google Popup (Protected with Pre-Authorized Admin Whitelist)
 */
export const signInWithGoogle = async (): Promise<AppUserProfile> => {
  const cred = await signInWithPopup(auth, googleProvider);
  const user = cred.user;
  const userEmail = (user.email || '').toLowerCase().trim();

  const authorizedAdmins = (await getAuthorizedAdminEmails()).map((e) => e.toLowerCase().trim());
  const isAuthorizedAdmin = authorizedAdmins.includes(userEmail);

  // Check if profile exists in Firestore system_users
  const userDocRef = doc(db, 'system_users', user.uid);
  const snap = await getDoc(userDocRef);

  if (snap.exists()) {
    const data = snap.data() as AppUserProfile;

    // If Admin/Staff: verify whitelist authorization
    if (data.role === 'admin' || data.role === 'tech') {
      if (!isAuthorizedAdmin && data.isApproved === false) {
        await signOut(auth);
        throw new Error(`Access Restricted: The Google account "${userEmail}" is not pre-authorized for SwiftStream Admin access.`);
      }
      await setDoc(userDocRef, { lastLoginAt: new Date().toISOString() }, { merge: true });
      return data;
    }

    // If Subscriber: check approval status
    if (data.role === 'subscriber') {
      if (data.status === 'pending_approval' || data.isApproved === false) {
        await signOut(auth);
        throw new Error('Your subscriber registration is currently under review by our Admin team. Please wait for approval.');
      }
      await setDoc(userDocRef, { lastLoginAt: new Date().toISOString() }, { merge: true });
      return data;
    }
  }

  // If newly signing in via Google and email is in the Authorized Admin Whitelist:
  if (isAuthorizedAdmin) {
    const adminProfile: AppUserProfile = {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName || userEmail.split('@')[0],
      role: 'admin',
      isApproved: true,
      status: 'active',
      photoURL: user.photoURL,
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    };

    try {
      await setDoc(userDocRef, adminProfile, { merge: true });
    } catch (err) {
      console.warn('Could not save admin profile to Firestore:', err);
    }

    return adminProfile;
  }

  // Check if user is an existing customer in customers collection
  try {
    const customerDocRef = doc(db, 'customers', user.uid);
    const custSnap = await getDoc(customerDocRef);
    if (custSnap.exists()) {
      const custData = custSnap.data();
      if (custData.status === 'pending_approval') {
        await signOut(auth);
        throw new Error('Your connection application is currently under review by our Admin team.');
      }
      const subscriberProfile: AppUserProfile = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || custData.fullName,
        role: 'subscriber',
        accountNo: custData.accountNo,
        isApproved: true,
        status: 'active',
        photoURL: user.photoURL,
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
      };
      await setDoc(userDocRef, subscriberProfile, { merge: true });
      return subscriberProfile;
    }
  } catch {
    // ignore
  }

  // Not an authorized admin & not an approved subscriber -> BLOCK SSO ACCESS
  await signOut(auth);
  throw new Error(`Access Denied: The Google account "${userEmail}" is not pre-authorized for SwiftStream SSO access. Only pre-authorized Administrator Gmail accounts are permitted.`);
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

    const userEmail = (user.email || '').toLowerCase().trim();
    const authorizedAdmins = (await getAuthorizedAdminEmails()).map((e) => e.toLowerCase().trim());
    const isOwner = authorizedAdmins.includes(userEmail) || userEmail.includes('admin');

    const defaultProfile: AppUserProfile = {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName || user.email?.split('@')[0] || 'SwiftStream Staff',
      role: 'admin',
      isApproved: isOwner,
      status: isOwner ? 'active' : 'pending_approval',
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
      try {
        const profile = await fetchOrCreateUserProfile(user);
        if (profile.role === 'subscriber' && (profile.status === 'pending_approval' || profile.isApproved === false)) {
          onUserChanged(null);
        } else {
          onUserChanged(profile);
        }
      } catch {
        onUserChanged(null);
      }
    } else {
      onUserChanged(null);
    }
  });
};
