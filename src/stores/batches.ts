// 卸油验收台 —— 数据层（Pinia）：批次状态、版本链、复核入账、冻结改单
import { computed, ref } from "vue";
import { defineStore } from "pinia";
import type {
  Batch,
  BatchData,
  BatchStatus,
  BatchVersion,
  ReviewInfo,
} from "../types";
import { loadBatches, saveBatches, uid } from "../lib/storage";
import { analyzeBatch } from "../lib/calc";
import { today } from "../lib/format";

export interface ReviewInput {
  reviewer: string;
  responsibility: string;
  handling: string;
}

export interface AmendInput {
  reason: string;
  amendedBy: string;
  data: BatchData;
}

/** 已复核版本不可直接覆盖，必须改单另建版本 */
export class FrozenVersionError extends Error {}

function persist(batches: Batch[]) {
  saveBatches(batches);
}

export const useBatchStore = defineStore("unloading-batches", () => {
  const batches = ref<Batch[]>(loadBatches());

  const currentOf = (batch: Batch): BatchVersion =>
    batch.versions[batch.versions.length - 1];

  /** 列表：新批次在前 */
  const orderedBatches = computed(() =>
    [...batches.value].sort((a, b) => {
      const ta = currentOf(b).createdAt;
      const tb = currentOf(a).createdAt;
      return ta.localeCompare(tb);
    })
  );

  function nextCode(date: string): string {
    const prefix = `YS-${date.replace(/-/g, "")}-`;
    let max = 0;
    for (const b of batches.value) {
      if (b.code.startsWith(prefix)) {
        const n = Number(b.code.slice(prefix.length));
        if (Number.isFinite(n)) max = Math.max(max, n);
      }
    }
    return `${prefix}${String(max + 1).padStart(3, "0")}`;
  }

  function buildVersion(
    version: number,
    data: BatchData,
    now: string,
    amendment?: BatchVersion["amendment"]
  ): BatchVersion {
    const { initialStatus } = analyzeBatch(data);
    return {
      version,
      data: structuredClone(data),
      status: initialStatus,
      createdAt: now,
      postedAt: initialStatus === "已复核" ? now : undefined,
      amendment,
    };
  }

  /** 新建批次：任一仓异常挂起待复核；全部正常直接入账 */
  function createBatch(data: BatchData): Batch {
    const now = new Date().toISOString();
    const batch: Batch = {
      id: uid(),
      code: nextCode(data.deliveryDate || today()),
      versions: [buildVersion(1, data, now)],
    };
    batches.value = [batch, ...batches.value];
    persist(batches.value);
    return batch;
  }

  /** 保存待复核批次的修改（已复核版本受冻结保护）*/
  function savePendingBatch(id: string, data: BatchData): BatchStatus {
    const batch = batches.value.find((b) => b.id === id);
    if (!batch) throw new Error("批次不存在");
    const current = currentOf(batch);
    if (current.status === "已复核") throw new FrozenVersionError("已复核批次已冻结，请使用改单");
    current.data = structuredClone(data);
    const { initialStatus } = analyzeBatch(data);
    current.status = initialStatus;
    if (initialStatus === "已复核" && !current.postedAt) {
      current.postedAt = new Date().toISOString();
    }
    persist(batches.value);
    return current.status;
  }

  /** 复核入账：复核人填明责任与处置 */
  function reviewBatch(id: string, input: ReviewInput): void {
    const batch = batches.value.find((b) => b.id === id);
    if (!batch) throw new Error("批次不存在");
    const current = currentOf(batch);
    if (current.status === "已复核") throw new FrozenVersionError("批次已复核入账");
    const review: ReviewInfo = {
      reviewer: input.reviewer.trim(),
      responsibility: input.responsibility.trim(),
      handling: input.handling.trim(),
      reviewedAt: new Date().toISOString(),
    };
    current.status = "已复核";
    current.review = review;
    current.postedAt = review.reviewedAt;
    persist(batches.value);
  }

  /** 改单：冻结版本原样保留，带原因另建版本；新版本仍需走挂起/复核规则 */
  function amendBatch(id: string, input: AmendInput): BatchStatus {
    const batch = batches.value.find((b) => b.id === id);
    if (!batch) throw new Error("批次不存在");
    const current = currentOf(batch);
    if (current.status !== "已复核") {
      throw new Error("仅已复核冻结批次需要改单");
    }
    const now = new Date().toISOString();
    const next = buildVersion(current.version + 1, input.data, now, {
      reason: input.reason.trim(),
      amendedBy: input.amendedBy.trim(),
      amendedAt: now,
    });
    batch.versions.push(next);
    persist(batches.value);
    return next.status;
  }

  /** 仅允许删除尚未入账（待复核）的批次 */
  function removeBatch(id: string): void {
    const batch = batches.value.find((b) => b.id === id);
    if (!batch) return;
    if (currentOf(batch).status === "已复核") {
      throw new FrozenVersionError("已复核批次已入账冻结，不可删除；如需更正请改单");
    }
    batches.value = batches.value.filter((b) => b.id !== id);
    persist(batches.value);
  }

  return {
    batches,
    orderedBatches,
    currentOf,
    createBatch,
    savePendingBatch,
    reviewBatch,
    amendBatch,
    removeBatch,
  };
});
