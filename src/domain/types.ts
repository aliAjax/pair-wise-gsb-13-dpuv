/**
 * 卸油验收台 —— 数据模型
 * 与界面、存储无关，可被计算层、存储层、页面层共同引用。
 */

export type BatchStatus = "held" | "posted";

/** 触发停待复核的问题类型 */
export type IssueCode = "seal_mismatch" | "temp_exceed" | "variance_exceed";

export const ISSUE_LABELS: Record<IssueCode, string> = {
  seal_mismatch: "铅封与交接单不一致",
  temp_exceed: "温差超过3℃",
  variance_exceed: "折算后短溢超过0.5%"
};

/** 复核人填写的责任与处置，只有停待批次需要 */
export interface ReviewInfo {
  reviewer: string;
  responsibility: string;
  disposition: string;
  reviewedAt: string;
}

/** 单个仓的验收结果（保存时由计算层生成的快照） */
export interface CompartmentResult {
  id: string;
  compartmentNo: string;
  sealDoc: string;
  sealOnSite: string;
  temp: number;
  truckGauge: number;
  stationGauge: number;
  factor: number;
  stdTruckQty: number;
  stationQty: number;
  diffQty: number;
  diffRate: number;
  issues: IssueCode[];
}

/** 一次卸油交接批次（一个车牌/一单） */
export interface UnloadBatch {
  id: string;
  batchNo: string;
  plate: string;
  waybillNo: string;
  unloadDate: string;
  driver: string;
  stationMaster: string;
  compartments: CompartmentResult[];
  /** 交付量合计：罐车表 20℃ 折算升数 */
  deliveredQty: number;
  /** 实收量合计：站内表升数 */
  receivedQty: number;
  /** 折算后总短溢升数（正为溢、负为短） */
  diffQty: number;
  /** 折算后短溢率 */
  diffRate: number;
  issues: IssueCode[];
  status: BatchStatus;
  review?: ReviewInfo;
  version: number;
  /** 同一批次历次版本，按版本号倒序；仅最新版带此字段，旧版以 rootId 挂接 */
  rootId?: string;
  amendReason?: string;
  createdAt: string;
  updatedAt: string;
}

/** 页面录入中的单仓草稿（数值允许为空，计算前由归一层兜底） */
export interface CompartmentDraft {
  id: string;
  compartmentNo: string;
  sealDoc: string;
  sealOnSite: string;
  temp: number | null;
  truckGauge: number | null;
  stationGauge: number | null;
}

/** 新建/改单时的表单草稿 */
export interface BatchDraft {
  plate: string;
  waybillNo: string;
  unloadDate: string;
  driver: string;
  stationMaster: string;
  compartments: CompartmentDraft[];
}

/** 复核提交载荷 */
export interface ReviewPayload {
  reviewer: string;
  responsibility: string;
  disposition: string;
}
