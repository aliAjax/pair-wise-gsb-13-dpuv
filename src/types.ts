// 卸油验收台 —— 领域模型
// 一个批次 = 一张交接单（一次到站卸油），包含车牌、铅封与若干仓的计量数据。

/** 状态：待复核（异常挂起）/ 已复核（复核入账，冻结）*/
export type BatchStatus = "待复核" | "已复核";

/** 单仓录入数据 */
export interface CompartmentInput {
  id: string;
  compartmentNo: string; // 仓号
  waybillSeal: string; // 交接单铅封号
  actualSeal: string; // 现场铅封号
  waybillTemp: number | null; // 交接温度 ℃
  truckGauge: number | null; // 罐车表读数（交付量）L
  stationGauge: number | null; // 站内表读数（实收量）L
}

/** 单仓计算结果（纯计算，不持久化，由输入派生）*/
export interface CompartmentResult {
  factor: number; // 温度修正系数
  tempDelta: number; // 交接温度 - 20
  truckStd: number; // 罐车表折算 20℃ 体积
  stationStd: number; // 站内表折算 20℃ 体积
  diff: number; // 折算后短溢量（站内 - 罐车），负为短少，正为溢余
  diffRate: number; // 短溢率（占罐车折算量）
  sealMismatch: boolean; // 铅封与交接单不一致
  tempAlert: boolean; // 温差超过 3℃
  diffAlert: boolean; // 折算后短溢超过 0.5%
  flagged: boolean; // 该仓是否触发挂起
}

/** 复核信息（复核人填明责任与处置后才能入账）*/
export interface ReviewInfo {
  reviewer: string;
  responsibility: string;
  handling: string;
  reviewedAt: string;
}

/** 改单（冻结后修订）留痕 */
export interface AmendmentInfo {
  reason: string;
  amendedBy: string;
  amendedAt: string;
}

/** 批次某一版本的完整数据，旧版本原样保留 */
export interface BatchVersion {
  version: number;
  data: BatchData;
  status: BatchStatus;
  review?: ReviewInfo;
  amendment?: AmendmentInfo;
  createdAt: string; // 该版本产生时间
  postedAt?: string; // 入账时间
}

export interface BatchData {
  plate: string; // 车牌
  waybillNo: string; // 交接单号
  driver: string; // 司机
  stationMaster: string; // 站长
  deliveryDate: string; // 交接日期 YYYY-MM-DD
  notes: string;
  compartments: CompartmentInput[];
}

/** 持久化的批次：版本链 + 序号 */
export interface Batch {
  id: string;
  code: string; // 业务单号，如 YS-0001
  versions: BatchVersion[];
}
