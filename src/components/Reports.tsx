import React, { useState, useMemo } from 'react';
import { 
  FileText, 
  Printer, 
  Download, 
  ChevronDown, 
  ChevronUp,
  Filter,
  CheckCircle2,
  Search
} from 'lucide-react';
import { format } from 'date-fns';
import { SKPD, Anggaran, Realisasi } from '../lib/types';
import { formatIDR, formatPercent, cn } from '../lib/utils';
import { useFirebase } from '../contexts/FirebaseContext';

type ReportType = 'skpd' | 'program' | 'kegiatan' | 'sub' | 'akun';

export default function Reports() {
  const { skpds, anggarans, realisasis } = useFirebase();
  const [type, setType] = useState<ReportType>('skpd');
  const [selectedSkpdId, setSelectedSkpdId] = useState<string>('');
  const [accountSearch, setAccountSearch] = useState<string>('');
  const [skpdSearch, setSkpdSearch] = useState<string>('');
  const [showSkpdList, setShowSkpdList] = useState(false);

  const filteredSkpds = useMemo(() => {
    return skpds
      .filter(s => s.nama.toLowerCase().includes(skpdSearch.toLowerCase()))
      .sort((a, b) => a.nama.localeCompare(b.nama));
  }, [skpds, skpdSearch]);

  const filteredAnggarans = useMemo(() => {
    let result = anggarans;
    if (selectedSkpdId) result = result.filter(a => a.skpdId === selectedSkpdId);
    if (accountSearch) {
      result = result.filter(a => 
        a.namaAkun.toLowerCase().includes(accountSearch.toLowerCase()) ||
        a.kodeAkun.toLowerCase().includes(accountSearch.toLowerCase())
      );
    }
    return result;
  }, [anggarans, selectedSkpdId, accountSearch]);

  const filteredRealisasis = useMemo(() => {
    let result = realisasis;
    if (selectedSkpdId) {
      result = result.filter(r => {
        const a = anggarans.find(ang => ang.id === r.anggaranId);
        return a?.skpdId === selectedSkpdId;
      });
    }
    if (accountSearch) {
      result = result.filter(r => {
        const a = anggarans.find(ang => ang.id === r.anggaranId);
        return a && (
          a.namaAkun.toLowerCase().includes(accountSearch.toLowerCase()) ||
          a.kodeAkun.toLowerCase().includes(accountSearch.toLowerCase())
        );
      });
    }
    return result;
  }, [realisasis, anggarans, selectedSkpdId, accountSearch]);

  const reportData = useMemo(() => {
    // Pre-map anggaran to details for fast lookup
    const anggaranMap: Record<string, Anggaran> = {};
    anggarans.forEach(a => { anggaranMap[a.id] = a; });

    if (type === 'skpd') {
      const skpdPagu: Record<string, number> = {};
      const skpdReal: Record<string, number> = {};

      anggarans.forEach(a => {
        skpdPagu[a.skpdId] = (skpdPagu[a.skpdId] || 0) + a.pagu;
      });

      realisasis.forEach(r => {
        const a = anggaranMap[r.anggaranId];
        if (a) {
          skpdReal[a.skpdId] = (skpdReal[a.skpdId] || 0) + r.nilai;
        }
      });

      const targetSkpds = selectedSkpdId 
        ? skpds.filter(s => s.id === selectedSkpdId)
        : skpds;

      return targetSkpds.map(skpd => {
        const pagu = skpdPagu[skpd.id] || 0;
        const real = skpdReal[skpd.id] || 0;
        return {
          id: skpd.id,
          label: skpd.nama,
          sublabel: skpd.kode,
          pagu,
          realisasi: real,
          sisa: pagu - real,
          persen: pagu > 0 ? real / pagu : 0
        };
      }).sort((a, b) => b.pagu - a.pagu);

    } else if (type === 'akun' && accountSearch) {
      // Specialized detailed view for account search
      return filteredAnggarans.map(a => {
        const realisasi = realisasis
          .filter(r => r.anggaranId === a.id)
          .reduce((sum, item) => sum + item.nilai, 0);
        
        const skpd = skpds.find(s => s.id === a.skpdId);
        
        return {
          id: a.id,
          label: a.namaAkun,
          sublabel: `${a.kodeAkun} • ${skpd?.nama || 'Unknown SKPD'} • ${a.namaProgram}`,
          pagu: a.pagu,
          realisasi,
          sisa: a.pagu - realisasi,
          persen: a.pagu > 0 ? realisasi / a.pagu : 0
        };
      }).sort((a, b) => b.pagu - a.pagu);
    } else {
      // Group by various hierarchical levels
      const groups: Record<string, { pagu: number, realisasi: number, kode: string }> = {};
      
      filteredAnggarans.forEach(a => {
        let label = '';
        let kode = '';
        
        if (type === 'program') { label = a.namaProgram || 'No Program'; kode = a.kodeProgram; }
        else if (type === 'kegiatan') { label = a.namaKegiatan || 'No Kegiatan'; kode = a.kodeKegiatan; }
        else if (type === 'sub') { label = a.namaSubKegiatan || 'No Sub Kegiatan'; kode = a.kodeSubKegiatan; }
        else if (type === 'akun') { label = a.namaAkun || 'No Rekening'; kode = a.kodeAkun; }

        if (!groups[label]) groups[label] = { pagu: 0, realisasi: 0, kode: kode };
        groups[label].pagu += a.pagu;
      });

      filteredRealisasis.forEach(r => {
        const a = anggaranMap[r.anggaranId];
        if (a) {
          let label = '';
          if (type === 'program') label = a.namaProgram || 'No Program';
          else if (type === 'kegiatan') label = a.namaKegiatan || 'No Kegiatan';
          else if (type === 'sub') label = a.namaSubKegiatan || 'No Sub Kegiatan';
          else if (type === 'akun') label = a.namaAkun || 'No Rekening';

          if (groups[label]) {
            groups[label].realisasi += r.nilai;
          }
        }
      });

      return Object.entries(groups).map(([label, data]) => ({
        id: label,
        label,
        sublabel: data.kode,
        pagu: data.pagu,
        realisasi: data.realisasi,
        sisa: data.pagu - data.realisasi,
        persen: data.pagu > 0 ? data.realisasi / data.pagu : 0
      })).sort((a, b) => b.pagu - a.pagu);
    }
  }, [type, skpds, anggarans, realisasis, filteredAnggarans, filteredRealisasis, selectedSkpdId, accountSearch]);

  const totals = useMemo(() => {
    return reportData.reduce((acc, curr) => ({
      pagu: acc.pagu + curr.pagu,
      realisasi: acc.realisasi + curr.realisasi,
      sisa: acc.sisa + curr.sisa
    }), { pagu: 0, realisasi: 0, sisa: 0 });
  }, [reportData]);

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap bg-bento-border/30 p-1 rounded-xl border border-bento-border w-fit gap-1">
            <button 
              onClick={() => setType('skpd')}
              className={cn(
                 "px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all",
                type === 'skpd' ? "bg-white text-bento-accent shadow-sm" : "text-bento-text-sub hover:text-bento-accent"
              )}
            >
              SKPD
            </button>
            <button 
              onClick={() => setType('program')}
              className={cn(
                "px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all",
                type === 'program' ? "bg-white text-bento-accent shadow-sm" : "text-bento-text-sub hover:text-bento-accent"
              )}
            >
              Program
            </button>
            <button 
              onClick={() => setType('kegiatan')}
              className={cn(
                "px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all",
                type === 'kegiatan' ? "bg-white text-bento-accent shadow-sm" : "text-bento-text-sub hover:text-bento-accent"
              )}
            >
              Kegiatan
            </button>
            <button 
              onClick={() => setType('sub')}
              className={cn(
                "px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all",
                type === 'sub' ? "bg-white text-bento-accent shadow-sm" : "text-bento-text-sub hover:text-bento-accent"
              )}
            >
              Sub Kegiatan
            </button>
            <button 
              onClick={() => setType('akun')}
              className={cn(
                "px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all",
                type === 'akun' ? "bg-white text-bento-accent shadow-sm" : "text-bento-text-sub hover:text-bento-accent"
              )}
            >
              Rekening
            </button>
          </div>

          <div className="relative group no-print">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-bento-text-sub pointer-events-none" />
            <input 
              type="text" 
              placeholder="Cari Rekening..." 
              value={accountSearch}
              onChange={(e) => setAccountSearch(e.target.value)}
              className="pl-9 pr-4 py-2.5 bg-white border border-bento-border rounded-xl text-xs font-bold text-bento-accent focus:ring-2 focus:ring-bento-primary/20 appearance-none shadow-sm hover:border-bento-primary/30 transition-all outline-none w-48 sm:w-64"
            />
          </div>

          <div className="relative group no-print">
            <Filter className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-bento-text-sub pointer-events-none" />
            <div className="relative">
              <input 
                type="text" 
                placeholder="Pilih SKPD (Ketik...)"
                value={selectedSkpdId ? skpds.find(s => s.id === selectedSkpdId)?.nama : skpdSearch}
                onChange={(e) => {
                  setSkpdSearch(e.target.value);
                  if (selectedSkpdId) {
                    setSelectedSkpdId('');
                  }
                }}
                onFocus={() => setShowSkpdList(true)}
                className="pl-9 pr-10 py-2.5 bg-white border border-bento-border rounded-xl text-xs font-bold text-bento-accent focus:ring-2 focus:ring-bento-primary/20 shadow-sm hover:border-bento-primary/30 transition-all outline-none w-48 sm:w-64"
              />
              <button 
                onClick={() => setShowSkpdList(!showSkpdList)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-bento-text-sub hover:text-bento-accent transition-colors"
              >
                <ChevronDown className="w-4 h-4" />
              </button>

              {showSkpdList && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-bento-border rounded-xl shadow-xl z-50 max-h-64 overflow-y-auto overflow-x-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                  <div 
                    onClick={() => {
                      setSelectedSkpdId('');
                      setSkpdSearch('');
                      setShowSkpdList(false);
                    }}
                    className="px-4 py-2.5 text-xs font-bold text-bento-text-sub hover:bg-slate-50 cursor-pointer border-b border-slate-50"
                  >
                    Semua SKPD
                  </div>
                  {filteredSkpds.map(skpd => (
                    <div 
                      key={skpd.id}
                      onClick={() => {
                        setSelectedSkpdId(skpd.id);
                        setSkpdSearch(skpd.nama);
                        setShowSkpdList(false);
                      }}
                      className="px-4 py-2.5 text-xs font-bold text-bento-accent hover:bg-slate-50 cursor-pointer border-b border-slate-50 flex flex-col"
                    >
                      <span>{skpd.nama}</span>
                      <span className="text-[10px] text-bento-text-sub">{skpd.kode}</span>
                    </div>
                  ))}
                  {filteredSkpds.length === 0 && (
                    <div className="px-4 py-8 text-center text-xs text-bento-text-sub font-bold">
                      SKPD tidak ditemukan
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <button 
          onClick={() => window.print()}
          className="flex items-center gap-2 px-5 py-2.5 bg-bento-accent text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-slate-800 transition-all shadow-sm"
        >
          <Printer className="w-4 h-4" />
          <span>Cetak Laporan</span>
        </button>
      </div>

      <div className="bento-card p-0 overflow-hidden print:border-none print:shadow-none">
        <div className="p-10 border-b border-bento-border flex justify-between items-center bg-slate-50/50">
          <div>
            <h2 className="text-2xl font-black text-bento-accent tracking-tight uppercase">
              LAPORAN REALISASI ANGGARAN
            </h2>
            <p className="text-sm text-bento-text-sub font-bold mt-1 uppercase tracking-widest">
              Basis {
                type === 'skpd' ? 'Unit Kerja (SKPD)' : 
                type === 'program' ? 'Program' : 
                type === 'kegiatan' ? 'Kegiatan' : 
                type === 'sub' ? 'Sub Kegiatan' : 
                'Mata Anggaran (Rekening)'
              } {selectedSkpdId ? `• ${skpds.find(s => s.id === selectedSkpdId)?.nama}` : ''} • 2026
            </p>
          </div>
          <div className="text-right">
            <div className="w-14 h-14 bg-bento-accent rounded-xl flex items-center justify-center text-white font-black text-2xl ml-auto mb-2 shadow-lg">
              A
            </div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-bento-text-sub">SI-REALISASI SYSTEMS</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50">
                <th className="px-8 py-5 text-[11px] font-bold text-bento-text-sub uppercase tracking-widest border-b border-bento-border">
                  {
                    type === 'skpd' ? 'Unit / Dinas' : 
                    type === 'program' ? 'Uraian Program' : 
                    type === 'kegiatan' ? 'Uraian Kegiatan' : 
                    type === 'sub' ? 'Uraian Sub Kegiatan' : 
                    'Uraian Rekening Belanja'
                  }
                </th>
                <th className="px-8 py-5 text-[11px] font-bold text-bento-text-sub uppercase tracking-widest border-b border-bento-border text-right">
                  Pagu
                </th>
                <th className="px-8 py-5 text-[11px] font-bold text-bento-text-sub uppercase tracking-widest border-b border-bento-border text-right">
                  Realisasi
                </th>
                <th className="px-8 py-5 text-[11px] font-bold text-bento-text-sub uppercase tracking-widest border-b border-bento-border text-right">
                  Sisa (SiLPA)
                </th>
                <th className="px-8 py-5 text-[11px] font-bold text-bento-text-sub uppercase tracking-widest border-b border-bento-border text-center">
                  Capaian
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bento-border">
              {reportData.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/10">
                  <td className="px-8 py-5">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-bento-accent">{row.label}</span>
                      <span className="text-[10px] text-bento-text-sub font-bold uppercase tracking-tighter">{row.sublabel}</span>
                    </div>
                  </td>
                  <td className="px-8 py-5 text-sm text-right font-bold text-bento-text-sub">
                    {formatIDR(row.pagu)}
                  </td>
                  <td className="px-8 py-5 text-sm text-right font-bold text-bento-primary">
                    {formatIDR(row.realisasi)}
                  </td>
                  <td className="px-8 py-5 text-sm text-right font-bold text-bento-warning">
                    {formatIDR(row.sisa)}
                  </td>
                  <td className="px-8 py-5 text-center">
                    <div className="flex flex-col items-center gap-1.5">
                      <div className="w-16 h-1.5 bg-bento-border rounded-full overflow-hidden">
                        <div 
                          className={cn(
                            "h-full transition-all duration-500",
                            row.persen >= 1 ? "bg-bento-success" : "bg-bento-primary"
                          )} 
                          style={{ width: `${Math.min(row.persen * 100, 100)}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-black text-bento-accent">{formatPercent(row.persen)}</span>
                    </div>
                  </td>
                </tr>
              ))}
              
              {/* Footer Totals */}
              <tr className="bg-slate-50 font-black border-t-2 border-slate-200">
                <td className="px-8 py-6 text-sm text-bento-accent uppercase tracking-widest">Aggregate Total</td>
                <td className="px-8 py-6 text-sm text-right text-bento-accent">{formatIDR(totals.pagu)}</td>
                <td className="px-8 py-6 text-sm text-right text-bento-primary">{formatIDR(totals.realisasi)}</td>
                <td className="px-8 py-6 text-sm text-right text-bento-warning">{formatIDR(totals.sisa)}</td>
                <td className="px-8 py-6 text-center text-bento-accent">
                   {formatPercent(totals.pagu > 0 ? totals.realisasi / totals.pagu : 0)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="p-10 flex justify-between items-start text-xs text-bento-text-sub border-t border-bento-border bg-slate-50/20">
          <p className="font-medium">Sistem Terverifikasi • {format(new Date(), 'dd MMM yyyy HH:mm')}</p>
          <div className="text-center w-64">
            <p className="mb-20 font-bold uppercase tracking-widest">Sekretaris Daerah Provinsi NTB,</p>
            <div className="h-px bg-bento-accent w-full mb-2"></div>
            <p className="font-extrabold text-bento-accent text-sm">Abul Chair, Ak</p>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          aside, header, nav, button, .no-print {
            display: none !important;
          }
          main {
            padding: 0 !important;
            margin: 0 !important;
            background: white !important;
          }
          body {
            background: white !important;
          }
        }
      `}</style>
    </div>
  );
}
