import React, { useState, useEffect } from "react";
import { X, RotateCcw, Check, Edit3, Edit2, Sparkles } from "lucide-react";

// Strip Arabic Tashkeel / Diacritics regex
function stripArabicDiacritics(text: string): string {
  if (!text) return "";
  return text.replace(/[\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED]/g, "");
}

interface NafahatCounterOverlayProps {
  type: "general" | "formula";
  title: string;
  arabicText: string;
  count: number;
  target: number;
  onIncrement: (amount?: number) => void;
  onReset: () => void;
  onClose: () => void;
  onEditCount?: () => void;
  onEditTarget?: () => void;
}

export function NafahatCounterOverlay({
  type,
  title,
  arabicText,
  count,
  target,
  onIncrement,
  onReset,
  onClose,
  onEditCount,
  onEditTarget,
}: NafahatCounterOverlayProps) {
  const [pulse, setPulse] = useState(false);
  const [ripples, setRipples] = useState<Array<{ id: number; x: number; y: number }>>([]);

  const cleanTitle = stripArabicDiacritics(title);
  const cleanArabicText = stripArabicDiacritics(arabicText);

  const safeTarget = Math.max(1, target);
  const ratio = Math.min(1, count / safeTarget);
  const isCompleted = count >= safeTarget;

  const handleTap = (e?: React.MouseEvent) => {
    onIncrement(1);
    setPulse(true);
    setTimeout(() => setPulse(false), 120);

    if (e) {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const newRipple = { id: Date.now(), x, y };
      setRipples((prev) => [...prev.slice(-4), newRipple]);
      setTimeout(() => {
        setRipples((prev) => prev.filter((r) => r.id !== newRipple.id));
      }, 600);
    }

    if (navigator.vibrate) {
      if (count + 1 === safeTarget) {
        navigator.vibrate([40, 50, 80]);
      } else {
        navigator.vibrate(12);
      }
    }
  };

  // Keyboard spacebar / Enter support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "Enter") {
        e.preventDefault();
        handleTap();
      } else if (e.code === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [count, safeTarget]);

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-50 flex flex-col bg-gradient-to-b from-[#388e6c] via-[#2f7d5e] to-[#225741] text-white select-none overflow-hidden animate-in fade-in duration-200"
    >
      {/* 
        ========================================================================
        Decorative Ambient Lighting & Subtle Palm Trees
        ========================================================================
      */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Soft emerald radial glow in the center */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-200/20 rounded-full blur-3xl" />
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-80 h-80 bg-teal-200/20 rounded-full blur-2xl" />

        {/* Left Side: Palm Tree */}
        <div className="absolute -bottom-6 -left-8 w-44 sm:w-60 h-72 sm:h-96 opacity-35 pointer-events-none select-none transition-opacity">
          <svg viewBox="0 0 200 300" className="w-full h-full drop-shadow-md">
            {/* Trunk */}
            <path
              d="M100 300 Q95 200 85 120 Q83 100 80 85 L96 85 Q98 100 102 200 Q106 250 110 300 Z"
              fill="#78350f"
            />
            <ellipse cx="94" cy="270" rx="9" ry="3" fill="#92400e" />
            <ellipse cx="92" cy="240" rx="8.5" ry="3" fill="#b45309" />
            <ellipse cx="90" cy="210" rx="8" ry="2.8" fill="#92400e" />
            <ellipse cx="88" cy="180" rx="7.5" ry="2.5" fill="#b45309" />
            <ellipse cx="86" cy="150" rx="7" ry="2.2" fill="#92400e" />
            <ellipse cx="84" cy="120" rx="6.5" ry="2" fill="#b45309" />
            <ellipse cx="82" cy="95" rx="6" ry="1.8" fill="#92400e" />

            {/* Golden Date Clusters */}
            <circle cx="80" cy="88" r="4" fill="#f59e0b" />
            <circle cx="84" cy="91" r="3.5" fill="#d97706" />
            <circle cx="77" cy="93" r="3" fill="#fbbf24" />
            <circle cx="94" cy="88" r="4" fill="#f59e0b" />
            <circle cx="91" cy="92" r="3.5" fill="#d97706" />

            {/* Fronds */}
            <path d="M86 85 C60 60 20 50 0 70 C25 65 65 75 86 85 Z" fill="#34d399" />
            <path d="M86 85 C50 40 15 25 5 40 C30 35 65 55 86 85 Z" fill="#6ee7b7" />
            <path d="M86 85 C70 30 40 5 25 15 C45 15 70 45 86 85 Z" fill="#10b981" />
            <path d="M86 85 C85 20 80 0 70 0 C75 15 82 45 86 85 Z" fill="#a7f3d0" />
            <path d="M90 85 C95 20 105 0 115 0 C110 15 100 45 90 85 Z" fill="#a7f3d0" />
            <path d="M90 85 C110 30 140 5 155 15 C135 15 110 45 90 85 Z" fill="#10b981" />
            <path d="M90 85 C130 40 165 25 175 40 C150 35 115 55 90 85 Z" fill="#6ee7b7" />
            <path d="M90 85 C120 60 160 50 180 70 C155 65 115 75 90 85 Z" fill="#34d399" />
          </svg>
        </div>

        {/* Right Side: Palm Tree */}
        <div className="absolute -bottom-6 -right-8 w-44 sm:w-60 h-72 sm:h-96 opacity-35 pointer-events-none select-none transition-opacity transform scale-x-[-1]">
          <svg viewBox="0 0 200 300" className="w-full h-full drop-shadow-md">
            <path
              d="M100 300 Q95 200 85 120 Q83 100 80 85 L96 85 Q98 100 102 200 Q106 250 110 300 Z"
              fill="#78350f"
            />
            <ellipse cx="94" cy="270" rx="9" ry="3" fill="#92400e" />
            <ellipse cx="92" cy="240" rx="8.5" ry="3" fill="#b45309" />
            <ellipse cx="90" cy="210" rx="8" ry="2.8" fill="#92400e" />
            <ellipse cx="88" cy="180" rx="7.5" ry="2.5" fill="#b45309" />
            <ellipse cx="86" cy="150" rx="7" ry="2.2" fill="#92400e" />
            <ellipse cx="84" cy="120" rx="6.5" ry="2" fill="#b45309" />
            <ellipse cx="82" cy="95" rx="6" ry="1.8" fill="#92400e" />

            <circle cx="80" cy="88" r="4" fill="#f59e0b" />
            <circle cx="84" cy="91" r="3.5" fill="#d97706" />
            <circle cx="77" cy="93" r="3" fill="#fbbf24" />
            <circle cx="94" cy="88" r="4" fill="#f59e0b" />
            <circle cx="91" cy="92" r="3.5" fill="#d97706" />

            <path d="M86 85 C60 60 20 50 0 70 C25 65 65 75 86 85 Z" fill="#34d399" />
            <path d="M86 85 C50 40 15 25 5 40 C30 35 65 55 86 85 Z" fill="#6ee7b7" />
            <path d="M86 85 C70 30 40 5 25 15 C45 15 70 45 86 85 Z" fill="#10b981" />
            <path d="M86 85 C85 20 80 0 70 0 C75 15 82 45 86 85 Z" fill="#a7f3d0" />
            <path d="M90 85 C95 20 105 0 115 0 C110 15 100 45 90 85 Z" fill="#a7f3d0" />
            <path d="M90 85 C110 30 140 5 155 15 C135 15 110 45 90 85 Z" fill="#10b981" />
            <path d="M90 85 C130 40 165 25 175 40 C150 35 115 55 90 85 Z" fill="#6ee7b7" />
            <path d="M90 85 C120 60 160 50 180 70 C155 65 115 75 90 85 Z" fill="#34d399" />
          </svg>
        </div>

        {/* Large Translucent Calligraphy Watermark in Center without Tashkeel */}
        <div className="absolute inset-0 flex items-center justify-center opacity-10">
          <p className="font-sans text-3xl sm:text-5xl font-black text-center leading-loose text-white max-w-lg px-6 rotate-[-3deg] select-none">
            اللهم صل على سيدنا محمد وعلى آله وصحبه وسلم
          </p>
        </div>
      </div>

      {/* 
        ========================================================================
        Top Navigation Header
        ========================================================================
      */}
      <header className="flex items-center justify-between px-5 pt-6 pb-3 shrink-0 relative z-20">
        <button
          onClick={onClose}
          aria-label="إغلاق العداد"
          className="rounded-full bg-white/20 hover:bg-white/30 p-2.5 shadow-sm backdrop-blur-md text-white transition-colors cursor-pointer border border-white/25"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="text-center">
          <div className="text-[11px] font-bold text-emerald-50/90">
            {type === "general" ? "الصلاة على النبي ﷺ" : "صيغة اليوم"}
          </div>
          <div className="text-sm font-black text-white">{cleanTitle}</div>
        </div>

        <button
          onClick={onReset}
          aria-label="إعادة ضبط العداد"
          className="rounded-full bg-white/20 hover:bg-rose-500/40 p-2.5 shadow-sm backdrop-blur-md text-white hover:text-rose-100 transition-colors cursor-pointer border border-white/25"
          title="تصفير العداد"
        >
          <RotateCcw className="h-5 w-5" />
        </button>
      </header>

      {/* 
        ========================================================================
        Interactive Tap Area (Full Screen Content)
        ========================================================================
      */}
      <div
        onClick={handleTap}
        className="flex-1 px-5 pt-2 pb-6 max-w-md mx-auto w-full flex flex-col items-center justify-between relative z-10 cursor-pointer"
      >
        {/* Sacred Arabic Text Card without Tashkeel and with enlarged font matching Athkar font */}
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full shrink-0 rounded-3xl bg-white/20 p-4 sm:p-5 text-center shadow-md border border-white/30 backdrop-blur-md animate-in fade-in-50 slide-in-from-top-2 duration-200"
        >
          <p className="font-sans text-lg sm:text-xl md:text-2xl font-black text-white leading-relaxed select-text drop-shadow-sm">
            « {cleanArabicText} »
          </p>
        </div>

        {/* Circular Counter with SVG Progress Ring - Centered in Screen Middle */}
        <div className="flex-1 flex flex-col items-center justify-center w-full py-2">
          <div className="relative aspect-square w-full max-w-[240px] xs:max-w-[270px] select-none rounded-full flex items-center justify-center shrink-0">
            <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full -rotate-90">
              {/* Background ring */}
              <circle
                cx="100"
                cy="100"
                r="86"
                fill="none"
                stroke="rgba(255, 255, 255, 0.25)"
                strokeWidth="10"
              />
              {/* Progress ring */}
              <circle
                cx="100"
                cy="100"
                r="86"
                fill="none"
                stroke="#a7f3d0"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 86}
                strokeDashoffset={2 * Math.PI * 86 * (1 - ratio)}
                style={{ transition: "stroke-dashoffset 0.15s ease-out" }}
              />
            </svg>

            {/* Inner Counter Sphere */}
            <div
              className={`absolute inset-5 rounded-full grid place-items-center bg-gradient-to-br from-[#40916c]/95 to-[#1b4332]/95 backdrop-blur-md shadow-2xl border border-white/40 transition-transform duration-100 ${
                pulse ? "scale-[0.95] bg-[#52b788]/95" : "scale-100"
              }`}
            >
              <div className="text-center px-4">
                {isCompleted ? (
                  <div className="flex flex-col items-center gap-1 animate-in zoom-in duration-150">
                    <div className="w-12 h-12 rounded-full bg-emerald-300 text-emerald-950 flex items-center justify-center shadow-lg shadow-emerald-300/40 mb-1">
                      <Check className="h-7 w-7" strokeWidth={3} />
                    </div>
                    <div className="text-3xl sm:text-4xl font-black font-mono text-white">
                      {count.toLocaleString("ar-EG")}
                    </div>
                    <span className="text-xs font-black text-emerald-100">
                      اكتمل الهدف ({target.toLocaleString("ar-EG")}) 🎉
                    </span>
                  </div>
                ) : (
                  <>
                    <div className="text-5xl sm:text-6xl font-black font-mono tabular-nums text-white drop-shadow-md">
                      {count.toLocaleString("ar-EG")}
                    </div>
                    <div className="mt-1.5 text-xs font-bold text-emerald-50/90 flex items-center justify-center gap-1">
                      <span>من {target.toLocaleString("ar-EG")} صلاة</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Ripple FX */}
            {ripples.map((rip) => (
              <span
                key={rip.id}
                className="absolute w-20 h-20 rounded-full bg-emerald-200/50 animate-ping pointer-events-none"
                style={{ left: rip.x - 40, top: rip.y - 40 }}
              />
            ))}
          </div>
        </div>

        {/* 
          ========================================================================
          Bottom Controls & Actions
          ========================================================================
        */}
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full shrink-0 flex flex-col items-center gap-2.5"
        >
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-200 animate-pulse" />
            <p className="text-xs text-emerald-50 font-medium">
              اضغط في أي مكان على الشاشة لعدّ الصلاة
            </p>
          </div>

          <div className="flex items-center gap-2 w-full max-w-xs">
            {onEditCount && (
              <button
                type="button"
                onClick={onEditCount}
                className="flex-1 py-2 px-3 rounded-2xl bg-white/20 hover:bg-white/30 border border-white/25 text-white text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
              >
                <Edit2 className="h-3.5 w-3.5 text-emerald-100" />
                <span>تعديل العدد</span>
              </button>
            )}

            {onEditTarget && (
              <button
                type="button"
                onClick={onEditTarget}
                className="flex-1 py-2 px-3 rounded-2xl bg-white/20 hover:bg-white/30 border border-white/25 text-white text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
              >
                <Edit3 className="h-3.5 w-3.5 text-emerald-100" />
                <span>تعديل الهدف</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
