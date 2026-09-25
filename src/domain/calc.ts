/**
 * 卸油验收台 —— 纯计算层
 * 业务规则全部集中在这里：
 * - 以 20℃ 为基准，每偏差 1℃ 对交付量修正 0.12%
 * - 铅封与交接单不一致 / 温差超过 3℃ / 折算后短溢超过 0.5% 触发停待复核
 * 该文件不读 DOM、不碰存储，方便单独验证与以后替换为接口实现。
 */
import type {
  BatchDraft,
  CompartmentDraft,
  CompartmentResult,
  IssueCode
} from "./types";

export const BASE_TEMP = 20;
/** 每 1℃ 的温度修正系数 0.12% */
export const TEMP_FACTOR_PER_DEGREE = 0.0012;
/** 温差停待阈值（℃） */
export const TEMP_TOLERANCE = 3;
/** 折算后短溢停待阈值（占交付量比例） */
export const VARIANCE_TOLERANCE = 0.005;

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function round4(value: number): number {
  return Math.round((value + Number.EPSILON) * 10000) / 10000;
}

/** 温度修正系数：高于 20℃ 体积膨胀向下修正，低于 20℃ 向上修正 */
export function tempFactor(temp: number): number {
  return 1 - (temp - BASE_TEMP) * TEMP_FACTOR_PER_DEGREE;
}

/** 罐车表读数折算到 20℃ 的标准升数 */
export function toStdQty(gauge: number, temp: number): number {
  return round2(gauge * tempFactor(temp));
}

export interface CompartmentCalc {
  factor: number;
  stdTruckQty: number;
  stationQty: number;
  diffQty: number;
  diffRate: number;
  issues: IssueCode[];
}

/** 计算单仓：铅封、温差以仓为单位判定；短溢先按仓算出，批次再汇总判定一次 */
export function calcCompartment(
  draft: Pick<CompartmentDraft, "sealDoc" | "sealOnSite" | "temp" | "truckGauge" | "stationGauge">
): CompartmentCalc {
  // 空输入在表单里可能是 null 或空串，统一归一成 0
  const temp = Number(draft.temp) || 0;
  const truckGauge = Number(draft.truckGauge) || 0;
  const stationGauge = Number(draft.stationGauge) || 0;

  const factor = round4(tempFactor(temp));
  const stdTruckQty = toStdQty(truckGauge, temp);
  const stationQty = round2(stationGauge);
  const diffQty = round2(stationQty - stdTruckQty);
  const diffRate = stdTruckQty > 0 ? round4(diffQty / stdTruckQty) : 0;

  const issues: IssueCode[] = [];
  if (
    draft.sealDoc.trim() &&
    draft.sealOnSite.trim() &&
    draft.sealDoc.trim() !== draft.sealOnSite.trim()
  ) {
    issues.push("seal_mismatch");
  }
  if (truckGauge > 0 && Math.abs(temp - BASE_TEMP) > TEMP_TOLERANCE) {
    issues.push("temp_exceed");
  }
  if (stdTruckQty > 0 && Math.abs(diffRate) > VARIANCE_TOLERANCE) {
    issues.push("variance_exceed");
  }

  return { factor, stdTruckQty, stationQty, diffQty, diffRate, issues };
}

export interface BatchCalcResult {
  compartments: CompartmentResult[];
  deliveredQty: number;
  receivedQty: number;
  diffQty: number;
  diffRate: number;
  issues: IssueCode[];
}

let seq = 0;
function localId(): string {
  seq += 1;
  return `calc-${Date.now().toString(36)}-${seq}`;
}

/**
 * 汇总整批：任一仓命中铅封/温差/短溢，或批次级短溢率超阈值，都需要停待复核。
 */
export function calcBatch(draft: BatchDraft): BatchCalcResult {
  const compartments: CompartmentResult[] = draft.compartments.map((item) => {
    const calc = calcCompartment(item);
    return {
      id: item.id || localId(),
      compartmentNo: item.compartmentNo.trim(),
      sealDoc: item.sealDoc.trim(),
      sealOnSite: item.sealOnSite.trim(),
      temp: Number(item.temp) || 0,
      truckGauge: Number(item.truckGauge) || 0,
      stationGauge: Number(item.stationGauge) || 0,
      ...calc
    };
  });

  const deliveredQty = round2(
    compartments.reduce((sum, item) => sum + item.stdTruckQty, 0)
  );
  const receivedQty = round2(
    compartments.reduce((sum, item) => sum + item.stationQty, 0)
  );
  const diffQty = round2(receivedQty - deliveredQty);
  const diffRate = deliveredQty > 0 ? round4(diffQty / deliveredQty) : 0;

  const issues = Array.from(new Set(compartments.flatMap((item) => item.issues)));
  if (deliveredQty > 0 && Math.abs(diffRate) > VARIANCE_TOLERANCE) {
    issues.push("variance_exceed");
  }
  const uniqueIssues = Array.from(new Set(issues));

  return { compartments, deliveredQty, receivedQty, diffQty, diffRate, issues: uniqueIssues };
}

/** 命中任一停待条件即“先停待复核”，否则可直接入账 */
export function shouldHold(issues: IssueCode[]): boolean {
  return issues.length > 0;
}
