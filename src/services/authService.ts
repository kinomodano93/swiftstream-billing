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
import { doc, setDoc, getDoc, query, where, getDocs, collection, deleteDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { getStoredStaffUsers, setStoredStaffUsers } from '../data/storage';

export type UserRole = 'admin' | 'cashier' | 'technician' | 'tech' | 'subscriber';

export const isStaffUser = (user: AppUserProfile | null | undefined): boolean => {
  if (!user || !user.role) return false;
  return user.role === 'admin' || user.role === 'cashier' || user.role === 'technician' || user.role === 'tech';
};

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
    city?: string;
    province?: string;
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
  const cleanEmail = email.toLowerCase().trim();

  // 1. Check local/staff directory first (Cashier, Technician, Admin)
  const staffList = getStoredStaffUsers();
  const staff = staffList.find((s) => s.email.toLowerCase().trim() === cleanEmail);

  if (staff) {
    if (staff.status === 'suspended') {
      throw new Error('Your staff account is currently suspended. Please contact the System Administrator.');
    }

    if (staff.initialPassword && staff.initialPassword !== password) {
      const err: any = new Error('Incorrect email or password. Please double-check your login credentials.');
      err.code = 'auth/wrong-password';
      throw err;
    }

    const updatedStaff = {
      ...staff,
      lastLoginAt: new Date().toISOString(),
    };
    setStoredStaffUsers(staffList.map((s) => (s.id === staff.id ? updatedStaff : s)));

    const profile: AppUserProfile = {
      uid: staff.id,
      email: staff.email,
      displayName: staff.fullName,
      role: staff.role,
      status: staff.status,
      isApproved: true,
      mobile: staff.mobile,
      createdAt: staff.createdAt,
      lastLoginAt: updatedStaff.lastLoginAt,
    };

    localStorage.setItem('swiftstream_current_auth_user', JSON.stringify(profile));
    return profile;
  }

  // 2. Check remote Firestore system_users for staff created remotely
  try {
    const q = query(collection(db, 'system_users'), where('email', '==', cleanEmail));
    const qSnap = await getDocs(q);
    if (!qSnap.empty) {
      const docData = qSnap.docs[0].data();
      if (
        docData.role === 'admin' ||
        docData.role === 'cashier' ||
        docData.role === 'technician' ||
        docData.role === 'tech'
      ) {
        if (docData.status === 'suspended') {
          throw new Error('Your staff account is currently suspended. Please contact the System Administrator.');
        }

        if (docData.initialPassword && docData.initialPassword !== password) {
          const err: any = new Error('Incorrect email or password. Please double-check your login credentials.');
          err.code = 'auth/wrong-password';
          throw err;
        }

        const profile: AppUserProfile = {
          uid: docData.uid || qSnap.docs[0].id,
          email: docData.email,
          displayName: docData.displayName || docData.fullName || 'Staff Member',
          role: docData.role,
          status: docData.status || 'active',
          isApproved: true,
          mobile: docData.mobile,
          createdAt: docData.createdAt || new Date().toISOString(),
          lastLoginAt: new Date().toISOString(),
        };

        localStorage.setItem('swiftstream_current_auth_user', JSON.stringify(profile));
        return profile;
      }
    }
  } catch (e: any) {
    if (e.message?.includes('suspended') || e.code === 'auth/wrong-password') {
      throw e;
    }
  }

  // 2.5 Check if user is a subscriber with an admin-configured manual portal password
  try {
    const localCustRaw = localStorage.getItem('swiftstream_customers');
    if (localCustRaw) {
      const localCustomers: any[] = JSON.parse(localCustRaw);
      const matchedCustomer = localCustomers.find(
        (c) => c.email && c.email.toLowerCase().trim() === cleanEmail
      );

      if (matchedCustomer && matchedCustomer.portalPassword && matchedCustomer.portalPassword === password) {
        if (matchedCustomer.status === 'suspended') {
          throw new Error('Your subscriber account is currently suspended. Please contact the Billing Office.');
        }
        if (matchedCustomer.status === 'pending_approval') {
          throw new Error('Your subscriber registration is currently under review by our Admin team. You will receive an SMS when your connection is approved.');
        }

        const subscriberProfile: AppUserProfile = {
          uid: matchedCustomer.id,
          email: matchedCustomer.email,
          displayName: matchedCustomer.fullName,
          role: 'subscriber',
          accountNo: matchedCustomer.accountNo,
          isApproved: true,
          status: 'active',
          planId: matchedCustomer.planId,
          planName: matchedCustomer.planName,
          monthlyFee: matchedCustomer.monthlyFee,
          mobile: matchedCustomer.mobile,
          createdAt: matchedCustomer.createdAt || new Date().toISOString(),
          lastLoginAt: new Date().toISOString(),
        };

        localStorage.setItem('swiftstream_current_auth_user', JSON.stringify(subscriberProfile));
        return subscriberProfile;
      }
    }

    // Also check Firestore system_users for subscriber portal password
    const userQ = query(collection(db, 'system_users'), where('email', '==', cleanEmail));
    const userQSnap = await getDocs(userQ);
    if (!userQSnap.empty) {
      const uData = userQSnap.docs[0].data();
      if (
        uData.role === 'subscriber' &&
        (uData.portalPassword === password || uData.initialPassword === password)
      ) {
        if (uData.status === 'suspended') {
          throw new Error('Your subscriber account is currently suspended. Please contact the Billing Office.');
        }
        if (uData.status === 'pending_approval' || uData.isApproved === false) {
          throw new Error('Your subscriber registration is currently under review by our Admin team.');
        }

        const subscriberProfile: AppUserProfile = {
          uid: uData.uid || userQSnap.docs[0].id,
          email: uData.email,
          displayName: uData.displayName || uData.fullName || 'Subscriber',
          role: 'subscriber',
          accountNo: uData.accountNo,
          isApproved: true,
          status: 'active',
          planId: uData.planId,
          planName: uData.planName,
          monthlyFee: uData.monthlyFee,
          mobile: uData.mobile,
          createdAt: uData.createdAt || new Date().toISOString(),
          lastLoginAt: new Date().toISOString(),
        };

        localStorage.setItem('swiftstream_current_auth_user', JSON.stringify(subscriberProfile));
        return subscriberProfile;
      }
    }
  } catch (err: any) {
    if (err.message?.includes('suspended') || err.message?.includes('under review')) {
      throw err;
    }
  }

  // 3. Fallback to Firebase Auth for subscribers / cloud users
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const profile = await fetchOrCreateUserProfile(cred.user);

  // Check if subscriber application is still pending admin approval
  if (profile.role === 'subscriber' && (profile.status === 'pending_approval' || profile.isApproved === false)) {
    await signOut(auth);
    throw new Error('Your subscriber registration is currently under review by our Admin team. You will receive an SMS when your connection is approved.');
  }

  // Clean local staff cache if signed in via standard Firebase user
  localStorage.removeItem('swiftstream_current_auth_user');

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
      city?: string;
      province?: string;
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
  const localStaff = getStoredStaffUsers().find((s) => s.email.toLowerCase().trim() === userEmail);
  const isAuthorizedAdmin = authorizedAdmins.includes(userEmail) || !!localStaff;

  // Check if staff user is suspended
  if (localStaff && localStaff.status === 'suspended') {
    await signOut(auth);
    throw new Error(`Access Restricted: The staff account "${userEmail}" is suspended. Please contact the Administrator.`);
  }

  // Check if profile exists in Firestore system_users
  const userDocRef = doc(db, 'system_users', user.uid);
  const snap = await getDoc(userDocRef);

  if (snap.exists()) {
    const data = snap.data() as AppUserProfile;

    // If Admin/Staff (Admin, Cashier, Technician): verify whitelist authorization
    if (data.role === 'admin' || data.role === 'cashier' || data.role === 'technician' || data.role === 'tech') {
      if (!isAuthorizedAdmin && data.isApproved === false) {
        await signOut(auth);
        throw new Error(`Access Restricted: The Google account "${userEmail}" is not pre-authorized for SwiftStream Staff access.`);
      }
      const finalRole = localStaff?.role || data.role;
      const updatedProfile: AppUserProfile = {
        ...data,
        role: finalRole,
        lastLoginAt: new Date().toISOString(),
      };
      await setDoc(userDocRef, updatedProfile, { merge: true });
      localStorage.setItem('swiftstream_current_auth_user', JSON.stringify(updatedProfile));
      return updatedProfile;
    }

    // If Subscriber: check approval status
    if (data.role === 'subscriber') {
      if (data.status === 'pending_approval' || data.isApproved === false) {
        await signOut(auth);
        throw new Error('Your subscriber registration is currently under review by our Admin team. Please wait for approval.');
      }
      await setDoc(userDocRef, { lastLoginAt: new Date().toISOString() }, { merge: true });
      localStorage.setItem('swiftstream_current_auth_user', JSON.stringify(data));
      return data;
    }
  }

  // If newly signing in via Google and email is in the Authorized Admin Whitelist or local staff:
  if (isAuthorizedAdmin) {
    const assignedRole = localStaff?.role || 'admin';
    const adminProfile: AppUserProfile = {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName || localStaff?.fullName || userEmail.split('@')[0],
      role: assignedRole,
      isApproved: true,
      status: 'active',
      photoURL: user.photoURL,
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    };

    try {
      await setDoc(userDocRef, adminProfile, { merge: true });
    } catch (err) {
      console.warn('Could not save admin/staff profile to Firestore:', err);
    }

    localStorage.setItem('swiftstream_current_auth_user', JSON.stringify(adminProfile));
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
      localStorage.setItem('swiftstream_current_auth_user', JSON.stringify(subscriberProfile));
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
  try {
    localStorage.removeItem('swiftstream_current_auth_user');
  } catch (_) {}
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
 * Permanently deletes a subscriber's account and profile from Cloud Firestore
 * and deletes their identity from Firebase Authentication
 */
export const deleteCustomerAccountFromFirestore = async (customer: {
  id: string;
  accountNo?: string;
  email?: string;
}): Promise<{ success: boolean; deletedCount: number; authDeleted?: boolean }> => {
  if (!customer) return { success: false, deletedCount: 0 };

  let deletedCount = 0;
  let resolvedEmail = (customer.email || '').trim();
  let resolvedUid = customer.id || '';

  // 1. Pre-lookup email/UID from Firestore before deletion if not provided
  try {
    if (!resolvedEmail && customer.id) {
      const custDoc = await getDoc(doc(db, 'customers', customer.id));
      if (custDoc.exists()) {
        const d = custDoc.data();
        if (d?.email) resolvedEmail = d.email;
        if (!customer.accountNo && d?.accountNo) customer.accountNo = d.accountNo;
      }
    }
    if (!resolvedEmail && customer.accountNo) {
      const qCust = query(collection(db, 'customers'), where('accountNo', '==', customer.accountNo));
      const snap = await getDocs(qCust);
      if (!snap.empty) {
        const d = snap.docs[0].data();
        if (d?.email) resolvedEmail = d.email;
      }
    }
    if (!resolvedEmail && customer.accountNo) {
      const qSys = query(collection(db, 'system_users'), where('accountNo', '==', customer.accountNo));
      const snapSys = await getDocs(qSys);
      if (!snapSys.empty) {
        const d = snapSys.docs[0].data();
        if (d?.email) resolvedEmail = d.email;
        if (d?.uid) resolvedUid = d.uid;
      }
    }
  } catch (lookupErr) {
    console.warn('Pre-lookup warning before deletion:', lookupErr);
  }

  // 2. Request backend Firebase Auth user deletion (Cloud Function)
  let authDeleted = false;
  try {
    const cloudFunctionUrl = 'https://asia-southeast1-swiftstream-portal.cloudfunctions.net/deleteUserAccount';
    const resp = await fetch(cloudFunctionUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerId: customer.id,
        accountNo: customer.accountNo,
        email: resolvedEmail || undefined,
        uid: resolvedUid || undefined,
      }),
    });
    if (resp.ok) {
      const data = await resp.json().catch(() => ({}));
      authDeleted = !!data.authDeleted;
      if (Array.isArray(data.firestoreDocsDeleted)) {
        deletedCount += data.firestoreDocsDeleted.length;
      }
    }
  } catch (fnErr) {
    console.warn('Backend deleteUserAccount call warning:', fnErr);
  }

  // 3. Fallback/Direct cleanup from 'customers' collection
  try {
    if (customer.id) {
      await deleteDoc(doc(db, 'customers', customer.id));
      deletedCount++;
    }
    if (customer.accountNo && customer.accountNo !== customer.id) {
      await deleteDoc(doc(db, 'customers', customer.accountNo));
      deletedCount++;
    }
    if (customer.accountNo) {
      const qCust = query(collection(db, 'customers'), where('accountNo', '==', customer.accountNo));
      const snap = await getDocs(qCust);
      for (const d of snap.docs) {
        if (d.id !== customer.id && d.id !== customer.accountNo) {
          await deleteDoc(doc(db, 'customers', d.id));
          deletedCount++;
        }
      }
    }
  } catch (err) {
    console.warn('Error deleting customer document from Firestore:', err);
  }

  // 4. Fallback/Direct cleanup from 'system_users' collection
  try {
    if (customer.id) {
      await deleteDoc(doc(db, 'system_users', customer.id));
      deletedCount++;
    }
    if (resolvedUid && resolvedUid !== customer.id) {
      await deleteDoc(doc(db, 'system_users', resolvedUid));
      deletedCount++;
    }
    if (customer.accountNo && customer.accountNo !== customer.id) {
      await deleteDoc(doc(db, 'system_users', customer.accountNo));
      deletedCount++;
    }
    if (customer.accountNo) {
      const qAcc = query(collection(db, 'system_users'), where('accountNo', '==', customer.accountNo));
      const snapAcc = await getDocs(qAcc);
      for (const d of snapAcc.docs) {
        await deleteDoc(doc(db, 'system_users', d.id));
        deletedCount++;
      }
    }
    if (resolvedEmail && resolvedEmail.includes('@')) {
      const cleanEmail = resolvedEmail.toLowerCase().trim();
      const qEmail = query(collection(db, 'system_users'), where('email', '==', cleanEmail));
      const snapEmail = await getDocs(qEmail);
      for (const d of snapEmail.docs) {
        await deleteDoc(doc(db, 'system_users', d.id));
        deletedCount++;
      }
    }
  } catch (err) {
    console.warn('Error deleting user account from system_users in Firestore:', err);
  }

  // 5. Clean up matching pending online applications if any exist
  try {
    if (resolvedEmail && resolvedEmail.includes('@')) {
      const cleanEmail = resolvedEmail.toLowerCase().trim();
      const qApp = query(collection(db, 'online_applications'), where('email', '==', cleanEmail));
      const snapApp = await getDocs(qApp);
      for (const d of snapApp.docs) {
        await deleteDoc(doc(db, 'online_applications', d.id));
      }
    }
  } catch (err) {
    console.warn('Error cleaning up online_applications:', err);
  }

  return { success: true, deletedCount, authDeleted };
};

