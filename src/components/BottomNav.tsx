import { ActiveTab } from '../types';
import { Home, LayoutGrid, Settings } from 'lucide-react';

interface BottomNavProps {
  activeTab: ActiveTab;
  onChangeTab: (tab: ActiveTab) => void;
}

export default function BottomNav({ activeTab, onChangeTab }: BottomNavProps) {
  return (
    <nav className="fixed bottom-0 inset-x-0 bg-white/95 border-t border-slate-200/80 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-40 backdrop-blur-md">
      <div className="max-w-[800px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-around">
        {/* Beranda */}
        <button
          type="button"
          onClick={() => onChangeTab('beranda')}
          className={`flex flex-col items-center justify-center w-20 py-1 transition-all cursor-pointer relative ${
            activeTab === 'beranda'
              ? 'text-[#1244a5] font-bold'
              : 'text-slate-400 hover:text-slate-600 font-medium'
          }`}
        >
          {activeTab === 'beranda' && (
            <span className="absolute -top-3 w-8 h-1 bg-[#1244a5] rounded-full" />
          )}
          <Home className="w-5 h-5 sm:w-5.5 sm:h-5.5 stroke-[2.2]" />
          <span className="text-[11px] sm:text-xs mt-1">Beranda</span>
        </button>

        {/* Menu */}
        <button
          type="button"
          onClick={() => onChangeTab('menu')}
          className={`flex flex-col items-center justify-center w-20 py-1 transition-all cursor-pointer relative ${
            activeTab === 'menu'
              ? 'text-[#1244a5] font-bold'
              : 'text-slate-400 hover:text-slate-600 font-medium'
          }`}
        >
          {activeTab === 'menu' && (
            <span className="absolute -top-3 w-8 h-1 bg-[#1244a5] rounded-full" />
          )}
          <LayoutGrid className="w-5 h-5 sm:w-5.5 sm:h-5.5 stroke-[2.2]" />
          <span className="text-[11px] sm:text-xs mt-1">Menu</span>
        </button>

        {/* Pengaturan */}
        <button
          type="button"
          onClick={() => onChangeTab('pengaturan')}
          className={`flex flex-col items-center justify-center w-20 py-1 transition-all cursor-pointer relative ${
            activeTab === 'pengaturan'
              ? 'text-[#1244a5] font-bold'
              : 'text-slate-400 hover:text-slate-600 font-medium'
          }`}
        >
          {activeTab === 'pengaturan' && (
            <span className="absolute -top-3 w-8 h-1 bg-[#1244a5] rounded-full" />
          )}
          <Settings className="w-5 h-5 sm:w-5.5 sm:h-5.5 stroke-[2.2]" />
          <span className="text-[11px] sm:text-xs mt-1">Pengaturan</span>
        </button>
      </div>
    </nav>
  );
}
