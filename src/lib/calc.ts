// 卸油验收台 —— 计算层（纯函数，无副作用，不依赖存储与页面）
import type {
  BatchData,
  BatchStatus,
  CompartmentInput,
  CompartmentResult,
} from "../types";

export const BASE_TEMP = 20; // 体积折算基准温度 ℃
export const TEMP_FACTOR = 0.0012; // 每差 1℃ 修正 0.12%
export const TEMP_TOLERANCE = 3; // 温差超过 3℃ 挂起
export const DIFF_TOLERANCE = 0.005; // 折算后短溢超过 0.5% 挂起

export function round(value: number, digits = 2): number {
  if (!Number.isFinite(value)) return 0;
  const p = 10 ** digits;
  return Math.round((value + Number.EPSILON) * p) / p;
}

/** 温度修正系数：温度高于20℃油品膨胀，读数偏大，折算时收缩 */
export function tempFactor(temp: number | null): number {
  if (temp === null || !Number.isFinite(temp)) return 1;
  return round(1 - (temp - BASE_TEMP) * TEMP_FACTOR, 6);
}

function toVolume(value: number | null): number {
  return value === null || !Number.isFinite(value) ? 0 : value;
}

/** 计算单仓结果 */
export function analyzeCompartment(c: CompartmentInput): CompartmentResult {
  const factor = tempFactor(c.waybillTemp);
  const tempDelta = c.waybillTemp === null ? 0 : c.waybillTemp - BASE_TEMP;
  const truckStd = round(toVolume(c.truckGauge) * factor);
  const stationStd = round(toVolume(c.stationGauge) * factor);
  const diff = round(stationStd - truckStd);
  const diffRate = truckStd > 0 ? round(diff / truckStd, 6) : 0;

  const sealMismatch =
    c.waybillSeal.trim() !== "" &&
    c.actualSeal.trim() !== "" &&
    c.waybillSeal.trim() !== c.actualSeal.trim();
  const tempAlert = Math.abs(tempDelta) > TEMP_TOLERANCE;
  const diffAlert = truckStd > 0 && Math.abs(diffRate) > DIFF_TOLERANCE;

  return {
    factor,
    tempDelta,
    truckStd,
    stationStd,
    diff,
    diffRate,
    sealMismatch,
    tempAlert,
    diffAlert,
    flagged: sealMismatch || tempAlert || diffAlert,
  };
}

export interface BatchAnalysis {
  rows: Array<{ input: CompartmentInput; result: CompartmentResult }>;
  flagged: boolean; // 任一仓异常则整批挂起
  totalTruckStd: number;
  totalStationStd: number;
  totalDiff: number;
  totalDiffRate: number;
  initialStatus: BatchStatus;
}

/** 计算整批：任一仓命中规则即为「待复核」，否则自动入账「已复核」 */
export function analyzeBatch(data: BatchData): BatchAnalysis {
  const rows = data.compartments.map((input) => ({
    input,
    result: analyzeCompartment(input),
  }));
  const totalTruckStd = round(rows.reduce((s, r) => s + r.result.truckStd, 0));
  const totalStationStd = round(
    rows.reduce((s, r) => s + r.result.stationStd, 0)
  );
  const totalDiff = round(totalStationStd - totalTruckStd);
  const totalDiffRate =
    totalTruckStd > 0 ? round(totalDiff / totalTruckStd, 6) : 0;
  const flagged = rows.some((r) => r.result.flagged);

  return {
    rows,
    flagged,
    totalTruckStd,
    totalStationStd,
    totalDiff,
    totalDiffRate,
    initialStatus: flagged ? "待复核" : "已复核",
  };
}

/** 挂起原因文案 */
export function flagReasons(r: CompartmentResult): string[] {
  const reasons: string[] = [];
  if (r.sealMismatch) reasons.push("铅封与交接单不一致");
  if (r.tempAlert)
    reasons.push(`温差超${TEMP_TOLERANCE}℃（实测${r.tempDelta > 0 ? "+" : ""}${r.tempDelta}℃）`);
  if (r.diffAlert)
    reasons.push(`短溢超${(DIFF_TOLERANCE * 100).toFixed(1)}%（${(r.diffRate * 100).toFixed(2)}%）`);
  return reasons;
}
