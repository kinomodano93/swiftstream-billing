import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  writeBatch,
  getDocs,
  Unsubscribe,
} from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../config/firebase';
import {
  Customer,
  Invoice,
  Payment,
  PaymentSubmission,
  Plan,
  RepairOrder,
  NapBox,
  FiberCable,
  FiberClosure,
  OltPopNode,
  MikrotikDevice,
  Expense,
  AuditLog,
  DailyRemittanceRecord,
  AddonCatalogItem,
  BusinessProfile,
} from '../types';

export const COLLECTIONS = {
  CUSTOMERS: 'customers',
  INVOICES: 'invoices',
  PAYMENTS: 'payments',
  PAYMENT_SUBMISSIONS: 'payment_submissions',
  PLANS: 'plans',
  REPAIR_ORDERS: 'repair_orders',
  NAP_BOXES: 'nap_boxes',
  FIBER_CABLES: 'fiber_cables',
  FIBER_CLOSURES: 'fiber_closures',
  OLT_NODES: 'olt_nodes',
  MIKROTIK_DEVICES: 'mikrotik_devices',
  EXPENSES: 'expenses',
  AUDIT_LOGS: 'audit_logs',
  DAILY_REMITTANCES: 'daily_remittances',
  ADDON_CATALOG: 'addon_catalog',
  BUSINESS_PROFILE: 'business_profile',
  COVERAGE_AREAS: 'coverage_areas',
} as const;

/**
 * Generic real-time collection listener
 */
export const subscribeToCollection = <T extends { id: string }>(
  collectionName: string,
  onData: (items: T[]) => void,
  onError?: (err: Error) => void
): Unsubscribe => {
  try {
    const colRef = collection(db, collectionName);
    return onSnapshot(
      colRef,
      (snapshot) => {
        const items: T[] = [];
        snapshot.forEach((d) => {
          items.push({ id: d.id, ...d.data() } as T);
        });
        onData(items);
      },
      (error) => {
        console.warn(`Firestore subscription error on [${collectionName}]:`, error);
        if (onError) onError(error);
      }
    );
  } catch (err: any) {
    console.warn(`Failed to initialize subscription for [${collectionName}]:`, err);
    return () => {};
  }
};

/**
 * Saves or merges a single document in Firestore
 */
export const saveFirestoreDoc = async <T extends { id: string }>(
  collectionName: string,
  data: T
): Promise<void> => {
  try {
    const docRef = doc(db, collectionName, data.id);
    await setDoc(docRef, data, { merge: true });
  } catch (error) {
    console.warn(`Firestore write error on [${collectionName}/${data.id}]:`, error);
  }
};

/**
 * Deletes a document from Firestore
 */
export const deleteFirestoreDoc = async (
  collectionName: string,
  id: string
): Promise<void> => {
  try {
    const docRef = doc(db, collectionName, id);
    await deleteDoc(docRef);
  } catch (error) {
    console.warn(`Firestore delete error on [${collectionName}/${id}]:`, error);
  }
};

/**
 * Uploads a base64 receipt screenshot to Firebase Storage and returns download URL
 */
export const uploadReceiptToFirebaseStorage = async (
  submissionId: string,
  base64DataUrl: string
): Promise<string> => {
  try {
    const storageRef = ref(storage, `receipts/${submissionId}_${Date.now()}.jpg`);
    await uploadString(storageRef, base64DataUrl, 'data_url');
    return await getDownloadURL(storageRef);
  } catch (error) {
    console.warn('Firebase Storage upload warning, keeping original URL:', error);
    return base64DataUrl;
  }
};

export interface MigrationProgressCallback {
  (step: string, current: number, total: number): void;
}

/**
 * 1-Click Migration / Seeder from local data to Cloud Firestore
 */
