import React, { useState, useEffect } from 'react';
import {
  Cloud,
  Database,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  UploadCloud,
  ShieldCheck,
  Server,
  Zap,
  ExternalLink,
  Copy,
  Check,
  HardDrive,
  Radio,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { firebaseConfig, testFirebaseConnection, FirebaseConnectionTestResult } from '../../config/firebase';
import { seedFirestoreFromLocalData } from '../../services/firestoreService';

export const FirebaseSettingsCard: React.FC = () => {
  const {
    customers,
    invoices,
    payments,
    paymentSubmissions,
    plans,
    repairOrders,
    napBoxes,
    fiberCables,
    fiberClosures,
    oltNode,
    mikrotikDevices,
    expenses,
    auditLogs,
    dailyRemittances,
    addonCatalog,
    businessProfile,
    showToast,
  } = useApp();

  const [testResult, setTestResult] = useState<FirebaseConnectionTestResult | null>(null);
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [isMigrating, setIsMigrating] = useState<boolean>(false);
  const [migrationStatus, setMigrationStatus] = useState<string>('');
  const [migrationPercent, setMigrationPercent] = useState<number>(0);
  const [copiedRules, setCopiedRules] = useState<boolean>(false);

  useEffect(() => {
    handleTestConnection();
  }, []);

  const handleTestConnection = async () => {
    setIsTesting(true);
    try {
      const res = await testFirebaseConnection();
      setTestResult(res);
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err?.message || 'Connection failed',
        projectId: firebaseConfig.projectId,
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleMigrateToFirestore = async () => {
    if (!window.confirm('This will upload all current subscribers, invoices, payments, fiber maps, and system settings to your Cloud Firestore database (swiftstream-portal). Proceed?')) {
      return;
    }

    setIsMigrating(true);
    setMigrationPercent(10);
    setMigrationStatus('Preparing database payloads...');

    const result = await seedFirestoreFromLocalData(
      {
        customers,
        invoices,
        payments,
        paymentSubmissions,
        plans,
        repairOrders,
        napBoxes,
        fiberCables,
        fiberClosures,
        oltNode,
        mikrotikDevices,
        expenses,
        auditLogs,
        dailyRemittances,
        addonCatalog,
        businessProfile,
      },
      (step, current, total) => {
        setMigrationStatus(step);
        setMigrationPercent(Math.min(95, Math.round((current / (total || 100)) * 100) + 15));
      }
    );

    setIsMigrating(false);
    if (result.success) {
      setMigrationPercent(100);
      setMigrationStatus(`Successfully uploaded ${result.totalUploaded} records to Cloud Firestore!`);
      showToast('success', 'Cloud Sync Complete', `All ${result.totalUploaded} records synced to Firestore (${firebaseConfig.projectId}).`);
    } else {
      showToast('error', 'Cloud Migration Failed', result.error || 'Failed to complete upload.');
    }
  };

  const sampleRules = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true; // Configure for production auth
    }
  }
}`;

  const handleCopyRules = () => {
    navigator.clipboard.writeText(sampleRules);
    setCopiedRules(true);
    setTimeout(() => setCopiedRules(false), 2500);
    showToast('info', 'Rules Copied', 'Paste into Firebase Console > Firestore > Rules');
  };

  return (
    <div className="space-y-6 text-xs text-slate-100">
      {/* Cloud Status Header */}
      <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-5 shadow-card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-bold">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <span>Google Firebase & Cloud Firestore</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  swiftstream-portal
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Real-time multi-device database sync, offline cache, and cloud storage
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono text-[10px] font-bold border ${
                testResult?.success
                  ? 'bg-emerald-950/60 border-emerald-800/60 text-emerald-300'
                  : 'bg-rose-950/60 border-rose-800/60 text-rose-300'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  testResult?.success ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'
                }`}
              />
              <span>
                {testResult?.success
                  ? `FIRESTORE ONLINE (${testResult.latencyMs}ms)`
                  : isTesting
                  ? 'TESTING CONNECTION...'
                  : 'DISCONNECTED'}
              </span>
            </div>

            <button
              type="button"
              onClick={handleTestConnection}
              disabled={isTesting}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition-colors disabled:opacity-50"
              title="Test Connection"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Project Details Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
            <span className="text-[10px] text-slate-400 font-semibold uppercase">Cloud Project ID</span>
            <span className="font-mono text-cyan-400 font-bold block">{firebaseConfig.projectId}</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
            <span className="text-[10px] text-slate-400 font-semibold uppercase">Cloud Storage Bucket</span>
            <span className="font-mono text-purple-400 font-bold block truncate">{firebaseConfig.storageBucket}</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
            <span className="text-[10px] text-slate-400 font-semibold uppercase">Offline Persistence</span>
            <span className="font-mono text-emerald-400 font-bold block flex items-center gap-1">
              <HardDrive className="w-3 h-3" />
              <span>Multi-Tab IndexedDB Active</span>
            </span>
          </div>
        </div>

        {/* 1-Click Migration / Cloud Seeder Action */}
        <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-950 to-slate-900 border border-cyan-900/50 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h4 className="font-bold text-slate-100 flex items-center gap-2">
                <UploadCloud className="w-4 h-4 text-cyan-400" />
                <span>1-Click Cloud Firestore Migration & Seeder</span>
              </h4>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Upload your local subscribers ({customers.length}), invoices ({invoices.length}), OR receipts ({payments.length}), and OSP fiber assets into Cloud Firestore.
              </p>
            </div>

            <button
              type="button"
              onClick={handleMigrateToFirestore}
              disabled={isMigrating}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl font-bold shadow-lg shadow-cyan-600/20 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 whitespace-nowrap"
            >
              <UploadCloud className={`w-4 h-4 ${isMigrating ? 'animate-bounce' : ''}`} />
              <span>{isMigrating ? 'Uploading...' : 'Sync Local Data to Cloud'}</span>
            </button>
          </div>

          {isMigrating && (
            <div className="space-y-1.5 pt-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-cyan-300 font-mono">{migrationStatus}</span>
                <span className="text-slate-400 font-mono">{migrationPercent}%</span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-cyan-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${migrationPercent}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Quick Links & Security Rules */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <a
            href={`https://console.firebase.google.com/project/${firebaseConfig.projectId}/firestore`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition-colors group"
          >
            <span className="text-slate-300 group-hover:text-cyan-400 font-semibold flex items-center gap-2">
              <Database className="w-3.5 h-3.5 text-amber-400" />
              <span>Open Firebase Firestore Console</span>
            </span>
            <ExternalLink className="w-3.5 h-3.5 text-slate-500 group-hover:text-cyan-400" />
          </a>

          <a
            href={`https://console.firebase.google.com/project/${firebaseConfig.projectId}/storage`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition-colors group"
          >
            <span className="text-slate-300 group-hover:text-cyan-400 font-semibold flex items-center gap-2">
              <HardDrive className="w-3.5 h-3.5 text-purple-400" />
              <span>Open Firebase Storage Console</span>
            </span>
            <ExternalLink className="w-3.5 h-3.5 text-slate-500 group-hover:text-cyan-400" />
          </a>
        </div>
      </div>
    </div>
  );
};

