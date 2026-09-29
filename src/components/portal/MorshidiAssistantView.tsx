import React, { useState } from 'react';
import {
  Sparkles,
  ExternalLink,
  RotateCcw,
  ShieldCheck,
  Maximize2
} from 'lucide-react';

export const MorshidiAssistantView: React.FC = () => {
  const [iframeKey, setIframeKey] = useState(0);
  const morshidiUrl = 'https://morshidi.vercel.app/';

  const handleRefresh = () => {
    setIframeKey(prev => prev + 1);
  };

  const handleOpenExternal = () => {
    window.open(morshidiUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="space-y-4 animate-fade-in text-right">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-univ-800 to-teal-700 text-white flex items-center justify-center shadow-soft shrink-0">
            <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
                مرشدي الذكي (Morshidi AI)
              </h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                متصل بالنظام
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              منصة الذكاء الاصطناعي الأكاديمي الرسمية لجامعة مرشدي
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={handleRefresh}
            className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors text-xs flex items-center gap-1.5 shadow-xs"
            title="إعادة تحميل الصفحة"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">تحديث الإطار</span>
          </button>

          <button
            onClick={handleOpenExternal}
            className="px-3.5 py-2 rounded-xl bg-univ-800 hover:bg-univ-900 text-white font-bold text-xs shadow-soft transition-colors flex items-center gap-1.5"
            title="فتح مرشدي في نافذة جديدة"
          >
            <span>فتح في نافذة كاملة</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Embedded Live Morshidi App Container */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-soft overflow-hidden flex flex-col h-[750px]">
        {/* Iframe Top Bar */}
        <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs text-slate-500 font-mono">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-slate-700 font-bold">morshidi.vercel.app</span>
          </div>
          <a
            href={morshidiUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-univ-700 hover:underline flex items-center gap-1"
          >
            <span>زيارة الرابط المباشر</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        {/* Embedded Iframe */}
        <div className="flex-1 w-full relative bg-slate-50">
          <iframe
            key={iframeKey}
            src={morshidiUrl}
            title="مرشدي الذكي - Morshidi AI"
            className="w-full h-full border-0"
            allow="clipboard-write; microphone"
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"
          />
        </div>
      </div>

    </div>
  );
};
