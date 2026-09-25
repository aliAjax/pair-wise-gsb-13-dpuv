/**
 * 卸油验收台 —— 数据与保存层
 * 负责批次组装、停待/复核状态流转、改单版本冻结、localStorage 持久化。
 * 页面只调用本模块导出的函数，不直接读写 localStorage。
 */
import type {
  BatchDraft,
  CompartmentDraft,
  CompartmentResult,
  ReviewPayload,
  UnloadBatch
} from "../domain/types";
import { calcBatch, round2, shouldHold } from "../domain/calc";

const STORAGE_KEY = "dfwlfront-7-unload-acceptance-v1";

export function newCompartmentDraft(): CompartmentDraft {
  return {
    id: crypto.randomUUID(),
    compartmentNo: "",
    sealDoc: "",
    sealOnSite: "",
    temp: null,
    truckGauge: null,
    stationGauge: null
  };
}

export function newBatchDraft(): BatchDraft {
  return {
    plate: "",
    waybillNo: "",
    unloadDate: new Date().toISOString().slice(0, 10),
    driver: "",
    stationMaster: "",
    compartments: [newCompartmentDraft()]
  };
}

/** 已保存批次回填为表单草稿（复核快照字段不回填，保存时重新计算） */
export function toDraft(batch: UnloadBatch): BatchDraft {
  return {
    plate: batch.plate,
    waybillNo: batch.waybillNo,
    unloadDate: batch.unloadDate,
    driver: batch.driver,
    stationMaster: batch.stationMaster,
    compartments: batch.compartments.map((item) => ({
      id: crypto.randomUUID(),
      compartmentNo: item.compartmentNo,
      sealDoc: item.sealDoc,
      sealOnSite: item.sealOnSite,
      temp: item.temp,
      truckGauge: item.truckGauge,
      stationGauge: item.stationGauge
    }))
  };
}

function normalizePlate(plate: string): string {
  return plate.trim().replace(/\s+/g, "").toUpperCase();
}

function buildBatchNo(count: number): string {
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `XY${day}-${String(count + 1).padStart(3, "0")}`;
}

interface BuildContext {
  seq: number;
  now: string;
  version?: number;
  rootId?: string;
  amendReason?: string;
}

/** 由录入草稿 + 计算结果组装可保存的批次 */
function buildBatch(draft: BatchDraft, ctx: BuildContext): UnloadBatch {
  const calc = calcBatch(draft);
  return {
    id: crypto.randomUUID(),
    batchNo: buildBatchNo(ctx.seq),
    plate: normalizePlate(draft.plate),
    waybillNo: draft.waybillNo.trim(),
    unloadDate: draft.unloadDate,
    driver: draft.driver.trim(),
    stationMaster: draft.stationMaster.trim(),
    compartments: calc.compartments,
    deliveredQty: calc.deliveredQty,
    receivedQty: calc.receivedQty,
    diffQty: calc.diffQty,
    diffRate: calc.diffRate,
    issues: calc.issues,
    status: shouldHold(calc.issues) ? "held" : "posted",
    version: ctx.version ?? 1,
    rootId: ctx.rootId,
    amendReason: ctx.amendReason,
    createdAt: ctx.now,
    updatedAt: ctx.now
  };
}

/** 复核通过：登记责任与处置后入账 */
export function applyReview(batch: UnloadBatch, payload: ReviewPayload): UnloadBatch {
  const now = new Date().toISOString();
  return {
    ...batch,
    status: "posted",
    review: {
      reviewer: payload.reviewer.trim(),
      responsibility: payload.responsibility.trim(),
      disposition: payload.disposition.trim(),
      reviewedAt: now
    },
    updatedAt: now
  };
}

/**
 * 改单：以最新版为底重新计算并另建版本，旧值原样保留。
 * 新版本若再次命中停待条件，仍需复核后才能入账。
 */
