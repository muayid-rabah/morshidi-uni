import React from 'react';
import { useStudent } from '../../context/StudentContext';
import { Sparkles, ExternalLink } from 'lucide-react';

export const FloatingAssistant: React.FC = () => {
  const { setActivePage, activePage } = useStudent();
  const morshidiUrl = 'https://morshidi.vercel.app/';

  // If already on the smart assistant page, don't show floating button
  if (activePage === 'smart-assistant') return null;

  return (
    <div className="fixed bottom-6 right-6 z-40 text-right font-arabic">
      <button
        onClick={() => setActivePage('smart-assistant')}
        className="flex items-center gap-2.5 px-4 py-3 rounded-full bg-white text-univ-900 font-bold text-xs sm:text-sm shadow-elevated hover:shadow-soft-lg hover:scale-105 transition-all group border border-univ-200"
        title="فتح مرشدي الذكي"
      >
        <Sparkles className="w-4 h-4 text-amber-500 animate-spin group-hover:rotate-45 transition-transform" />
        <span>مرشدي الذكي</span>
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-univ-50 text-univ-800 font-mono">AI</span>
      </button>
    </div>
  );
};
