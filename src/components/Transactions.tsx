import React, { useState } from 'react';
import { 
  Plus, 
  Search, 
  Calendar as CalendarIcon, 
  ArrowRightLeft, 
  Trash2,
  Filter,
  X,
  Upload,
  TrendingUp
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { SKPD, Anggaran, Realisasi } from '../lib/types';
import { formatIDR, cn, generateId } from '../lib/utils';
import { format, isValid, parse } from 'date-fns';
import { useFirebase } from '../contexts/FirebaseContext';

export default function Transactions() {
  const { 
    anggarans, skpds, realisasis, quotaExceeded,
    saveRealisasi, saveRealisasisBulk, deleteRealisasi, deleteAllRealisasi 
  } = useFirebase();

  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    anggaranId: '',
    tanggal: format(new Date(), 'yyyy-MM-dd'),
    nilai: 0,
    keterangan: ''
  });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.anggaranId || formData.nilai <= 0) return;

    const newRealisasi: Realisasi = {
      id: generateId(),
      ...formData
    };

    saveRealisasi(newRealisasi);
    setShowAdd(false);
    setFormData({
      anggaranId: '',
      tanggal: format(new Date(), 'yyyy-MM-dd'),
      nilai: 0,
      keterangan: ''
    });
  };

  const filteredRealisasi = realisasis.filter(r => {
    const anggaran = anggarans.find(a => a.id === r.anggaranId);
    return r.keterangan.toLowerCase().includes(search.toLowerCase()) || 
           anggaran?.namaAkun.toLowerCase().includes(search.toLowerCase());
  });

  const handleImportRealisasi = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsSaving(true);
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const data = event.target?.result;
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const results = XLSX.utils.sheet_to_json(sheet) as any[];
          
          if (results.length === 0) {
            alert("File Excel kosong atau tidak terbaca.");
            setIsSaving(false);
            return;
          }

          const importedData: Realisasi[] = results
            .map((row: any) => {
              const normalizedRow: any = {};
              Object.keys(row).forEach(key => {
                const k = key.toLowerCase().replace(/[^a-z0-9]/g, '');
                
                if (k.includes('kodeskpd')) normalizedRow.skpd_kode = row[key];
                if (k.includes('koderekening') || k.includes('kodeakun')) normalizedRow.kode_akun = row[key];
                if (k === 'jumlah' || k === 'nilai' || k === 'pagu' || k.includes('jumlah') || k.includes('pagu')) normalizedRow.nilai = row[key];
                
                // Track hierarchy headers to support finding matching budget
                if (k.includes('kodeprogram')) normalizedRow.kode_program = row[key];
                if (k.includes('kodekegiatan') && !k.includes('sub')) normalizedRow.kode_kegiatan = row[key];
                if (k.includes('kodesub') || k.includes('kodesubkeg')) normalizedRow.kode_sub = row[key];
              });
              return normalizedRow;
            })
            .filter((row: any) => row.skpd_kode != null && row.kode_akun != null && row.nilai != null)
            .map((row: any) => {
              const skpd = skpds.find(s => s.kode === String(row.skpd_kode).trim());
              
              // Find budget with more precision if hierarchy info is available
              const anggaran = anggarans.find(a => {
                const matchBase = a.skpdId === skpd?.id && a.kodeAkun === String(row.kode_akun).trim();
                
                // If the file has sub-activities/programs, use them to narrow down (useful if accounts repeat across programs)
                if (row.kode_sub) return matchBase && a.kodeSubKegiatan === String(row.kode_sub).trim();
                if (row.kode_kegiatan) return matchBase && a.kodeKegiatan === String(row.kode_kegiatan).trim();
                if (row.kode_program) return matchBase && a.kodeProgram === String(row.kode_program).trim();
                
                return matchBase;
              });

              if (!anggaran) return null;

              // Clean numeric values
              let amount = 0;
              if (typeof row.nilai === 'number') {
                amount = row.nilai;
              } else {
                let cleanVal = String(row.nilai).replace(/[Rp\s]/gi, '');
                if (cleanVal.includes('.') && cleanVal.includes(',')) {
                  cleanVal = cleanVal.replace(/\./g, '').replace(',', '.');
                } else if (cleanVal.includes('.') && !cleanVal.includes(',')) {
                   if ((cleanVal.match(/\./g) || []).length > 1 || cleanVal.split('.')[1].length === 3) {
                     cleanVal = cleanVal.replace(/\./g, '');
                   }
                } else if (cleanVal.includes(',') && !cleanVal.includes('.')) {
                  cleanVal = cleanVal.replace(',', '.');
                }
                amount = Number(cleanVal.replace(/[^0-9.-]+/g, ""));
              }
              if (isNaN(amount)) amount = 0;

              // dateStr will always be today for imports as per user request to hide these columns
              let dateStr = format(new Date(), 'yyyy-MM-dd');

              return {
                id: generateId(),
                anggaranId: anggaran.id,
                tanggal: dateStr,
                nilai: amount,
                keterangan: 'Imported via Excel',
              };
            })
            .filter((r): r is Realisasi => r !== null);

          if (importedData.length > 0) {
            await saveRealisasisBulk(importedData);
            alert(`Berhasil mengimpor ${importedData.length} data Realisasi.`);
          } else {
            const keys = Object.keys(results[0]).join(', ');
            alert(`Gagal Impor Realisasi.\n\nKolom ditemukan: [${keys}]\n\nPastikan ada kolom:\n- Kode SKPD\n- Kode Rekening\n- Jumlah\n\nSerta pastikan data tersebut sudah ada di Data Master (Anggaran).`);
          }
        } catch (error: any) {
          console.error("Import error:", error);
          alert(`Gagal membaca file Excel: ${error.message || 'Format tidak dikenal'}`);
        } finally {
          setIsSaving(false);
          if (e.target) e.target.value = '';
        }
      };
      reader.onerror = () => {
        alert("Gagal membaca file.");
        setIsSaving(false);
      };
      reader.readAsArrayBuffer(file);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-black text-bento-accent text-2xl tracking-tight uppercase">Riwayat Realisasi</h3>
          <p className="text-xs text-bento-text-sub font-bold uppercase tracking-widest mt-1">Audit Log Transaksi Keuangan</p>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-bento-text-sub" />
            <input 
              type="text" 
              placeholder="Cari transaksi..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 pr-4 py-2.5 bg-white border border-bento-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-bento-primary/20 focus:border-bento-primary w-full sm:w-64 transition-all"
            />
          </div>
          <label className={cn(
            "flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all shadow-sm",
            (isSaving) ? "bg-slate-200 text-slate-400 cursor-not-allowed" : "bg-bento-accent text-white hover:bg-slate-800 cursor-pointer"
          )}>
            {isSaving ? (
              <>
                <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
                <span>Sinkronisasi...</span>
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                <span>Import</span>
                <input 
                  type="file" 
                  accept=".xlsx,.xls" 
                  className="hidden" 
                  disabled={isSaving}
                  onChange={handleImportRealisasi}
                />
              </>
            )}
          </label>
          <button 
            onClick={async () => {
              if (window.confirm('Apakah Anda yakin ingin menghapus SEMUA data realisasi? Tindakan ini tidak dapat dibatalkan.')) {
                setIsSaving(true);
                await deleteAllRealisasi();
                setIsSaving(false);
              }
            }}
            disabled={isSaving || realisasis.length === 0}
            className="flex items-center gap-2 px-5 py-2.5 bg-white border border-red-200 text-bento-danger rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-red-50 transition-all shadow-sm disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Trash2 className="w-4 h-4" />
            <span>Hapus Semua</span>
          </button>
          <button 
            onClick={() => setShowAdd(true)}
            disabled={false}
            className="flex items-center gap-2 px-5 py-2.5 bg-bento-primary text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-blue-700 transition-all shadow-md shadow-blue-100 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah</span>
          </button>
        </div>
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-bento-accent/40 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[24px] w-full max-w-md shadow-2xl overflow-hidden border border-bento-border animate-in fade-in zoom-in duration-300">
            <div className="p-8 border-b border-bento-border flex items-center justify-between bg-slate-50/50">
              <h4 className="font-black text-bento-accent uppercase tracking-tight">Input Transaksi Baru</h4>
              <button onClick={() => setShowAdd(false)} className="text-bento-text-sub hover:text-bento-accent transition-transform hover:scale-110">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAdd} className="p-8 space-y-5">
              <div>
                <label className="block text-[11px] font-bold text-bento-text-sub uppercase tracking-widest mb-2">Mata Anggaran</label>
                <select 
                  required
                  value={formData.anggaranId}
                  onChange={e => setFormData({...formData, anggaranId: e.target.value})}
                  className="w-full bg-slate-50 border border-bento-border rounded-xl px-4 py-3 text-sm font-bold text-bento-accent focus:ring-2 focus:ring-bento-primary/20 outline-none transition-all"
                >
                  <option value="">Pilih Anggaran...</option>
                  {anggarans.map(a => {
                    const skpd = skpds.find(s => s.id === a.skpdId);
                    return (
                      <option key={a.id} value={a.id}>
                        [{skpd?.kode}] {a.namaAkun}
                      </option>
                    )
                  })}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-bento-text-sub uppercase tracking-widest mb-2">Tanggal</label>
                  <input 
                    type="date"
                    required
                    value={formData.tanggal}
                    onChange={e => setFormData({...formData, tanggal: e.target.value})}
                    className="w-full bg-slate-50 border border-bento-border rounded-xl px-4 py-3 text-sm font-bold text-bento-accent focus:ring-2 focus:ring-bento-primary/20 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-bento-text-sub uppercase tracking-widest mb-2">Nilai (Rp)</label>
                  <input 
                    type="number"
                    required
                    placeholder="0"
                    value={formData.nilai || ''}
                    onChange={e => setFormData({...formData, nilai: Number(e.target.value)})}
                    className="w-full bg-slate-50 border border-bento-border rounded-xl px-4 py-3 text-sm font-bold text-bento-primary focus:ring-2 focus:ring-bento-primary/20 outline-none font-bold transition-all"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-bento-text-sub uppercase tracking-widest mb-2">Keterangan</label>
                <textarea 
                  rows={3}
                  value={formData.keterangan}
                  onChange={e => setFormData({...formData, keterangan: e.target.value})}
                  className="w-full bg-slate-50 border border-bento-border rounded-xl px-4 py-3 text-sm font-medium text-bento-accent focus:ring-2 focus:ring-bento-primary/20 outline-none resize-none transition-all"
                  placeholder="Contoh: Pembayaran Gaji Pegawai..."
                ></textarea>
              </div>
              <div className="flex gap-4 pt-4">
                <button 
                  type="button"
                  onClick={() => setShowAdd(false)}
                  className="flex-1 px-4 py-3 text-xs font-bold uppercase tracking-widest text-bento-text-sub bg-slate-100 rounded-xl hover:bg-slate-200 transition-all"
                >
                  Batal
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-4 py-3 text-xs font-bold uppercase tracking-widest text-white bg-bento-primary rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
                >
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bento-card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-bento-border">
                <th className="px-8 py-5 text-[11px] font-bold text-bento-text-sub uppercase tracking-widest">Tanggal</th>
                <th className="px-8 py-5 text-[11px] font-bold text-bento-text-sub uppercase tracking-widest">Akun / SKPD</th>
                <th className="px-8 py-5 text-[11px] font-bold text-bento-text-sub uppercase tracking-widest">Keterangan</th>
                <th className="px-8 py-5 text-[11px] font-bold text-bento-text-sub uppercase tracking-widest text-right">Nilai</th>
                <th className="px-8 py-5 text-[11px] font-bold text-bento-text-sub uppercase tracking-widest text-right">Opsi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bento-border">
              {quotaExceeded && (
                <tr>
                   <td colSpan={5} className="px-8 py-20 text-center">
                    <div className="flex flex-col items-center gap-3 text-red-500">
                      <TrendingUp className="w-10 h-10 rotate-180 opacity-50" />
                      <p className="text-sm font-bold uppercase tracking-widest">Batas Kuota Tercapai</p>
                      <p className="text-xs opacity-70">Sinkronisasi data tertunda. Anda melihat data dari cache lokal.</p>
                    </div>
                  </td>
                </tr>
              )}
              {filteredRealisasi.map((item) => {
                const anggaran = anggarans.find(a => a.id === item.anggaranId);
                const skpd = skpds.find(s => s.id === anggaran?.skpdId);
                return (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-all duration-200">
                    <td className="px-8 py-5 text-bento-text-sub font-mono font-bold">
                      {(() => {
                        const d = new Date(item.tanggal);
                        return isValid(d) ? format(d, 'dd/MM/yyyy') : item.tanggal;
                      })()}
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex flex-col">
                        <span className="font-bold text-bento-accent leading-tight">{anggaran?.namaAkun || 'No Account'}</span>
                        <span className="text-[10px] text-bento-text-sub font-bold uppercase tracking-tighter truncate max-w-[200px]">{skpd?.nama}</span>
                      </div>
                    </td>
                    <td className="px-8 py-5 text-bento-text-sub font-medium italic">
                      {item.keterangan || '-'}
                    </td>
                    <td className="px-8 py-5 text-right">
                      <span className="font-extrabold text-bento-success">
                        {formatIDR(item.nilai)}
                      </span>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <button 
                         onClick={() => deleteRealisasi(item.id)}
                        className="text-bento-text-sub hover:text-bento-danger transition-colors p-2 rounded-lg hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                )
              })}
              {filteredRealisasi.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-8 py-20 text-center">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-bento-border border-dashed">
                      <ArrowRightLeft className="w-7 h-7 text-bento-text-sub/40" />
                    </div>
                    <p className="text-sm font-bold text-bento-accent">Belum ada riwayat transaksi</p>
                    <p className="text-xs text-bento-text-sub mt-1">Gunakan tombol "Tambah" untuk mencatat pengeluaran.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Excel Template Helpers */}
      <div className="p-6 bg-white rounded-2xl border border-bento-border flex items-start gap-4 shadow-sm">
        <div className="p-3 bg-bento-primary/10 rounded-xl">
          <Upload className="w-5 h-5 text-bento-primary" />
        </div>
        <div>
          <h4 className="text-sm font-bold text-bento-accent mb-1">Panduan Struktur File Excel Realisasi</h4>
          <p className="text-xs text-bento-text-sub leading-relaxed">
            Gunakan struktur kolom yang sama dengan Import Anggaran untuk mengenali Mata Anggaran secara otomatis.
            Sistem akan mencocokkan transaksi berdasarkan hierarki kode yang tersedia.
          </p>
          <div className="mt-3 inline-block px-3 py-1.5 bg-slate-50 border border-bento-border rounded-lg font-mono text-[10px] text-bento-primary font-bold overflow-hidden text-ellipsis whitespace-nowrap max-w-full">
            Kode SKPD, SKPD, Kode Program, Program, Kode Kegiatan, Kegiatan, Kode Sub Kegaitan, Sub Kegiatan, Kode Rekening, Rekening, Jumlah
          </div>
        </div>
      </div>
    </div>
  );
}
