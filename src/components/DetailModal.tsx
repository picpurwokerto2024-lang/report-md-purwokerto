import { X, Calendar, MapPin, CheckCircle2, Phone, AlertCircle } from 'lucide-react';

interface DetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  updateDate?: string;
}

export default function DetailModal({ isOpen, onClose, updateDate = '13 Okt 2026' }: DetailModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-blue-100 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-blue-50 text-[#176fd0] flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#1244a5]">Update Informasi MD</h3>
              <p className="text-xs text-slate-400">Purwokerto & Area Sekitar • {updateDate}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-4 space-y-3.5 text-xs sm:text-sm text-slate-600">
          <div className="p-3.5 bg-blue-50/70 rounded-2xl border border-blue-100/80">
            <h4 className="font-bold text-[#1244a5] flex items-center gap-1.5 mb-1">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Sistem Sinkronisasi Google Sheets
            </h4>
            <p className="text-slate-600 leading-relaxed text-xs">
              Seluruh data laporan MD Pasar, MD Mobile, dan MD Stay terhubung langsung dengan Google Spreadsheets masing-masing personel secara realtime.
            </p>
          </div>

          <div className="p-3.5 bg-amber-50/70 rounded-2xl border border-amber-100">
            <h4 className="font-bold text-amber-800 flex items-center gap-1.5 mb-1">
              <AlertCircle className="w-4 h-4 text-amber-600" />
              Petunjuk Pengisian & Jadwal
            </h4>
            <ul className="list-disc pl-5 space-y-1 text-slate-600 text-xs">
              <li>Pastikan update data kunjungan toko dilakukan maksimal pukul 18:00 WIB setiap hari kerja.</li>
              <li>Untuk update promo MT dan GT, cek sheet Informasi Promo untuk periode bulan berjalan.</li>
              <li>Jika link spreadsheet tidak dapat diakses, silakan hubungi admin PIC Purwokerto.</li>
            </ul>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/60">
            <h4 className="font-bold text-slate-800 flex items-center gap-1.5 mb-1.5">
              <MapPin className="w-4 h-4 text-blue-600" />
              Cakupan Area Kunjungan
            </h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Purwokerto (PWK), Purbalingga (PBG), Ajibarang (AJB), Majenang, Cilacap, Kebumen, Wonosobo, Banjarnegara.
            </p>
          </div>

          <div className="flex items-center gap-2 p-3 bg-emerald-50/70 text-emerald-800 rounded-2xl text-xs">
            <Phone className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Kontak PIC: <strong>picpurwokerto2024@gmail.com</strong></span>
          </div>
        </div>

        <div className="mt-5 pt-3 border-t border-slate-100 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-[#176fd0] hover:bg-[#1258a5] text-white font-semibold text-xs transition-colors cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
