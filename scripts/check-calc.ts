import assert from "node:assert";
import {
  BASE_TEMP,
  calcBatch,
  shouldHold,
  tempFactor,
  TEMP_TOLERANCE,
  VARIANCE_TOLERANCE
} from "../src/domain/calc.ts";
import type { BatchDraft, CompartmentDraft } from "../src/domain/types.ts";

let pass = 0;
function ok(name: string, cond: boolean) {
  assert.ok(cond, name);
  pass += 1;
}

function cmp(partial: Partial<CompartmentDraft>): CompartmentDraft {
  return {
    id: "c",
    compartmentNo: "1",
    sealDoc: "S1",
    sealOnSite: "S1",
    temp: 20,
    truckGauge: 10000,
    stationGauge: 10000,
    ...partial
  };
}

function draft(compartments: CompartmentDraft[]): BatchDraft {
  return {
    plate: "沪A1",
    waybillNo: "W1",
    unloadDate: "2026-09-25",
    driver: "d",
    stationMaster: "s",
    compartments
  };
}

// 20℃ 系数为 1
ok("base temp factor 1", Math.abs(tempFactor(BASE_TEMP) - 1) < 1e-9);
// 25℃：1 - 5*0.0012 = 0.994
ok("25C factor 0.994", Math.abs(tempFactor(25) - 0.994) < 1e-9);
// 15℃：1.006
ok("15C factor 1.006", Math.abs(tempFactor(15) - 1.006) < 1e-9);

// 正常批次：20℃、铅封一致、零差异 -> 入账
{
  const r = calcBatch(draft([cmp({})]));
  ok("normal no issues", r.issues.length === 0);
  ok("normal posted", !shouldHold(r.issues));
  ok("normal delivered", r.deliveredQty === 10000);
}

// 高温 24℃ 且短溢超 0.5%
{
  const r = calcBatch(draft([cmp({ temp: 24, stationGauge: 9900 })]));
  // std = 10000 * (1 - 4*0.0012) = 9952
  ok("high temp std 9952", r.compartments[0].stdTruckQty === 9952);
  ok("has temp issue", r.issues.includes("temp_exceed"));
  ok("has variance issue", r.issues.includes("variance_exceed"));
  ok("holds", shouldHold(r.issues));
  // 差 -52 / 9952 = -0.522% > 0.5%
  ok("rate approx", Math.abs(r.diffRate + 0.0052) < 0.0001);
}

// 温差刚好 3℃：不触发（>3 才触发）
{
  const r = calcBatch(draft([cmp({ temp: 23 })]));
  ok("3C boundary not flagged", !r.issues.includes("temp_exceed"));
  const r2 = calcBatch(draft([cmp({ temp: 17 })]));
  ok("minus 3C boundary not flagged", !r2.issues.includes("temp_exceed"));
}

// 温差 3.1℃ 触发
{
  const r = calcBatch(draft([cmp({ temp: 23.1, stationGauge: 10000 })]));
  // std = 10000*(1-3.1*0.0012)=9962.8，station 10000 为溢 0.37% -> 仅温差
  ok("3.1C flagged", r.issues.includes("temp_exceed"));
  ok("0.37pct no variance", !r.issues.includes("variance_exceed"));
}

// 铅封不一致
{
  const r = calcBatch(draft([cmp({ sealDoc: "AA", sealOnSite: "BB" })]));
  ok("seal mismatch", r.issues.includes("seal_mismatch"));
  ok("seal holds", shouldHold(r.issues));
}

// 短溢恰好 0.5%：不触发（>0.5% 才触发）
{
  // std 10000，站内 10050 -> +0.5% 整
  const r = calcBatch(draft([cmp({ stationGauge: 10050 })]));
  ok("exactly 0.5pct not flagged", !r.issues.includes("variance_exceed"));
  const r2 = calcBatch(draft([cmp({ stationGauge: 10051 })]));
  ok("0.51pct flagged", r2.issues.includes("variance_exceed"));
}

// 多仓：单仓正常但合计短溢超 0.5% -> 批次级判停
{
  const r = calcBatch(
    draft([
      cmp({ id: "a", compartmentNo: "1", stationGauge: 10000 }),
      cmp({ id: "b", compartmentNo: "2", truckGauge: 10000, stationGauge: 9890 })
    ])
  );
  // 仓2：-110/10000=-1.1% 已命中；另验批次汇总
  ok("multi total ~19890", r.receivedQty === 19890);
  ok("multi variance holds", r.issues.includes("variance_exceed"));
}

// 空输入归一，不抛异常且不误判温差
{
  const r = calcBatch(
    draft([cmp({ temp: null as unknown as number, truckGauge: null, stationGauge: null })])
  );
  ok("null normalized, no temp issue", !r.issues.includes("temp_exceed"));
  ok("null delivered 0", r.deliveredQty === 0);
}

console.log(`all ${pass} assertions passed`);
