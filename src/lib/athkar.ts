import { db, type ThikrGroup, type ThikrItem, type ThikrProgress } from "./db";
import { isoDate, startOfWeek, endOfWeek, weekDays } from "./date-utils";
import { autoCloudSync, isQuotaExceeded, setQuotaExceededCooldown } from "./cloud-sync";
import { collection, getDocs, setDoc, doc } from "firebase/firestore";
import { dbFirestore } from "./firebase";

/** ---------- Global Athkar (Admin) ---------- */

export async function createGlobalThikr(input: {
  name: string;
  target_count: number;
  duration_scope?: "week" | "month" | "lifetime";
}): Promise<void> {
  const cleanName = input.name.trim();
  if (!cleanName) throw new Error("اسم الذكر فارغ");

  const thikrId = "gthikr_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);
  const payload = {
    name: cleanName,
    target_count: Math.max(1, input.target_count),
    duration_scope: input.duration_scope || "week",
    created_at: new Date().toISOString(),
  };

  await setDoc(doc(dbFirestore, "global_athkar", thikrId), payload, { merge: true }).catch(() => {});

  const existing = await db.thikr_items.where("name").equals(cleanName).first();
  if (!existing) {
    await db.thikr_items.add({
      global_id: thikrId,
      name: cleanName,
      target_count: Math.max(1, input.target_count),
      duration_scope: input.duration_scope || "week",
      group_id: null,
      created_at: new Date().toISOString(),
    });
  } else {
    await db.thikr_items.update(existing.id!, {
      global_id: thikrId,
      duration_scope: input.duration_scope || "week",
    });
  }
}

export async function updateGlobalThikr(
  docId: string,
  oldName: string,
  input: {
    name: string;
    target_count: number;
    duration_scope?: "week" | "month" | "lifetime";
  }
): Promise<void> {
  const cleanName = input.name.trim();
  if (!cleanName) throw new Error("اسم الذكر فارغ");

  const payload = {
    name: cleanName,
    target_count: Math.max(1, input.target_count),
    duration_scope: input.duration_scope || "week",
    updated_at: new Date().toISOString(),
  };

  await setDoc(doc(dbFirestore, "global_athkar", docId), payload, { merge: true }).catch(() => {});

  const localItems = await db.thikr_items.toArray();
  const match = localItems.find(
    (i) => (i.global_id && i.global_id === docId) ||
           i.name.trim().toLowerCase() === oldName.trim().toLowerCase() ||
           i.name.trim().toLowerCase() === cleanName.trim().toLowerCase()
  );

  if (match && match.id) {
    await db.thikr_items.update(match.id, {
      global_id: docId,
      name: cleanName,
      target_count: Math.max(1, input.target_count),
      duration_scope: input.duration_scope || "week",
    });
  }
}

export async function deleteGlobalThikr(docId: string, name?: string): Promise<void> {
  const { deleteDoc, doc } = await import("firebase/firestore");
  await deleteDoc(doc(dbFirestore, "global_athkar", docId)).catch(() => {});
  if (name) {
    const match = await db.thikr_items.where("name").equals(name.trim()).first();
    if (match && match.id) {
      await deleteItem(match.id);
    }
  }
}

