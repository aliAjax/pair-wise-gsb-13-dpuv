<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import type { BatchDraft, CompartmentDraft } from "../domain/types";
import {
  calcBatch,
  round2,
  TEMP_TOLERANCE,
  VARIANCE_TOLERANCE
} from "../domain/calc";
import { newBatchDraft, newCompartmentDraft } from "../data/unloadRepository";

const props = defineProps<{
  mode: "create" | "amend";
  initial?: BatchDraft;
}>();

const emit = defineEmits<{
  submitted: [draft: BatchDraft, reason: string];
  cancelled: [];
}>();

const draft = reactive<BatchDraft>(
  props.initial ? structuredClone(toPlain(props.initial)) : newBatchDraft()
);
const amendReason = ref("");

function toPlain(initial: BatchDraft): BatchDraft {
  return {
    ...initial,
    compartments: initial.compartments.map((item) => ({ ...item }))
  };
}

const calc = computed(() => calcBatch(draft));

const headerError = ref("");

function addCompartment() {
  draft.compartments.push(newCompartmentDraft());
}

function removeCompartment(id: string) {
  if (draft.compartments.length === 1) return;
  draft.compartments = draft.compartments.filter((item) => item.id !== id);
}

function validations(): string[] {
  const errors: string[] = [];
  if (!draft.plate.trim()) errors.push("请填写车牌号");
  if (!draft.waybillNo.trim()) errors.push("请填写交接单号");
  if (!draft.unloadDate) errors.push("请选择卸油日期");
  if (!draft.driver.trim()) errors.push("请填写司机姓名");
  if (!draft.stationMaster.trim()) errors.push("请填写站长/交接人");
  draft.compartments.forEach((item, index) => {
    const label = `第${index + 1}仓`;
    if (!item.compartmentNo.trim()) errors.push(`${label}：请填仓号`);
    if (!item.sealDoc.trim()) errors.push(`${label}：请填交接单铅封号`);
    if (!item.sealOnSite.trim()) errors.push(`${label}：请填现场铅封号`);
    if (item.temp === null || Number.isNaN(item.temp)) errors.push(`${label}：请填交接温度`);
    if (!isPositive(item.truckGauge)) errors.push(`${label}：请填罐车表读数`);
    if (!isPositive(item.stationGauge)) errors.push(`${label}：请填站内表读数`);
  });
  const nos = draft.compartments.map((item) => item.compartmentNo.trim());
  if (new Set(nos).size !== nos.length) errors.push("仓号不能重复");
  if (props.mode === "amend" && !amendReason.value.trim()) errors.push("改单必须填写改单原因");
  return errors;
}

function isPositive(value: number | null): boolean {
  return value !== null && !Number.isNaN(value) && value > 0;
}

function previewCell(item: CompartmentDraft) {
  const hasTemp = item.temp !== null && item.temp !== "" && !Number.isNaN(Number(item.temp));
  const temp = Number(item.temp) || 0;
  const factor = 1 - (temp - 20) * 0.0012;
  const truck = Number(item.truckGauge) || 0;
  const station = Number(item.stationGauge) || 0;
  const std = round2(truck * factor);
  const diff = round2(station - std);
  const rate = std > 0 ? diff / std : 0;
  return {
    factor: hasTemp && truck > 0 ? factor.toFixed(4) : "—",
    std: std ? std.toFixed(2) : "—",
    diff: std ? `${diff > 0 ? "+" : ""}${diff.toFixed(2)}` : "—",
    rate: std ? `${(rate * 100).toFixed(2)}%` : "—",
    rateBad: std > 0 && Math.abs(rate) > VARIANCE_TOLERANCE
  };
}

function tempBad(item: CompartmentDraft): boolean {
  return (
    item.temp !== null &&
    item.temp !== "" &&
    !Number.isNaN(Number(item.temp)) &&
    Math.abs(Number(item.temp) - 20) > TEMP_TOLERANCE
  );
}

function sealBad(item: CompartmentDraft): boolean {
  return (
    item.sealDoc.trim() !== "" &&
    item.sealOnSite.trim() !== "" &&
    item.sealDoc.trim() !== item.sealOnSite.trim()
  );
}

function submit() {
  const errors = validations();
  headerError.value = errors[0] ?? "";
  if (errors.length > 0) return;
  emit(
    "submitted",
    {
      ...draft,
      plate: draft.plate,
      compartments: draft.compartments.map((item) => ({ ...item }))
    },
    amendReason.value.trim()
  );
}
</script>

