// 卸油验收台 —— 展示格式化（纯展示，不参与计算）

export function fmtVolume(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return `${v.toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} L`;
}

/** 短溢量带符号 */
export function fmtSigned(v: number): string {
  const sign = v > 0 ? "+" : v < 0 ? "-" : "";
  return `${sign}${Math.abs(v).toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} L`;
}

export function fmtPercent(rate: number, digits = 2): string {
  const sign = rate > 0 ? "+" : rate < 0 ? "-" : "";
  return `${sign}${(Math.abs(rate) * 100).toFixed(digits)}%`;
}

export function fmtFactor(f: number): string {
  return f.toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
}

export function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(
    d.getHours()
  )}:${p(d.getMinutes())}`;
}

export function today(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