export interface FirebaseAuthUserRecord {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  disabled: boolean;
  creationTime?: string;
  lastSignInTime?: string;
}

/**
 * Lists all registered users in Firebase Authentication via backend Cloud Function
 */
export const fetchFirebaseAuthUsers = async (): Promise<FirebaseAuthUserRecord[]> => {
  const cloudFunctionUrl = 'https://asia-southeast1-swiftstream-portal.cloudfunctions.net/deleteUserAccount';
  const resp = await fetch(cloudFunctionUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'list' }),
  });
  if (!resp.ok) {
    throw new Error(`Failed to fetch Firebase Auth users: HTTP ${resp.status}`);
  }
  const data = await resp.json();
  return data.users || [];
};

/**
 * Direct deletion of an account from Firebase Auth and Firestore by UID or Email
 */
export const deleteAuthUserDirect = async (identifier: {
  uid?: string;
  email?: string;
  accountNo?: string;
  customerId?: string;
}): Promise<{ success: boolean; authDeleted: boolean }> => {
  const cloudFunctionUrl = 'https://asia-southeast1-swiftstream-portal.cloudfunctions.net/deleteUserAccount';
  const resp = await fetch(cloudFunctionUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(identifier),
  });
  if (!resp.ok) {
    throw new Error(`Failed to delete Firebase Auth user: HTTP ${resp.status}`);
  }
  const data = await resp.json();
  return { success: !!data.success, authDeleted: !!data.authDeleted };
};

