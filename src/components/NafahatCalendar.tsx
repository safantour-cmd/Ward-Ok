import React, { useMemo, useState, useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import {
  arabicMonthYear,
  AR_WEEKDAYS,
  isoDate,
  weekDays,
  formatArabicDate,
} from "@/lib/date-utils";
import {
  getDayOfRabiFromDate,
  formatRabiDayArabic,
  formatRabiDayShort,
  getRabiDisplayInfo,
  getFormulaSalawatCount,
  getHijriDate,
  getHijriOffset,
  setHijriOffset,
} from "@/lib/nafahat";
import { Calendar, ChevronRight, ChevronLeft, Sparkles, Check, Heart, SlidersHorizontal, Moon } from "lucide-react";

const AR_WEEKDAYS_SAT_FIRST = [
  AR_WEEKDAYS[6], // السبت
  AR_WEEKDAYS[0], // الأحد
  AR_WEEKDAYS[1], // الاثنين
  AR_WEEKDAYS[2], // الثلاثاء
  AR_WEEKDAYS[3], // الأربعاء
  AR_WEEKDAYS[4], // الخميس
  AR_WEEKDAYS[5], // الجمعة
];

interface NafahatCalendarProps {
  selectedDate: string;
  onSelectDate: (date: string) => void;
}

export function NafahatCalendar({
  selectedDate,
  onSelectDate,
}: NafahatCalendarProps) {
  const [viewType, setViewType] = useState<"week" | "month">(() => {
    return (localStorage.getItem("nafahat_calendar_view_type") as any) || "week";
  });

  const [hijriOffset, setLocalHijriOffset] = useState(() => getHijriOffset());
  const [showOffsetControls, setShowOffsetControls] = useState(false);

  useEffect(() => {
    const handleOffsetChanged = () => {
      setLocalHijriOffset(getHijriOffset());
    };
    window.addEventListener("hijri-offset-changed", handleOffsetChanged);
    return () => window.removeEventListener("hijri-offset-changed", handleOffsetChanged);
  }, []);

  const handleAdjustOffset = (delta: number) => {
    const next = hijriOffset + delta;
    setLocalHijriOffset(next);
    setHijriOffset(next);
  };

  const toggleViewType = (type: "week" | "month") => {
    setViewType(type);
    localStorage.setItem("nafahat_calendar_view_type", type);
  };

  const today = isoDate();

  // Current Month calculation
  const now = new Date(selectedDate);
  const year = now.getFullYear();
  const month = now.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Lead blanks for Saturday start
  const jsDay = firstOfMonth.getDay();
  const leadBlanks = (jsDay + 1) % 7;

  const monthCells: Array<{ date: Date | null; iso: string | null }> = [];
  for (let i = 0; i < leadBlanks; i++) monthCells.push({ date: null, iso: null });
  for (let d = 1; d <= daysInMonth; d++) {
    const dt = new Date(year, month, d);
    monthCells.push({ date: dt, iso: isoDate(dt) });
  }
  while (monthCells.length % 7 !== 0) monthCells.push({ date: null, iso: null });

  // Current week days
  const currentWeekDates = useMemo(() => weekDays(new Date(selectedDate)), [selectedDate]);

  // Database queries for month logs
  const monthStart = isoDate(new Date(year, month, 1));
  const monthEnd = isoDate(new Date(year, month, daysInMonth));
  const nafahatLogs = useLiveQuery(
    () =>
      db?.nafahat_logs
        ?.where("date")
        .between(monthStart, monthEnd, true, true)
        .toArray() ?? Promise.resolve([]),
    [monthStart, monthEnd]
  ) ?? [];

  // Index logs by date
  const logsByDate = useMemo(() => {
    const map = new Map<string, { regularCount: number; rareCount: number; salawat: number }>();
    for (const log of nafahatLogs) {
      if (log.date) {
        const regularCount = log.regular_sunnah_ids?.length || 0;
        const rareCount = Object.keys(log.rare_sunnah_ratings || {}).length;
        const formulaDay = getDayOfRabiFromDate(log.date);
        const formulaCount = getFormulaSalawatCount(log.date, formulaDay);
        const salawat = (log.salawat_count || 0) + formulaCount;
        map.set(log.date, { regularCount, rareCount, salawat });
      }
    }
    return map;
  }, [nafahatLogs, hijriOffset]);

  const navigatePeriod = (direction: -1 | 1) => {
    const cur = new Date(selectedDate);
    if (viewType === "week") {
      cur.setDate(cur.getDate() + direction * 7);
      onSelectDate(isoDate(cur));
    } else {
      const nextMonth = new Date(year, month + direction, 1);
      onSelectDate(isoDate(nextMonth));
    }
  };

  const jumpToToday = () => {
    onSelectDate(today);
  };

  const selectedHijri = getHijriDate(selectedDate);
  const selectedRabiDay = selectedHijri.day;

  return (
    <div className="w-full bg-emerald-950/5 border border-emerald-500/20 rounded-3xl p-4 sm:p-5 shadow-xs backdrop-blur-sm relative overflow-hidden transition-all duration-300">
      {/* Background palm silhouette */}
      <div
        className="absolute -bottom-8 -left-8 w-32 h-32 opacity-5 pointer-events-none text-emerald-800"
        aria-hidden
      >
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C12 2 10 7 10 10C8 8 5 9 5 12C5 15 8 16 10 15C9 17 8 20 8 22H16C16 20 15 17 14 15C16 16 19 15 19 12C19 9 16 8 14 10C14 7 12 2 12 2Z" />
        </svg>
      </div>

      {/* Header controls */}
      <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-2xl bg-emerald-500/10 text-emerald-700 border border-emerald-500/20">
            <Calendar className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-black text-emerald-950 tracking-tight">
                {arabicMonthYear(new Date(selectedDate))}
              </h3>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-600/15 text-emerald-900 border border-emerald-600/20 shadow-3xs">
                🌴 {selectedHijri.formatted}
              </span>
            </div>
            <p className="text-[11px] text-emerald-800/70 font-medium">
              {formatArabicDate(new Date(selectedDate))}
            </p>
          </div>
        </div>

        {/* View switcher & Navigation & Hijri Adjustment */}
        <div className="flex items-center gap-1.5 mr-auto">
          {/* Hijri Adjustment Toggle */}
          <button
            onClick={() => setShowOffsetControls((prev) => !prev)}
            className={`p-1.5 rounded-xl border text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
              showOffsetControls || hijriOffset !== 0
                ? "bg-amber-50 text-amber-900 border-amber-300"
                : "bg-white/80 text-emerald-900 border-emerald-500/20 hover:bg-emerald-50"
            }`}
            title="ضبط رؤية الهلال (± يوم)"
          >
            <Moon className="h-3.5 w-3.5" />
            {hijriOffset !== 0 && (
              <span className="font-mono text-[10px]">
                {hijriOffset > 0 ? `+${hijriOffset}` : hijriOffset}
              </span>
            )}
          </button>

          {selectedDate !== today && (
            <button
              onClick={jumpToToday}
              className="px-2.5 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold shadow-xs transition-transform active:scale-95 cursor-pointer"
            >
              اليوم
            </button>
          )}

          <div className="flex items-center bg-white/80 rounded-2xl border border-emerald-500/20 p-0.5">
            <button
              type="button"
              onClick={() => toggleViewType("week")}
              className={`px-2.5 py-1 rounded-xl text-[11px] font-black transition-all cursor-pointer ${
                viewType === "week"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-emerald-900/60 hover:text-emerald-950"
              }`}
            >
              أسبوع
            </button>
            <button
              type="button"
              onClick={() => toggleViewType("month")}
              className={`px-2.5 py-1 rounded-xl text-[11px] font-black transition-all cursor-pointer ${
                viewType === "month"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-emerald-900/60 hover:text-emerald-950"
              }`}
            >
              شهر
            </button>
          </div>

          <div className="flex items-center bg-white/80 rounded-2xl border border-emerald-500/20 p-0.5">
            <button
              onClick={() => navigatePeriod(-1)}
              className="p-1 rounded-xl hover:bg-emerald-50 text-emerald-900 transition-colors cursor-pointer"
              title="السابق"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              onClick={() => navigatePeriod(1)}
              className="p-1 rounded-xl hover:bg-emerald-50 text-emerald-900 transition-colors cursor-pointer"
              title="التالي"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Optional Moon Sighting Offset Controls */}
      {showOffsetControls && (
        <div className="mb-3.5 p-2.5 bg-amber-50/80 border border-amber-300/60 rounded-2xl flex items-center justify-between gap-2 text-xs animate-in fade-in duration-200">
          <div className="flex items-center gap-1.5 text-amber-950 font-medium">
            <Moon className="h-4 w-4 text-amber-700 shrink-0" />
            <span>ضبط الهلال (تعديل اليوم الهجري بحسب بلدك):</span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => handleAdjustOffset(-1)}
              className="px-2 py-0.5 bg-white border border-amber-300 rounded-lg font-bold text-amber-900 hover:bg-amber-100 cursor-pointer shadow-3xs"
            >
              -١ يوم
            </button>
            <span className="font-mono font-black text-amber-900 px-1">
              {hijriOffset === 0 ? "٠ (افتراضي)" : hijriOffset > 0 ? `+${hijriOffset}` : hijriOffset}
            </span>
            <button
              onClick={() => handleAdjustOffset(1)}
              className="px-2 py-0.5 bg-white border border-amber-300 rounded-lg font-bold text-amber-900 hover:bg-amber-100 cursor-pointer shadow-3xs"
            >
              +١ يوم
            </button>
            {hijriOffset !== 0 && (
              <button
                onClick={() => handleAdjustOffset(-hijriOffset)}
                className="text-[10px] text-amber-700 underline mr-1 cursor-pointer"
              >
                إعادة ضبط
              </button>
            )}
          </div>
        </div>
      )}

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-1 text-center mb-1.5">
        {AR_WEEKDAYS_SAT_FIRST.map((dayName, idx) => (
          <div
            key={idx}
            className="text-[11px] font-black text-emerald-900/70 py-1"
          >
            {dayName}
          </div>
        ))}
      </div>

      {/* Day Cells (Week or Month view) */}
      {viewType === "week" ? (
        <div className="grid grid-cols-7 gap-1.5">
          {currentWeekDates.map((dateIso, idx) => {
            const isSelected = dateIso === selectedDate;
            const isToday = dateIso === today;
            const logData = logsByDate.get(dateIso);
            const rabiInfo = getRabiDisplayInfo(dateIso);
            const hasActivity =
              logData &&
              (logData.regularCount > 0 || logData.rareCount > 0 || logData.salawat > 0);
            const dayNum = parseInt(dateIso.split("-")[2], 10) || new Date(dateIso).getDate();

            return (
              <button
                key={idx}
                type="button"
                onClick={() => onSelectDate(dateIso)}
                className={`flex flex-col items-center justify-between p-1.5 rounded-2xl border transition-all cursor-pointer relative min-h-[72px] ${
                  isSelected
                    ? "bg-emerald-600 text-white border-emerald-700 shadow-md ring-2 ring-emerald-400/40"
                    : isToday
                    ? "bg-emerald-100/90 border-emerald-300 text-emerald-950"
                    : "bg-white/80 border-emerald-500/15 text-slate-800 hover:bg-emerald-50/70"
                }`}
              >
                <div className="flex flex-col items-center">
                  <span
                    className={`text-xs font-black ${
                      isSelected ? "text-white" : "text-emerald-950"
                    }`}
                  >
                    {dayNum}
                  </span>
                  {/* Rabi' day label under the day number (only if in Rabi' al-Awwal or Rabi' al-Thani) */}
                  {rabiInfo.isRabi ? (
                    <span
                      className={`text-[9px] font-black leading-tight mt-0.5 px-1 py-0.2 rounded-md ${
                        isSelected
                          ? "bg-white/20 text-white"
                          : rabiInfo.isRabiAwwal
                          ? "text-emerald-800 bg-emerald-500/10"
                          : "text-teal-800 bg-teal-500/10"
                      }`}
                    >
                      {rabiInfo.shortLabel}
                    </span>
                  ) : (
                    <span className="text-[9px] text-transparent leading-tight mt-0.5 select-none">
                      -
                    </span>
                  )}
                </div>

                {/* Progress Indicators */}
                <div className="flex flex-col items-center gap-0.5 mt-1">
                  {hasActivity ? (
                    <div className="flex items-center gap-0.5">
                      {logData.regularCount > 0 && (
                        <span
                          className={`inline-block w-1.5 h-1.5 rounded-full ${
                            isSelected ? "bg-white" : "bg-emerald-500"
                          }`}
                          title={`${logData.regularCount} سُنن راتبة`}
                        />
                      )}
                      {logData.rareCount > 0 && (
                        <span
                          className={`inline-block w-1.5 h-1.5 rounded-full ${
                            isSelected ? "bg-amber-300" : "bg-amber-500"
                          }`}
                          title={`${logData.rareCount} سُنن مهجورة مُحياة`}
                        />
                      )}
                      {logData.salawat > 0 && (
                        <span
                          className={`inline-block w-1.5 h-1.5 rounded-full ${
                            isSelected ? "bg-teal-200" : "bg-teal-600"
                          }`}
                          title={`${logData.salawat} صلاة على النبي`}
                        />
                      )}
                    </div>
                  ) : (
                    <span
                      className={`text-[9px] ${
                        isSelected ? "text-emerald-200" : "text-emerald-900/40"
                      }`}
                    >
                      —
                    </span>
                  )}

                  {logData && logData.salawat > 0 && (
                    <span
                      className={`text-[9px] font-mono font-bold leading-none ${
                        isSelected ? "text-emerald-100" : "text-emerald-700"
                      }`}
                    >
                      {logData.salawat >= 1000
                        ? `${(logData.salawat / 1000).toFixed(1)}k`
                        : logData.salawat}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-1">
          {monthCells.map((cell, idx) => {
            if (!cell.date || !cell.iso) {
              return (
                <div
                  key={idx}
                  className="h-14 rounded-xl bg-transparent opacity-0 pointer-events-none"
                />
              );
            }

            const dateIso = cell.iso;
            const isSelected = dateIso === selectedDate;
            const isToday = dateIso === today;
            const logData = logsByDate.get(dateIso);
            const rabiInfo = getRabiDisplayInfo(dateIso);
            const hasActivity =
              logData &&
              (logData.regularCount > 0 || logData.rareCount > 0 || logData.salawat > 0);

            return (
              <button
                key={idx}
                type="button"
                onClick={() => onSelectDate(dateIso)}
                className={`flex flex-col items-center justify-between p-1 rounded-xl border transition-all cursor-pointer relative h-14 ${
                  isSelected
                    ? "bg-emerald-600 text-white border-emerald-700 shadow-sm ring-2 ring-emerald-400/40 font-bold"
                    : isToday
                    ? "bg-emerald-100/90 border-emerald-300 text-emerald-950 font-bold"
                    : "bg-white/70 border-emerald-500/10 text-slate-800 hover:bg-emerald-50"
                }`}
              >
                <div className="flex flex-col items-center">
                  <span className="text-[11px] font-bold leading-none">
                    {cell.date.getDate()}
                  </span>
                  {/* Rabi' day label (only if in Rabi' al-Awwal or Rabi' al-Thani) */}
                  {rabiInfo.isRabi ? (
                    <span
                      className={`text-[8px] font-black leading-tight mt-0.5 ${
                        isSelected
                          ? "text-white"
                          : rabiInfo.isRabiAwwal
                          ? "text-emerald-800"
                          : "text-teal-800"
                      }`}
                    >
                      {rabiInfo.shortLabel}
                    </span>
                  ) : (
                    <span className="text-[8px] text-transparent leading-tight mt-0.5 select-none">
                      -
                    </span>
                  )}
                </div>

                {hasActivity ? (
                  <div className="flex items-center gap-0.5 mb-0.5">
                    <span
                      className={`w-1 h-1 rounded-full ${
                        isSelected ? "bg-white" : "bg-emerald-500"
                      }`}
                    />
                    {logData.salawat > 0 && (
                      <span
                        className={`w-1 h-1 rounded-full ${
                          isSelected ? "bg-amber-200" : "bg-amber-500"
                        }`}
                      />
                    )}
                  </div>
                ) : (
                  <div className="h-1" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
