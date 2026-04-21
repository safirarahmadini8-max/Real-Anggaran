import React, { createContext, useContext, useState, useEffect } from 'react';
import { SKPD, Anggaran, Realisasi } from '../lib/types';

interface FirebaseContextType {
  user: any;
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

export function FirebaseProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState({ skpds: false, anggarans: false, realisasis: false });
  const [syncError, setSyncError] = useState<string | null>(null);
  const [skpds, setSkpds] = useState<SKPD[]>([]);
  const [anggarans, setAnggarans] = useState<Anggaran[]>([]);
  const [realisasis, setRealisasis] = useState<Realisasi[]>([]);
  const [quotaExceeded, setQuotaExceeded] = useState(false);

  const login = async () => {
    setUser({ displayName: 'Safira Rahmadini', email: 'safira@example.com', photoURL: null });
  };

  const logout = async () => {
    setUser(null);
  };

  const saveSKPD = async () => {};
  const saveSKPDsBulk = async (data: Partial<SKPD>[]) => {
    setSkpds(prev => [...prev, ...data as SKPD[]]);
  };
  const deleteSKPD = async (id: string) => {
    setSkpds(prev => prev.filter(s => s.id !== id));
  };
  const deleteAllSKPDs = async () => setSkpds([]);

  const saveAnggaran = async () => {};
  const saveAnggaransBulk = async (data: Partial<Anggaran>[]) => {
    setAnggarans(prev => [...prev, ...data as Anggaran[]]);
  };
  const deleteAnggaran = async (id: string) => {
    setAnggarans(prev => prev.filter(a => a.id !== id));
  };
  const deleteAllAnggarans = async () => setAnggarans([]);

  const saveRealisasi = async (data: Partial<Realisasi>) => {
    setRealisasis(prev => [...prev, data as Realisasi]);
  };
  const saveRealisasisBulk = async (data: Partial<Realisasi>[]) => {
    setRealisasis(prev => [...prev, ...data as Realisasi[]]);
  };
  const deleteRealisasi = async (id: string) => {
    setRealisasis(prev => prev.filter(r => r.id !== id));
  };
  const deleteAllRealisasi = async () => setRealisasis([]);

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
