/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, 
  Database, 
  FileText, 
  Menu, 
  X, 
  TrendingUp, 
  ArrowRightLeft,
  Settings,
  LogOut,
  ChevronRight,
  User as UserIcon,
  LogIn
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { SKPD, Anggaran, Realisasi } from './lib/types';
import Dashboard from './components/Dashboard';
import MasterData from './components/MasterData';
import Transactions from './components/Transactions';
import Reports from './components/Reports';
import { cn } from './lib/utils';
import { useFirebase } from './contexts/FirebaseContext';

type Page = 'dashboard' | 'master' | 'transactions' | 'reports';

export default function App() {
  const { 
    user, loading, syncError, skpds, anggarans, realisasis, quotaExceeded,
    login, logout, setSyncError,
    saveSKPD, deleteSKPD,
    saveAnggaran, saveAnggaransBulk, deleteAnggaran,
    saveRealisasi, saveRealisasisBulk, deleteRealisasi
  } = useFirebase();

  const [activePage, setActivePage] = useState<Page>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'master', label: 'Master Data', icon: Database },
    { id: 'transactions', label: 'Realisasi', icon: ArrowRightLeft },
    { id: 'reports', label: 'Laporan', icon: FileText },
  ];

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-50 flex-col gap-4">
        <div className="w-12 h-12 border-4 border-bento-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-bold text-bento-accent animate-pulse uppercase tracking-widest">Memuat Sistem...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen w-screen bg-bento-accent flex items-center justify-center p-6 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.1),transparent)]">
        <div className="max-w-md w-full bg-white rounded-[40px] p-12 shadow-2xl space-y-8 relative overflow-hidden border border-white/20">
          <div className="absolute top-0 right-0 w-32 h-32 bg-bento-primary/5 rounded-full -mr-16 -mt-16 blur-2xl"></div>
          <div className="relative text-center space-y-4">
            <div className="w-20 h-20 bg-bento-primary rounded-3xl flex items-center justify-center mx-auto shadow-xl shadow-blue-100 mb-6 rotate-3 hover:rotate-0 transition-transform duration-500">
               <Database className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-black text-bento-accent tracking-tighter uppercase">SI-REALISASI</h1>
            <p className="text-sm text-bento-text-sub font-medium leading-relaxed">
              Sistem Informasi Monitoring Anggaran & Realisasi Terintegrasi. Silakan masuk untuk melanjutkan.
            </p>
          </div>

          <button 
            onClick={login}
            className="w-full bg-bento-accent text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-slate-800 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg"
          >
            <LogIn className="w-5 h-5" />
            <span>Masuk dengan Google</span>
          </button>

          <p className="text-[10px] text-center text-bento-text-sub uppercase font-bold tracking-widest pt-4">
            Pemerintah Provinsi NTB • 2026
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#f4f6f9] text-[#1e293b] overflow-hidden font-sans">
      {/* Sidebar - Bento Style */}
      <motion.aside
        initial={{ width: sidebarOpen ? 260 : 80 }}
        animate={{ width: sidebarOpen ? 260 : 80 }}
        className="bg-bento-accent text-white flex flex-col z-20"
      >
        <div className="p-8 flex items-center justify-between">
          {sidebarOpen && (
            <div className="flex items-center gap-3 overflow-hidden whitespace-nowrap">
              <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center text-bento-accent font-black text-xl">
                A
              </div>
              <span className="font-extrabold text-lg tracking-tight">SI-REALISASI</span>
            </div>
          )}
          {!sidebarOpen && (
            <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center text-bento-accent font-black text-xl mx-auto">
              A
            </div>
          )}
        </div>

        <nav className="flex-1 px-4 space-y-1">
          {/* Dashboard Group */}
          <div className={cn("bento-nav-item", activePage === 'dashboard' && "active")} onClick={() => setActivePage('dashboard')}>
            <LayoutDashboard className="w-5 h-5" />
            {sidebarOpen && <span>Dashboard</span>}
          </div>

          <div className="bento-group-label">{sidebarOpen ? 'Master Data' : '•••'}</div>
          <div className={cn("bento-nav-item", activePage === 'master' && "active")} onClick={() => setActivePage('master')}>
            <Database className="w-5 h-5" />
            {sidebarOpen && <span>Data Master</span>}
          </div>
          <div className={cn("bento-nav-item", activePage === 'transactions' && "active")} onClick={() => setActivePage('transactions')}>
            <ArrowRightLeft className="w-5 h-5" />
            {sidebarOpen && <span>Realisasi</span>}
          </div>

          <div className="bento-group-label">{sidebarOpen ? 'Pelaporan' : '•••'}</div>
          <div className={cn("bento-nav-item", activePage === 'reports' && "active")} onClick={() => setActivePage('reports')}>
            <FileText className="w-5 h-5" />
            {sidebarOpen && <span>Laporan</span>}
          </div>
        </nav>

        <div className="p-6 border-t border-white/10 space-y-4">
          <div className="bento-group-label">{sidebarOpen ? 'Pengaturan' : '•••'}</div>
          <button 
            onClick={logout}
            className="w-full flex items-center gap-3 px-4 py-3 text-red-100 hover:text-white hover:bg-red-500/20 rounded-xl transition-all text-sm font-bold"
          >
            <LogOut className="w-5 h-5 text-red-400" />
            {sidebarOpen && <span>Keluar Sistem</span>}
          </button>

          <button 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-full flex items-center gap-3 px-4 py-2 text-white/50 hover:text-white transition-all text-sm"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5 mx-auto" />}
            {sidebarOpen && <span>Tutup Sidebar</span>}
          </button>
          {sidebarOpen && (
            <div className="text-[10px] text-white/30 font-mono tracking-tighter">
              v2.4.0 Build 2026 AI Studio
            </div>
          )}
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {syncError && (
          <div className={cn(
            "border-b px-10 py-3 flex items-center justify-between gap-4 animate-in fade-in slide-in-from-top duration-300",
            quotaExceeded ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200"
          )}>
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-2 h-2 rounded-full animate-pulse",
                quotaExceeded ? "bg-amber-500" : "bg-red-500"
              )}></div>
              <p className={cn(
                "text-sm font-bold",
                quotaExceeded ? "text-amber-700" : "text-red-700"
              )}>{syncError}</p>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setSyncError(null)}
                className={cn(
                  "p-1.5 transition-colors",
                  quotaExceeded ? "text-amber-400 hover:text-amber-700" : "text-red-400 hover:text-red-700"
                )}
                title="Sembunyikan Pesan"
              >
                <X className="w-4 h-4" />
              </button>
              <button 
                onClick={() => window.location.reload()}
                className={cn(
                  "px-3 py-1 text-white text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all ml-2",
                  quotaExceeded ? "bg-amber-600 hover:bg-amber-700" : "bg-red-600 hover:bg-red-700"
                )}
              >
                Refresh Data
              </button>
            </div>
          </div>
        )}
        <header className="h-20 flex items-center justify-between px-10 bg-transparent border-none sticky top-0 z-10">
          <div>
            <h2 className="text-2xl font-bold text-bento-accent tracking-tight leading-none mb-1">
              {navItems.find(i => i.id === activePage)?.label}
            </h2>
            <p className="text-xs text-bento-text-sub font-medium">Tahun Anggaran 2026 • Real-time Monitoring</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right mr-2 hidden sm:block">
              <p className="text-sm font-bold text-bento-accent">{user?.displayName || 'User'}</p>
              <p className="text-[11px] text-bento-text-sub font-medium uppercase tracking-wider">{user?.email}</p>
            </div>
            <div className="w-11 h-11 bg-bento-border rounded-full flex items-center justify-center text-gray-500 overflow-hidden shadow-sm">
              {user?.photoURL ? (
                <img src={user.photoURL} alt={user.displayName || ''} referrerPolicy="no-referrer" />
              ) : (
                <UserIcon className="w-6 h-6 text-slate-400" />
              )}
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-10 pt-4 scroll-smooth">
          <AnimatePresence mode="wait">
            <motion.div
              key={activePage}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="max-w-7xl mx-auto h-full"
            >
              {activePage === 'dashboard' && (
                <Dashboard />
              )}
              {activePage === 'master' && (
                <MasterData />
              )}
              {activePage === 'transactions' && (
                <Transactions />
              )}
              {activePage === 'reports' && (
                <Reports />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
