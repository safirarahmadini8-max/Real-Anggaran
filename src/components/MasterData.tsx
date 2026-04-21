import React, { useState } from 'react';
import { 
  Plus, 
  Upload, 
  Trash2, 
  Download, 
  Search, 
  Building2, 
  ListOrdered,
  Database,
  ChevronLeft,
  ChevronRight,
  TrendingUp
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { SKPD, Anggaran } from '../lib/types';
import { cn, formatIDR, generateId } from '../lib/utils';
import { useFirebase } from '../contexts/FirebaseContext';

const ITEMS_PER_PAGE = 50;

export default function MasterData() {
  const { 
    skpds, anggarans, dataLoading, quotaExceeded,
    saveSKPDsBulk, saveAnggaransBulk, 
    deleteSKPD, deleteAnggaran,
    deleteAllSKPDs, deleteAllAnggarans
  } = useFirebase();

  const [tab, setTab] = useState<'skpd' | 'anggaran'>('skpd');
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isSaving, setIsSaving] = useState(false);

  const handleImportSKPD = (e: React.ChangeEvent<HTMLInputElement>) => {
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

          const newData: SKPD[] = results
            .map((row: any) => {
              const normalizedRow: any = {};
              Object.keys(row).forEach(key => {
                const k = key.toLowerCase().replace(/[^a-z0-9]/g, '');
                if (k.includes('kode')) normalizedRow.kode = row[key];
                if (k.includes('nama') || k.includes('skpd')) normalizedRow.nama = row[key];
              });
              return normalizedRow;
            })
            .filter((row: any) => row.kode != null && row.nama != null)
            .map((row: any) => ({
              id: generateId(),
              kode: String(row.kode).trim(),
              nama: String(row.nama).trim(),
            }));

          if (newData.length > 0) {
            await saveSKPDsBulk(newData);
            alert(`Berhasil mengimpor ${newData.length} data SKPD.`);
          } else {
            const detectedKeys = results[0] ? Object.keys(results[0]).join(', ') : 'File kosong';
            alert(`Gagal Impor SKPD.\n\nKolom yang ditemukan di Excel: [${detectedKeys}]\n\nPastikan ada kolom dengan nama:\n- "Kode"\n- "Nama" atau "SKPD"`);
          }
        } catch (error: any) {
          console.error("Import error:", error);
          alert(`Gagal membaca file Excel: ${error.message || 'Error tidak diketahui'}`);
        } finally {
          setIsSaving(false);
          if (e.target) e.target.value = '';
        }
      };
      reader.readAsArrayBuffer(file);
    }
  };

  const handleImportAnggaran = (e: React.ChangeEvent<HTMLInputElement>) => {
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

          const newData: Anggaran[] = results
            .map((row: any) => {
              const normalizedRow: any = {};
              Object.keys(row).forEach(key => {
                // Remove spaces and make lowercase for very robust matching
                const k = key.toLowerCase().replace(/[^a-z0-9]/g, '');
                
                if (k.includes('kodeskpd')) normalizedRow.skpd_kode = row[key];
                if (k.includes('koderekening') || k.includes('kodeakun')) normalizedRow.kode_akun = row[key];
                if ((k === 'rekening' || k === 'namaakun') || (k.includes('rekening') && !k.includes('kode'))) normalizedRow.nama_akun = row[key];
                if (k === 'jumlah' || k === 'pagu' || k.includes('jumlah') || k.includes('pagu')) normalizedRow.jumlah = row[key];
                if (k.includes('kodeprogram')) normalizedRow.kode_program = row[key];
                if (k === 'program' || (k.includes('program') && !k.includes('kode'))) normalizedRow.program = row[key];
                if (k.includes('kodekegiatan') && !k.includes('sub')) normalizedRow.kode_kegiatan = row[key];
                if (k === 'kegiatan' || (k.includes('kegiatan') && !k.includes('sub') && !k.includes('kode'))) normalizedRow.kegiatan = row[key];
                if (k.includes('kodesub') || k.includes('kodesubkeg')) normalizedRow.kode_sub = row[key];
                if (k.includes('subkeg') && !k.includes('kode')) normalizedRow.sub = row[key];
              });
              return normalizedRow;
            })
            .filter((row: any) => {
              // Row is valid if it has at least localized skpd_kode, kode_akun, and a numeric-like jumlah
              return row.skpd_kode != null && row.kode_akun != null && row.jumlah != null;
            })
            .map((row: any) => {
              const targetSkpdKode = String(row.skpd_kode).trim();
              const skpd = skpds.find(s => s.kode === targetSkpdKode);
              
              // Clean numeric values (remove currency symbols, handle Indonesian formats)
              let amount = 0;
              if (typeof row.jumlah === 'number') {
                amount = row.jumlah;
              } else {
                // Handle Indonesian format: dots as thousand separator, comma as decimal
                // First, remove any currency labels or spaces
                let cleanVal = String(row.jumlah).replace(/[Rp\s]/gi, '');
                
                // If there are both dots and commas, it's definitely formatted (e.g. 1.234,56)
                if (cleanVal.includes('.') && cleanVal.includes(',')) {
                  cleanVal = cleanVal.replace(/\./g, '').replace(',', '.');
                } 
                // If only dots, could be thousand sep (1.000.000) or decimal (1.23)
                else if (cleanVal.includes('.') && !cleanVal.includes(',')) {
                   // If multiple dots, it's thousand separators (1.000.000)
                   if ((cleanVal.match(/\./g) || []).length > 1) {
                     cleanVal = cleanVal.replace(/\./g, '');
                   }
                   // If one dot and 3 digits after, it's likely thousand sep (1.000)
                   else if (cleanVal.split('.')[1].length === 3) {
                     cleanVal = cleanVal.replace('.', '');
                   }
                }
                // If only comma, it's likely decimal
                else if (cleanVal.includes(',') && !cleanVal.includes('.')) {
                  cleanVal = cleanVal.replace(',', '.');
                }

                amount = Number(cleanVal.replace(/[^0-9.-]+/g, ""));
              }

              if (isNaN(amount)) amount = 0;

              return {
                id: generateId(),
                skpdId: skpd?.id || '',
                kodeProgram: String(row.kode_program || '').trim(),
                namaProgram: String(row.program || '').trim(),
                kodeKegiatan: String(row.kode_kegiatan || '').trim(),
                namaKegiatan: String(row.kegiatan || '').trim(),
                kodeSubKegiatan: String(row.kode_sub || '').trim(),
                namaSubKegiatan: String(row.sub || '').trim(),
                kodeAkun: String(row.kode_akun).trim(),
                namaAkun: String(row.nama_akun || 'No Name').trim(),
                pagu: amount,
              };
            });

          if (newData.length > 0) {
            await saveAnggaransBulk(newData);
            alert(`Berhasil mengimpor ${newData.length} data Anggaran.`);
          } else {
            const detectedKeys = Object.keys(results[0]).join(', ');
            alert(`Gagal Impor Anggaran.\n\nKolom yang ditemukan di Excel: [${detectedKeys}]\n\nPastikan ada kolom dengan nama:\n- "Kode SKPD"\n- "Kode Rekening"\n- "Jumlah"`);
          }
        } catch (error) {
          console.error("Import error:", error);
          alert("Gagal membaca file Excel. Pastikan file dalam format .xlsx atau .xls.");
        } finally {
          setIsSaving(false);
          if (e.target) e.target.value = '';
        }
      };
      reader.onerror = () => alert("Gagal membaca file.");
      reader.readAsArrayBuffer(file);
    }
  };

  const filteredSkpds = React.useMemo(() => skpds.filter(s => 
    s.nama.toLowerCase().includes(search.toLowerCase()) || 
    s.kode.toLowerCase().includes(search.toLowerCase())
  ), [skpds, search]);

  const filteredAnggarans = React.useMemo(() => anggarans.filter(a => {
    const skpd = skpds.find(s => s.id === a.skpdId);
    const searchLower = search.toLowerCase();
    return a.namaAkun.toLowerCase().includes(searchLower) || 
           a.kodeAkun.toLowerCase().includes(searchLower) ||
           (a.namaProgram || '').toLowerCase().includes(searchLower) ||
           (a.namaKegiatan || '').toLowerCase().includes(searchLower) ||
           (a.namaSubKegiatan || '').toLowerCase().includes(searchLower) ||
           skpd?.nama.toLowerCase().includes(searchLower);
  }), [anggarans, skpds, search]);

  const totalItems = tab === 'skpd' ? filteredSkpds.length : filteredAnggarans.length;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);

  // Reset page when search, tab, or total data length changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [search, tab, totalItems]);
  const currentData = React.useMemo(() => {
    const list = tab === 'skpd' ? filteredSkpds : filteredAnggarans;
    return list.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  }, [tab, filteredSkpds, filteredAnggarans, currentPage]);

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex bg-bento-border/30 p-1 rounded-xl border border-bento-border w-fit">
          <button 
            onClick={() => setTab('skpd')}
            className={cn(
              "px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all",
              tab === 'skpd' ? "bg-white text-bento-accent shadow-sm" : "text-bento-text-sub hover:text-bento-accent"
            )}
          >
            Data SKPD
          </button>
          <button 
            onClick={() => setTab('anggaran')}
            className={cn(
              "px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all",
              tab === 'anggaran' ? "bg-white text-bento-accent shadow-sm" : "text-bento-text-sub hover:text-bento-accent"
            )}
          >
            Data Anggaran
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={async () => {
              const msg = tab === 'skpd' 
                ? 'Apakah Anda yakin ingin menghapus SEMUA data SKPD?' 
                : 'Apakah Anda yakin ingin menghapus SEMUA data Anggaran?';
              if (window.confirm(msg + ' Tindakan ini tidak dapat dibatalkan.')) {
                setIsSaving(true);
                if (tab === 'skpd') await deleteAllSKPDs();
                else await deleteAllAnggarans();
                setIsSaving(false);
              }
            }}
            disabled={isSaving || (tab === 'skpd' ? skpds.length === 0 : anggarans.length === 0)}
            className="flex items-center gap-2 px-5 py-2.5 bg-white border border-red-200 text-bento-danger rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-red-50 transition-all shadow-sm disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Trash2 className="w-4 h-4" />
            <span>Hapus Semua</span>
          </button>
          
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-bento-text-sub" />
            <input 
              type="text" 
              placeholder="Cari data..." 
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
              </>
            )}
            <input 
              type="file" 
              accept=".xlsx,.xls" 
              className="hidden" 
              disabled={isSaving}
              onChange={tab === 'skpd' ? handleImportSKPD : handleImportAnggaran}
            />
          </label>
        </div>
      </div>

      <div className="bento-card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-bento-border">
                <th className="px-8 py-5 text-[11px] font-bold text-bento-text-sub uppercase tracking-widest">
                  {tab === 'skpd' ? 'ID Unit' : 'Unit Kerja'}
                </th>
                {tab === 'anggaran' && (
                  <>
                    <th className="px-8 py-5 text-[11px] font-bold text-bento-text-sub uppercase tracking-widest">
                      Program / Kegiatan
                    </th>
                    <th className="px-8 py-5 text-[11px] font-bold text-bento-text-sub uppercase tracking-widest">
                      Sub Kegiatan / Rekening
                    </th>
                  </>
                )}
                {tab === 'skpd' && (
                  <th className="px-8 py-5 text-[11px] font-bold text-bento-text-sub uppercase tracking-widest">
                    Nama Unit
                  </th>
                )}
                {tab === 'anggaran' && (
                  <th className="px-8 py-5 text-[11px] font-bold text-bento-text-sub uppercase tracking-widest text-right">
                    Pagu (Rp)
                  </th>
                )}
                <th className="px-8 py-5 text-[11px] font-bold text-bento-text-sub uppercase tracking-widest text-right">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bento-border">
              {(tab === 'skpd' ? dataLoading.skpds : dataLoading.anggarans) && !quotaExceeded && (
                <tr>
                  <td colSpan={tab === 'skpd' ? 3 : 5} className="px-8 py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-8 h-8 border-2 border-bento-primary border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-xs font-bold text-bento-text-sub uppercase tracking-widest animate-pulse">Sinkronisasi Cloud...</p>
                    </div>
                  </td>
                </tr>
              )}
              {quotaExceeded && (
                <tr>
                   <td colSpan={tab === 'skpd' ? 3 : 5} className="px-8 py-20 text-center">
                    <div className="flex flex-col items-center gap-3 text-red-500">
                      <TrendingUp className="w-10 h-10 rotate-180 opacity-50" />
                      <p className="text-sm font-bold uppercase tracking-widest">Batas Kuota Tercapai</p>
                      <p className="text-xs opacity-70">Sistem hanya dapat membaca data lokal. Penulisan data baru akan aktif kembali besok.</p>
                    </div>
                  </td>
                </tr>
              )}
              {!(tab === 'skpd' ? dataLoading.skpds : dataLoading.anggarans) && !quotaExceeded && currentData.length === 0 && (
                <tr>
                  <td colSpan={tab === 'skpd' ? 3 : 5} className="px-8 py-20 text-center">
                    <div className="flex flex-col items-center gap-3 text-bento-text-sub opacity-50">
                      <Database className="w-10 h-10" />
                      <p className="text-sm font-medium">Belum ada data {tab === 'skpd' ? 'SKPD' : 'Anggaran'}</p>
                    </div>
                  </td>
                </tr>
              )}
              {tab === 'skpd' ? (
                currentData.map((skpd) => (
                  <tr key={skpd.id} className="hover:bg-slate-50/50 transition-all duration-200">
                    <td className="px-8 py-5 text-sm font-mono text-bento-primary font-bold">{skpd.id.startsWith('temp-') ? '(Baru)' : skpd.kode}</td>
                    <td className="px-8 py-5 text-sm font-bold text-bento-accent">{skpd.nama}</td>
                    <td className="px-8 py-5 text-sm text-right">
                      <button 
                        onClick={() => deleteSKPD(skpd.id)}
                        className="text-bento-text-sub hover:text-bento-danger transition-colors p-2 rounded-lg hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                (currentData as Anggaran[]).map((anggaran) => {
                  const skpd = skpds.find(s => s.id === anggaran.skpdId);
                  return (
                    <tr key={anggaran.id} className="hover:bg-slate-50/50 transition-all duration-200">
                      <td className="px-8 py-5 align-top">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-bento-accent leading-tight">{skpd?.nama || 'Tanpa Unit'}</span>
                          <span className="text-[10px] font-bold text-bento-text-sub uppercase tracking-tighter">{skpd?.kode}</span>
                        </div>
                      </td>
                      <td className="px-8 py-5 align-top">
                        <div className="flex flex-col gap-2">
                          <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-bento-text-sub uppercase tracking-tighter">Program</span>
                            <span className="text-xs font-bold text-bento-accent">{anggaran.namaProgram || '-'}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-bento-text-sub uppercase tracking-tighter">Kegiatan</span>
                            <span className="text-xs font-medium text-bento-accent">{anggaran.namaKegiatan || '-'}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-5 align-top">
                        <div className="flex flex-col gap-2">
                          <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-bento-text-sub uppercase tracking-tighter">Sub Kegiatan</span>
                            <span className="text-xs font-medium text-bento-accent">{anggaran.namaSubKegiatan || '-'}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-bento-text-sub uppercase tracking-tighter text-bento-primary">Rekening</span>
                            <span className="text-sm font-bold text-bento-primary">{anggaran.namaAkun}</span>
                            <span className="text-[11px] font-mono font-medium text-bento-text-sub">{anggaran.kodeAkun}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-5 text-sm font-black text-right text-bento-accent align-top">
                        {formatIDR(anggaran.pagu)}
                      </td>
                      <td className="px-8 py-5 text-sm text-right align-top">
                        <button 
                          onClick={() => deleteAnggaran(anggaran.id)}
                          className="text-bento-text-sub hover:text-bento-danger transition-colors p-2 rounded-lg hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
              {(tab === 'skpd' ? filteredSkpds : filteredAnggarans).length === 0 && (
                <tr>
                  <td colSpan={tab === 'skpd' ? 3 : 5} className="px-8 py-20 text-center">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-bento-border border-dashed">
                      <Database className="w-7 h-7 text-bento-text-sub/40" />
                    </div>
                    <p className="text-sm font-bold text-bento-accent">Belum ada data tersedia</p>
                    <p className="text-xs text-bento-text-sub mt-1">Gunakan fitur import untuk memulai.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="px-8 py-4 bg-slate-50 border-t border-bento-border flex items-center justify-between">
            <div className="text-xs font-bold text-bento-text-sub uppercase tracking-widest">
              Menampilkan {(currentPage - 1) * ITEMS_PER_PAGE + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, totalItems)} dari {totalItems} data
            </div>
            <div className="flex items-center gap-2">
              <button 
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => prev - 1)}
                className="p-2 bg-white border border-bento-border rounded-lg disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-50 transition-all"
              >
                <ChevronLeft className="w-4 h-4 text-bento-accent" />
              </button>
              <span className="text-xs font-bold text-bento-accent px-4 py-2 bg-white border border-bento-border rounded-lg shadow-sm">
                Hal {currentPage} / {totalPages}
              </span>
              <button 
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => prev + 1)}
                className="p-2 bg-white border border-bento-border rounded-lg disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-50 transition-all"
              >
                <ChevronRight className="w-4 h-4 text-bento-accent" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* CSV Template Helpers */}
      <div className="p-6 bg-white rounded-2xl border border-bento-border flex items-start gap-4 shadow-sm">
        <div className="p-3 bg-bento-primary/10 rounded-xl">
          <Download className="w-5 h-5 text-bento-primary" />
        </div>
        <div>
          <h4 className="text-sm font-bold text-bento-accent mb-1">Panduan Struktur File Excel</h4>
          <p className="text-xs text-bento-text-sub leading-relaxed">
            Pastikan header file sesuai dengan kriteria berikut agar proses sinkronisasi berjalan normal.
          </p>
          <div className="mt-3 inline-block px-3 py-1.5 bg-slate-50 border border-bento-border rounded-lg font-mono text-[10px] text-bento-primary font-bold overflow-hidden text-ellipsis whitespace-nowrap max-w-full">
            {tab === 'skpd' ? 'kode, nama' : 'Kode SKPD, SKPD, Kode Program, Program, Kode Kegiatan, Kegiatan, Kode Sub Kegaitan, Sub Kegiatan, Kode Rekening, Rekening, Jumlah'}
          </div>
        </div>
      </div>
    </div>
  );
}
