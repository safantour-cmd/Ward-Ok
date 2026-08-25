import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  X,
  Plus,
  Gift,
  Search,
  Calendar,
  Sparkles,
  Edit2,
  Trash2,
  CheckCircle2,
  FileSpreadsheet,
  Star,
  BookOpen,
  CalendarDays,
  RotateCcw,
  GripVertical,
  ArrowUp,
  ArrowDown,
  ArrowLeftRight,
  Save,
  Check,
  Smartphone,
  MoveVertical,
  Layers
} from "lucide-react";
import { Reorder, motion, AnimatePresence } from "motion/react";
import {
  type GlobalHadayaItem,
  DEFAULT_RARE_SUNNAHS,
  PROPHETIC_GIFT_PRESETS,
  getDefaultGlobalHadayaList,
  saveGlobalHadayaList,
  createGlobalHadaya,
  updateGlobalHadaya,
  deleteGlobalHadaya,
  resetHadayaToDefault,
  swapHadaya,
  moveHadaya
} from "@/lib/nafahat";
import { isoDate, formatArabicDate } from "@/lib/date-utils";

interface HadayaManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  globalHadaya: GlobalHadayaItem[];
  onRefresh?: () => void;
}

interface HadayaWithUid extends GlobalHadayaItem {
  _uid: string;
}

