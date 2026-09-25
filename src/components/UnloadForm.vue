<script setup lang="ts">
// 卸油录入表单：支持「新建批次 / 修正待复核 / 已冻结批次改单」
import { computed, reactive, ref, watch } from "vue";
import type { BatchData, CompartmentInput } from "../types";
import {
  analyzeCompartment,
  BASE_TEMP,
  DIFF_TOLERANCE,
  TEMP_TOLERANCE,
} from "../lib/calc";
import { fmtFactor, fmtPercent, fmtSigned, today } from "../lib/format";
import { uid } from "../lib/storage";

export type FormMode = "create" | "edit" | "amend";

const props = defineProps<{
  mode: FormMode;
  initial?: BatchData;
}>();

export interface AmendMeta {
  reason: string;
  amendedBy: string;
}

const emit = defineEmits<{
  (e: "submit", data: BatchData, amendMeta?: AmendMeta): void;
  (e: "cancel"): void;
}>();

function blankCompartment(): CompartmentInput {
  return {
    id: uid(),
    compartmentNo: "",
    waybillSeal: "",
    actualSeal: "",
    waybillTemp: null,
    truckGauge: null,
    stationGauge: null,
  };
}

function blankData(): BatchData {
  return {
    plate: "",
    waybillNo: "",
    driver: "",
    stationMaster: "",
    deliveryDate: today(),
    notes: "",
    compartments: [blankCompartment()],
  };
}

const form = reactive<BatchData>(blankData());

watch(
  () => props.initial,
  (initial) => {
    Object.assign(form, initial ? structuredClone(initial) : blankData());
    if (form.compartments.length === 0) form.compartments.push(blankCompartment());
  },
  { immediate: true }
);

const amendReason = ref("");
const amendBy = ref("");

const modeMeta = computed(() => {
  switch (props.mode) {
    case "edit":
      return { title: "修正待复核批次", submit: "保存修改并重新校验" };
    case "amend":
      return { title: "改单（新建版本）", submit: "另建版本" };
    default:
      return { title: "新增卸油验收", submit: "保存验收" };
  }
});

function addCompartment() {
  form.compartments.push(blankCompartment());
}

function removeCompartment(index: number) {
  form.compartments.splice(index, 1);
}

const errors = ref<string[]>([]);

function validate(): boolean {
  const errs: string[] = [];
  if (!form.plate.trim()) errs.push("请填写车牌号");
  if (!form.waybillNo.trim()) errs.push("请填写交接单号");
  if (!form.deliveryDate) errs.push("请选择交接日期");
  if (form.compartments.length === 0) errs.push("至少录入一仓");
  form.compartments.forEach((c, i) => {
    const label = c.compartmentNo || `第${i + 1}仓`;
    if (!c.compartmentNo.trim()) errs.push(`${label}：请填写仓号`);
    if (!c.waybillSeal.trim()) errs.push(`${label}：请填写交接单铅封号`);
    if (!c.actualSeal.trim()) errs.push(`${label}：请填写现场铅封号`);
    if (c.waybillTemp === null) errs.push(`${label}：请填写交接温度`);
    if (c.truckGauge === null || c.truckGauge <= 0)
      errs.push(`${label}：罐车表读数需大于0`);
    if (c.stationGauge === null || c.stationGauge < 0)
      errs.push(`${label}：请填写站内表读数`);
  });
  if (props.mode === "amend") {
    if (!amendReason.value.trim()) errs.push("改单必须填写原因");
    if (!amendBy.value.trim()) errs.push("请填写改单人");
  }
  errors.value = errs;
  return errs.length === 0;
}

function submit() {
  if (!validate()) return;
  const data: BatchData = {
    ...form,
    plate: form.plate.trim(),
    waybillNo: form.waybillNo.trim(),
    driver: form.driver.trim(),
    stationMaster: form.stationMaster.trim(),
    compartments: form.compartments.map((c) => ({
      ...c,
      compartmentNo: c.compartmentNo.trim(),
      waybillSeal: c.waybillSeal.trim(),
      actualSeal: c.actualSeal.trim(),
    })),
  };
  if (props.mode === "amend") {
    emit("submit", data, {
      reason: amendReason.value.trim(),
      amendedBy: amendBy.value.trim(),
    });
  } else {
    emit("submit", data);
  }
}
</script>

