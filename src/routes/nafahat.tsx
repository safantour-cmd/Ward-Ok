import { createFileRoute } from "@tanstack/react-router";
import React, { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Sparkles,
  Heart,
  Star,
  Check,
  Plus,
  RotateCcw,
  BookOpen,
  Calendar as CalendarIcon,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Award,
  Flame,
  Info,
  Copy,
  CheckCheck,
  Layers,
  Search,
  Filter,
  X,
  Edit2,
  Edit3,
  Palmtree,
} from "lucide-react";
import { db } from "@/lib/db";
import { isoDate, formatArabicDate } from "@/lib/date-utils";
import {
  SALAWAT_FORMULAS,
  DEFAULT_REGULAR_SUNNAHS,
  DEFAULT_RARE_SUNNAHS,
  getFormulaForDay,
  getDayOfRabiFromDate,
  formatRabiDayArabic,
  formatRabiDayShort,
  getRabiDisplayInfo,
  getNafahatLogForDate,
  toggleRegularSunnah,
  toggleRareSunnahRevived,
  addGeneralSalawatCount,
  setGeneralSalawatCountDirect,
  getFormulaSalawatCount,
  addFormulaSalawatCount,
  setFormulaSalawatCountDirect,
  getGeneralSalawatDailyGoal,
  setGeneralSalawatDailyGoal,
  getFormulaSalawatDailyGoal,
  setFormulaSalawatDailyGoal,
  getTotalSalawatInMonth,
  getHijriDate,
  subscribeGlobalHadaya,
  getHadayaForDay,
  subscribeGlobalSalawatFormulas,
  type SalawatFormula,
  type RegularSunnahItem,
  type RareSunnahItem,
  type GlobalHadayaItem,
} from "@/lib/nafahat";
import { NafahatCalendar } from "@/components/NafahatCalendar";
import { NafahatCounterOverlay } from "@/components/NafahatCounterOverlay";

const nafahatSearchSchema = z.object({
  date: z.string().optional(),
});

export const Route = createFileRoute("/nafahat")({
  validateSearch: nafahatSearchSchema,
  head: () => ({
    meta: [
      { title: "نفحات ربيعية — وَرْد" },
      {
        name: "description",
        content:
          "نفحات ربيعية: السُّنن الراتبة، والسنن المهجورة، وصيغ الصلاة على النبي ﷺ والهدف التراكمي لشهر ربيع الأنوار.",
      },
    ],
  }),
  component: NafahatScreen,
});

