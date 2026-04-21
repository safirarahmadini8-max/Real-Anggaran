export interface SKPD {
  id: string;
  kode: string;
  nama: string;
  color?: string;
}

export interface Anggaran {
  id: string;
  skpdId: string;
  kodeProgram: string;
  namaProgram: string;
  kodeKegiatan: string;
  namaKegiatan: string;
  kodeSubKegiatan: string;
  namaSubKegiatan: string;
  kodeAkun: string;
  namaAkun: string;
  pagu: number;
}

export interface Realisasi {
  id: string;
  anggaranId: string;
  nilai: number;
  tanggal: string;
  keterangan: string;
}

