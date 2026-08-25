import { useEffect, useState } from "react";
import { RotateCcw, X, Check } from "lucide-react";
import type { ThikrItem, ThikrProgress } from "@/lib/db";
import { getTodayProgress, incrementToday, resetToday } from "@/lib/athkar";

// Strip Arabic Tashkeel / Diacritics regex
function stripArabicDiacritics(text: string): string {
  if (!text) return "";
  return text.replace(/[\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED]/g, "");
}

/**
 * Full-screen tasbih counter overlay for a single thikr item.
 * Non-punitive: never blocks — just tracks progress toward target.
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

  const target = item.target_count;
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
    if (navigator.vibrate) navigator.vibrate(next.completed ? [40, 40, 60] : 8);
  }

  async function strokeWidth(next: ThikrProgress) {
    // keeping signature simple
  }

  async function reset() {
    const next = await resetToday(item.id!, date);
    setProgress(next);
    onChange?.(next);
  }

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-50 flex flex-col bg-gradient-to-b from-[color-mix(in_oklch,var(--athkar)_18%,white)] to-background"
    >
      <header className="flex items-center justify-between px-5 pt-6 pb-3 shrink-0">
        <button
          onClick={onClose}
          aria-label="إغلاق"
          className="rounded-full bg-white/70 p-2 shadow-sm backdrop-blur"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="text-center">
          <div className="text-xs text-muted-foreground">الورد الحالي</div>
          <div className="text-sm font-bold text-slate-700">مسبحة الأذكار</div>
        </div>
        <button
          onClick={reset}
          aria-label="تصفير"
          className="rounded-full bg-white/70 p-2 shadow-sm backdrop-blur"
        >
          <RotateCcw className="h-5 w-5" />
        </button>
      </header>

      {/* Main Container - Structured with fixed top text and perfectly centered counter button */}
      <div className="flex-1 px-6 pt-2 pb-6 max-w-md mx-auto w-full flex flex-col items-center justify-between relative">
        {/* Full Dhikr Text Display - Top section */}
        <div className="w-full shrink-0 rounded-2xl bg-white/95 p-4 sm:p-5 text-center shadow-xs border border-white/60 backdrop-blur-md animate-in fade-in-50 slide-in-from-top-2 duration-200">
          <p className="font-sans text-lg sm:text-xl md:text-2xl font-black text-slate-800 leading-relaxed whitespace-pre-line select-text">
            {cleanDhikrName}
          </p>
        </div>

        {/* Counter Button - Centered exactly in the viewport middle */}
        <div className="flex-1 flex flex-col items-center justify-center w-full py-2">
          <button
            onClick={tap}
            disabled={completed}
            className="relative aspect-square w-full max-w-[240px] xs:max-w-[280px] sm:max-w-[300px] select-none rounded-full active:scale-[0.98] transition disabled:opacity-90 shrink-0 shadow-lg cursor-pointer"
            aria-label="عدّ ذكر"
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
              className={`absolute inset-6 rounded-full grid place-items-center bg-white/85 backdrop-blur shadow-inner transition ${
                pulse ? "scale-[0.97]" : ""
              }`}
            >
              <div className="text-center">
                {completed ? (
                  <div className="flex flex-col items-center gap-1">
                    <Check className="h-10 w-10 text-[color:var(--athkar)]" strokeWidth={3} />
                    <span className="text-lg font-bold text-slate-800">اكتمل الورد</span>
                  </div>
                ) : (
                  <>
                    <div className="text-5xl sm:text-6xl font-black tabular-nums text-foreground">
                      {count}
                    </div>
                    <div className="mt-1 text-xs sm:text-sm text-muted-foreground font-bold">
                      من {target}
                    </div>
                  </>
                )}
              </div>
            </div>
          </button>
        </div>

        {/* Bottom hint text */}
        <p className="shrink-0 max-w-xs text-center text-xs text-muted-foreground font-medium">
          اضغط في أي مكان داخل الدائرة لعدّ التسبيح.
        </p>
      </div>
    </div>
  );
}