function NafahatScreen() {
  const search = Route.useSearch();
  const [selectedDate, setSelectedDate] = useState(() => search?.date || isoDate());

  useEffect(() => {
    if (search?.date) {
      setSelectedDate(search.date);
    }
  }, [search?.date]);

  // Main Tab: "salawat" (الصلاة على النبي ﷺ) or "sunnah" (السُّنَنُ النَّبَوِيَّة)
  const [activeMainTab, setActiveMainTab] = useState<"salawat" | "sunnah">(() => {
    return (localStorage.getItem("nafahat_active_main_tab") as any) || "salawat";
  });

  const handleSetMainTab = (tab: "salawat" | "sunnah") => {
    setActiveMainTab(tab);
    localStorage.setItem("nafahat_active_main_tab", tab);
  };

  // Sunnah sub-tab: "regular" (السُّنن الراتبة) or "rare" (السنن المهجورة)
  const [sunnahSubTab, setSunnahSubTab] = useState<"regular" | "rare">("regular");

  // Collapsible Calendar (open by default)
  const [showCalendar, setShowCalendar] = useState(true);

  const toggleCalendar = () => {
    setShowCalendar((prev) => !prev);
  };

  // Rabi formula card expansion (closed by default, click to open)
  const [isFormulaExpanded, setIsFormulaExpanded] = useState<boolean>(() => {
    return localStorage.getItem("nafahat_formula_expanded") === "true";
  });

  const toggleFormulaExpanded = () => {
    setIsFormulaExpanded((prev) => {
      const next = !prev;
      localStorage.setItem("nafahat_formula_expanded", String(next));
      return next;
    });
  };

  // Live Query from Dexie for selected date
  const dailyLog = useLiveQuery(
    () => getNafahatLogForDate(selectedDate),
    [selectedDate]
  );

  // All logs for cumulative month count
  const currentMonthPrefix = selectedDate.substring(0, 7);
  const [formulaSyncTrigger, setFormulaSyncTrigger] = useState(0);

  const monthTotalSalawat = useLiveQuery(
    () => getTotalSalawatInMonth(currentMonthPrefix),
    [currentMonthPrefix, formulaSyncTrigger]
  ) ?? 0;

  // Listen for custom formula update events & hijri offset changes
  useEffect(() => {
    const handleUpdate = () => {
      setFormulaSyncTrigger((prev) => prev + 1);
    };
    const handleOffset = () => {
      setSelectedFormulaDay(getDayOfRabiFromDate(selectedDate));
      setFormulaSyncTrigger((prev) => prev + 1);
    };
    window.addEventListener("nafahat-formula-count-updated", handleUpdate);
    window.addEventListener("hijri-offset-changed", handleOffset);
    return () => {
      window.removeEventListener("nafahat-formula-count-updated", handleUpdate);
      window.removeEventListener("hijri-offset-changed", handleOffset);
    };
  }, [selectedDate]);

  // Dynamic Salawat Formulas from Firestore / LocalCache (managed by Admin in /admin)
  const [salawatFormulasList, setSalawatFormulasList] = useState<SalawatFormula[]>(() => SALAWAT_FORMULAS);

  useEffect(() => {
    const unsub = subscribeGlobalSalawatFormulas((list) => {
      setSalawatFormulasList(list);
    });
    return () => unsub();
  }, []);

  // Rabi formula selection (defaults to day of rabi or active log)
  const defaultFormulaDay = getDayOfRabiFromDate(selectedDate);
  const [selectedFormulaDay, setSelectedFormulaDay] = useState(defaultFormulaDay);

  useEffect(() => {
    setSelectedFormulaDay(getDayOfRabiFromDate(selectedDate));
  }, [selectedDate]);

  const currentFormula: SalawatFormula = useMemo(() => {
    return getFormulaForDay(selectedFormulaDay, salawatFormulasList);
  }, [selectedFormulaDay, salawatFormulasList]);

  // Dedicated Counter Modals: "general" | "formula" | null
  const [activeCounterModal, setActiveCounterModal] = useState<"general" | "formula" | null>(null);

  // Formula Browser Modal
  const [showFormulaModal, setShowFormulaModal] = useState(false);

  // Custom Monthly Goal (Default 10,000)
  const [monthlyGoal, setMonthlyGoal] = useState<number>(() => {
    const saved = localStorage.getItem("nafahat_monthly_salawat_goal");
    return saved ? parseInt(saved, 10) || 10000 : 10000;
  });

  const [showEditGoalModal, setShowEditGoalModal] = useState(false);
  const [customGoalInput, setCustomGoalInput] = useState(String(monthlyGoal));

  // Daily goals for general and formula
  const [generalDailyGoal, setGeneralDailyGoal] = useState<number>(() => getGeneralSalawatDailyGoal());
  const [formulaDailyGoal, setFormulaDailyGoal] = useState<number>(() =>
    getFormulaSalawatDailyGoal(selectedFormulaDay, currentFormula.recommendedCount)
  );

  useEffect(() => {
    setFormulaDailyGoal(getFormulaSalawatDailyGoal(selectedFormulaDay, currentFormula.recommendedCount));
  }, [selectedFormulaDay, currentFormula.recommendedCount]);

  // Modal to edit daily goals ("general" | "formula" | null)
  const [showEditDailyGoalModal, setShowEditDailyGoalModal] = useState<"general" | "formula" | null>(null);
  const [customDailyGoalInput, setCustomDailyGoalInput] = useState("");
  const [onlyThisDayOption, setOnlyThisDayOption] = useState(false);
  const [showProgressDetailToast, setShowProgressDetailToast] = useState(false);

  const handleOpenEditDailyGoal = (type: "general" | "formula") => {
    setShowEditDailyGoalModal(type);
    setOnlyThisDayOption(false);
    setCustomDailyGoalInput(type === "general" ? String(generalDailyGoal) : String(formulaDailyGoal));
  };

  const handleSaveDailyGoal = () => {
    const num = parseInt(customDailyGoalInput, 10);
    if (!isNaN(num) && num > 0) {
      if (showEditDailyGoalModal === "general") {
        const newTotalGoal = setGeneralSalawatDailyGoal(num, selectedDate, onlyThisDayOption, currentRabiDayNum);
        setGeneralDailyGoal(num);
        setMonthlyGoal(newTotalGoal);
      } else if (showEditDailyGoalModal === "formula") {
        setFormulaSalawatDailyGoal(selectedFormulaDay, num);
        setFormulaDailyGoal(num);
      }
      setShowEditDailyGoalModal(null);
    }
  };

  // Custom Direct Salawat Input Modal
  const [showCustomCountModal, setShowCustomCountModal] = useState<"general" | "formula" | null>(null);
  const [customCountInput, setCustomCountInput] = useState("");

  // Search filter for regular sunnahs
  const [sunnahSearch, setSunnahSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  // Custom user sunnahs list stored in local storage
  const [customSunnahs, setCustomSunnahs] = useState<RegularSunnahItem[]>(() => {
    try {
      const saved = localStorage.getItem("nafahat_custom_sunnahs");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Global Hadaya Nabawiyya from Firestore
  const [globalHadayaList, setGlobalHadayaList] = useState<GlobalHadayaItem[]>([]);

  useEffect(() => {
    const unsub = subscribeGlobalHadaya((items) => {
      setGlobalHadayaList(items);
    });
    return () => unsub();
  }, []);

  // Modal to add custom sunnah
  const [showAddSunnahModal, setShowAddSunnahModal] = useState(false);
  const [newSunnahTitle, setNewSunnahTitle] = useState("");
  const [newSunnahCategory, setNewSunnahCategory] = useState("عام");
  const [newSunnahHint, setNewSunnahHint] = useState("");

  // Copy feedback state
  const [copiedFormula, setCopiedFormula] = useState(false);

  const handleCopyFormula = (text: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedFormula(true);
      setTimeout(() => setCopiedFormula(false), 2000);
    }
  };

  // General Salawat Count for today
  const todayGeneralSalawat = dailyLog?.salawat_count || 0;

  // Specific Formula Count for today
  const todayFormulaSalawat = getFormulaSalawatCount(selectedDate, selectedFormulaDay);

  // Combined Today's Total Salawat
  const todayTotalSalawat = todayGeneralSalawat + todayFormulaSalawat;

  // Handlers for General Salawat
  const handleIncrementGeneralSalawat = async (inc: number) => {
    if (navigator.vibrate) navigator.vibrate(15);
    await addGeneralSalawatCount(selectedDate, inc);
  };

  const handleResetGeneralSalawat = async () => {
    await setGeneralSalawatCountDirect(selectedDate, 0);
    if (navigator.vibrate) navigator.vibrate(20);
  };

  const handleSaveDirectGeneralCount = async () => {
    const val = parseInt(customCountInput, 10);
    if (!isNaN(val) && val >= 0) {
      await setGeneralSalawatCountDirect(selectedDate, val);
      setShowCustomCountModal(null);
    }
  };

  // Handlers for Formula of the Day Salawat
  const handleIncrementFormulaSalawat = (inc: number) => {
    if (navigator.vibrate) navigator.vibrate(15);
    addFormulaSalawatCount(selectedDate, selectedFormulaDay, inc);
    setFormulaSyncTrigger((prev) => prev + 1);
  };

  const handleResetFormulaSalawat = () => {
    setFormulaSalawatCountDirect(selectedDate, selectedFormulaDay, 0);
    setFormulaSyncTrigger((prev) => prev + 1);
    if (navigator.vibrate) navigator.vibrate(20);
  };

  const handleSaveDirectFormulaCount = () => {
    const val = parseInt(customCountInput, 10);
    if (!isNaN(val) && val >= 0) {
      setFormulaSalawatCountDirect(selectedDate, selectedFormulaDay, val);
      setFormulaSyncTrigger((prev) => prev + 1);
      setShowCustomCountModal(null);
    }
  };

  // Save Custom Goal
  const handleSaveMonthlyGoal = () => {
    const num = parseInt(customGoalInput, 10);
    if (!isNaN(num) && num > 0) {
      setMonthlyGoal(num);
      localStorage.setItem("nafahat_monthly_salawat_goal", String(num));
      setShowEditGoalModal(false);
    }
  };

  // Save new custom sunnah
  const handleAddCustomSunnah = () => {
    if (!newSunnahTitle.trim()) return;
    const newItem: RegularSunnahItem = {
      id: `custom_${Date.now()}`,
      title: newSunnahTitle.trim(),
      category: newSunnahCategory.trim() || "عام",
      hint: newSunnahHint.trim() || "سنة مضافة من قبلك",
    };
    const updated = [newItem, ...customSunnahs];
    setCustomSunnahs(updated);
    localStorage.setItem("nafahat_custom_sunnahs", JSON.stringify(updated));
    setNewSunnahTitle("");
    setNewSunnahHint("");
    setShowAddSunnahModal(false);
  };

  // Combined Regular Sunnahs
  const allRegularSunnahs = useMemo(() => {
    return [...customSunnahs, ...DEFAULT_REGULAR_SUNNAHS];
  }, [customSunnahs]);

  // Categories list
  const categories = useMemo(() => {
    const set = new Set<string>();
    allRegularSunnahs.forEach((item) => set.add(item.category));
    return ["all", ...Array.from(set)];
  }, [allRegularSunnahs]);

  // Filtered Regular Sunnahs
  const filteredRegularSunnahs = useMemo(() => {
    return allRegularSunnahs.filter((item) => {
      const matchCategory = selectedCategory === "all" || item.category === selectedCategory;
      const matchSearch =
        !sunnahSearch.trim() ||
        item.title.includes(sunnahSearch.trim()) ||
        item.hint.includes(sunnahSearch.trim());
      return matchCategory && matchSearch;
    });
  }, [allRegularSunnahs, selectedCategory, sunnahSearch]);

  // Regular Sunnah Progress
  const completedRegularIds = useMemo(() => {
    return new Set(dailyLog?.regular_sunnah_ids || []);
  }, [dailyLog]);

  const completedRegularCount = completedRegularIds.size;
  const regularTotalCount = allRegularSunnahs.length;
  const regularPct =
    regularTotalCount > 0
      ? Math.min(100, Math.round((completedRegularCount / regularTotalCount) * 100))
      : 0;

  // Rare Sunnah Progress (Single Star / Checkmark per item)
  const revivedRareMap = useMemo(() => {
    return dailyLog?.rare_sunnah_ratings || {};
  }, [dailyLog]);

  const revivedRareCount = Object.keys(revivedRareMap).filter(
    (k) => (revivedRareMap[k] || 0) > 0
  ).length;

  // Monthly Goal Calculation
  const monthlyGoalPct =
    monthlyGoal > 0 ? Math.min(100, Math.round((monthTotalSalawat / monthlyGoal) * 100)) : 0;

  // Daily goals percentages
  const generalDailyGoalPct =
    generalDailyGoal > 0
      ? Math.min(100, Math.round((todayGeneralSalawat / generalDailyGoal) * 100))
      : 0;

  const formulaDailyGoalPct =
    formulaDailyGoal > 0
      ? Math.min(100, Math.round((todayFormulaSalawat / formulaDailyGoal) * 100))
      : 0;

  const currentRabiDayNum = getDayOfRabiFromDate(selectedDate);
  const currentHijri = getHijriDate(selectedDate);
  const rabiInfo = useMemo(() => getRabiDisplayInfo(selectedDate), [selectedDate, formulaSyncTrigger]);

  // Prophetic Gifts for this day (defaults to 1 curated gift, or admin-created ones)
  const todayHadaya = useMemo(() => {
    return getHadayaForDay(selectedDate, currentRabiDayNum, globalHadayaList);
  }, [selectedDate, currentRabiDayNum, globalHadayaList]);

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-[#f4faf6] text-slate-900 pb-28 relative select-none font-sans overflow-x-hidden"
    >
      {/* 
        ========================================================================
        Subtle Background Decoration (Light Palm Trees & Translucent Salawat Motif)
        ========================================================================
      */}
      <div
        className="fixed inset-0 pointer-events-none z-0 overflow-hidden"
        aria-hidden
      >
        {/* Soft emerald radial glows */}
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-emerald-300/15 blur-3xl" />
        <div className="absolute top-1/2 -left-32 w-96 h-96 rounded-full bg-teal-300/15 blur-3xl" />
        <div className="absolute -bottom-32 right-1/4 w-96 h-96 rounded-full bg-lime-300/10 blur-3xl" />

        {/* Translucent Calligraphy Motif */}
        <div className="absolute inset-0 flex items-center justify-center opacity-[0.035] select-none text-emerald-950 font-serif text-5xl sm:text-7xl font-black rotate-[-6deg] whitespace-nowrap">
          اللَّهُمَّ صَلِّ عَلَى سَيِّدِنَا مُحَمَّدٍ وَعَلَى آلِهِ وَصَحْبِهِ وَسَلِّمْ
        </div>

        {/* Stylized Palm Tree Silhouettes */}
        <div className="absolute bottom-16 -left-12 w-48 h-48 opacity-[0.04] text-emerald-900">
          <svg viewBox="0 0 100 100" fill="currentColor">
            <path d="M50 5 C50 5 45 25 35 35 C20 40 5 35 5 35 C5 35 20 48 30 50 C20 60 5 65 5 65 C5 65 25 65 38 56 C37 68 30 85 25 95 L55 95 C50 85 45 68 46 56 C58 65 78 65 78 65 C78 65 63 60 53 50 C63 48 78 35 78 35 C78 35 63 40 48 35 C38 25 33 5 33 5 Z" />
          </svg>
        </div>
        <div className="absolute top-24 -right-12 w-40 h-40 opacity-[0.03] text-emerald-900">
          <svg viewBox="0 0 100 100" fill="currentColor">
            <path d="M50 5 C50 5 45 25 35 35 C20 40 5 35 5 35 C5 35 20 48 30 50 C20 60 5 65 5 65 C5 65 25 65 38 56 C37 68 30 85 25 95 L55 95 C50 85 45 68 46 56 C58 65 78 65 78 65 C78 65 63 60 53 50 C63 48 78 35 78 35 C78 35 63 40 48 35 C38 25 33 5 33 5 Z" />
          </svg>
        </div>
      </div>

      {/* 
        ========================================================================
        Top Navigation Bar
        ========================================================================
      */}
      <header className="sticky top-0 z-30 bg-[#f4faf6]/90 backdrop-blur-md border-b border-emerald-500/20 px-4 py-3 shadow-2xs">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-center shadow-xs">
              <Palmtree className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <h1 className="text-base font-black text-emerald-950 tracking-tight">
                  نفحات ربيعية
                </h1>
                <span className="text-[10px] font-black bg-emerald-600/15 text-emerald-900 px-2 py-0.5 rounded-full border border-emerald-600/20 shadow-3xs">
                  🌴 {rabiInfo.formattedHijri}
                </span>
              </div>
              <p className="text-[11px] text-emerald-800/80 font-medium">
                {formatArabicDate(new Date(selectedDate))}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Calendar Toggle Button */}
            <button
              onClick={toggleCalendar}
              className={`p-2 rounded-2xl border transition-all cursor-pointer ${
                showCalendar
                  ? "bg-emerald-600 text-white border-emerald-700 shadow-xs"
                  : "bg-white/80 text-emerald-900 border-emerald-500/20 hover:bg-emerald-50"
              }`}
              title="إظهار / إخفاء التقويم"
            >
              <CalendarIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-lg mx-auto px-4 pt-3.5 space-y-4 relative z-10">
        {/* 
          ========================================================================
          Collapsible Calendar Card (With Rabi' al-Awwal days displayed)
          ========================================================================
        */}
        {showCalendar && (
          <div className="animate-in fade-in slide-in-from-top-2 duration-300">
            <NafahatCalendar
              selectedDate={selectedDate}
              onSelectDate={(date) => setSelectedDate(date)}
            />
          </div>
        )}

        {/* 
          ========================================================================
          Primary Section Switcher (الصلاة على النبي ﷺ | السنن والهدي النبوي)
          ========================================================================
        */}
        <div className="flex items-center p-1 bg-emerald-950/10 rounded-2xl border border-emerald-500/20 shadow-inner">
          <button
            type="button"
            onClick={() => handleSetMainTab("salawat")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeMainTab === "salawat"
                ? "bg-emerald-600 text-white shadow-xs"
                : "text-emerald-950/70 hover:text-emerald-950 hover:bg-white/40"
            }`}
          >
            <Heart className="h-3.5 w-3.5 fill-current" />
            <span>الصلاة على النبي ﷺ</span>
            <span className="text-[10px] font-mono font-bold bg-white/20 px-1.5 py-0.2 rounded-full">
              {todayTotalSalawat.toLocaleString("ar-EG")}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleSetMainTab("sunnah")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeMainTab === "sunnah"
                ? "bg-emerald-600 text-white shadow-xs"
                : "text-emerald-950/70 hover:text-emerald-950 hover:bg-white/40"
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>السنن والهدي النبوي</span>
            <span className="text-[10px] font-mono font-bold bg-white/20 px-1.5 py-0.2 rounded-full">
              {completedRegularCount + revivedRareCount}
            </span>
          </button>
        </div>

        {/* 
          ========================================================================
          TAB 1: الصلاة على النبي ﷺ (Salawat Trackers)
          ========================================================================
        */}
        {activeMainTab === "salawat" && (
          <div className="space-y-4 animate-in fade-in duration-300">
            {/* 
              ------------------------------------------------------------------
              1. الصلاة على النبي ﷺ (اللهم صل على سيدنا محمد) - مع شريط الهدف الشهري المدمج
              ------------------------------------------------------------------
            */}
            <div className="bg-white/95 border border-emerald-500/25 rounded-3xl p-4 sm:p-5 shadow-xs relative overflow-hidden">
              {/* Athkar-Style Interactive Row & Buttons */}
              <div className="flex items-stretch gap-1.5">
                {/* Main Interactive Tap Card */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => handleIncrementGeneralSalawat(1)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleIncrementGeneralSalawat(1);
                    }
                  }}
                  className="group relative flex-1 overflow-hidden rounded-2xl border border-emerald-500/25 bg-white p-3 text-right active:scale-[0.97] hover:border-emerald-500/40 transition-all cursor-pointer shadow-xs select-none focus:outline-hidden focus:ring-2 focus:ring-emerald-500/50"
                  title="انقر هنا للتسبيح بالصلاة على النبي ﷺ"
                >
                  {/* Progress Fill */}
                  <div
                    className="absolute inset-y-0 right-0 bg-emerald-500/15 transition-all duration-300"
                    style={{ width: `${generalDailyGoalPct}%` }}
                    aria-hidden
                  />
                  <div className="relative flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-black text-emerald-950 group-active:translate-x-[-1px] transition-transform">
                        اللهم صل على سيدنا محمد
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-black text-emerald-900 tabular-nums font-mono">
                          {todayGeneralSalawat.toLocaleString("ar-EG")} / {generalDailyGoal.toLocaleString("ar-EG")} صلاة
                        </span>
                        {todayGeneralSalawat >= generalDailyGoal && (
                          <span className="rounded-full bg-emerald-600/15 px-1.5 py-0.5 text-[10px] font-black text-emerald-700 inline-block">
                            اكتمل ✓
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Quick decrement, reset, and direct complete buttons */}
                    <div className="flex items-center gap-1.5 shrink-0 relative z-20">
                      {todayGeneralSalawat < generalDailyGoal && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            setGeneralSalawatCountDirect(selectedDate, generalDailyGoal);
                            if (navigator.vibrate) navigator.vibrate([40, 40, 60]);
                          }}
                          className="px-2.5 py-1 text-xs font-black text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs cursor-pointer active:scale-95 transition-all"
                          title="تم مباشرة (إكمال الهدف اليومي)"
                        >
                          تم
                        </button>
                      )}

                      {todayGeneralSalawat > 0 && (
                        <>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              addGeneralSalawatCount(selectedDate, -1);
                              if (navigator.vibrate) navigator.vibrate(8);
                            }}
                            className="h-7 w-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-black text-sm transition-all active:scale-90 cursor-pointer shadow-xs"
                            title="تراجع خطوة (-١)"
                          >
                            -
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              handleResetGeneralSalawat();
                            }}
                            className="h-7 w-7 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 flex items-center justify-center font-black text-xs transition-all active:scale-90 cursor-pointer shadow-xs"
                            title="تصفير العداد"
                          >
                            ⟲
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* View Counter Icon Button */}
                <button
                  onClick={() => setActiveCounterModal("general")}
                  aria-label="العداد الكامل"
                  className="rounded-2xl border border-emerald-500/25 bg-white/80 px-2.5 text-emerald-800 hover:bg-emerald-50 hover:text-emerald-950 active:scale-95 transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer shadow-2xs"
                  title="شاشة العداد الكاملة"
                >
                  <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <circle cx="12" cy="12" r="4" fill="currentColor" className="opacity-40" />
                  </svg>
                  <span className="text-[9px] font-bold leading-none">عداد</span>
                </button>

                {/* Edit Daily Goal Button */}
                <button
                  onClick={() => handleOpenEditDailyGoal("general")}
                  aria-label="تعديل الهدف اليومي"
                  className="rounded-2xl border border-emerald-500/25 bg-white/80 px-2.5 text-emerald-800 hover:bg-amber-50 hover:text-amber-800 active:scale-95 transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer shadow-2xs"
                  title="تعديل الهدف اليومي"
                >
                  <Edit2 className="h-4.5 w-4.5" />
                  <span className="text-[9px] font-bold leading-none">تعديل</span>
                </button>
              </div>

              {/* Integrated Monthly Goal Strip */}
              <div className="mt-3 pt-3 border-t border-emerald-500/15">
                <div className="bg-emerald-50/70 rounded-2xl p-2.5 sm:p-3 border border-emerald-500/20">
                  <div className="flex items-center justify-between gap-2 mb-2 flex-wrap text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="p-1 rounded-lg bg-amber-100 text-amber-800 shrink-0">
                        <Award className="h-3.5 w-3.5" />
                      </span>
                      <span className="font-black text-emerald-950">
                        الهدف الشامل لربيعين (٦٠ يوماً):
                      </span>
                      <span className="font-black text-emerald-900 font-mono">
                        {monthlyGoal.toLocaleString("ar-EG")} صلاة
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setCustomGoalInput(String(monthlyGoal));
                          setShowEditGoalModal(true);
                        }}
                        className="p-1 rounded-md text-slate-500 hover:text-emerald-800 hover:bg-emerald-100/80 transition-colors cursor-pointer"
                        title="تعديل الهدف الشامل"
                      >
                        <Edit3 className="h-3 w-3" />
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-900">
                      <span>إنجاز اليوم:</span>
                      <strong className="font-mono text-emerald-950 font-black">
                        {todayGeneralSalawat.toLocaleString("ar-EG")}
                      </strong>
                    </div>
                  </div>

                  {/* Progress Bar with percentage written directly inside on the green line - Clickable to reveal raw count */}
                  <div
                    onClick={() => setShowProgressDetailToast((prev) => !prev)}
                    className="w-full bg-slate-200/90 rounded-full h-5 overflow-hidden shadow-inner relative flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-emerald-400/40 transition-all"
                    title="انقر لعرض العدد الفعلي المنجز بالتفصيل"
                  >
                    <div
                      className="absolute inset-y-0 right-0 bg-gradient-to-l from-emerald-500 via-emerald-600 to-teal-600 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, Math.max(monthlyGoalPct, 0))}%` }}
                    />
                    <span className="relative z-10 text-[10px] font-black font-mono text-emerald-950 drop-shadow-xs px-2 select-none">
                      {monthlyGoalPct}%
                    </span>
                  </div>

                  {/* Detail popover on click */}
                  {showProgressDetailToast && (
                    <div className="mt-2 p-2.5 bg-white rounded-xl border border-emerald-300 shadow-xs flex items-center justify-between text-xs animate-in fade-in slide-in-from-top-1 duration-150">
                      <div className="flex items-center gap-2 font-black text-emerald-950">
                        <Sparkles className="h-4 w-4 text-emerald-600 shrink-0" />
                        <span className="text-xs font-bold text-slate-700">
                          الصلوات المنجزة:
                        </span>
                        <span className="text-emerald-800 font-mono text-sm font-black bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200">
                          {monthTotalSalawat.toLocaleString("ar-EG")} صلاة
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowProgressDetailToast(false);
                        }}
                        className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer rounded-lg hover:bg-slate-100"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 
              ------------------------------------------------------------------
              2. صيغة اليوم من ربيع الأول - عنوان أوضح وقابلية للطي والفتح
              ------------------------------------------------------------------
            */}
            <div className="bg-white/95 border-2 border-teal-600/30 rounded-3xl p-4 sm:p-5 shadow-xs relative overflow-hidden transition-all">
              {/* Formula Header - Clean, balanced font size, fully visible title, and distinct Rabi 1 / Rabi 2 badge */}
              <div className="flex flex-col gap-1.5 pb-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="px-2.5 py-1 rounded-xl bg-teal-800 text-white text-[11px] font-black shadow-xs shrink-0">
                      {rabiInfo.isRabiAwwal
                        ? `صيغة ${currentFormula.day} ربيع الأول`
                        : rabiInfo.isRabiThani
                        ? `صيغة ${currentFormula.day} ربيع الثاني`
                        : `صيغة اليوم (${currentFormula.day})`}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={toggleFormulaExpanded}
                      className="px-2.5 py-1 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-900 text-xs font-black border border-teal-300/70 transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <span>{isFormulaExpanded ? "إخفاء النص" : "عرض الصيغة"}</span>
                      {isFormulaExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowFormulaModal(true)}
                      className="p-1.5 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200/60 transition-colors cursor-pointer"
                      title="تصفح جميع صيغ الثلاثين يوماً"
                    >
                      <Layers className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCopyFormula(currentFormula.arabicText)}
                      className="p-1.5 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200/60 transition-colors cursor-pointer"
                      title="نسخ نص الصيغة"
                    >
                      {copiedFormula ? (
                        <CheckCheck className="h-4 w-4 text-teal-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Formula title: balanced size, fully legible, no truncation */}
                <h2
                  onClick={toggleFormulaExpanded}
                  className="text-xs sm:text-sm font-bold text-teal-950 leading-relaxed cursor-pointer hover:text-teal-800 transition-colors"
                >
                  {currentFormula.title}
                </h2>
              </div>

              {/* Expandable Formula Text and Details */}
              {isFormulaExpanded && (
                <div className="pt-2 animate-in fade-in duration-200">
                  {/* Arabic Formula Text Box with Warm Beige Background for High Contrast & Refined Typography */}
                  <div className="bg-[#FAF7F0] border border-[#E8DFC8] rounded-2xl p-4 sm:p-5 text-center mb-3 shadow-inner">
                    <p className="font-sans text-base sm:text-lg font-black leading-loose text-[#2A2118] select-text text-center text-balance px-2 tracking-normal">
                      « {currentFormula.arabicText} »
                    </p>
                  </div>

                  {/* Source & Merit */}
                  <div className="text-xs text-slate-700 bg-slate-50/90 rounded-xl p-3 border border-slate-200 mb-3 space-y-1">
                    <div className="flex items-start gap-1.5">
                      <span className="font-black text-teal-950 shrink-0">المصدر:</span>
                      <span className="text-slate-800 font-medium">{currentFormula.source}</span>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <span className="font-black text-teal-950 shrink-0">الفضل:</span>
                      <span className="text-slate-800 font-medium">{currentFormula.merit}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Athkar-Style Interactive Row & Buttons for Formula */}
              <div className="flex items-stretch gap-1.5 mt-2">
                {/* Main Interactive Tap Card */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => handleIncrementFormulaSalawat(1)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleIncrementFormulaSalawat(1);
                    }
                  }}
                  className="group relative flex-1 overflow-hidden rounded-2xl border border-teal-500/25 bg-white p-3 text-right active:scale-[0.97] hover:border-teal-500/40 transition-all cursor-pointer shadow-xs select-none focus:outline-hidden focus:ring-2 focus:ring-teal-500/50"
                  title="انقر هنا للتسبيح بصيغة اليوم"
                >
                  {/* Progress Fill */}
                  <div
                    className="absolute inset-y-0 right-0 bg-teal-500/15 transition-all duration-300"
                    style={{ width: `${formulaDailyGoalPct}%` }}
                    aria-hidden
                  />
                  <div className="relative flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="break-words text-wrap whitespace-pre-wrap text-sm font-black text-teal-950 group-active:translate-x-[-1px] transition-transform">
                        {currentFormula.title}
                      </div>
                      <div className="mt-0.5 text-xs text-teal-800/80 font-bold tabular-nums">
                        {todayFormulaSalawat.toLocaleString("ar-EG")} / {formulaDailyGoal.toLocaleString("ar-EG")} صلاة
                        {todayFormulaSalawat >= formulaDailyGoal && (
                          <span className="mr-1.5 rounded-full bg-teal-600/15 px-1.5 py-0.5 text-[10px] font-black text-teal-700 inline-block">
                            اكتمل ✓
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Quick decrement, reset, and direct complete buttons */}
                    <div className="flex items-center gap-1.5 shrink-0 relative z-20">
                      {todayFormulaSalawat < formulaDailyGoal && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            setFormulaSalawatCountDirect(selectedDate, selectedFormulaDay, formulaDailyGoal);
                            setFormulaSyncTrigger((prev) => prev + 1);
                            if (navigator.vibrate) navigator.vibrate([40, 40, 60]);
                          }}
                          className="px-2.5 py-1 text-xs font-black text-white bg-teal-700 hover:bg-teal-800 rounded-lg shadow-xs cursor-pointer active:scale-95 transition-all"
                          title="تم مباشرة (إكمال الهدف)"
                        >
                          تم
                        </button>
                      )}

                      {todayFormulaSalawat > 0 && (
                        <>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              addFormulaSalawatCount(selectedDate, selectedFormulaDay, -1);
                              setFormulaSyncTrigger((prev) => prev + 1);
                              if (navigator.vibrate) navigator.vibrate(8);
                            }}
                            className="h-7 w-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-black text-sm transition-all active:scale-90 cursor-pointer shadow-xs"
                            title="تراجع خطوة (-١)"
                          >
                            -
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              handleResetFormulaSalawat();
                            }}
                            className="h-7 w-7 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 flex items-center justify-center font-black text-xs transition-all active:scale-90 cursor-pointer shadow-xs"
                            title="تصفير العداد"
                          >
                            ⟲
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* View Counter Icon Button (Identical to Athkar) */}
                <button
                  onClick={() => setActiveCounterModal("formula")}
                  aria-label="العداد الكامل"
                  className="rounded-2xl border border-teal-500/25 bg-white/80 px-2.5 text-teal-800 hover:bg-teal-50 hover:text-teal-950 active:scale-95 transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer shadow-2xs"
                  title="شاشة العداد الكاملة"
                >
                  <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <circle cx="12" cy="12" r="4" fill="currentColor" className="opacity-40" />
                  </svg>
                  <span className="text-[9px] font-bold leading-none">عداد</span>
                </button>

                {/* Edit Daily Goal Button (Identical to Athkar) */}
                <button
                  onClick={() => handleOpenEditDailyGoal("formula")}
                  aria-label="تعديل الهدف اليومي"
                  className="rounded-2xl border border-teal-500/25 bg-white/80 px-2.5 text-teal-800 hover:bg-amber-50 hover:text-amber-800 active:scale-95 transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer shadow-2xs"
                  title="تعديل الهدف اليومي للصيغة"
                >
                  <Edit2 className="h-4.5 w-4.5" />
                  <span className="text-[9px] font-bold leading-none">تعديل</span>
                </button>
              </div>
            </div>

            {/* Hadith Quote with Lighter Soft Illuminated Color */}
            <div className="bg-gradient-to-br from-emerald-50 via-teal-50/90 to-emerald-100/70 text-emerald-950 rounded-3xl p-5 border border-emerald-300/80 shadow-xs space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-lg">🌿</span>
                <h4 className="text-xs font-black text-emerald-900 uppercase tracking-wider">
                  من أنوار وهدايات الصلاة على النبي ﷺ
                </h4>
              </div>
              <p className="font-serif text-sm leading-relaxed text-emerald-950 font-bold">
                «مَنْ صَلَّى عَلَيَّ صَلَاةً صَلَّى اللهُ عَلَيْهِ بِهَا عَشْرًا، وَحُطَّتْ عَنْهُ عَشْرُ خَطِيئَاتٍ، وَرُفِعَتْ لَهُ عَشْرُ دَرَجَاتٍ»
              </p>
              <p className="text-[11px] text-emerald-800/80 font-medium">
                — رواه الإمام أحمد والنسائي وصححه الألباني
              </p>
            </div>
          </div>
        )}

        {/* 
          ========================================================================
          TAB 2: السُّنَنُ وَالْهَدْيُ النَّبَوِي (السُّنن الراتبة والسنن المهجورة)
          ========================================================================
        */}
        {activeMainTab === "sunnah" && (
          <div className="space-y-4 animate-in fade-in duration-300">
            {/* Sub Tabs: السنن الراتبة vs هدايا نبوية - Large, prominent and colorful */}
            <div className="grid grid-cols-2 gap-2.5 p-1.5 bg-slate-100/80 rounded-2xl border border-slate-200">
              <button
                type="button"
                onClick={() => setSunnahSubTab("regular")}
                className={`py-3 px-3 rounded-xl font-black text-xs sm:text-sm transition-all cursor-pointer flex items-center justify-center gap-2 ${
                  sunnahSubTab === "regular"
                    ? "bg-emerald-700 text-white shadow-sm ring-2 ring-emerald-500/30"
                    : "bg-white/80 text-emerald-950 hover:bg-white hover:text-emerald-800"
                }`}
              >
                <span>🌿 السنن اليومية الراتبة</span>
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                  sunnahSubTab === "regular" ? "bg-emerald-800/80 text-emerald-100" : "bg-emerald-100 text-emerald-900"
                }`}>
                  {allRegularSunnahs.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setSunnahSubTab("rare")}
                className={`py-3 px-3 rounded-xl font-black text-xs sm:text-sm transition-all cursor-pointer flex items-center justify-center gap-2 ${
                  sunnahSubTab === "rare"
                    ? "bg-amber-600 text-white shadow-sm ring-2 ring-amber-400/40"
                    : "bg-white/80 text-amber-950 hover:bg-white hover:text-amber-800"
                }`}
              >
                <span>🎁 هدايا نبوية</span>
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                  sunnahSubTab === "rare" ? "bg-amber-700/80 text-amber-100" : "bg-amber-100 text-amber-900"
                }`}>
                  {todayHadaya.length}
                </span>
              </button>
            </div>

            {/* 
              ------------------------------------------------------------------
              SUB-TAB 1: السنن اليومية الراتبة (Daily Regular Sunnahs)
              ------------------------------------------------------------------
            */}
            {sunnahSubTab === "regular" && (
              <div className="space-y-3.5">
                {/* Stats Summary Bar with Warm Soft Beige Background */}
                <div className="bg-[#FAF7F0] border border-[#E8DFC8] rounded-3xl p-4 shadow-xs">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 rounded-xl bg-emerald-600/15 text-emerald-800">
                        <Check className="h-4 w-4" />
                      </span>
                      <div>
                        <h3 className="text-xs sm:text-sm font-black text-emerald-950">
                          الإنجاز اليومي للسنن الراتبة
                        </h3>
                        <p className="text-[11px] text-slate-700 font-bold">
                          طبّقتَ اليوم {completedRegularCount} من {regularTotalCount} سُنّة راتبة
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs sm:text-sm font-black text-emerald-800">
                        {regularPct}%
                      </span>
                      <button
                        onClick={() => setShowAddSunnahModal(true)}
                        className="p-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-transform active:scale-95 cursor-pointer"
                        title="إضافة سُنّة جديدة مخصصة"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="w-full bg-slate-200/80 rounded-full h-2.5 overflow-hidden shadow-inner">
                    <div
                      className="bg-emerald-600 h-full rounded-full transition-all duration-300"
                      style={{ width: `${regularPct}%` }}
                    />
                  </div>
                </div>

                {/* Filter and Search */}
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute right-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      value={sunnahSearch}
                      onChange={(e) => setSunnahSearch(e.target.value)}
                      placeholder="ابحث في السنن اليومية..."
                      className="w-full pl-3 pr-9 py-2.5 bg-white border border-emerald-500/20 rounded-2xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                    />
                  </div>

                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="px-3.5 py-2.5 bg-white border border-emerald-500/20 rounded-2xl text-xs sm:text-sm font-black text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 cursor-pointer shadow-2xs"
                  >
                    <option value="all">🌟 جميع التصنيفات (الكل)</option>
                    {categories
                      .filter((c) => c !== "all")
                      .map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                  </select>
                </div>

                {/* Sunnahs List with Enhanced Readability and Larger Fonts */}
                <div className="space-y-2.5">
                  {filteredRegularSunnahs.map((sunnah) => {
                    const isDone = completedRegularIds.has(sunnah.id);
                    return (
                      <div
                        key={sunnah.id}
                        onClick={() => toggleRegularSunnah(selectedDate, sunnah.id)}
                        className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-start justify-between gap-3.5 ${
                          isDone
                            ? "bg-emerald-50/90 border-emerald-400/50 shadow-2xs"
                            : "bg-white border-slate-200/80 hover:border-emerald-400/50 hover:bg-emerald-50/20 shadow-xs"
                        }`}
                      >
                        <div className="flex items-start gap-3.5 min-w-0 flex-1">
                          <div
                            className={`mt-0.5 w-7 h-7 rounded-xl border flex items-center justify-center transition-colors shrink-0 ${
                              isDone
                                ? "bg-emerald-600 border-emerald-700 text-white shadow-xs"
                                : "border-slate-300 bg-slate-50"
                            }`}
                          >
                            {isDone && <Check className="h-4.5 w-4.5" />}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <h4
                                className={`text-sm sm:text-base font-black ${
                                  isDone ? "text-emerald-950 line-through opacity-80" : "text-slate-900"
                                }`}
                              >
                                {sunnah.title}
                              </h4>
                              <span className="text-[10px] sm:text-xs font-bold px-2.5 py-0.5 rounded-lg bg-emerald-100 text-emerald-900 border border-emerald-300/60">
                                {sunnah.category}
                              </span>
                            </div>
                            <p className="text-xs sm:text-sm text-slate-600 font-medium leading-relaxed">
                              {sunnah.hint}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 
              ------------------------------------------------------------------
              SUB-TAB 2: هدايا نبوية (Prophetic Gifts - Curated by Admin)
              ------------------------------------------------------------------
            */}
            {sunnahSubTab === "rare" && (
              <div className="space-y-3.5">
                {/* Intro Banner with Authentic Hadith in Soft Amber/Teal */}
                <div className="bg-gradient-to-r from-amber-50 via-amber-100/50 to-emerald-50 text-slate-900 p-4.5 rounded-3xl shadow-xs border border-amber-200/80">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="p-1.5 rounded-xl bg-amber-400/30 text-amber-900">
                      <Star className="h-4 w-4 fill-amber-500 text-amber-600" />
                    </span>
                    <h3 className="text-xs sm:text-sm font-black text-amber-950">
                      هدايا نبوية وأنوار محمدية ﷺ
                    </h3>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-800 leading-relaxed font-sans font-bold">
                    «مَنْ سَنَّ فِي الإِسْلاَمِ سُنَّةً حَسَنَةً فَلَهُ أَجْرُهَا وَأَجْرُ مَنْ عَمِلَ بِهَا بَعْدَهُ مِنْ غَيْرِ أَنْ يَنْقُصَ مِنْ أُجُورِهِمْ شَيْءٌ» [رواه مسلم]
                  </p>
                </div>

                {/* Hadaya List (Curated for the day) */}
                {todayHadaya.length === 0 ? (
                  <div className="bg-white border border-amber-200/60 rounded-3xl p-6 text-center shadow-xs">
                    <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-3 border border-amber-200">
                      <Star className="h-6 w-6 text-amber-500 fill-amber-400/30" />
                    </div>
                    <p className="text-sm font-black text-slate-900 mb-1">
                      لم يتم نشر هدية نبوية لهذا اليوم بعد 🌿
                    </p>
                    <p className="text-xs font-bold text-slate-500">
                      ستظهر الهدايا والسنن النبوية هنا فور نشرها وتفعيلها.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {todayHadaya.map((item) => {
                      const isRevived = (revivedRareMap[item.id] || 0) > 0;

                      return (
                        <div
                          key={item.id}
                          className={`rounded-3xl border p-4.5 transition-all ${
                            isRevived
                              ? "bg-gradient-to-b from-amber-50/90 to-emerald-50/60 border-amber-300 shadow-sm ring-1 ring-amber-400/40"
                              : "bg-white border-amber-200/80 hover:bg-amber-50/30 shadow-xs"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3 mb-2.5">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full ${
                                  item.isAdminCreated
                                    ? "bg-amber-500 text-amber-950 font-extrabold"
                                    : "bg-emerald-600 text-white"
                                }`}>
                                  {item.targetBadge || (item.isAdminCreated ? "هدية نبوية مباركة 🎁" : "هدية اليوم")}
                                </span>
                              </div>
                              <h4 className="text-sm sm:text-base font-black text-slate-900">
                                {item.title}
                              </h4>
                            </div>

                            {/* Single Star / Checkmark Toggle Action */}
                            <button
                              type="button"
                              onClick={() => toggleRareSunnahRevived(selectedDate, item.id)}
                              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-2xl font-black text-xs sm:text-sm transition-all cursor-pointer shrink-0 active:scale-95 shadow-xs ${
                                isRevived
                                  ? "bg-amber-500 text-emerald-950 border border-amber-600 shadow-amber-500/20 ring-2 ring-amber-400/50"
                                  : "bg-white border border-amber-300 text-slate-700 hover:bg-amber-50 hover:text-amber-800"
                              }`}
                            >
                              <Star
                                className={`h-4.5 w-4.5 ${
                                  isRevived ? "fill-emerald-950 text-emerald-950" : "text-amber-500"
                                }`}
                              >
                              </Star>
                              <span>{isRevived ? "مُحْيَاةٌ اليوم ⭐" : "إِحْيَاء"}</span>
                            </button>
                          </div>

                          {/* Hadith text */}
                          <div className="bg-amber-50/50 border border-amber-200/80 rounded-2xl p-3.5 mb-2.5 font-sans font-bold text-xs sm:text-sm leading-loose text-slate-900 shadow-inner">
                            « {item.hadithText} »
                          </div>

                          {/* Scholar Benefit / Virtue */}
                          <div className="flex items-start gap-2 text-xs sm:text-sm text-slate-700 bg-white p-3 rounded-xl border border-amber-200/50">
                            <span className="font-bold text-amber-900 shrink-0">الفضل والبركة:</span>
                            <span className="font-medium leading-relaxed">{item.benefit || (item as any).scholarBenefit}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* 
        ========================================================================
        MODAL 1: Full-Screen Immersive Counter for General Salawat (الصلاة العامة)
        ========================================================================
      */}
      {activeCounterModal === "general" && (
        <NafahatCounterOverlay
          type="general"
          title="الصلاة على النبي ﷺ"
          arabicText="اللَّهُمَّ صَلِّ عَلَى سَيِّدِنَا مُحَمَّدٍ وَعَلَى آلِهِ وَصَحْبِهِ وَسَلِّمْ"
          count={todayGeneralSalawat}
          target={generalDailyGoal}
          onIncrement={(amt = 1) => handleIncrementGeneralSalawat(amt)}
          onReset={handleResetGeneralSalawat}
          onClose={() => setActiveCounterModal(null)}
          onEditCount={() => {
            setCustomCountInput(String(todayGeneralSalawat));
            setShowCustomCountModal("general");
          }}
          onEditTarget={() => {
            handleOpenEditDailyGoal("general");
          }}
        />
      )}

      {/* 
        ========================================================================
        MODAL 2: Full-Screen Immersive Counter for Formula of the Day (صيغة اليوم)
        ========================================================================
      */}
      {activeCounterModal === "formula" && (
        <NafahatCounterOverlay
          type="formula"
          title={`صيغة ${formatRabiDayShort(selectedFormulaDay)}: ${currentFormula.title}`}
          arabicText={currentFormula.arabicText}
          count={todayFormulaSalawat}
          target={formulaDailyGoal}
          onIncrement={(amt = 1) => handleIncrementFormulaSalawat(amt)}
          onReset={handleResetFormulaSalawat}
          onClose={() => setActiveCounterModal(null)}
          onEditCount={() => {
            setCustomCountInput(String(todayFormulaSalawat));
            setShowCustomCountModal("formula");
          }}
          onEditTarget={() => {
            handleOpenEditDailyGoal("formula");
          }}
        />
      )}

      {/* 
        ========================================================================
        MODAL: Edit Daily Goal Modal (General or Formula)
        ========================================================================
      */}
      {showEditDailyGoalModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xs w-full p-5 shadow-2xl relative animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-black text-slate-900">
                {showEditDailyGoalModal === "general"
                  ? `تحديد هدف اليوم (${formatRabiDayShort(currentRabiDayNum)})`
                  : `تحديد هدف صيغة ${formatRabiDayShort(selectedFormulaDay)}`}
              </h3>
              <button
                onClick={() => setShowEditDailyGoalModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-[11px] text-slate-500 mb-2.5">
              حدد عدد التكرار اليومي الذي ترغب في الالتزام به:
            </p>

            <input
              type="number"
              min="1"
              value={customDailyGoalInput}
              onChange={(e) => setCustomDailyGoalInput(e.target.value)}
              className="w-full text-center font-mono text-xl font-black p-3 rounded-2xl border border-emerald-500/30 bg-emerald-50/40 text-emerald-950 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 mb-3"
              placeholder="100"
              autoFocus
            />

            {showEditDailyGoalModal === "general" && (
              <label className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer select-none text-[11px] font-bold text-slate-800 hover:bg-emerald-50/50 transition-colors mb-4">
                <input
                  type="checkbox"
                  checked={onlyThisDayOption}
                  onChange={(e) => setOnlyThisDayOption(e.target.checked)}
                  className="h-4 w-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 cursor-pointer"
                />
                <span>تعديل هذا اليوم فقط (دون التأثير على باقي الأيام)</span>
              </label>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleSaveDailyGoal}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                حفظ الهدف
              </button>
              <button
                onClick={() => setShowEditDailyGoalModal(null)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 
        ========================================================================
        MODAL 3: 30-Day Formulas Browser Modal
        ========================================================================
      */}
      {showFormulaModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 shadow-2xl relative max-h-[85vh] flex flex-col animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-700">
                  <Layers className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-black text-emerald-950">
                  صِيَغُ الصَّلاَةِ عَلَى النَّبِيِّ ﷺ (٣٠ يَوْمًا)
                </h3>
              </div>
              <button
                onClick={() => setShowFormulaModal(false)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="overflow-y-auto py-3 space-y-3 flex-1 pr-1 pl-1">
              {salawatFormulasList.map((item) => {
                const isCurrent = item.day === selectedFormulaDay;
                return (
                  <div
                    key={item.day}
                    onClick={() => {
                      setSelectedFormulaDay(item.day);
                      setShowFormulaModal(false);
                    }}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                      isCurrent
                        ? "bg-emerald-50 border-emerald-500/50 shadow-xs ring-2 ring-emerald-400/30"
                        : "bg-slate-50/70 border-slate-200 hover:bg-emerald-50/40"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-600 text-white">
                        اليوم {item.day} من ربيع
                      </span>
                      <h4 className="text-xs font-black text-emerald-950">
                        {item.title}
                      </h4>
                    </div>

                    <p className="font-serif text-xs text-slate-800 leading-relaxed line-clamp-3">
                      « {item.arabicText} »
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 
        ========================================================================
        MODAL 4: Edit Custom Count Modal (General or Formula)
        ========================================================================
      */}
      {showCustomCountModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xs w-full p-5 shadow-2xl relative animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-black text-slate-900">
                {showCustomCountModal === "general"
                  ? "تعديل عداد الصلاة العامة"
                  : `تعديل عداد صيغة ${formatRabiDayShort(selectedFormulaDay)}`}
              </h3>
              <button
                onClick={() => setShowCustomCountModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <input
              type="number"
              min="0"
              value={customCountInput}
              onChange={(e) => setCustomCountInput(e.target.value)}
              className="w-full text-center font-mono text-2xl font-black p-3 rounded-2xl border border-emerald-500/30 bg-emerald-50/40 text-emerald-950 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 mb-4"
              placeholder="0"
              autoFocus
            />

            <div className="flex gap-2">
              <button
                onClick={
                  showCustomCountModal === "general"
                    ? handleSaveDirectGeneralCount
                    : handleSaveDirectFormulaCount
                }
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                حفظ
              </button>
              <button
                onClick={() => setShowCustomCountModal(null)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 
        ========================================================================
        MODAL 5: Edit Monthly Goal Modal
        ========================================================================
      */}
      {showEditGoalModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xs w-full p-5 shadow-2xl relative animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-black text-slate-900">
                تحديد الهدف الشهري التراكمي
              </h3>
              <button
                onClick={() => setShowEditGoalModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-[11px] text-slate-500 mb-3">
              حدد عدد الصلوات المستهدف إنجازها خلال شهر ربيع الأول كاملاً:
            </p>

            <input
              type="number"
              step="1000"
              min="100"
              value={customGoalInput}
              onChange={(e) => setCustomGoalInput(e.target.value)}
              className="w-full text-center font-mono text-xl font-black p-3 rounded-2xl border border-emerald-500/30 bg-emerald-50/40 text-emerald-950 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 mb-4"
              placeholder="10000"
              autoFocus
            />

            <div className="flex gap-2">
              <button
                onClick={handleSaveMonthlyGoal}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                حفظ الهدف
              </button>
              <button
                onClick={() => setShowEditGoalModal(false)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 
        ========================================================================
        MODAL 6: Add Custom Sunnah Modal
        ========================================================================
      */}
      {showAddSunnahModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl relative animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
              <h3 className="text-xs font-black text-slate-900">
                إضافة سُنّة راتبة جديدة
              </h3>
              <button
                onClick={() => setShowAddSunnahModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  عنوان السُنّة المباركة *
                </label>
                <input
                  type="text"
                  value={newSunnahTitle}
                  onChange={(e) => setNewSunnahTitle(e.target.value)}
                  placeholder="مثال: البداءة باليمين في الوضوء"
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  التصنيف
                </label>
                <input
                  type="text"
                  value={newSunnahCategory}
                  onChange={(e) => setNewSunnahCategory(e.target.value)}
                  placeholder="مثال: طهارة، صلاة، آداب، نوم..."
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  فضلها أو تلميح تطبيقي
                </label>
                <input
                  type="text"
                  value={newSunnahHint}
                  onChange={(e) => setNewSunnahHint(e.target.value)}
                  placeholder="مثال: كان ﷺ يحب التيامن في كل شأنه"
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleAddCustomSunnah}
                disabled={!newSunnahTitle.trim()}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-black rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                إضافة
              </button>
              <button
                onClick={() => setShowAddSunnahModal(false)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