/**
 * Cleans orphan users from Firebase Auth that have no matching active customer or staff in Firestore
 */
export const cleanOrphanAuthUsers = async (
  dryRun = false
): Promise<{ success: boolean; orphansCount: number; deletedCount: number; orphans: any[] }> => {
  const cloudFunctionUrl = 'https://asia-southeast1-swiftstream-portal.cloudfunctions.net/deleteUserAccount';
  const resp = await fetch(cloudFunctionUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'cleanOrphans', dryRun }),
  });
  if (!resp.ok) {
    throw new Error(`Failed to clean orphan auth users: HTTP ${resp.status}`);
  }
  return await resp.json();
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
    const localStaff = getStoredStaffUsers().find((s) => s.email.toLowerCase().trim() === userEmail);
    const authorizedAdmins = (await getAuthorizedAdminEmails()).map((e) => e.toLowerCase().trim());
    const isOwner = authorizedAdmins.includes(userEmail) || userEmail.includes('admin') || !!localStaff;
    const assignedRole = localStaff?.role || (isOwner ? 'admin' : 'subscriber');

    const defaultProfile: AppUserProfile = {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName || localStaff?.fullName || user.email?.split('@')[0] || 'SwiftStream Staff',
      role: assignedRole,
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
          localStorage.removeItem('swiftstream_current_auth_user');
          onUserChanged(null);
        } else {
          localStorage.setItem('swiftstream_current_auth_user', JSON.stringify(profile));
          onUserChanged(profile);
        }
      } catch {
        onUserChanged(null);
      }
    } else {
      // Check if a local authenticated staff or subscriber session exists
      try {
        const localRaw = localStorage.getItem('swiftstream_current_auth_user');
        if (localRaw) {
          const localProfile = JSON.parse(localRaw) as AppUserProfile;

          // If subscriber signed in via portal password
          if (localProfile.role === 'subscriber') {
            try {
              const localCustomers: any[] = JSON.parse(localStorage.getItem('swiftstream_customers') || '[]');
              const matchedCust = localCustomers.find(
                (c) =>
                  c.id === localProfile.uid ||
                  (c.email && c.email.toLowerCase().trim() === (localProfile.email || '').toLowerCase().trim()) ||
                  (localProfile.accountNo && c.accountNo === localProfile.accountNo)
              );

              if (matchedCust && matchedCust.status !== 'pending_approval') {
                onUserChanged({
                  ...localProfile,
                  displayName: matchedCust.fullName || localProfile.displayName,
                  accountNo: matchedCust.accountNo || localProfile.accountNo,
                  status: matchedCust.status === 'suspended' ? 'suspended' : 'active',
                });
                return;
              }
            } catch {}
          }

          const staffList = getStoredStaffUsers();
          const matchedStaff = staffList.find(
            (s) =>
              s.id === localProfile.uid ||
              s.email.toLowerCase().trim() === (localProfile.email || '').toLowerCase().trim()
          );

          if (matchedStaff && matchedStaff.status === 'active') {
            onUserChanged({
              ...localProfile,
              role: matchedStaff.role,
              displayName: matchedStaff.fullName,
              status: matchedStaff.status,
            });
            return;
          } else if (
            localProfile.role === 'admin' &&
            ((localProfile.email || '').toLowerCase().trim() === 'swiftstream.telecom@gmail.com' ||
              (localProfile.email || '').toLowerCase().trim() === 'youlo1709@gmail.com')
          ) {
            onUserChanged(localProfile);
            return;
          } else if (localProfile.role !== 'subscriber') {
            localStorage.removeItem('swiftstream_current_auth_user');
          }
        }
      } catch (_) {}

      onUserChanged(null);
    }
  });
};
