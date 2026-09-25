/**
 * 卸油验收台 —— 状态编排层
 * 组合数据层与计算层，向页面提供批次录入、停待复核、改单版本、查询能力。
 */
import { computed, reactive, ref } from "vue";
import type {
  BatchDraft,
  ReviewPayload,
  UnloadBatch
} from "../domain/types";
import {
  applyReview,
  createBatch,
  loadBatches,
  nextVersion,
  saveBatches
} from "../data/unloadRepository";

const batches = ref<UnloadBatch[]>(loadBatches());

const query = reactive({
  plate: "",
  date: "",
  status: "all" as "all" | "held" | "posted"
});

function persist() {
  saveBatches(batches.value);
}

function normPlate(plate: string): string {
  return plate.trim().replace(/\s+/g, "").toUpperCase();
}

/** 同一批次的所有版本，按版本号倒序 */
function versionsOf(batch: UnloadBatch): UnloadBatch[] {
  const rootId = batch.rootId ?? batch.id;
  return batches.value
    .filter((item) => (item.rootId ?? item.id) === rootId)
    .sort((a, b) => b.version - a.version);
}

/** 查询结果：按车牌 + 日期过滤，每个批次只显示最新版本 */
const filteredBatches = computed(() => {
  const plate = normPlate(query.plate);
  const groups = new Map<string, UnloadBatch>();
  for (const batch of batches.value) {
    const rootId = batch.rootId ?? batch.id;
    const latest = groups.get(rootId);
    if (!latest || batch.version > latest.version) {
      groups.set(rootId, batch);
    }
  }
  return [...groups.values()]
    .filter((batch) => !plate || normPlate(batch.plate).includes(plate))
    .filter((batch) => !query.date || batch.unloadDate === query.date)
    .filter((batch) => query.status === "all" || batch.status === query.status)
    .sort((a, b) =>
      b.unloadDate === a.unloadDate
        ? b.batchNo.localeCompare(a.batchNo)
        : b.unloadDate.localeCompare(a.unloadDate)
    );
});

const metrics = computed(() => {
  const latest = filteredBatches.value;
  const held = latest.filter((batch) => batch.status === "held").length;
  const posted = latest.filter((batch) => batch.status === "posted").length;
  const diff = latest
    .filter((batch) => batch.status === "posted")
    .reduce((sum, batch) => sum + batch.diffQty, 0);
  return { total: latest.length, held, posted, diff: Math.round(diff * 100) / 100 };
});

function saveNew(draft: BatchDraft): UnloadBatch {
  const batch = createBatch(draft, batches.value);
  batches.value = [batch, ...batches.value];
  persist();
  return batch;
}

function review(batchId: string, payload: ReviewPayload) {
  batches.value = batches.value.map((batch) =>
    batch.id === batchId ? applyReview(batch, payload) : batch
  );
  persist();
}

function amend(current: UnloadBatch, draft: BatchDraft, reason: string): UnloadBatch {
  const versioned = nextVersion(current, draft, reason);
  batches.value = [versioned, ...batches.value];
  persist();
  return versioned;
}

export const unloadStore = reactive({
  query,
  filteredBatches,
  metrics,
  versionsOf,
  saveNew,
  review,
  amend
});

export function useUnloadStore() {
  return unloadStore;
}
