import React, { createContext, useContext, useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  User
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  onSnapshot, 
  doc, 
  setDoc, 
  deleteDoc, 
  writeBatch, 
  getDocs,
  getDocFromServer
} from 'firebase/firestore';
import { SKPD, Anggaran, Realisasi } from '../lib/types';
import firebaseConfig from '../../firebase-applet-config.json';

interface FirebaseContextType {
  user: User | null;
  loading: boolean;
  dataLoading: { skpds: boolean; anggarans: boolean; realisasis: boolean };
  syncError: string | null;
  skpds: SKPD[];
  anggarans: Anggaran[];
  realisasis: Realisasi[];
  quotaExceeded: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  setSyncError: (error: string | null) => void;
  saveSKPD: (skpd: Partial<SKPD>) => Promise<void>;
  saveSKPDsBulk: (skpds: Partial<SKPD>[]) => Promise<void>;
  deleteSKPD: (id: string) => Promise<void>;
  deleteAllSKPDs: () => Promise<void>;
  saveAnggaran: (anggaran: Partial<Anggaran>) => Promise<void>;
  saveAnggaransBulk: (anggarans: Partial<Anggaran>[]) => Promise<void>;
  deleteAnggaran: (id: string) => Promise<void>;
  deleteAllAnggarans: () => Promise<void>;
  saveRealisasi: (realisasi: Partial<Realisasi>) => Promise<void>;
  saveRealisasisBulk: (realisasis: Partial<Realisasi>[]) => Promise<void>;
  deleteRealisasi: (id: string) => Promise<void>;
  deleteAllRealisasi: () => Promise<void>;
}

const FirebaseContext = createContext<FirebaseContextType | undefined>(undefined);

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

export function FirebaseProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState({ skpds: true, anggarans: true, realisasis: true });
  const [syncError, setSyncError] = useState<string | null>(null);
  const [skpds, setSkpds] = useState<SKPD[]>([]);
  const [anggarans, setAnggarans] = useState<Anggaran[]>([]);
  const [realisasis, setRealisasis] = useState<Realisasi[]>([]);
  const [quotaExceeded, setQuotaExceeded] = useState(false);

  // Connection Test & Auth Observer
  useEffect(() => {
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error: any) {
        if (error.message?.includes('offline')) {
          setSyncError("Sistem saat ini sedang Offline. Pastikan koneksi internet Anda stabil.");
        }
      }
    };
    testConnection();

    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  // Real-time Data Sync
  useEffect(() => {
    if (!user) {
      setSkpds([]);
      setAnggarans([]);
      setRealisasis([]);
      setDataLoading({ skpds: false, anggarans: false, realisasis: false });
      return;
    }

    const unsubSkpds = onSnapshot(collection(db, 'skpds'), (snapshot) => {
      setSkpds(snapshot.docs.map(d => d.data() as SKPD));
      setDataLoading(prev => ({ ...prev, skpds: false }));
    }, (err) => handleFirestoreError(err, 'list', 'skpds'));

    const unsubAnggarans = onSnapshot(collection(db, 'anggarans'), (snapshot) => {
      setAnggarans(snapshot.docs.map(d => d.data() as Anggaran));
      setDataLoading(prev => ({ ...prev, anggarans: false }));
    }, (err) => handleFirestoreError(err, 'list', 'anggarans'));

    const unsubRealisasis = onSnapshot(collection(db, 'realisasis'), (snapshot) => {
      setRealisasis(snapshot.docs.map(d => d.data() as Realisasi));
      setDataLoading(prev => ({ ...prev, realisasis: false }));
    }, (err) => handleFirestoreError(err, 'list', 'realisasis'));

    return () => {
      unsubSkpds();
      unsubAnggarans();
      unsubRealisasis();
    };
  }, [user]);

  const handleFirestoreError = (error: any, op: string, path: string) => {
    console.error(`Firestore Error [${op}]:`, error);
    if (error.message?.includes('Quota exceeded')) {
      setQuotaExceeded(true);
      setSyncError("Batas kuota database tercapai. Beberapa fitur mungkin terbatas.");
    } else {
      setSyncError(`Terjadi kesalahan saat memproses data ${path}. Silakan coba lagi.`);
    }
  };

  const login = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const logout = async () => {
    await signOut(auth);
  };

  // SKPD Operations
  const saveSKPD = async (data: Partial<SKPD>) => {
    if (!data.id) return;
    await setDoc(doc(db, 'skpds', data.id), data);
  };
  const saveSKPDsBulk = async (data: Partial<SKPD>[]) => {
    const batch = writeBatch(db);
    data.forEach(item => {
      if (item.id) batch.set(doc(db, 'skpds', item.id), item);
    });
    await batch.commit();
  };
  const deleteSKPD = async (id: string) => {
    await deleteDoc(doc(db, 'skpds', id));
  };
  const deleteAllSKPDs = async () => {
    const snapshot = await getDocs(collection(db, 'skpds'));
    const batch = writeBatch(db);
    snapshot.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
  };

  // Anggaran Operations
  const saveAnggaran = async (data: Partial<Anggaran>) => {
    if (!data.id) return;
    await setDoc(doc(db, 'anggarans', data.id), data);
  };
  const saveAnggaransBulk = async (data: Partial<Anggaran>[]) => {
    const batchSize = 500;
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = writeBatch(db);
      const chunk = data.slice(i, i + batchSize);
      chunk.forEach(item => {
        if (item.id) batch.set(doc(db, 'anggarans', item.id), item);
      });
      await batch.commit();
    }
  };
  const deleteAnggaran = async (id: string) => {
    await deleteDoc(doc(db, 'anggarans', id));
  };
  const deleteAllAnggarans = async () => {
    const snapshot = await getDocs(collection(db, 'anggarans'));
    const batch = writeBatch(db);
    snapshot.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
  };

  // Realisasi Operations
  const saveRealisasi = async (data: Partial<Realisasi>) => {
    if (!data.id) return;
    await setDoc(doc(db, 'realisasis', data.id), data);
  };
  const saveRealisasisBulk = async (data: Partial<Realisasi>[]) => {
    const batchSize = 500;
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = writeBatch(db);
      const chunk = data.slice(i, i + batchSize);
      chunk.forEach(item => {
        if (item.id) batch.set(doc(db, 'realisasis', item.id), item);
      });
      await batch.commit();
    }
  };
  const deleteRealisasi = async (id: string) => {
    await deleteDoc(doc(db, 'realisasis', id));
  };
  const deleteAllRealisasi = async () => {
    const snapshot = await getDocs(collection(db, 'realisasis'));
    const batch = writeBatch(db);
    snapshot.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
  };

  return (
    <FirebaseContext.Provider value={{
      user, loading, dataLoading, syncError, skpds, anggarans, realisasis, quotaExceeded,
      login, logout, setSyncError,
      saveSKPD, saveSKPDsBulk, deleteSKPD, deleteAllSKPDs,
      saveAnggaran, saveAnggaransBulk, deleteAnggaran, deleteAllAnggarans,
      saveRealisasi, saveRealisasisBulk, deleteRealisasi, deleteAllRealisasi
    }}>
      {children}
    </FirebaseContext.Provider>
  );
}

export function useFirebase() {
  const context = useContext(FirebaseContext);
  if (context === undefined) {
    throw new Error('useFirebase must be used within a FirebaseProvider');
  }
  return context;
}
