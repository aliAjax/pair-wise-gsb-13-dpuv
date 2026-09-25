// 卸油验收台 —— 存储层（只负责序列化与读取，不含业务计算）
import type { Batch } from "../types";

export const STORAGE_KEY = "dfwlfront-7-unloading-batches-v1";

export function loadBatches(): Batch[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === null) return seedBatches();
  try {
    const parsed = JSON.parse(raw) as Batch[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveBatches(batches: Batch[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(batches));
}

export function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

// ---- 种子数据（仅首次打开时写入）----

function seedBatches(): Batch[] {
  return [
    {
      id: "seed-1",
      code: "YS-20260925-001",
      versions: [
        {
          version: 1,
          createdAt: "2026-09-25T08:12:00.000Z",
          postedAt: "2026-09-25T08:12:00.000Z",
          status: "已复核",
          data: {
            plate: "京A8F267",
            waybillNo: "JD-20260925-118",
            driver: "王建国",
            stationMaster: "李秀兰",
            deliveryDate: "2026-09-25",
            notes: "92号汽油，两仓卸油正常，账实一致",
            compartments: [
              {
                id: "seed-1-c1",
                compartmentNo: "1仓",
                waybillSeal: "TF-772031",
                actualSeal: "TF-772031",
                waybillTemp: 21.2,
                truckGauge: 12000,
                stationGauge: 11960,
              },
              {
                id: "seed-1-c2",
                compartmentNo: "2仓",
                waybillSeal: "TF-772032",
                actualSeal: "TF-772032",
                waybillTemp: 20.6,
                truckGauge: 9000,
                stationGauge: 8985,
              },
            ],
          },
        },
      ],
    },
    {
      id: "seed-2",
      code: "YS-20260924-006",
      versions: [
        {
          version: 1,
          createdAt: "2026-09-24T22:40:00.000Z",
          status: "待复核",
          data: {
            plate: "冀JK2086",
            waybillNo: "JD-20260924-203",
            driver: "赵军",
            stationMaster: "李秀兰",
            deliveryDate: "2026-09-24",
            notes: "1仓铅封号现场核对不符，等待运输公司确认",
            compartments: [
              {
                id: "seed-2-c1",
                compartmentNo: "1仓",
                waybillSeal: "TF-880121",
                actualSeal: "TF-880127",
                waybillTemp: 24.5,
                truckGauge: 12500,
                stationGauge: 12420,
              },
              {
                id: "seed-2-c2",
                compartmentNo: "2仓",
                waybillSeal: "TF-880122",
                actualSeal: "TF-880122",
                waybillTemp: 20.8,
                truckGauge: 8000,
                stationGauge: 7990,
              },
            ],
          },
        },
      ],
    },
    {
      id: "seed-3",
      code: "YS-20260923-009",
      versions: [
        {
          version: 1,
          createdAt: "2026-09-23T09:05:00.000Z",
          postedAt: "2026-09-23T09:05:00.000Z",
          status: "已复核",
          data: {
            plate: "鲁N5512D",
            waybillNo: "JD-20260923-077",
            driver: "孙志强",
            stationMaster: "陈卫国",
            deliveryDate: "2026-09-23",
            notes: "0号柴油，一仓",
            compartments: [
              {
                id: "seed-3-c1",
                compartmentNo: "1仓",
                waybillSeal: "TF-655301",
                actualSeal: "TF-655301",
                waybillTemp: 22.0,
                truckGauge: 10000,
                stationGauge: 9970,
              },
            ],
          },
        },
        {
          version: 2,
          createdAt: "2026-09-23T15:20:00.000Z",
          postedAt: "2026-09-23T15:20:00.000Z",
          status: "已复核",
          amendment: {
            reason: "站内表人工读数误录，复测后修正站内表读数",
            amendedBy: "陈卫国",
            amendedAt: "2026-09-23T15:20:00.000Z",
          },
          data: {
            plate: "鲁N5512D",
            waybillNo: "JD-20260923-077",
            driver: "孙志强",
            stationMaster: "陈卫国",
            deliveryDate: "2026-09-23",
            notes: "0号柴油，一仓；站内表复测修正",
            compartments: [
              {
                id: "seed-3-c1-v2",
                compartmentNo: "1仓",
                waybillSeal: "TF-655301",
                actualSeal: "TF-655301",
                waybillTemp: 22.0,
                truckGauge: 10000,
                stationGauge: 9985,
              },
            ],
          },
        },
      ],
    },
  ];
}
