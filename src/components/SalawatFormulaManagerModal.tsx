import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  X,
  Search,
  Sparkles,
  Edit2,
  CheckCircle2,
  FileSpreadsheet,
  RotateCcw,
  ArrowUp,
  ArrowDown,
  ArrowLeftRight,
  Layers,
  Heart,
  Save,
  BookOpen,
  GripVertical,
  Check,
  Smartphone,
  MoveVertical,
} from "lucide-react";
import { Reorder, motion, AnimatePresence } from "motion/react";
import {
  type SalawatFormula,
  DEFAULT_SALAWAT_FORMULAS,
  saveGlobalSalawatFormulas,
  updateSingleSalawatFormula,
  swapSalawatFormulas,
  moveSalawatFormula,
  resetSalawatFormulasToDefault,
} from "@/lib/nafahat";
import { isoDate, formatArabicDate } from "@/lib/date-utils";

interface SalawatFormulaManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  formulas: SalawatFormula[];
  onRefresh?: () => void;
}

interface FormulaWithUid extends SalawatFormula {
  _uid: string;
}

export function SalawatFormulaManagerModal({
  isOpen,
  onClose,
  formulas,
  onRefresh,
}: SalawatFormulaManagerModalProps) {
  const [activeTab, setActiveTab] = useState<"list" | "edit">("list");
  const [searchQuery, setSearchQuery] = useState("");

  const rawList = formulas && formulas.length > 0 ? formulas : DEFAULT_SALAWAT_FORMULAS;

  // Stable local list for iOS drag & reorder
  const [localFormulas, setLocalFormulas] = useState<FormulaWithUid[]>(() => {
    return rawList.map((f, i) => ({
      ...f,
      _uid: `uid_${f.day}_${i}_${f.title.slice(0, 10).replace(/\s+/g, "_")}`,
    }));
  });

  // Keep local formulas in sync when props change (if not currently dragging)
  useEffect(() => {
    if (formulas && formulas.length > 0) {
      setLocalFormulas(
        formulas.map((f, i) => ({
          ...f,
          _uid: `uid_${f.day}_${i}_${f.title.slice(0, 10).replace(/\s+/g, "_")}`,
        }))
      );
    }
  }, [formulas]);

  // Edit State
  const [editingDay, setEditingDay] = useState<number>(1);
  const [editTitle, setEditTitle] = useState("");
  const [editArabicText, setEditArabicText] = useState("");
  const [editSource, setEditSource] = useState("");
  const [editMerit, setEditMerit] = useState("");
  const [editRecommendedCount, setEditRecommendedCount] = useState<string>("100");

  // Quick Swap Bar State
  const [swapDayA, setSwapDayA] = useState<number>(1);
  const [swapDayB, setSwapDayB] = useState<number>(2);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [saveToast, setSaveToast] = useState<string | null>(null);

  // Debounced auto-save timer ref
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  if (!isOpen) return null;

  const currentFormulasList = localFormulas.length > 0 ? localFormulas : rawList;

  const handleStartEdit = (formula: SalawatFormula) => {
    setEditingDay(formula.day);
    setEditTitle(formula.title);
    setEditArabicText(formula.arabicText);
    setEditSource(formula.source || "");
    setEditMerit(formula.merit || "");
    setEditRecommendedCount(String(formula.recommendedCount || 100));
    setActiveTab("edit");
    setFeedbackMsg(null);
  };

  const handleSelectDayToEdit = (dayNum: number) => {
    const found = currentFormulasList.find((f) => f.day === dayNum) || currentFormulasList[dayNum - 1];
    if (found) {
      handleStartEdit(found);
    }
  };

  const handleSaveFormulaEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTitle.trim()) {
      setFeedbackMsg({ type: "error", text: "يرجى كتابة عنوان أو اسم الصيغة" });
      return;
    }
    if (!editArabicText.trim()) {
      setFeedbackMsg({ type: "error", text: "يرجى كتابة نص الصيغة الشريفة" });
      return;
    }

    const parsedCount = parseInt(editRecommendedCount, 10);
    const validCount = !isNaN(parsedCount) && parsedCount > 0 ? parsedCount : 100;

    setIsSubmitting(true);
    setFeedbackMsg(null);

    try {
      await updateSingleSalawatFormula(editingDay, {
        title: editTitle.trim(),
        arabicText: editArabicText.trim(),
        source: editSource.trim(),
        merit: editMerit.trim(),
        recommendedCount: validCount,
      });

      // Update local state as well
      setLocalFormulas((prev) =>
        prev.map((item) =>
          item.day === editingDay
            ? {
                ...item,
                title: editTitle.trim(),
                arabicText: editArabicText.trim(),
                source: editSource.trim(),
                merit: editMerit.trim(),
                recommendedCount: validCount,
              }
            : item
        )
      );

      setFeedbackMsg({
        type: "success",
        text: `✨ تم حفظ تعديل صيغة اليوم (${editingDay}) بنجاح وتحديثها سحابياً لجميع الأعضاء!`,
      });
      onRefresh?.();
    } catch (err: any) {
      setFeedbackMsg({
        type: "error",
        text: err.message || "حدث خطأ أثناء حفظ تعديلات الصيغة",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // iOS-style Reorder handler
  const handleReorder = (newItems: FormulaWithUid[]) => {
    // Re-index days 1..30
    const reindexed: FormulaWithUid[] = newItems.map((item, idx) => ({
      ...item,
      day: idx + 1,
    }));

    setLocalFormulas(reindexed);
    setIsSavingOrder(true);

    // Provide haptic feedback if available
    if (typeof window !== "undefined" && "navigator" in window && "vibrate" in navigator) {
      try {
        navigator.vibrate?.(20);
      } catch (e) {}
    }

    // Debounce save to Firestore & localStorage
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await saveGlobalSalawatFormulas(reindexed);
        setIsSavingOrder(false);
        setSaveToast("✨ تم حفظ الترتيب الجديد سحابياً بنجاح لجميع الأعضاء!");
        setTimeout(() => setSaveToast(null), 3500);
        onRefresh?.();
      } catch (err) {
        console.error("Failed to auto-save reordered formulas:", err);
        setIsSavingOrder(false);
      }
    }, 600);
  };

  const handleManualMove = async (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= localFormulas.length) return;

    const updated = [...localFormulas];
    const [moved] = updated.splice(index, 1);
    updated.splice(targetIndex, 0, moved);

    handleReorder(updated);
  };

  const handleExecuteQuickSwap = async () => {
    if (swapDayA === swapDayB) {
      alert("يرجى اختيار يومين مختلفين للتبديل بينهما");
      return;
    }
    setIsSubmitting(true);
    try {
      await swapSalawatFormulas(swapDayA, swapDayB);
      
      // Update local state
      const updated = [...localFormulas];
      const idxA = updated.findIndex((f) => f.day === swapDayA);
      const idxB = updated.findIndex((f) => f.day === swapDayB);
      if (idxA !== -1 && idxB !== -1) {
        const temp = updated[idxA];
        updated[idxA] = updated[idxB];
        updated[idxB] = temp;
        const reindexed = updated.map((item, idx) => ({ ...item, day: idx + 1 }));
        setLocalFormulas(reindexed);
      }

      setFeedbackMsg({
        type: "success",
        text: `🔄 تم تبديل صيغة اليوم (${swapDayA}) مع صيغة اليوم (${swapDayB}) بنجاح!`,
      });
      onRefresh?.();
    } catch (err: any) {
      setFeedbackMsg({
        type: "error",
        text: err.message || "حدث خطأ أثناء تبديل الصيغ",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetToDefaults = async () => {
    const confirmReset = window.confirm(
      "هل أنت متأكد من استعادة الترتيب والنصوص الأصلية المعتمدة لجميع صيغ الصلاة على النبي ﷺ (٣٠ يوماً)؟"
    );
    if (!confirmReset) return;

    setIsSubmitting(true);
    try {
      await resetSalawatFormulasToDefault();
      setLocalFormulas(
        DEFAULT_SALAWAT_FORMULAS.map((f, i) => ({
          ...f,
          _uid: `uid_def_${f.day}_${i}`,
        }))
      );
      setFeedbackMsg({
        type: "success",
        text: "✨ تم استعادة الترتيب والنصوص الأصلية بنجاح لجميع أيام الشهر!",
      });
      onRefresh?.();
    } catch (err: any) {
      setFeedbackMsg({
        type: "error",
        text: err.message || "حدث خطأ أثناء استعادة الترتيب الأصلي",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Export 30-Day Formulas Schedule to Excel
  const exportFormulasToExcel = () => {
    const rowsHtml = currentFormulasList
      .map((item) => {
        return `
        <tr>
          <td style="text-align: center; font-weight: bold; font-size: 13px;">اليوم ${item.day}</td>
          <td style="font-weight: bold; text-align: right; font-size: 13px;">${item.title}</td>
          <td style="text-align: right; font-size: 13px; font-family: traditional arabic, serif;">« ${item.arabicText} »</td>
          <td style="text-align: center; font-weight: bold;">${item.recommendedCount || 100}</td>
          <td style="text-align: right; font-size: 12px;">${item.source || "كتب الصلوات المعتمدة"}</td>
          <td style="text-align: right; font-size: 12px;">${item.merit || ""}</td>
        </tr>
      `;
      })
      .join("");

    const excelHtml = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
        <style>
          body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; }
          table { border-collapse: collapse; width: 100%; direction: rtl; }
          th { background-color: #0d9488; color: #ffffff; font-weight: bold; padding: 10px; border: 1px solid #0f766e; text-align: center; }
          td { padding: 8px; border: 1px solid #cbd5e1; font-size: 13px; }
        </style>
      </head>
      <body dir="rtl">
        <h2 style="text-align: center; color: #0f766e; font-family: sans-serif;">جدول صِيَغ الصلاة على النبي ﷺ لشهر ربيع الأنوار (30 يوماً) 🌸</h2>
        <p style="text-align: center; color: #475569; font-size: 12px;">تم التصدير بتاريخ: ${isoDate()} (${formatArabicDate(isoDate())})</p>
        <table>
          <thead>
            <tr>
              <th>اليوم</th>
              <th>اسم / عنوان الصيغة</th>
              <th>نص الصيغة المباركة</th>
              <th>العدد المستهدف</th>
              <th>المصدر والتخريج</th>
              <th>الفضل والبركة</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob(["\uFEFF" + excelHtml], { type: "application/vnd.ms-excel;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `جدول_صيغ_الصلاة_على_النبي_30_يوما_${isoDate()}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isSearchActive = Boolean(searchQuery.trim());
  const filteredFormulas = currentFormulasList.filter((item) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      item.arabicText.toLowerCase().includes(q) ||
      (item.source && item.source.toLowerCase().includes(q)) ||
      (item.merit && item.merit.toLowerCase().includes(q)) ||
      String(item.day).includes(q)
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-5 bg-slate-900/60 backdrop-blur-xs text-right dir-rtl animate-in fade-in duration-150 select-none">
      <div className="bg-white w-full max-w-4xl max-h-[92vh] rounded-3xl shadow-2xl border border-teal-200 flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-teal-900 via-emerald-900 to-teal-950 text-white flex items-center justify-between gap-3 shrink-0 shadow-sm">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-2xl bg-teal-500/30 border border-teal-400/40 flex items-center justify-center text-xl shadow-inner shrink-0">
              🌸
            </div>
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-black tracking-tight flex items-center gap-2 flex-wrap">
                <span>إدارة وترتيب صِيَغ الصلاة على النبي ﷺ</span>
                <span className="text-[10px] bg-teal-700/80 px-2 py-0.5 rounded-full border border-teal-500/50">
                  ٣٠ يوماً (سحابي مباشر)
                </span>
              </h3>
              <p className="text-xs text-teal-200/90 font-medium mt-0.5 truncate">
                سحب وإفلات متل الآيفون، تعديل النصوص، وتبديل الأيام للمدير
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-2xl bg-white/10 hover:bg-white/20 text-teal-100 hover:text-white transition-all cursor-pointer border border-white/10 shrink-0"
            title="إغلاق النافذة"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Top Control Bar with Tabs & Actions */}
        <div className="p-3 sm:p-4 bg-teal-50/80 border-b border-teal-100 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          {/* Tabs */}
          <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-teal-200 shadow-2xs w-full sm:w-auto overflow-x-auto">
            <button
              type="button"
              onClick={() => {
                setActiveTab("list");
                setFeedbackMsg(null);
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                activeTab === "list"
                  ? "bg-teal-700 text-white shadow-xs"
                  : "text-slate-600 hover:bg-teal-50 hover:text-teal-950"
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              <span>📱 جدول وترتيب الصيغ (سحب وإفلات)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab("edit");
                handleSelectDayToEdit(editingDay);
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                activeTab === "edit"
                  ? "bg-teal-700 text-white shadow-xs"
                  : "text-slate-600 hover:bg-teal-50 hover:text-teal-950"
              }`}
            >
              <Edit2 className="h-3.5 w-3.5" />
              <span>✏️ تعديل اسم ونصوص الصيغة (اليوم {editingDay})</span>
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {isSavingOrder && (
              <span className="text-[11px] font-bold text-teal-800 bg-teal-100/90 px-2.5 py-1 rounded-xl flex items-center gap-1 animate-pulse border border-teal-300">
                <Sparkles className="h-3.5 w-3.5 text-teal-700 animate-spin" />
                <span>جارٍ حفظ الترتيب...</span>
              </span>
            )}

            <button
              type="button"
              onClick={handleResetToDefaults}
              disabled={isSubmitting || isSavingOrder}
              className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition-all cursor-pointer shadow-2xs flex items-center gap-1 border border-slate-200 shrink-0"
              title="استعادة الترتيب والنصوص الافتراضية المعتمدة"
            >
              <RotateCcw className="h-3.5 w-3.5 text-slate-500" />
              <span>استعادة الأصلي</span>
            </button>

            <button
              type="button"
              onClick={exportFormulasToExcel}
              className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-black transition-all cursor-pointer shadow-2xs flex items-center gap-1.5 border border-teal-700 shrink-0"
              title="تصدير جدول الصيغ 30 يوماً كملف إكسل"
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span>تصدير (Excel)</span>
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 bg-slate-50/50">
          {/* Global Notifications */}
          {feedbackMsg && (
            <div
              className={`p-3 rounded-2xl mb-3 text-xs font-bold flex items-center justify-between gap-2 border shadow-2xs animate-in fade-in duration-150 ${
                feedbackMsg.type === "success"
                  ? "bg-emerald-50 text-emerald-900 border-emerald-300"
                  : "bg-rose-50 text-rose-900 border-rose-300"
              }`}
            >
              <div className="flex items-center gap-2">
                {feedbackMsg.type === "success" ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                ) : (
                  <X className="h-4 w-4 text-rose-600 shrink-0" />
                )}
                <span>{feedbackMsg.text}</span>
              </div>
              <button
                type="button"
                onClick={() => setFeedbackMsg(null)}
                className="p-1 hover:bg-black/5 rounded-lg text-slate-400"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {saveToast && (
            <div className="p-2.5 rounded-2xl mb-3 text-xs font-black bg-teal-600 text-white border border-teal-700 shadow-md flex items-center justify-between gap-2 animate-in slide-in-from-top-2 duration-200">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-teal-200" />
                <span>{saveToast}</span>
              </div>
              <button
                type="button"
                onClick={() => setSaveToast(null)}
                className="p-1 hover:bg-white/20 rounded-lg text-teal-100"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* TAB 1: Formulas List & iOS Drag and Drop Reordering */}
          {activeTab === "list" && (
            <div className="space-y-3">
              {/* iPhone Long-Press Drag & Drop Interactive Tip Banner */}
              <div className="p-3 bg-gradient-to-r from-teal-50 via-emerald-50 to-amber-50 rounded-2xl border border-teal-300/80 shadow-2xs flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-xs shrink-0">
                    <Smartphone className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-teal-950 flex items-center gap-1.5">
                      <span>السحب والترتيب الذكي (متل الآيفون)</span>
                      <span className="text-[10px] bg-amber-200 text-amber-900 font-extrabold px-1.5 py-0.2 rounded">
                        لمس مطول 📱
                      </span>
                    </h4>
                    <p className="text-[11px] text-teal-800 font-medium mt-0.5">
                      اضغط باستمرار على بطاقة الصيغة أو أيقونة المقبض (<GripVertical className="inline h-3 w-3 text-teal-700" />) ثم اسحبها لأعلى أو لأسفل، وسيتم تحديث وحفظ ترتيب الـ 30 يوماً تلقائياً لجميع الأعضاء.
                    </p>
                  </div>
                </div>
              </div>

              {/* Quick Swap Box */}
              <div className="p-3 bg-white rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2.5 shadow-2xs">
                <div className="flex items-center gap-2 min-w-0">
                  <ArrowLeftRight className="h-4 w-4 text-teal-700 shrink-0" />
                  <span className="text-xs font-black text-slate-800 shrink-0">
                    تبديل سريع بين يومين:
                  </span>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <select
                    value={swapDayA}
                    onChange={(e) => setSwapDayA(Number(e.target.value))}
                    className="px-2 py-1 rounded-xl border border-teal-300 bg-white text-xs font-bold text-teal-950 focus:outline-none shadow-2xs"
                  >
                    {currentFormulasList.map((f) => (
                      <option key={`a_${f.day}`} value={f.day}>
                        اليوم {f.day}: {f.title.length > 15 ? f.title.substring(0, 15) + "..." : f.title}
                      </option>
                    ))}
                  </select>

                  <span className="text-xs font-black text-teal-700">مع</span>

                  <select
                    value={swapDayB}
                    onChange={(e) => setSwapDayB(Number(e.target.value))}
                    className="px-2 py-1 rounded-xl border border-teal-300 bg-white text-xs font-bold text-teal-950 focus:outline-none shadow-2xs"
                  >
                    {currentFormulasList.map((f) => (
                      <option key={`b_${f.day}`} value={f.day}>
                        اليوم {f.day}: {f.title.length > 15 ? f.title.substring(0, 15) + "..." : f.title}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={handleExecuteQuickSwap}
                    disabled={isSubmitting || isSavingOrder}
                    className="px-3 py-1 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-black transition-all cursor-pointer shadow-xs flex items-center gap-1 shrink-0"
                  >
                    <ArrowLeftRight className="h-3 w-3" />
                    <span>تبديل</span>
                  </button>
                </div>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ابحث في أسماء الصيغ أو نصوصها المباركة..."
                  className="w-full pl-3 pr-10 py-2.5 rounded-2xl border border-slate-200 bg-white text-xs font-medium focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                />
              </div>

              {isSearchActive && (
                <div className="p-2 px-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] font-bold text-amber-900 flex items-center gap-1.5">
                  <span>💡 ملاحظة: السحب وإعادة الترتيب يعمل في وضع العرض الكامل (امسح البحث لتفعيل السحب).</span>
                </div>
              )}

              {/* iOS Reorderable List of 30 Days */}
              {!isSearchActive ? (
                <Reorder.Group
                  axis="y"
                  values={localFormulas}
                  onReorder={handleReorder}
                  className="space-y-2.5"
                >
                  {localFormulas.map((item, index) => {
                    const isFirst = index === 0;
                    const isLast = index === localFormulas.length - 1;

                    return (
                      <Reorder.Item
                        key={item._uid}
                        value={item}
                        dragListener={true}
                        whileDrag={{
                          scale: 1.025,
                          boxShadow: "0 20px 25px -5px rgba(13, 148, 136, 0.25), 0 8px 10px -6px rgba(13, 148, 136, 0.2)",
                          zIndex: 50,
                          cursor: "grabbing",
                          backgroundColor: "#f0fdfa",
                        }}
                        onDragStart={() => {
                          if (typeof window !== "undefined" && "navigator" in window && "vibrate" in navigator) {
                            try {
                              navigator.vibrate?.(35);
                            } catch (e) {}
                          }
                        }}
                        className="p-3.5 bg-white rounded-2xl border border-slate-200/90 hover:border-teal-400 hover:shadow-xs transition-all flex flex-col md:flex-row md:items-start justify-between gap-3 group relative cursor-grab active:cursor-grabbing select-none"
                      >
                        {/* Drag Handle & Content */}
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          {/* iOS Drag Handle with Day Badge */}
                          <div className="flex flex-col items-center gap-1 shrink-0 pt-0.5">
                            <div className="p-1.5 rounded-xl bg-slate-100 group-hover:bg-teal-100 text-slate-400 group-hover:text-teal-700 transition-colors">
                              <GripVertical className="h-4 w-4" />
                            </div>
                            <span className="h-6 w-6 rounded-lg bg-teal-800 text-white font-black text-[11px] flex items-center justify-center shadow-2xs">
                              {item.day}
                            </span>
                          </div>

                          {/* Details */}
                          <div className="min-w-0 flex-1 space-y-1.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="text-xs sm:text-sm font-black text-slate-900">
                                {item.title}
                              </h4>
                              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-teal-50 text-teal-900 border border-teal-200">
                                الهدف: {item.recommendedCount || 100}
                              </span>
                            </div>

                            {/* Arabic Formula Text Box */}
                            <div className="bg-[#FAF7F0] border border-[#E8DFC8] rounded-xl p-2.5 text-right">
                              <p className="font-serif text-xs sm:text-sm font-bold text-[#2A2118] leading-relaxed line-clamp-2">
                                « {item.arabicText} »
                              </p>
                            </div>

                            {/* Merit & Source */}
                            {(item.source || item.merit) && (
                              <div className="text-[11px] text-slate-600 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                                {item.source && (
                                  <span className="truncate">
                                    <strong className="font-black text-teal-900">المصدر:</strong> {item.source}
                                  </span>
                                )}
                                {item.merit && (
                                  <span className="truncate">
                                    <strong className="font-black text-emerald-900">الفضل:</strong> {item.merit}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Fast Actions (Buttons) */}
                        <div className="flex items-center gap-1.5 shrink-0 self-end md:self-start pt-1 md:pt-0 border-t md:border-t-0 border-slate-100 w-full md:w-auto justify-end">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleManualMove(index, "up");
                            }}
                            disabled={isFirst}
                            className={`p-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                              isFirst
                                ? "bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed"
                                : "bg-slate-50 hover:bg-teal-50 text-slate-700 hover:text-teal-900 border-slate-200"
                            }`}
                            title="تقديم للأعلى"
                          >
                            <ArrowUp className="h-3.5 w-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleManualMove(index, "down");
                            }}
                            disabled={isLast}
                            className={`p-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                              isLast
                                ? "bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed"
                                : "bg-slate-50 hover:bg-teal-50 text-slate-700 hover:text-teal-900 border-slate-200"
                            }`}
                            title="تأخير للأسفل"
                          >
                            <ArrowDown className="h-3.5 w-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStartEdit(item);
                            }}
                            className="px-2.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-black transition-all cursor-pointer shadow-xs flex items-center gap-1"
                            title="تعديل نصوص الصيغة"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                            <span>تعديل</span>
                          </button>
                        </div>
                      </Reorder.Item>
                    );
                  })}
                </Reorder.Group>
              ) : (
                /* Search Results View */
                <div className="space-y-2.5">
                  {filteredFormulas.map((item) => (
                    <div
                      key={item.day}
                      className="p-3.5 bg-white rounded-2xl border border-slate-200 transition-all flex flex-col md:flex-row md:items-start justify-between gap-3"
                    >
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <span className="h-6 w-6 rounded-lg bg-teal-800 text-white font-black text-[11px] flex items-center justify-center shadow-2xs shrink-0 mt-0.5">
                          {item.day}
                        </span>
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-xs sm:text-sm font-black text-slate-900">{item.title}</h4>
                            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-teal-50 text-teal-900 border border-teal-200">
                              الهدف: {item.recommendedCount || 100}
                            </span>
                          </div>
                          <div className="bg-[#FAF7F0] border border-[#E8DFC8] rounded-xl p-2.5 text-right">
                            <p className="font-serif text-xs sm:text-sm font-bold text-[#2A2118] leading-relaxed">
                              « {item.arabicText} »
                            </p>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleStartEdit(item)}
                        className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-black transition-all cursor-pointer shadow-xs flex items-center gap-1 self-end md:self-start shrink-0"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                        <span>تعديل</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Edit Single Formula Form */}
          {activeTab === "edit" && (
            <div className="max-w-2xl mx-auto bg-white p-5 sm:p-6 rounded-3xl border border-teal-200 shadow-sm">
              <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="h-8 w-8 rounded-xl bg-teal-800 text-white font-black text-sm flex items-center justify-center">
                    {editingDay}
                  </span>
                  <h4 className="text-sm font-black text-slate-900">
                    تعديل بيانات صيغة اليوم ({editingDay}) من ربيع الأنوار
                  </h4>
                </div>

                <select
                  value={editingDay}
                  onChange={(e) => handleSelectDayToEdit(Number(e.target.value))}
                  className="px-3 py-1.5 rounded-xl border border-teal-300 bg-white text-xs font-bold text-teal-950 focus:outline-none shadow-2xs"
                >
                  {currentFormulasList.map((f) => (
                    <option key={`pick_${f.day}`} value={f.day}>
                      اليوم {f.day}: {f.title}
                    </option>
                  ))}
                </select>
              </div>

              <form onSubmit={handleSaveFormulaEdit} className="space-y-4">
                {/* Title */}
                <div>
                  <label className="text-xs font-black text-slate-800 block mb-1.5">
                    اسم / عنوان الصيغة *
                  </label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder="مثال: الصلاة الإبراهيمية المباركة / صلاة تفريج الكروب..."
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                  />
                </div>

                {/* Arabic Text */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-black text-slate-800">
                      نص الصيغة الشريفة الكامل مع التشكيل والضبط *
                    </label>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {editArabicText.length} حرف
                    </span>
                  </div>
                  <textarea
                    rows={4}
                    value={editArabicText}
                    onChange={(e) => setEditArabicText(e.target.value)}
                    placeholder="اكتب نص الصيغة الشريفة..."
                    required
                    className="w-full p-3.5 rounded-xl border border-slate-200 bg-white font-serif text-sm font-bold text-[#2A2118] focus:outline-none focus:ring-2 focus:ring-teal-500/30 leading-loose"
                  />
                </div>

                {/* Recommended Count */}
                <div>
                  <label className="text-xs font-black text-slate-800 block mb-1.5">
                    العدد المستهدف الافتراضي لليوم (تكرار) *
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={100000}
                    step={10}
                    value={editRecommendedCount}
                    onChange={(e) => setEditRecommendedCount(e.target.value)}
                    required
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                  />
                </div>

                {/* Source */}
                <div>
                  <label className="text-xs font-black text-slate-800 block mb-1.5">
                    المصدر والتخريج (اختياري)
                  </label>
                  <input
                    type="text"
                    value={editSource}
                    onChange={(e) => setEditSource(e.target.value)}
                    placeholder="مثال: صحيح البخاري، سنن الترمذي، دلائل الخيرات..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                  />
                </div>

                {/* Merit */}
                <div>
                  <label className="text-xs font-black text-slate-800 block mb-1.5">
                    الفضل والبركة المرجوة (اختياري)
                  </label>
                  <input
                    type="text"
                    value={editMerit}
                    onChange={(e) => setEditMerit(e.target.value)}
                    placeholder="مثال: تفريج الكرب، زيادة المحبة، نيل الشفاعة..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                  />
                </div>

                {/* Actions */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab("list")}
                    className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer"
                  >
                    إلغاء والعودة للجدول
                  </button>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-black transition-all cursor-pointer shadow-md flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Save className="h-4 w-4" />
                    <span>{isSubmitting ? "جارٍ الحفظ..." : "حفظ التعديل سحابياً"}</span>
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
