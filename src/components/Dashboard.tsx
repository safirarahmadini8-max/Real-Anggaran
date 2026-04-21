import React, { useMemo } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { 
  DollarSign, 
  TrendingUp, 
  Wallet, 
  AlertCircle,
  Database
} from 'lucide-react';
import { SKPD, Anggaran, Realisasi } from '../lib/types';
import { formatIDR, formatPercent, cn } from '../lib/utils';
import { motion } from 'motion/react';
import { useFirebase } from '../contexts/FirebaseContext';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

export default function Dashboard() {
  const { skpds, anggarans, realisasis, quotaExceeded } = useFirebase();
  const stats = useMemo(() => {
    const totalAnggaran = anggarans.reduce((sum, item) => sum + (Number(item.pagu) || 0), 0);
    const totalRealisasi = realisasis.reduce((sum, item) => sum + (Number(item.nilai) || 0), 0);
    const totalSisa = totalAnggaran - totalRealisasi;
    const persentase = totalAnggaran > 0 ? totalRealisasi / totalAnggaran : 0;

    return { totalAnggaran, totalRealisasi, totalSisa, persentase };
  }, [anggarans, realisasis]);

  const chartData = useMemo(() => {
    if (skpds.length === 0) return [];

    // Pre-calculate aggregate sums to avoid O(N^2)
    const skpdPagu: Record<string, number> = {};
    const skpdReal: Record<string, number> = {};
    
    // Map anggaranId to skpdId for quick lookup
    const anggaranToSkpd: Record<string, string> = {};
    anggarans.forEach(a => {
      anggaranToSkpd[a.id] = a.skpdId;
      skpdPagu[a.skpdId] = (skpdPagu[a.skpdId] || 0) + (Number(a.pagu) || 0);
    });

    realisasis.forEach(r => {
      const skpdId = anggaranToSkpd[r.anggaranId];
      if (skpdId) {
        skpdReal[skpdId] = (skpdReal[skpdId] || 0) + (Number(r.nilai) || 0);
      }
    });

    return skpds.map(skpd => {
      const pagu = skpdPagu[skpd.id] || 0;
      const real = skpdReal[skpd.id] || 0;
      return {
        nama: skpd.nama,
        Anggaran: pagu,
        Realisasi: real,
        Sisa: pagu - real
      };
    }).sort((a, b) => b.Anggaran - a.Anggaran).slice(0, 5);
  }, [skpds, anggarans, realisasis]);

  const pieData = useMemo(() => {
    // Pre-calculate to avoid O(N^2) inside loop
    const anggaranDetails: Record<string, string> = {};
    anggarans.forEach(a => { anggaranDetails[a.id] = a.namaAkun; });

    const data: Record<string, number> = {};
    realisasis.forEach(r => {
      const namaAkun = anggaranDetails[r.anggaranId];
      if (namaAkun) {
        data[namaAkun] = (data[namaAkun] || 0) + r.nilai;
      }
    });

    return Object.entries(data)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [realisasis, anggarans]);

  return (
    <div className="space-y-6 pb-12">
      {quotaExceeded && (
        <motion.div 
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          className="bg-amber-50 border border-amber-200 rounded-2xl p-6 flex items-center gap-4 overflow-hidden shadow-sm"
        >
          <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <AlertCircle className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-amber-900 leading-none mb-1 uppercase tracking-wider">Mode Dokumentasi (Offline)</h4>
            <p className="text-xs text-amber-700 font-medium leading-relaxed">
              Batas kuota database tercapai. Sistem beralih menggunakan data cadangan lokal. Anda tetap dapat melakukan input, dan data akan sinkron otomatis saat kuota tersedia kembali (besok).
            </p>
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      {/* Stats Cards - Bento Row 1 */}
      <StatCard 
        title="Total Pagu" 
        value={formatIDR(stats.totalAnggaran)} 
        icon={Wallet} 
        trend="Anggaran Murni + Perubahan"
      />
      <StatCard 
        title="Realisasi" 
        value={formatIDR(stats.totalRealisasi)} 
        icon={TrendingUp} 
        trend={`${formatPercent(stats.persentase)} dari Target`}
        trendColor="text-bento-success"
      />
      <StatCard 
        title="Sisa Anggaran" 
        value={formatIDR(stats.totalSisa)} 
        icon={DollarSign} 
        trend={`SiLPA Potensial: ${formatPercent(1 - stats.persentase)}`}
        trendColor="text-bento-warning"
      />
      <div className="bg-bento-accent rounded-2xl p-6 text-white shadow-lg flex flex-col justify-center">
        <h4 className="text-[11px] font-bold text-white/50 uppercase tracking-widest mb-2">Persentase Capaian</h4>
        <p className="text-4xl font-extrabold tracking-tight mb-2 text-white">{formatPercent(stats.persentase)}</p>
        <span className="text-xs text-bento-success font-semibold flex items-center gap-1">
          <TrendingUp className="w-3 h-3" /> On Track
        </span>
      </div>

      {/* Main Chart - Bento Row 2+3 */}
      <div className="md:col-span-3 md:row-span-2 bento-card flex flex-col min-h-[450px]">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h3 className="font-bold text-bento-accent text-base">Tren Realisasi per SKPD</h3>
            <p className="text-xs text-bento-text-sub">Perbandingan Anggaran vs Realisasi (5 SKPD Tertinggi)</p>
          </div>
          <div className="flex gap-4 text-[10px] uppercase font-bold tracking-widest text-bento-text-sub">
            <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-bento-border"></div> Pagu</span>
            <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-bento-primary"></div> Realisasi</span>
          </div>
        </div>
        <div className="flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#e2e8f0" />
              <XAxis 
                dataKey="nama" 
                fontSize={10} 
                tickLine={false} 
                axisLine={false}
                tick={{ fill: '#64748b', fontWeight: 500 }}
              />
              <YAxis 
                fontSize={10} 
                tickLine={false} 
                axisLine={false}
                tickFormatter={(val) => `Rp${val/1e6}jt`}
                tick={{ fill: '#64748b' }}
              />
              <Tooltip 
                cursor={{ fill: 'rgba(0,0,0,0.02)' }}
                contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                formatter={(value: number) => formatIDR(value)}
              />
              <Bar dataKey="Anggaran" fill="#e2e8f0" radius={[6, 6, 0, 0]} barSize={40} />
              <Bar dataKey="Realisasi" fill="#2563eb" radius={[6, 6, 0, 0]} barSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Side Bento Card */}
      <div className="bg-gradient-to-br from-bento-primary to-blue-800 rounded-2xl p-6 text-white shadow-md flex flex-col justify-between overflow-hidden relative">
        <div className="relative z-10">
          <h3 className="font-bold text-lg mb-2 leading-tight">Pusat Data Master</h3>
          <p className="text-xs text-white/70 leading-relaxed mb-6">Sinkronisasi data SKPD & Anggaran melalui file Excel (.xlsx).</p>
          
          <div className="space-y-3">
            {[
              { icon: Database, label: 'Kamus SKPD' },
              { icon: Wallet, label: 'Pagu Anggaran' },
              { icon: AlertCircle, label: 'Bantuan' }
            ].map((btn) => (
              <button key={btn.label} className="w-full flex items-center gap-3 px-4 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-xs font-medium transition-all text-left">
                <btn.icon className="w-4 h-4" />
                {btn.label}
              </button>
            ))}
          </div>
        </div>
        {/* Decorator blob */}
        <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
      </div>

      {/* Account Distribution - Bento Row 3 Right */}
      <div className="bento-card flex flex-col">
        <h3 className="font-bold text-bento-accent text-sm mb-4">Distribusi Akun</h3>
        <div className="h-[180px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={4}
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value: number) => formatIDR(value)}
                contentStyle={{ borderRadius: '12px', shadow: 'none', border: '1px solid #e2e8f0' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 space-y-1.5 flex-1">
          {pieData.slice(0, 3).map((item, index) => (
            <div key={item.name} className="flex items-center justify-between text-[10px] font-medium">
              <div className="flex items-center gap-2 truncate">
                <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                <span className="text-bento-text-sub truncate">{item.name}</span>
              </div>
              <span className="text-bento-accent">{formatPercent(item.value / (stats.totalRealisasi || 1))}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);
}

function StatCard({ title, value, icon: Icon, trend, trendColor = "text-bento-text-sub" }: any) {
  return (
    <motion.div 
      whileHover={{ y: -2 }}
      className="bento-card flex flex-col justify-between"
    >
      <div>
        <h4 className="bento-stat-label">{title}</h4>
        <p className="bento-stat-value">{value}</p>
      </div>
      <div className={cn("text-[10px] font-bold mt-4 flex items-center gap-1", trendColor)}>
        {trend}
      </div>
    </motion.div>
  );
}