<template>
  <section class="panel entry-panel">
    <div class="panel-head">
      <h2>{{ mode === "create" ? "卸油验收录入" : `改单 · ${initial?.plate ?? ""}` }}</h2>
      <p class="rule-hint">
        基准温度 20℃，每差 1℃ 对交付量修正 0.12%；铅封不符 / 温差 &gt; 3℃ /
        短溢 &gt; 0.5% 将先停待复核。
      </p>
    </div>

    <div v-if="headerError" class="form-error">{{ headerError }}</div>

    <form @submit.prevent="submit">
      <div class="head-grid">
        <label>
          车牌号 <i>*</i>
          <input v-model="draft.plate" placeholder="如 沪A12345" :disabled="mode === 'amend'" />
        </label>
        <label>
          交接单号 <i>*</i>
          <input v-model="draft.waybillNo" placeholder="如 YD-20260925-01" />
        </label>
        <label>
          卸油日期 <i>*</i>
          <input v-model="draft.unloadDate" type="date" />
        </label>
        <label>
          司机 <i>*</i>
          <input v-model="draft.driver" placeholder="司机签字姓名" />
        </label>
        <label>
          站长/交接人 <i>*</i>
          <input v-model="draft.stationMaster" placeholder="站内交接人" />
        </label>
      </div>

      <div class="cmp-table entry-table">
        <div class="cmp-row cmp-head">
          <span>仓号 *</span>
          <span>交接单铅封 *</span>
          <span>现场铅封 *</span>
          <span>交接温度℃ *</span>
          <span class="num">罐车表L *</span>
          <span class="num">站内表L *</span>
          <span class="num">系数</span>
          <span class="num">折算20℃L</span>
          <span class="num">短溢L</span>
          <span class="num">短溢率</span>
          <span></span>
        </div>
        <div v-for="(item, index) in draft.compartments" :key="item.id" class="cmp-row cmp-input-row">
          <input v-model="item.compartmentNo" placeholder="1" />
          <input v-model="item.sealDoc" placeholder="交接单铅封号" :class="{ 'input-bad': sealBad(item) }" />
          <input v-model="item.sealOnSite" placeholder="现场实铅号" :class="{ 'input-bad': sealBad(item) }" />
          <input v-model.number="item.temp" type="number" step="0.1" placeholder="20.0"
            :class="{ 'input-bad': tempBad(item) }" />
          <input v-model.number="item.truckGauge" type="number" min="0" step="1" placeholder="15000" />
          <input v-model.number="item.stationGauge" type="number" min="0" step="1" placeholder="14990" />
          <span class="num live">{{ previewCell(item).factor }}</span>
          <span class="num live">{{ previewCell(item).std }}</span>
          <span class="num live">{{ previewCell(item).diff }}</span>
          <span class="num live" :class="{ 'val-bad': previewCell(item).rateBad }">
            {{ previewCell(item).rate }}
          </span>
          <button type="button" class="secondary mini" :disabled="draft.compartments.length === 1"
            @click="removeCompartment(item.id)">移除</button>
        </div>
      </div>

      <button type="button" class="secondary add-cmp" @click="addCompartment">+ 增加一仓</button>

      <div class="totals-bar">
        <span>交付合计（20℃折算）：<strong>{{ calc.deliveredQty.toFixed(2) }} L</strong></span>
        <span>站内实收合计：<strong>{{ calc.receivedQty.toFixed(2) }} L</strong></span>
        <span>
          折算短溢：
          <strong :class="calc.diffQty > 0 ? 'val-up' : calc.diffQty < 0 ? 'val-down' : ''">
            {{ calc.diffQty > 0 ? "+" : "" }}{{ calc.diffQty.toFixed(2) }} L
          </strong>
          /
          <strong :class="{ 'val-bad': calc.issues.includes('variance_exceed') }">
            {{ (calc.diffRate * 100).toFixed(2) }}%
          </strong>
        </span>
        <span v-if="calc.issues.length > 0" class="hold-tip">
          ⚠ 命中停待条件（{{ calc.issues.length }}项），保存后为“停待复核”，复核入账前不计收入账
        </span>
        <span v-else class="ok-tip">✓ 未命中停待条件，保存后直接入账</span>
      </div>

      <label v-if="mode === 'amend'" class="amend-reason">
        改单原因 <i>*</i>（已复核批次冻结，本次修改将另存为新版本，旧值保留）
        <textarea v-model="amendReason" placeholder="如：现场铅封号与交接单不符，核实后更正…"></textarea>
      </label>

      <div class="entry-actions">
        <button type="submit">{{ mode === "create" ? "保存交接" : "另存新版本" }}</button>
        <button v-if="mode === 'amend'" type="button" class="secondary" @click="emit('cancelled')">取消改单</button>
      </div>
    </form>
  </section>
</template>