export function HadayaManagerModal({
  isOpen,
  onClose,
  globalHadaya,
  onRefresh
}: HadayaManagerModalProps) {
  const [activeTab, setActiveTab] = useState<"reorder" | "planner" | "add" | "edit">("reorder");
  const [searchQuery, setSearchQuery] = useState("");

  const rawList = globalHadaya && globalHadaya.length > 0 ? globalHadaya : getDefaultGlobalHadayaList();

  // Local state for smooth drag & drop
  const [localItems, setLocalItems] = useState<HadayaWithUid[]>(() => {
    return rawList.map((item, idx) => ({
      ...item,
      order: item.order || idx + 1,
      day: item.day || idx + 1,
      _uid: `uid_${item.id || idx}_${idx}_${item.title.slice(0, 10).replace(/\s+/g, "_")}`,
    }));
  });

  useEffect(() => {
    if (globalHadaya && globalHadaya.length > 0) {
      setLocalItems(
        globalHadaya.map((item, idx) => ({
          ...item,
          order: item.order || idx + 1,
          day: item.day || idx + 1,
          _uid: `uid_${item.id || idx}_${idx}_${item.title.slice(0, 10).replace(/\s+/g, "_")}`,
        }))
      );
    } else {
      const def = getDefaultGlobalHadayaList();
      setLocalItems(
        def.map((item, idx) => ({
          ...item,
          order: idx + 1,
          day: idx + 1,
          _uid: `uid_${item.id || idx}_${idx}_${item.title.slice(0, 10).replace(/\s+/g, "_")}`,
        }))
      );
    }
  }, [globalHadaya]);

  // Editing State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editOrder, setEditOrder] = useState<number>(1);
  const [title, setTitle] = useState("");
  const [hadithText, setHadithText] = useState("");
  const [benefit, setBenefit] = useState("");
  const [targetType, setTargetType] = useState<"day_of_year" | "rabi_day" | "date" | "all">("day_of_year");
  const [targetVal, setTargetVal] = useState<string>("1");

  // Swap State
  const [swapIndexA, setSwapIndexA] = useState<number>(1);
  const [swapIndexB, setSwapIndexB] = useState<number>(2);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [saveToast, setSaveToast] = useState<string | null>(null);

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  if (!isOpen) return null;

  const currentItemsList: HadayaWithUid[] = localItems;

  // Start editing a gift
  const handleStartEdit = (item: GlobalHadayaItem, index: number) => {
    setEditingId(item.id);
    setEditOrder(item.order || index + 1);
    setTitle(item.title);
    setHadithText(item.hadith_text);
    setBenefit(item.benefit);
    setTargetType(item.target_type || "day_of_year");
    setTargetVal(item.target_value || String(index + 1));
    setActiveTab("edit");
    setFeedbackMsg(null);
  };

  // Drag & drop reorder commit
  const handleReorder = (newItems: HadayaWithUid[]) => {
    const updated = newItems.map((item, idx) => ({
      ...item,
      order: idx + 1,
      day: idx + 1,
    }));
    setLocalItems(updated);

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        setIsSavingOrder(true);
        await saveGlobalHadayaList(updated);
        setSaveToast("تم حفظ الترتيب الجديد للهدايا النبوية بالسحابة وتوزيعه على الأيام ✓");
        onRefresh?.();
        setTimeout(() => setSaveToast(null), 2500);
      } catch (err) {
        console.error("Failed to save reordered hadaya list:", err);
      } finally {
        setIsSavingOrder(false);
      }
    }, 600);
  };

  // Move up
  const handleMoveUp = async (index: number) => {
    if (index <= 0) return;
    const next = [...localItems];
    const temp = next[index];
    next[index] = next[index - 1];
    next[index - 1] = temp;
    handleReorder(next);
  };

  // Move down
  const handleMoveDown = async (index: number) => {
    if (index >= localItems.length - 1) return;
    const next = [...localItems];
    const temp = next[index];
    next[index] = next[index + 1];
    next[index + 1] = temp;
    handleReorder(next);
  };

  // Quick swap
  const handleQuickSwap = async () => {
    const idxA = swapIndexA - 1;
    const idxB = swapIndexB - 1;
    if (idxA < 0 || idxA >= localItems.length || idxB < 0 || idxB >= localItems.length || idxA === idxB) {
      setFeedbackMsg({ type: "error", text: "يرجى تحديد رقمين صحيحين ومختلفين لتبديل الموضعين" });
      return;
    }
    const next = [...localItems];
    const temp = next[idxA];
    next[idxA] = next[idxB];
    next[idxB] = temp;
    handleReorder(next);
    setSaveToast(`تم تبديل الهدية #${swapIndexA} مع الهدية #${swapIndexB} بنجاح ✓`);
    setTimeout(() => setSaveToast(null), 2500);
  };

  // Save Add/Edit form
  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setFeedbackMsg({ type: "error", text: "يرجى كتابة عنوان الهدية النبوية" });
      return;
    }

    setIsSubmitting(true);
    setFeedbackMsg(null);

    try {
      if (editingId) {
        await updateGlobalHadaya(editingId, {
          title: title.trim(),
          hadith_text: hadithText.trim(),
          benefit: benefit.trim(),
          target_type: targetType,
          target_value: targetVal.trim(),
        });
        setFeedbackMsg({ type: "success", text: "✨ تم حفظ تعديلات الهدية النبوية بنجاح ونشرها للمستخدمين!" });
      } else {
        await createGlobalHadaya({
          title: title.trim(),
          hadith_text: hadithText.trim(),
          benefit: benefit.trim(),
          target_type: targetType,
          target_value: targetVal.trim(),
        });
        setFeedbackMsg({ type: "success", text: "🎁 تم نشر الهدية النبوية بنجاح في نهاية القائمة وتوزيعها!" });
      }

      onRefresh?.();
      setTimeout(() => {
        setEditingId(null);
        setTitle("");
        setHadithText("");
        setBenefit("");
        setActiveTab("reorder");
      }, 1200);
    } catch (err: any) {
      setFeedbackMsg({ type: "error", text: err.message || "حدث خطأ أثناء حفظ الهدية النبوية" });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete
  const handleDelete = async (id: string, itemTitle: string) => {
    if (!window.confirm(`هل أنت متأكد من حذف الهدية النبوية: "${itemTitle}"؟`)) {
      return;
    }
    try {
      await deleteGlobalHadaya(id);
      setSaveToast("تم حذف الهدية وإعادة ترقيم القائمة تلقائياً ✓");
      onRefresh?.();
      setTimeout(() => setSaveToast(null), 2500);
    } catch (err) {
      alert("حدث خطأ أثناء حذف الهدية النبوية");
    }
  };

  // Reset to default
  const handleResetToDefault = async () => {
    if (
      !window.confirm(
        "هل أنت متأكد من إعادة ضبط قائمة الهدايا النبوية للترتيب الافتراضي المعتمد (22 هدية وسنة نبوية)؟ سيتم استبدال القائمة الحالية."
      )
    ) {
      return;
    }
    try {
      setIsSavingOrder(true);
      await resetHadayaToDefault();
      setSaveToast("تمت استعادة قائمة الهدايا النبوية الافتراضية بنجاح ✓");
      onRefresh?.();
      setTimeout(() => setSaveToast(null), 2500);
    } catch (err) {
      alert("حدث خطأ أثناء استعادة القائمة الافتراضية");
    } finally {
      setIsSavingOrder(false);
    }
  };

  // Excel Export
  const exportScheduleToExcel = () => {
    const rowsHtml = currentItemsList.map((item, idx) => {
      const dayNum = item.order || idx + 1;
      return `
        <tr>
          <td style="text-align: center; font-weight: bold;">اليوم ${dayNum}</td>
          <td style="font-weight: bold; text-align: right;">${item.title}</td>
          <td style="text-align: right; font-size: 12px;">« ${item.hadith_text || (item as any).hadithText || ""} »</td>
          <td style="text-align: right; font-size: 12px;">${item.benefit || (item as any).scholarBenefit || ""}</td>
          <td style="text-align: center; font-weight: bold;">${item.target_type === "date" ? `تاريخ: ${item.target_value}` : `ترتيب يومي #${dayNum}`}</td>
        </tr>
      `;
    }).join("");

    const excelHtml = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
        <style>
          body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; }
          table { border-collapse: collapse; width: 100%; direction: rtl; }
          th { background-color: #065f46; color: #ffffff; font-weight: bold; padding: 10px; border: 1px solid #047857; text-align: center; }
          td { padding: 8px; border: 1px solid #cbd5e1; font-size: 13px; }
        </style>
      </head>
      <body dir="rtl">
        <h2 style="text-align: center; color: #065f46; font-family: sans-serif;">جدول الهدايا والسنن النبوية المباركة (توزيع الأيام) 🎁</h2>
        <p style="text-align: center; color: #475569; font-size: 12px;">تم التصدير بتاريخ: ${isoDate()} (${formatArabicDate(isoDate())})</p>
        <table>
          <thead>
            <tr>
              <th>ترتيب اليوم</th>
              <th>عنوان الهدية والسنّة</th>
              <th>نص الحديث الشريف</th>
              <th>الفضل والبركة</th>
              <th>طبيعة الظهور</th>
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
    link.setAttribute("download", `جدول_الهدايا_النبوية_${isoDate()}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredList = currentItemsList.filter((item, idx) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const dayStr = String(item.order || idx + 1);
    return (
      item.title.toLowerCase().includes(q) ||
      (item.hadith_text || (item as any).hadithText || "").toLowerCase().includes(q) ||
      (item.benefit || (item as any).scholarBenefit || "").toLowerCase().includes(q) ||
      dayStr.includes(q)
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs text-right dir-rtl animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-4xl max-h-[92vh] rounded-3xl shadow-2xl border border-emerald-200 flex flex-col overflow-hidden">
        
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-emerald-900 via-teal-900 to-emerald-950 text-white flex items-center justify-between gap-3 shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-emerald-500/30 border border-emerald-400/40 flex items-center justify-center text-xl shadow-inner">
              🎁
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black tracking-tight flex items-center gap-2">
                <span>إدارة وترتيب الهدايا النبوية والسنن المهجورة</span>
                <span className="text-[10px] bg-emerald-700/80 px-2 py-0.5 rounded-full border border-emerald-500/50">
                  سحابي ومباشر
                </span>
              </h3>
              <p className="text-xs text-emerald-200/90 font-medium mt-0.5">
                تحديد وترتيب الهدايا التي تظهر يومياً عند جميع المستخدمين بالتسلسل
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-2xl bg-white/10 hover:bg-white/20 text-emerald-100 hover:text-white transition-all cursor-pointer border border-white/10"
            title="إغلاق النافذة"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Top Control Bar with Tabs, Search, & Actions */}
        <div className="p-3 sm:p-4 bg-emerald-50/80 border-b border-emerald-100 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          {/* Tabs */}
          <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-emerald-200 shadow-2xs w-full sm:w-auto overflow-x-auto">
            <button
              type="button"
              onClick={() => {
                setActiveTab("reorder");
                setFeedbackMsg(null);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                activeTab === "reorder"
                  ? "bg-emerald-700 text-white shadow-xs"
                  : "text-slate-600 hover:bg-emerald-50 hover:text-emerald-950"
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              <span>📋 ترتيب الهدايا ({currentItemsList.length})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab("add");
                setEditingId(null);
                setTitle("");
                setHadithText("");
                setBenefit("");
                setFeedbackMsg(null);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                activeTab === "add"
                  ? "bg-emerald-700 text-white shadow-xs"
                  : "text-slate-600 hover:bg-emerald-50 hover:text-emerald-950"
              }`}
            >
              <Plus className="h-3.5 w-3.5" />
              <span>+ إضافة هدية جديدة</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab("planner");
                setFeedbackMsg(null);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                activeTab === "planner"
                  ? "bg-emerald-700 text-white shadow-xs"
                  : "text-slate-600 hover:bg-emerald-50 hover:text-emerald-950"
              }`}
            >
              <CalendarDays className="h-3.5 w-3.5" />
              <span>🗓️ خريطة الأيام</span>
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
            <button
              type="button"
              onClick={exportScheduleToExcel}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black transition-all cursor-pointer shadow-2xs flex items-center gap-1.5 border border-emerald-700 shrink-0"
              title="تصدير جدول الهدايا النبوية لملف إكسل"
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span>تصدير Excel</span>
            </button>

            <button
              type="button"
              onClick={handleResetToDefault}
              className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 hover:text-slate-900 text-xs font-bold transition-all cursor-pointer shadow-2xs flex items-center gap-1.5 border border-slate-200 shrink-0"
              title="إعادة ضبط الهدايا إلى القائمة الافتراضية"
            >
              <RotateCcw className="h-3.5 w-3.5 text-slate-500" />
              <span>الافتراضي</span>
            </button>
          </div>
        </div>

        {/* Live Save Notification Toast */}
        <AnimatePresence>
          {saveToast && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-emerald-600 text-white text-xs font-black py-2 px-4 text-center flex items-center justify-center gap-2 shrink-0 shadow-sm"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>{saveToast}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/50">
          
          {/* TAB 1: REORDER & DRAG AND DROP */}
          {activeTab === "reorder" && (
            <div className="space-y-4">
              {/* Instructions Bar */}
              <div className="p-3.5 bg-gradient-to-r from-amber-50 to-emerald-50 rounded-2xl border border-amber-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-amber-600 shrink-0" />
                  <div>
                    <h4 className="text-xs font-black text-slate-900">
                      ترتيب الهدايا النبوية بالسحب والإفلات أو الأسهم
                    </h4>
                    <p className="text-[11px] text-slate-600 font-medium">
                      اسحب أي هدية من مقبض السحب (⋮⋮) أو استخدم أزرار (↑ / ↓) لتغيير الترتيب اليومي. الحفظ سحابي فوري ويصل لكل المستخدمين.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {isSavingOrder && (
                    <span className="text-[10px] font-black text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md animate-pulse">
                      جاري الحفظ بالسحابة...
                    </span>
                  )}
                  <span className="text-xs font-black text-emerald-800 bg-white px-2.5 py-1 rounded-xl border border-emerald-200 shadow-2xs">
                    إجمالي الهدايا: {currentItemsList.length}
                  </span>
                </div>
              </div>

              {/* Quick Swap Bar & Search */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                {/* Search */}
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="ابحث بالعنوان، نص الحديث، أو رقم اليوم..."
                    className="w-full pl-3 pr-8 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium focus:outline-none focus:border-emerald-500 shadow-2xs"
                  />
                </div>

                {/* Quick Swap Position Box */}
                <div className="flex items-center gap-1.5 bg-white p-1.5 rounded-xl border border-slate-200 shadow-2xs">
                  <span className="text-[11px] font-black text-slate-700 whitespace-nowrap mr-1">تبديل موضع:</span>
                  <input
                    type="number"
                    min="1"
                    max={currentItemsList.length}
                    value={swapIndexA}
                    onChange={(e) => setSwapIndexA(parseInt(e.target.value, 10) || 1)}
                    className="w-12 text-center p-1 border border-slate-200 rounded-lg text-xs font-black text-emerald-950 bg-slate-50"
                  />
                  <ArrowLeftRight className="h-3 w-3 text-slate-400" />
                  <input
                    type="number"
                    min="1"
                    max={currentItemsList.length}
                    value={swapIndexB}
                    onChange={(e) => setSwapIndexB(parseInt(e.target.value, 10) || 1)}
                    className="w-12 text-center p-1 border border-slate-200 rounded-lg text-xs font-black text-emerald-950 bg-slate-50"
                  />
                  <button
                    type="button"
                    onClick={handleQuickSwap}
                    className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black cursor-pointer transition-all shadow-2xs"
                  >
                    تبديل
                  </button>
                </div>
              </div>

              {/* Reorderable List */}
              <Reorder.Group
                axis="y"
                values={localItems}
                onReorder={handleReorder}
                className="space-y-2.5 select-none"
              >
                {filteredList.map((item, idx) => {
                  const originalIdx = localItems.findIndex((x) => x._uid === item._uid);
                  const displayDayNum = (originalIdx !== -1 ? originalIdx : idx) + 1;
                  const hadith = item.hadith_text || (item as any).hadithText || "";
                  const merit = item.benefit || (item as any).scholarBenefit || "";

                  return (
                    <Reorder.Item
                      key={item._uid}
                      value={item}
                      className="touch-manipulation"
                    >
                      <div className="p-3.5 sm:p-4 bg-white rounded-2xl border border-emerald-200/80 shadow-2xs hover:shadow-xs transition-all flex items-start justify-between gap-3 group">
                        
                        {/* Drag Handle & Day Number */}
                        <div className="flex items-center gap-2 shrink-0 self-center">
                          <div
                            className="cursor-grab active:cursor-grabbing p-1.5 rounded-xl bg-slate-100 hover:bg-emerald-100 text-slate-400 hover:text-emerald-800 transition-colors"
                            title="اسحب لتغيير الترتيب"
                          >
                            <GripVertical className="h-5 w-5" />
                          </div>

                          <div className="h-8 w-8 rounded-xl bg-emerald-700 text-white font-black text-xs flex items-center justify-center shadow-2xs">
                            {displayDayNum}
                          </div>
                        </div>

                        {/* Gift Info */}
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-black text-xs sm:text-sm text-slate-900">
                              {item.title}
                            </span>
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-950 border border-emerald-200">
                              هدية اليوم {displayDayNum} 🎁
                            </span>
                          </div>

                          {hadith && (
                            <p className="text-[11px] sm:text-xs font-serif text-slate-700 bg-slate-50 p-2 rounded-xl border border-slate-100 line-clamp-2 leading-relaxed">
                              « {hadith} »
                            </p>
                          )}

                          {merit && (
                            <div className="text-[10px] sm:text-[11px] text-slate-600 flex items-start gap-1">
                              <span className="font-black text-emerald-800 shrink-0">الفضل:</span>
                              <span className="line-clamp-1">{merit}</span>
                            </div>
                          )}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-1 shrink-0 self-center">
                          {/* Move Up */}
                          <button
                            type="button"
                            disabled={originalIdx <= 0}
                            onClick={() => handleMoveUp(originalIdx)}
                            className={`p-1.5 rounded-lg border text-slate-600 transition-all ${
                              originalIdx <= 0
                                ? "opacity-30 cursor-not-allowed bg-slate-50 border-slate-200"
                                : "bg-white hover:bg-emerald-50 hover:text-emerald-950 border-slate-200 cursor-pointer"
                            }`}
                            title="تحريك لأعلى"
                          >
                            <ArrowUp className="h-3.5 w-3.5" />
                          </button>

                          {/* Move Down */}
                          <button
                            type="button"
                            disabled={originalIdx >= localItems.length - 1}
                            onClick={() => handleMoveDown(originalIdx)}
                            className={`p-1.5 rounded-lg border text-slate-600 transition-all ${
                              originalIdx >= localItems.length - 1
                                ? "opacity-30 cursor-not-allowed bg-slate-50 border-slate-200"
                                : "bg-white hover:bg-emerald-50 hover:text-emerald-950 border-slate-200 cursor-pointer"
                            }`}
                            title="تحريك لأسفل"
                          >
                            <ArrowDown className="h-3.5 w-3.5" />
                          </button>

                          {/* Edit */}
                          <button
                            type="button"
                            onClick={() => handleStartEdit(item, originalIdx)}
                            className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 cursor-pointer transition-all"
                            title="تعديل اسم أو نص أو فضل الهدية"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>

                          {/* Delete */}
                          <button
                            type="button"
                            onClick={() => handleDelete(item.id, item.title)}
                            className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 cursor-pointer transition-all"
                            title="حذف الهدية من القائمة"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </Reorder.Item>
                  );
                })}
              </Reorder.Group>
            </div>
          )}

          {/* TAB 2: ADD OR EDIT FORM */}
          {(activeTab === "add" || activeTab === "edit") && (
            <div className="max-w-2xl mx-auto bg-white p-5 sm:p-6 rounded-3xl border border-emerald-200 shadow-sm">
              <h4 className="text-sm font-black text-slate-900 mb-3 flex items-center gap-2 border-b border-slate-100 pb-2">
                <span>{editingId ? `✏️ تعديل الهدية النبوية (اليوم #${editOrder})` : "🎁 إضافة هدية نبوية جديدة للقائمة"}</span>
              </h4>

              {feedbackMsg && (
                <div
                  className={`p-3 rounded-xl mb-4 text-xs font-bold flex items-center gap-2 border ${
                    feedbackMsg.type === "success"
                      ? "bg-emerald-50 text-emerald-900 border-emerald-300"
                      : "bg-rose-50 text-rose-900 border-rose-300"
                  }`}
                >
                  {feedbackMsg.type === "success" ? <CheckCircle2 className="h-4 w-4" /> : <X className="h-4 w-4" />}
                  <span>{feedbackMsg.text}</span>
                </div>
              )}

              <form onSubmit={handleSaveForm} className="space-y-4">
                {/* Preset Autocomplete Dropdown */}
                <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200">
                  <label className="text-xs font-black text-emerald-950 block mb-1.5 flex items-center justify-between">
                    <span>✨ مقترحات جاهزة للتعبئة التلقائية السريعة</span>
                  </label>
                  <select
                    onChange={(e) => {
                      const pId = e.target.value;
                      if (pId) {
                        const preset = PROPHETIC_GIFT_PRESETS.find((p) => p.id === pId);
                        if (preset) {
                          setTitle(preset.title);
                          setHadithText(preset.hadithText);
                          setBenefit(preset.benefit);
                        }
                      }
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-emerald-300 bg-white text-xs font-black text-emerald-950 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 cursor-pointer shadow-2xs"
                  >
                    <option value="">-- اختر هدية نبوية جاهزة للتعبئة الفورية (مثل: صلاة التسابيح، صلاة الضحى...) --</option>
                    {PROPHETIC_GIFT_PRESETS.map((preset) => (
                      <option key={preset.id} value={preset.id}>
                        {preset.title}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Title */}
                <div>
                  <label className="text-xs font-black text-slate-800 block mb-1.5">
                    عنوان الهدية والسنّة النبوية *
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="مثال: صلاة التسابيح / الشرب قاعداً بثلاث دفعات / عيادة المريض..."
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  />
                </div>

                {/* Hadith Text */}
                <div>
                  <label className="text-xs font-black text-slate-800 block mb-1.5">
                    نص الحديث النبوي الشريف 📜
                  </label>
                  <textarea
                    rows={3}
                    value={hadithText}
                    onChange={(e) => setHadithText(e.target.value)}
                    placeholder="اكتب الحديث الشريف مع ذكر المخرّج (مثال: قال رسول الله ﷺ: «...» رواه مسلم)"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-serif leading-relaxed focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  />
                </div>

                {/* Benefit / Virtue */}
                <div>
                  <label className="text-xs font-black text-slate-800 block mb-1.5">
                    الفضل والبركة وثمرة العمل 🌸
                  </label>
                  <input
                    type="text"
                    value={benefit}
                    onChange={(e) => setBenefit(e.target.value)}
                    placeholder="مثال: فيها مغفرة الذنوب العشرة، ونيل صلاة الملائكة..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  />
                </div>

                {/* Buttons */}
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(null);
                      setTitle("");
                      setHadithText("");
                      setBenefit("");
                      setActiveTab("reorder");
                    }}
                    className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black cursor-pointer shadow-xs transition-all flex items-center gap-2"
                  >
                    <Gift className="h-4 w-4" />
                    <span>{isSubmitting ? "جاري الحفظ..." : editingId ? "حفظ التعديلات ونشرها بالسحابة" : "إضافة ونشر الهدية"}</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 3: PLANNER & CALENDAR OVERVIEW */}
          {activeTab === "planner" && (
            <div className="space-y-4">
              <div className="p-3.5 bg-gradient-to-r from-amber-50 to-emerald-50 rounded-2xl border border-amber-200/80 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-amber-600 shrink-0" />
                  <div>
                    <h4 className="text-xs font-black text-slate-900">
                      خريطة توزيع الهدايا على أيام السنة
                    </h4>
                    <p className="text-[11px] text-slate-600 font-medium">
                      تتوزع الهدايا بالتسلسل تلقائياً لكل يوم من أيام السنة، ويمكنك تعديل أي يوم بالنقر على زر التعديل.
                    </p>
                  </div>
                </div>
              </div>

              {/* Grid of days */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {currentItemsList.map((item, idx) => {
                  const dayNum = item.order || idx + 1;
                  const hadith = item.hadith_text || (item as any).hadithText || "";
                  const merit = item.benefit || (item as any).scholarBenefit || "";

                  return (
                    <div
                      key={item.id || idx}
                      className="p-3.5 rounded-2xl border border-slate-200 bg-white hover:border-emerald-300 shadow-2xs transition-all"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="h-7 w-7 rounded-xl bg-emerald-100 text-emerald-950 border border-emerald-200 flex items-center justify-center font-black text-xs shrink-0">
                            {dayNum}
                          </span>
                          <span className="font-black text-xs text-slate-900 truncate">
                            {item.title}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleStartEdit(item, idx)}
                          className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 text-[11px] font-bold cursor-pointer transition-all shrink-0"
                          title="تعديل هدية هذا اليوم"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {hadith && (
                        <p className="text-[11px] font-serif text-slate-700 bg-slate-50 p-2 rounded-xl border border-slate-100 mb-1.5 line-clamp-2 leading-relaxed">
                          « {hadith} »
                        </p>
                      )}

                      {merit && (
                        <div className="text-[10px] text-slate-600 flex items-start gap-1">
                          <span className="font-black text-emerald-800 shrink-0">الفضل:</span>
                          <span className="line-clamp-1">{merit}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-500 font-bold">
            التغييرات تحفظ في قاعدة بيانات Firebase مباشرة وتصل لجميع المشتركين
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-black text-xs transition-all cursor-pointer shadow-xs"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}
