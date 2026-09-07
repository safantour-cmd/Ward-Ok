import { useEffect, useState } from "react";
import { RotateCcw, X, Check, Vibrate, VibrateOff } from "lucide-react";
import type { ThikrItem, ThikrProgress } from "@/lib/db";
import { getTodayProgress, incrementToday, resetToday } from "@/lib/athkar";

// Strip Arabic Tashkeel / Diacritics regex
function stripArabicDiacritics(text: string): string {
  if (!text) return "";
  return text.replace(/[\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED]/g, "");
}

/**
 * Full-screen tasbih counter overlay for a single thikr item.
 * Tapping anywhere on the screen increments the counter.
 * Includes haptic vibration feedback with a discrete bottom toggle button to disable/enable it.
 */
export function TasbihCounter({
  item,
  onClose,
  onChange,
  date,
}: {
  item: ThikrItem;
  onClose: () => void;
  onChange?: (p: ThikrProgress) => void;
  date?: string;
}) {
  const [progress, setProgress] = useState<ThikrProgress | null>(null);
  const [pulse, setPulse] = useState(false);
  const [vibrateEnabled, setVibrateEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem("athkar_vibration_enabled") !== "false";
    } catch {
      return true;
    }
  });

  const cleanDhikrName = stripArabicDiacritics(item.name);

  useEffect(() => {
    let mounted = true;
    getTodayProgress(item.id!, date).then((p) => {
      if (mounted) setProgress(p);
    });
    return () => {
      mounted = false;
    };
  }, [item.id, date]);

  const target = progress?.daily_target ?? item.target_count;
  const count = progress?.current_count ?? 0;
  const completed = progress?.completed ?? false;
  const ratio = Math.min(1, count / target);

  async function tap() {
    if (completed) return;
    const next = await incrementToday(item.id!, target, date);
    setProgress(next);
    onChange?.(next);
    setPulse(true);
    setTimeout(() => setPulse(false), 120);

    if (vibrateEnabled && typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(next.completed ? [45, 40, 70] : 18);
    }
  }

  const toggleVibration = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const next = !vibrateEnabled;
    setVibrateEnabled(next);
    try {
      localStorage.setItem("athkar_vibration_enabled", String(next));
    } catch {}
    if (next && typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(30);
    }
  };

  async function reset(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    const next = await resetToday(item.id!, date);
    setProgress(next);
    onChange?.(next);
    if (vibrateEnabled && typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(25);
    }
  }

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onClose();
  };

  return (
    <div
      dir="rtl"
      onClick={tap}
      className="fixed inset-0 z-50 flex flex-col bg-gradient-to-b from-[color-mix(in_oklch,var(--athkar)_18%,white)] to-background cursor-pointer select-none touch-manipulation"
    >
      <header className="flex items-center justify-between px-5 pt-6 pb-3 shrink-0 relative z-10">
        <button
          type="button"
          onClick={handleClose}
          aria-label="إغلاق"
          className="rounded-full bg-white/80 p-2 shadow-sm backdrop-blur hover:bg-white active:scale-95 transition-transform cursor-pointer"
        >
          <X className="h-5 w-5 text-slate-700" />
        </button>
        <div className="text-center pointer-events-none">
          <div className="text-xs text-muted-foreground font-semibold">الورد الحالي</div>
          <div className="text-sm font-bold text-slate-700">مسبحة الأذكار</div>
        </div>
        <button
          type="button"
          onClick={reset}
          aria-label="تصفير"
          className="rounded-full bg-white/80 p-2 shadow-sm backdrop-blur hover:bg-white active:scale-95 transition-transform cursor-pointer"
        >
          <RotateCcw className="h-5 w-5 text-slate-700" />
        </button>
      </header>

      {/* Main Container - Structured with fixed top text, centered counter, and bottom vibration control */}
      <div className="flex-1 px-6 pt-2 pb-6 max-w-md mx-auto w-full flex flex-col items-center justify-between relative">
        {/* Full Dhikr Text Display - Top section */}
        <div className="w-full shrink-0 rounded-2xl bg-white/95 p-4 sm:p-5 text-center shadow-xs border border-white/60 backdrop-blur-md animate-in fade-in-50 slide-in-from-top-2 duration-200 pointer-events-none">
          <p className="font-sans text-lg sm:text-xl md:text-2xl font-black text-slate-800 leading-relaxed whitespace-pre-line select-text">
            {cleanDhikrName}
          </p>
        </div>

        {/* Counter Visual - Centered in the viewport */}
        <div className="flex-1 flex flex-col items-center justify-center w-full py-2 pointer-events-none">
          <div
            className={`relative aspect-square w-full max-w-[240px] xs:max-w-[280px] sm:max-w-[300px] rounded-full shadow-lg transition-transform ${
              pulse ? "scale-[0.96]" : "scale-100"
            }`}
          >
            <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full -rotate-90">
              <circle
                cx="100"
                cy="100"
                r="88"
                fill="none"
                stroke="color-mix(in oklch, var(--athkar) 15%, white)"
                strokeWidth="10"
              />
              <circle
                cx="100"
                cy="100"
                r="88"
                fill="none"
                stroke="var(--athkar)"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 88}
                strokeDashoffset={2 * Math.PI * 88 * (1 - ratio)}
                style={{ transition: "stroke-dashoffset 0.2s ease" }}
              />
            </svg>
            <div
              className={`absolute inset-6 rounded-full grid place-items-center bg-white/90 backdrop-blur shadow-inner transition-transform ${
                pulse ? "scale-[0.97]" : ""
              }`}
            >
              <div className="text-center">
                {completed ? (
                  <div className="flex flex-col items-center gap-1">
                    <Check className="h-10 w-10 text-[color:var(--athkar)]" strokeWidth={3} />
                    <span className="text-lg font-black text-slate-800">اكتمل الورد ✓</span>
                  </div>
                ) : (
                  <>
                    <div className="text-5xl sm:text-6xl font-black tabular-nums text-foreground tracking-tight">
                      {count}
                    </div>
                    <div className="mt-1 text-xs sm:text-sm text-muted-foreground font-extrabold">
                      من {target}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom hint and small vibration toggle button */}
        <div className="shrink-0 flex flex-col items-center gap-2 pt-2">
          <p className="text-center text-xs text-slate-600 font-bold pointer-events-none">
            اضغط في أي مكان على الشاشة للتسبيح
          </p>

          <button
            type="button"
            onClick={toggleVibration}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold border transition-all cursor-pointer shadow-2xs active:scale-95 ${
              vibrateEnabled
                ? "bg-emerald-50/90 text-emerald-900 border-emerald-300 hover:bg-emerald-100"
                : "bg-slate-100/90 text-slate-600 border-slate-300 hover:bg-slate-200"
            }`}
            title="تبديل الاهتزاز عند النقر"
          >
            {vibrateEnabled ? (
              <>
                <Vibrate className="h-3.5 w-3.5 text-emerald-600" />
                <span>الرجة: مفعّلة (انقر للإلغاء)</span>
              </>
            ) : (
              <>
                <VibrateOff className="h-3.5 w-3.5 text-slate-500" />
                <span>الرجة: معطّلة (انقر للتفعيل)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