<template>
  <form class="panel entry-panel" @submit.prevent="submit">
    <div class="panel-head">
      <h2>{{ modeMeta.title }}</h2>
      <button type="button" class="secondary small" @click="emit('cancel')">取消</button>
    </div>

    <div class="form-grid">
      <label>
        车牌号 <span class="req">*</span>
        <input v-model="form.plate" placeholder="如 京A8F267" />
      </label>
      <label>
        交接单号 <span class="req">*</span>
        <input v-model="form.waybillNo" placeholder="如 JD-20260925-118" />
      </label>
      <label>
        司机
        <input v-model="form.driver" placeholder="司机姓名" />
      </label>
      <label>
        站长
        <input v-model="form.stationMaster" placeholder="站长姓名" />
      </label>
      <label>
        交接日期 <span class="req">*</span>
        <input v-model="form.deliveryDate" type="date" />
      </label>
    </div>

    <div class="rule-hint">
      体积以 {{ BASE_TEMP }}℃ 为基准，每差 1℃ 按交付量修正 0.12%；
      铅封不一致、温差超 {{ TEMP_TOLERANCE }}℃ 或折算短溢超
      {{ (DIFF_TOLERANCE * 100).toFixed(1) }}% 时整批挂起待复核。
    </div>

    <div class="compartment-table-wrap">
      <table class="compartment-table">
        <thead>
          <tr>
            <th>仓号</th>
            <th>交接单铅封</th>
            <th>现场铅封</th>
            <th>交接温度℃</th>
            <th>罐车表 L</th>
            <th>站内表 L</th>
            <th>折算预览</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(c, index) in form.compartments" :key="c.id">
            <td><input v-model="c.compartmentNo" placeholder="如 1仓" /></td>
            <td><input v-model="c.waybillSeal" placeholder="铅封号" /></td>
            <td>
              <input
                v-model="c.actualSeal"
                placeholder="铅封号"
                :class="{ bad: c.waybillSeal && c.actualSeal && c.waybillSeal !== c.actualSeal }"
              />
            </td>
            <td><input v-model.number="c.waybillTemp" type="number" step="0.1" /></td>
            <td><input v-model.number="c.truckGauge" type="number" min="0" step="0.01" /></td>
            <td><input v-model.number="c.stationGauge" type="number" min="0" step="0.01" /></td>
            <td class="preview">
              <template v-if="c.truckGauge && c.truckGauge > 0">
                <p :class="{ alert: analyzeCompartment(c).sealMismatch }">
                  系数 {{ fmtFactor(analyzeCompartment(c).factor) }}
                </p>
                <p :class="{ alert: analyzeCompartment(c).tempAlert }">
                  温差 {{ analyzeCompartment(c).tempDelta > 0 ? "+" : ""
                  }}{{ analyzeCompartment(c).tempDelta }}℃
                </p>
                <p :class="{ alert: analyzeCompartment(c).diffAlert }">
                  短溢 {{ fmtSigned(analyzeCompartment(c).diff) }}
                  ({{ fmtPercent(analyzeCompartment(c).diffRate) }})
                </p>
              </template>
              <span v-else class="muted">待录入</span>
            </td>
            <td>
              <button
                type="button"
                class="danger small"
                :disabled="form.compartments.length === 1"
                @click="removeCompartment(index)"
              >
                删仓
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="compartment-actions">
      <button type="button" class="secondary" @click="addCompartment">+ 添加一仓</button>
    </div>

    <label class="full-label">
      备注
      <textarea v-model="form.notes" placeholder="现场情况、异常说明等" />
    </label>

    <template v-if="mode === 'amend'">
      <div class="amend-box">
        <label>
          改单原因 <span class="req">*</span>
          <textarea v-model="amendReason" placeholder="旧版本将冻结保留，须说明改单原因" />
        </label>
        <label>
          改单人 <span class="req">*</span>
          <input v-model="amendBy" placeholder="姓名" />
        </label>
      </div>
    </template>

    <ul v-if="errors.length" class="errors">
      <li v-for="(err, i) in errors" :key="i">{{ err }}</li>
    </ul>

    <div class="form-footer">
      <button type="submit">{{ modeMeta.submit }}</button>
    </div>
  </form>
</template>