export function nextVersion(
  current: UnloadBatch,
  draft: BatchDraft,
  reason: string
): UnloadBatch {
  const now = new Date().toISOString();
  const rootId = current.rootId ?? current.id;
  const built = buildBatch(draft, {
    seq: parseSeq(current.batchNo),
    now,
    version: current.version + 1,
    rootId,
    amendReason: reason.trim()
  });
  // 同一批次沿用首个批次号，便于按单号串联版本
  return { ...built, batchNo: current.batchNo };
}

function parseSeq(batchNo: string): number {
  const match = /-(\d+)$/.exec(batchNo);
  return match ? Number(match[1]) : 0;
}

/* ---------------- 持久化 ---------------- */

function seedBatches(): UnloadBatch[] {
  const now = new Date().toISOString();
  const make = (
    partial: Omit<
      UnloadBatch,
      "createdAt" | "updatedAt" | "version"
    > & { version?: number }
  ): UnloadBatch => ({
    version: 1,
    createdAt: now,
    updatedAt: now,
    ...partial
  });

  const c1: CompartmentResult[] = [
    {
      id: "seed-1-c1",
      compartmentNo: "1",
      sealDoc: "SF20260901",
      sealOnSite: "SF20260901",
      temp: 20.5,
      truckGauge: 15000,
      stationGauge: 14990,
      factor: 0.9994,
      stdTruckQty: 14991,
      stationQty: 14990,
      diffQty: -1,
      diffRate: -0.0001,
      issues: []
    },
    {
      id: "seed-1-c2",
      compartmentNo: "2",
      sealDoc: "SF20260902",
      sealOnSite: "SF20260902",
      temp: 21,
      truckGauge: 12000,
      stationGauge: 11980,
      factor: 0.9988,
      stdTruckQty: 11985.6,
      stationQty: 11980,
      diffQty: -5.6,
      diffRate: -0.0005,
      issues: []
    }
  ];

  const c2: CompartmentResult[] = [
    {
      id: "seed-2-c1",
      compartmentNo: "1",
      sealDoc: "SF20258801",
      sealOnSite: "SF20258801",
      temp: 24,
      truckGauge: 16000,
      stationGauge: 15880,
      factor: 0.9952,
      stdTruckQty: 15923.2,
      stationQty: 15880,
      diffQty: -43.2,
      diffRate: -0.0027,
      issues: ["temp_exceed"]
    },
    {
      id: "seed-2-c2",
      compartmentNo: "2",
      sealDoc: "SF20258802",
      sealOnSite: "SF20258802",
      temp: 22,
      truckGauge: 10000,
      stationGauge: 9990,
      factor: 0.9976,
      stdTruckQty: 9976,
      stationQty: 9990,
      diffQty: 14,
      diffRate: 0.0014,
      issues: []
    }
  ];

  const c3V1: CompartmentResult[] = [
    {
      id: "seed-3-c1",
      compartmentNo: "1",
      sealDoc: "SF778801",
      sealOnSite: "SF778001",
      temp: 26,
      truckGauge: 14000,
      stationGauge: 13800,
      factor: 0.9928,
      stdTruckQty: 13899.2,
      stationQty: 13800,
      diffQty: -99.2,
      diffRate: -0.0071,
      issues: ["seal_mismatch", "temp_exceed", "variance_exceed"]
    }
  ];
  const c3V2: CompartmentResult[] = [
    {
      id: "seed-3-c1-v2",
      compartmentNo: "1",
      sealDoc: "SF778001",
      sealOnSite: "SF778001",
      temp: 26,
      truckGauge: 14000,
      stationGauge: 13880,
      factor: 0.9928,
      stdTruckQty: 13899.2,
      stationQty: 13880,
      diffQty: -19.2,
      diffRate: -0.0014,
      issues: ["temp_exceed"]
    }
  ];

  const old: UnloadBatch = make({
    id: "seed-3-v1",
    batchNo: "XY20260924-003",
    plate: "沪B90123",
    waybillNo: "YD-20260924-18",
    unloadDate: "2026-09-24",
    driver: "马涛",
    stationMaster: "站长 刘倩",
    compartments: c3V1,
    deliveredQty: round2(c3V1[0].stdTruckQty),
    receivedQty: c3V1[0].stationQty,
    diffQty: c3V1[0].diffQty,
    diffRate: c3V1[0].diffRate,
    issues: ["seal_mismatch", "temp_exceed", "variance_exceed"],
    status: "posted",
    review: {
      reviewer: "区督导 周明",
      responsibility: "交接单铅封登记错误，实际铅封 SF778001 与现场一致",
      disposition: "按实铅封更正后复核入账，短量由承运方按协议补偿",
      reviewedAt: now
    },
    rootId: "seed-3-v1",
    version: 1
  });

  const current: UnloadBatch = make({
    id: "seed-3-v2",
    batchNo: "XY20260924-003",
    plate: "沪B90123",
    waybillNo: "YD-20260924-18",
    unloadDate: "2026-09-24",
    driver: "马涛",
    stationMaster: "站长 刘倩",
    compartments: c3V2,
    deliveredQty: round2(c3V2[0].stdTruckQty),
    receivedQty: c3V2[0].stationQty,
    diffQty: c3V2[0].diffQty,
    diffRate: c3V2[0].diffRate,
    issues: ["temp_exceed"],
    status: "posted",
    review: {
      reviewer: "区督导 周明",
      responsibility: "气温偏高导致温差超 3℃，铅封已核正",
      disposition: "按 20℃ 折算后短溢在 0.5% 内，准予入账",
      reviewedAt: now
    },
    rootId: "seed-3-v1",
    amendReason: "交接单铅封号录入错误，更正为现场实铅 SF778001",
    version: 2
  });

  return [
    make({
      id: "seed-1",
      batchNo: "XY20260925-001",
      plate: "沪A12345",
      waybillNo: "YD-20260925-01",
      unloadDate: "2026-09-25",
      driver: "王建国",
      stationMaster: "站长 陈立",
      compartments: c1,
      deliveredQty: round2(c1[0].stdTruckQty + c1[1].stdTruckQty),
      receivedQty: round2(c1[0].stationQty + c1[1].stationQty),
      diffQty: round2(c1[0].diffQty + c1[1].diffQty),
      diffRate: round2(c1[0].diffQty + c1[1].diffQty) / round2(c1[0].stdTruckQty + c1[1].stdTruckQty),
      issues: [],
      status: "posted"
    }),
    make({
      id: "seed-2",
      batchNo: "XY20260925-002",
      plate: "沪B67890",
      waybillNo: "YD-20260925-07",
      unloadDate: "2026-09-25",
      driver: "李伟",
      stationMaster: "站长 陈立",
      compartments: c2,
      deliveredQty: round2(c2[0].stdTruckQty + c2[1].stdTruckQty),
      receivedQty: round2(c2[0].stationQty + c2[1].stationQty),
      diffQty: round2(c2[0].diffQty + c2[1].diffQty),
      diffRate:
        round2(c2[0].diffQty + c2[1].diffQty) /
        round2(c2[0].stdTruckQty + c2[1].stdTruckQty),
      issues: ["temp_exceed"],
      status: "held"
    }),
    old,
    current
  ];
}

export function loadBatches(): UnloadBatch[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return seedBatches();
  try {
    const parsed = JSON.parse(raw) as UnloadBatch[];
    return Array.isArray(parsed) ? parsed : seedBatches();
  } catch {
    return seedBatches();
  }
}

export function saveBatches(batches: UnloadBatch[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(batches));
}

export function createBatch(draft: BatchDraft, existing: UnloadBatch[]): UnloadBatch {
  return buildBatch(draft, { seq: existing.length, now: new Date().toISOString() });
}