/** Deleted tracking helpers to ensure deleted items & groups are never resurrected */
export function getDeletedThikrItems(): Set<string> {
  try {
    const raw = localStorage.getItem("athkar_deleted_items");
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

export function recordDeletedThikrItem(identifier: string | number) {
  try {
    const set = getDeletedThikrItems();
    set.add(String(identifier).trim().toLowerCase());
    localStorage.setItem("athkar_deleted_items", JSON.stringify(Array.from(set)));
  } catch {}
}

export function getDeletedThikrGroups(): Set<string> {
  try {
    const raw = localStorage.getItem("athkar_deleted_groups");
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

export function recordDeletedThikrGroup(identifier: string | number) {
  try {
    const set = getDeletedThikrGroups();
    set.add(String(identifier).trim().toLowerCase());
    localStorage.setItem("athkar_deleted_groups", JSON.stringify(Array.from(set)));
  } catch {}
}

export async function syncGlobalAthkarFromCloud(): Promise<void> {
  if (isQuotaExceeded()) return;
  try {
    const querySnapshot = await getDocs(collection(dbFirestore, "global_athkar")).catch((err: any) => {
      const errStr = String(err?.message || err || "");
      if (errStr.includes("resource-exhausted") || errStr.includes("quota")) {
        setQuotaExceededCooldown(24);
      }
      return null;
    });
    if (!querySnapshot) return;

    const localItems = await db.thikr_items.toArray();
    const deletedItems = getDeletedThikrItems();

    for (const docSnap of querySnapshot.docs) {
      const data = docSnap.data();
      if (!data || !data.name) continue;

      const cleanName = data.name.trim();
      const docIdStr = String(docSnap.id).toLowerCase();
      const cleanNameLower = cleanName.toLowerCase();

      // If user deleted this item locally, do not resurrect it
      if (deletedItems.has(docIdStr) || deletedItems.has(cleanNameLower)) {
        continue;
      }

      const existing = localItems.find(
        (i) => (i.global_id && i.global_id === docSnap.id) || i.name.trim().toLowerCase() === cleanNameLower
      );

      if (existing) {
        if (
          existing.name !== cleanName ||
          existing.target_count !== (data.target_count || 1) ||
          existing.duration_scope !== data.duration_scope
        ) {
          await db.thikr_items.update(existing.id!, {
            global_id: docSnap.id,
            name: cleanName,
            target_count: data.target_count || 1,
            duration_scope: data.duration_scope || "week",
          });
        }
      } else {
        await db.thikr_items.add({
          global_id: docSnap.id,
          name: cleanName,
          target_count: data.target_count || 1,
          duration_scope: data.duration_scope || "week",
          group_id: null,
          created_at: new Date().toISOString(),
        });
      }
    }
  } catch (err) {
    console.error("Failed to sync global athkar:", err);
  }
}

/** ---------- Groups ---------- */

export async function listGroups(): Promise<ThikrGroup[]> {
  return db.thikr_groups.orderBy("id").toArray();
}

export async function createGroup(name: string): Promise<number> {
  const clean = name.trim();
  if (!clean) throw new Error("اسم المجموعة فارغ");
  const groupId = "group_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);
  const id = (await db.thikr_groups.add({
    global_id: groupId,
    name: clean,
    created_at: new Date().toISOString(),
  })) as number;
  autoCloudSync();
  return id;
}

export async function renameGroup(id: number, name: string) {
  await db.thikr_groups.update(id, { name: name.trim() });
  autoCloudSync();
}

export async function deleteGroup(id: number) {
  const grp = await db.thikr_groups.get(id);
  if (grp) {
    if (grp.global_id) recordDeletedThikrGroup(grp.global_id);
    if (grp.name) recordDeletedThikrGroup(grp.name);
    recordDeletedThikrGroup(grp.id!);
  }
  await db.transaction("rw", db.thikr_groups, db.thikr_items, async () => {
    // detach items — do not delete them
    const items = await db.thikr_items.where("group_id").equals(id).toArray();
    for (const it of items) {
      if (it.id != null) await db.thikr_items.update(it.id, { group_id: null });
    }
    await db.thikr_groups.delete(id);
  });
  autoCloudSync();
}

/** ---------- Items ---------- */

export async function listItems(): Promise<ThikrItem[]> {
  return db.thikr_items.orderBy("id").toArray();
}

export async function createItem(input: {
  name: string;
  target_count: number;
  group_id: number | null;
}): Promise<number> {
  const clean = input.name.trim();
  if (!clean) throw new Error("اسم الذكر فارغ");
  const target = Math.max(1, Math.floor(input.target_count || 1));
  const globalId = "thikr_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);
  const id = (await db.thikr_items.add({
    global_id: globalId,
    name: clean,
    target_count: target,
    group_id: input.group_id,
    created_at: new Date().toISOString(),
  })) as number;
  autoCloudSync();
  return id;
}

export async function updateItem(
  id: number,
  patch: Partial<Pick<ThikrItem, "name" | "target_count" | "group_id">>,
) {
  await db.thikr_items.update(id, patch);
  autoCloudSync();
}

export async function deleteItem(id: number) {
  const item = await db.thikr_items.get(id);
  if (item) {
    if (item.global_id) recordDeletedThikrItem(item.global_id);
    if (item.name) recordDeletedThikrItem(item.name);
    recordDeletedThikrItem(item.id!);
  }
  await db.transaction("rw", db.thikr_items, db.thikr_progress, async () => {
    await db.thikr_progress.where("thikr_item_id").equals(id).delete();
    await db.thikr_items.delete(id);
  });
  autoCloudSync();
}

/** ---------- Daily progress & per-day adjustments ---------- */

export async function updateDailyTarget(itemId: number, dailyTarget: number, date?: string): Promise<ThikrProgress> {
  const targetDate = date || isoDate();
  const row = await getTodayProgress(itemId, targetDate);
  const target = Math.max(1, Math.floor(dailyTarget));
  const completed = row.current_count >= target;
  await db.thikr_progress.update(row.id!, {
    daily_target: target,
    completed,
    excluded: false,
  });
  autoCloudSync();
  return { ...row, daily_target: target, completed, excluded: false };
}

export async function excludeItemForDate(itemId: number, date?: string): Promise<ThikrProgress> {
  const targetDate = date || isoDate();
  const row = await getTodayProgress(itemId, targetDate);
  await db.thikr_progress.update(row.id!, {
    excluded: true,
    completed: true,
  });
  autoCloudSync();
  return { ...row, excluded: true, completed: true };
}

export async function restoreItemForDate(itemId: number, date?: string): Promise<ThikrProgress> {
  const targetDate = date || isoDate();
  const row = await getTodayProgress(itemId, targetDate);
  await db.thikr_progress.update(row.id!, {
    excluded: false,
    completed: false,
  });
  autoCloudSync();
  return { ...row, excluded: false, completed: false };
}

export async function getTodayProgress(itemId: number, date?: string): Promise<ThikrProgress> {
  const targetDate = date || isoDate();
  const row = await db.thikr_progress
    .where("[thikr_item_id+date]")
    .equals([itemId, targetDate])
    .first();
  if (row) return row;
  const id = await db.thikr_progress.add({
    thikr_item_id: itemId,
    date: targetDate,
    current_count: 0,
    completed: false,
  });
  return (await db.thikr_progress.get(id as number))!;
}

/** Increment today's counter by 1 (never above target). Returns updated row. */
export async function incrementToday(itemId: number, target: number, date?: string): Promise<ThikrProgress> {
  const targetDate = date || isoDate();
  const row = await getTodayProgress(itemId, targetDate);
  if (row.completed) return row;
  const effectiveTarget = row.daily_target ?? target;
  const next = Math.min(effectiveTarget, row.current_count + 1);
  const completed = next >= effectiveTarget;
  await db.thikr_progress.update(row.id!, { current_count: next, completed });
  autoCloudSync();
  return { ...row, current_count: next, completed };
}

export async function resetToday(itemId: number, date?: string): Promise<ThikrProgress> {
  const targetDate = date || isoDate();
  const row = await getTodayProgress(itemId, targetDate);
  await db.thikr_progress.update(row.id!, { current_count: 0, completed: false });
  autoCloudSync();
  return { ...row, current_count: 0, completed: false };
}

/** Mark today's counter as fully complete (set current_count = target_count). */
export async function completeToday(itemId: number, target: number, date?: string): Promise<ThikrProgress> {
  const targetDate = date || isoDate();
  const row = await getTodayProgress(itemId, targetDate);
  const effectiveTarget = row.daily_target ?? target;
  await db.thikr_progress.update(row.id!, { current_count: effectiveTarget, completed: true });
  autoCloudSync();
  return { ...row, current_count: effectiveTarget, completed: true };
}

export async function decrementToday(itemId: number, date?: string): Promise<ThikrProgress> {
  const targetDate = date || isoDate();
  const row = await getTodayProgress(itemId, targetDate);
  const next = Math.max(0, row.current_count - 1);
  const completed = next >= row.current_count; // usually false since it's decreasing
  await db.thikr_progress.update(row.id!, { current_count: next, completed: false });
  autoCloudSync();
  return { ...row, current_count: next, completed: false };
}


/** Progress rows keyed by itemId for today. */
export async function getAllTodayProgress(): Promise<Map<number, ThikrProgress>> {
  const today = isoDate();
  const rows = await db.thikr_progress.where("date").equals(today).toArray();
  const map = new Map<number, ThikrProgress>();
  for (const r of rows) map.set(r.thikr_item_id, r);
  return map;
}

/** The last thikr the user interacted with (for the home mini-card). */
export async function getLastTouchedItem(): Promise<ThikrItem | null> {
  const rows = await db.thikr_progress.orderBy("id").reverse().limit(20).toArray();
  for (const r of rows) {
    const item = await db.thikr_items.get(r.thikr_item_id);
    if (item) return item;
  }
  // fallback: most recently created item
  const items = await db.thikr_items.orderBy("id").reverse().limit(1).toArray();
  return items[0] ?? null;
}

/** ---------- Weekly evaluation ---------- */

export interface WeeklyStats {
  week_start: string;
  week_end: string;
  days_total: number; // days elapsed in the current week up to today
  commitment_percent: number; // 0..100 — average per-day completion ratio
}

export async function computeWeeklyStats(): Promise<WeeklyStats> {
  const days = weekDays();
  const today = isoDate();
  const elapsed = days.filter((d) => d <= today);
  const rawItems = await db.thikr_items.toArray();
  const deleted = getDeletedThikrItems();
  const items = rawItems.filter((it) => {
    const k1 = String(it.id);
    const k2 = it.global_id ? String(it.global_id).toLowerCase() : "";
    const k3 = it.name ? it.name.trim().toLowerCase() : "";
    return !deleted.has(k1) && !deleted.has(k2) && !deleted.has(k3);
  });

  if (items.length === 0 || elapsed.length === 0) {
    return {
      week_start: isoDate(startOfWeek()),
      week_end: isoDate(endOfWeek()),
      days_total: elapsed.length,
      commitment_percent: 0,
    };
  }
  const rows = await db.thikr_progress.where("date").anyOf(elapsed).toArray();
  let sum = 0;
  for (const d of elapsed) {
    const dayRows = rows.filter((r) => r.date === d);
    const dayActiveItems = items.filter((it) => {
      const r = dayRows.find((p) => p.thikr_item_id === it.id);
      return !r?.excluded;
    });
    if (dayActiveItems.length === 0) {
      sum += 1;
      continue;
    }
    const completedCount = dayActiveItems.filter((it) => {
      const r = dayRows.find((p) => p.thikr_item_id === it.id);
      if (!r) return false;
      if (r.completed) return true;
      const target = r.daily_target ?? it.target_count;
      return (r.current_count || 0) >= target;
    }).length;
    sum += Math.min(1, completedCount / dayActiveItems.length);
  }
  const percent = Math.round((sum / elapsed.length) * 100);
  return {
    week_start: isoDate(startOfWeek()),
    week_end: isoDate(endOfWeek()),
    days_total: elapsed.length,
    commitment_percent: percent,
  };
}

/** Pick a rotating wisdom quote based on the week (stable within a week). */
export async function pickWisdomForWeek(): Promise<string> {
  return "لا يزالُ لسانُك رطبًا من ذكرِ اللهِ";
}