export const seedFirestoreFromLocalData = async (
  data: {
    customers: Customer[];
    invoices: Invoice[];
    payments: Payment[];
    paymentSubmissions: PaymentSubmission[];
    plans: Plan[];
    repairOrders: RepairOrder[];
    napBoxes: NapBox[];
    fiberCables: FiberCable[];
    fiberClosures: FiberClosure[];
    oltNode: OltPopNode;
    mikrotikDevices: MikrotikDevice[];
    expenses: Expense[];
    auditLogs: AuditLog[];
    dailyRemittances: DailyRemittanceRecord[];
    addonCatalog: AddonCatalogItem[];
    businessProfile: BusinessProfile;
  },
  onProgress?: MigrationProgressCallback
): Promise<{ success: boolean; totalUploaded: number; error?: string }> => {
  let totalUploaded = 0;

  try {
    const uploadBatch = async <T extends { id: string }>(
      colName: string,
      items: T[],
      label: string
    ) => {
      if (!items || items.length === 0) return;
      if (onProgress) onProgress(`Uploading ${label}...`, totalUploaded, 100);

      // Firestore batches are limited to 500 operations
      const chunkSize = 400;
      for (let i = 0; i < items.length; i += chunkSize) {
        const chunk = items.slice(i, i + chunkSize);
        const batch = writeBatch(db);
        chunk.forEach((item) => {
          const docRef = doc(db, colName, item.id);
          batch.set(docRef, item, { merge: true });
        });
        await batch.commit();
        totalUploaded += chunk.length;
      }
    };

    // 1. Subscribers
    await uploadBatch(COLLECTIONS.CUSTOMERS, data.customers, 'Subscribers');

    // 2. Invoices & Bills
    await uploadBatch(COLLECTIONS.INVOICES, data.invoices, 'Invoices');

    // 3. Official Receipts & Payments
    await uploadBatch(COLLECTIONS.PAYMENTS, data.payments, 'Official Receipts');

    // 4. Payment Submissions & Proofs
    await uploadBatch(COLLECTIONS.PAYMENT_SUBMISSIONS, data.paymentSubmissions, 'Payment Proofs');

    // 5. Internet Plans
    await uploadBatch(COLLECTIONS.PLANS, data.plans, 'Internet Plans');

    // 6. Repair & Field Work Orders
    await uploadBatch(COLLECTIONS.REPAIR_ORDERS, data.repairOrders, 'Service Orders');

    // 7. NAP Distribution Boxes
    await uploadBatch(COLLECTIONS.NAP_BOXES, data.napBoxes, 'NAP Boxes');

    // 8. Fiber Cables & GIS Spans
    await uploadBatch(COLLECTIONS.FIBER_CABLES, data.fiberCables, 'Fiber Spans');

    // 9. Fiber Splice Closures
    await uploadBatch(COLLECTIONS.FIBER_CLOSURES, data.fiberClosures, 'Splice Closures');

    // 10. MikroTik Routers
    await uploadBatch(COLLECTIONS.MIKROTIK_DEVICES, data.mikrotikDevices, 'MikroTik Routers');

    // 11. Expenses
    await uploadBatch(COLLECTIONS.EXPENSES, data.expenses, 'Expenses');

    // 12. Audit Logs
    await uploadBatch(COLLECTIONS.AUDIT_LOGS, data.auditLogs, 'Audit Logs');

    // 13. Daily Cashier Remittances
    await uploadBatch(COLLECTIONS.DAILY_REMITTANCES, data.dailyRemittances, 'Remittances');

    // 14. Addon Catalog
    await uploadBatch(COLLECTIONS.ADDON_CATALOG, data.addonCatalog, 'Add-on Catalog');

    // 15. Singletons: OLT Node & Business Profile
    const singletonsBatch = writeBatch(db);
    singletonsBatch.set(doc(db, COLLECTIONS.OLT_NODES, data.oltNode.id || 'primary_olt'), data.oltNode, { merge: true });
    singletonsBatch.set(doc(db, COLLECTIONS.BUSINESS_PROFILE, 'company_profile'), data.businessProfile, { merge: true });
    await singletonsBatch.commit();
    totalUploaded += 2;

    if (onProgress) onProgress('Cloud Firestore synchronization complete!', 100, 100);

    return { success: true, totalUploaded };
  } catch (err: any) {
    console.error('Firestore migration failed:', err);
    return { success: false, totalUploaded, error: err?.message || 'Failed to complete batch upload' };
  }
};

/**
 * Deletes all documents in selected Firestore collections to allow a clean start
 */
export const purgeFirestoreCollections = async (
  collectionsToPurge: string[] = [
    COLLECTIONS.CUSTOMERS,
    COLLECTIONS.INVOICES,
    COLLECTIONS.PAYMENTS,
    COLLECTIONS.PAYMENT_SUBMISSIONS,
    COLLECTIONS.REPAIR_ORDERS,
    COLLECTIONS.NAP_BOXES,
    COLLECTIONS.FIBER_CABLES,
    COLLECTIONS.FIBER_CLOSURES,
    COLLECTIONS.MIKROTIK_DEVICES,
    COLLECTIONS.EXPENSES,
    COLLECTIONS.DAILY_REMITTANCES,
    COLLECTIONS.AUDIT_LOGS,
  ],
  onProgress?: (msg: string) => void
): Promise<{ success: boolean; deletedCount: number; error?: string }> => {
  let deletedCount = 0;
  try {
    for (const colName of collectionsToPurge) {
      if (onProgress) onProgress(`Cleaning ${colName}...`);
      const colRef = collection(db, colName);
      const snap = await getDocs(colRef);
      if (!snap.empty) {
        const docs = snap.docs;
        const chunkSize = 400;
        for (let i = 0; i < docs.length; i += chunkSize) {
          const chunk = docs.slice(i, i + chunkSize);
          const batch = writeBatch(db);
          chunk.forEach((d) => batch.delete(d.ref));
          await batch.commit();
          deletedCount += chunk.length;
        }
      }
    }
    return { success: true, deletedCount };
  } catch (err: any) {
    console.error('Firestore purge error:', err);
    return { success: false, deletedCount, error: err?.message || 'Purge failed' };
  }
};

