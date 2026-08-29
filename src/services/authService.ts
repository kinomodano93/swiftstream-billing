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
import { doc, setDoc, getDoc, query, where, getDocs, collection } from 'firebase/firestore';
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
  monthlyFee?: number;
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
    installationDate?: string;
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
 * Syncs a customer's approval/activation directly to their system_users profile
 */
export const syncCustomerApprovalToUser = async (
  emailOrUid: string,
  customerData?: { accountNo?: string; fullName?: string; planName?: string; planId?: string; mobile?: string }
): Promise<void> => {
  try {
    // 1. Direct UID lookup in system_users
    const userDocRef = doc(db, 'system_users', emailOrUid);
    const userSnap = await getDoc(userDocRef);
    if (userSnap.exists()) {
      await setDoc(
        userDocRef,
        {
          isApproved: true,
          status: 'active',
          accountNo: customerData?.accountNo || userSnap.data()?.accountNo,
          displayName: customerData?.fullName || userSnap.data()?.displayName,
          planId: customerData?.planId || userSnap.data()?.planId,
          planName: customerData?.planName || userSnap.data()?.planName,
          mobile: customerData?.mobile || userSnap.data()?.mobile,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
      return;
    }

    // 2. Lookup by email if emailOrUid is an email address
    if (emailOrUid && emailOrUid.includes('@')) {
      const q = query(collection(db, 'system_users'), where('email', '==', emailOrUid.toLowerCase().trim()));
      const qSnap = await getDocs(q);
      for (const docSnap of qSnap.docs) {
        await setDoc(
          doc(db, 'system_users', docSnap.id),
          {
            isApproved: true,
            status: 'active',
            accountNo: customerData?.accountNo || docSnap.data()?.accountNo,
            displayName: customerData?.fullName || docSnap.data()?.displayName,
            planId: customerData?.planId || docSnap.data()?.planId,
            planName: customerData?.planName || docSnap.data()?.planName,
            mobile: customerData?.mobile || docSnap.data()?.mobile,
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      }
    }
  } catch (err) {
    console.warn('Could not sync customer approval to system_users:', err);
  }
};

/**
 * Fetches user profile from Firestore or creates a default one
 */
export const fetchOrCreateUserProfile = async (user: User): Promise<AppUserProfile> => {
  try {
    const userDocRef = doc(db, 'system_users', user.uid);
    const snap = await getDoc(userDocRef);

    if (snap.exists()) {
      let data = snap.data() as AppUserProfile;

      // If user is a subscriber, verify whether Admin has already approved or activated their customer record
      if (data.role === 'subscriber') {
        let matchedCustomer: any = null;

        // 1. Check customers collection by UID
        try {
          const custSnap = await getDoc(doc(db, 'customers', user.uid));
          if (custSnap.exists()) {
            matchedCustomer = custSnap.data();
          }
        } catch {
          // ignore
        }

        // 2. If not found by UID, check customers collection by email
        if (!matchedCustomer && user.email) {
          try {
            const custQuery = query(collection(db, 'customers'), where('email', '==', user.email.trim()));
            const qSnap = await getDocs(custQuery);
            if (!qSnap.empty) {
              matchedCustomer = qSnap.docs[0].data();
            }
          } catch {
            // ignore
          }
        }

        // 3. Fallback: check local storage customers
        if (!matchedCustomer && user.email) {
          try {
            const localCusts = JSON.parse(localStorage.getItem('swiftstream_customers') || '[]');
            matchedCustomer = localCusts.find(
              (c: any) =>
                c.id === user.uid ||
                (c.email && c.email.toLowerCase() === user.email?.toLowerCase()) ||
                (data.accountNo && c.accountNo === data.accountNo)
            );
          } catch {
            // ignore
          }
        }

        // If customer record is found and NOT in pending_approval (e.g. active, pending_install, overdue, suspended)
        if (matchedCustomer && matchedCustomer.status !== 'pending_approval') {
          data = {
            ...data,
            isApproved: true,
            status: 'active',
            accountNo: matchedCustomer.accountNo || data.accountNo,
            planId: matchedCustomer.planId || data.planId,
            planName: matchedCustomer.planName || data.planName,
            monthlyFee: matchedCustomer.monthlyFee || data.monthlyFee,
            mobile: matchedCustomer.mobile || data.mobile,
            displayName: user.displayName || matchedCustomer.fullName || data.displayName,
          };
          await setDoc(userDocRef, data, { merge: true });
        }
      }

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
