<script setup lang="ts">
// 罐车卸油验收台 —— 页面编排（数据/计算/保存均在独立模块）
import { computed, ref } from "vue";
import { useBatchStore } from "./stores/batches";
import type { Batch, BatchData } from "./types";
import { analyzeBatch } from "./lib/calc";
import { fmtSigned, fmtVolume } from "./lib/format";
import UnloadForm, { type FormMode, type AmendMeta } from "./components/UnloadForm.vue";
import BatchCard from "./components/BatchCard.vue";

const store = useBatchStore();

// ---- 录入区状态 ----
const formMode = ref<FormMode | null>(null);
const editingId = ref<string | null>(null);
const formInitial = ref<BatchData | undefined>(undefined);

function openCreate() {
  formMode.value = "create";
  editingId.value = null;
  formInitial.value = undefined;
}

function openEdit(batch: Batch) {
  formMode.value = "edit";
  editingId.value = batch.id;
  formInitial.value = batch.versions[batch.versions.length - 1].data;
}

function openAmend(batch: Batch) {
  formMode.value = "amend";
  editingId.value = batch.id;
  formInitial.value = batch.versions[batch.versions.length - 1].data;
}

function closeForm() {
  formMode.value = null;
  editingId.value = null;
  formInitial.value = undefined;
}

const toast = ref("");
function showToast(msg: string) {
  toast.value = msg;
  window.setTimeout(() => (toast.value = ""), 3200);
}

function handleSubmit(data: BatchData, amendMeta?: AmendMeta) {
  if (formMode.value === "create") {
    const batch = store.createBatch(data);
    const status = store.currentOf(batch).status;
    showToast(
      status === "已复核"
        ? `批次 ${batch.code} 校验通过，已入账冻结`
        : `批次 ${batch.code} 命中验收红线，已挂起待复核`
    );
  } else if (formMode.value === "edit" && editingId.value) {
    const status = store.savePendingBatch(editingId.value, data);
    showToast(
      status === "已复核"
        ? "修正后校验通过，已自动入账冻结"
        : "修改已保存，仍存在异常，继续挂起待复核"
    );
  } else if (formMode.value === "amend" && editingId.value && amendMeta) {
    const status = store.amendBatch(editingId.value, { ...amendMeta, data });
    showToast(
      status === "已复核"
        ? "新版本校验通过，已入账；旧版本已冻结保留"
        : "新版本存在异常，已挂起待复核；旧版本已冻结保留"
    );
  }
  closeForm();
}

function handleReview(id: string, input: { reviewer: string; responsibility: string; handling: string }) {
  store.reviewBatch(id, input);
  showToast("已填明责任与处置，批次复核入账并冻结");
}

function handleRemove(id: string) {
  try {
    store.removeBatch(id);
    showToast("待复核批次已删除");
  } catch (e) {
    showToast(e instanceof Error ? e.message : "删除失败");
  }
}

// ---- 查询：按车牌 + 日期 + 状态，重开页面仍可查 ----
const queryPlate = ref("");
const queryDate = ref("");
const queryStatus = ref<"全部" | "待复核" | "已复核">("全部");

const filteredBatches = computed(() =>
  store.orderedBatches.filter((batch) => {
    const current = store.currentOf(batch);
    const d = current.data;
    if (queryPlate.value && !d.plate.toUpperCase().includes(queryPlate.value.trim().toUpperCase()))
      return false;
    if (queryDate.value && d.deliveryDate !== queryDate.value) return false;
    if (queryStatus.value !== "全部" && current.status !== queryStatus.value) return false;
    return true;
  })
);

// ---- 指标 ----
const metrics = computed(() => {
  const all = store.batches;
  const currents = all.map((b) => store.currentOf(b));
  const reviewed = currents.filter((v) => v.status === "已复核").length;
  const holding = currents.filter((v) => v.status === "待复核").length;
  const postedStd = currents
    .filter((v) => v.status === "已复核")
    .reduce((sum, v) => sum + analyzeBatch(v.data).totalStationStd, 0);
  const totalDiff = currents
    .filter((v) => v.status === "已复核")
    .reduce((sum, v) => sum + analyzeBatch(v.data).totalDiff, 0);
  return { total: all.length, reviewed, holding, postedStd, totalDiff };
});

const statusBars = computed(() => {
  const currents = store.batches.map((b) => store.currentOf(b));
  return (["待复核", "已复核"] as const).map((status) => ({
    status,
    value: currents.filter((v) => v.status === status).length,
  }));
});
const maxBar = computed(() => Math.max(1, ...statusBars.value.map((s) => s.value)));

function resetQuery() {
  queryPlate.value = "";
  queryDate.value = "";
  queryStatus.value = "全部";
}
</script>

<template>
  <main class="app">
    <div class="shell">
      <header class="topbar">
        <div>
          <p class="eyebrow">石油行业 · 罐车到站卸油</p>
          <h1>卸油验收台</h1>
          <p class="subtitle">
            按仓录入车牌、铅封、交接温度与罐车/站内双表读数，以 20℃ 为基准自动折算短溢；
            铅封不符、温差超 3℃ 或短溢超 0.5% 挂起待复核，复核定责后方可入账。
          </p>
        </div>
        <div class="stack">
          <span class="tag">Vue3</span>
          <span class="tag">Vite</span>
          <span class="tag">TypeScript</span>
          <span class="tag">版本留痕</span>
        </div>
      </header>

      <section class="metrics">
        <article class="metric">
          <span>验收批次</span>
          <strong>{{ metrics.total }}</strong>
        </article>
        <article class="metric">
          <span>待复核挂起</span>
          <strong class="warn-text">{{ metrics.holding }}</strong>
        </article>
        <article class="metric">
          <span>已复核冻结</span>
          <strong class="ok-text">{{ metrics.reviewed }}</strong>
        </article>
        <article class="metric">
          <span>入账实收（折算20℃）</span>
          <strong>{{ fmtVolume(metrics.postedStd) }}</strong>
        </article>
        <article class="metric">
          <span>入账累计短溢</span>
          <strong :class="metrics.totalDiff < 0 ? 'warn-text' : 'ok-text'">
            {{ fmtSigned(metrics.totalDiff) }}
          </strong>
        </article>
      </section>

      <section class="workspace wide">
        <!-- 左栏：录入 / 查询 -->
        <div class="side-col">
          <UnloadForm
            v-if="formMode"
            :mode="formMode"
            :initial="formInitial"
            @submit="handleSubmit"
            @cancel="closeForm"
          />

          <section v-else class="panel">
            <h2>批次查询</h2>
            <div class="query-grid">
              <label>
                车牌号
                <input v-model="queryPlate" placeholder="支持模糊查询" />
              </label>
              <label>
                交接日期
                <input v-model="queryDate" type="date" />
              </label>
              <label>
                状态
                <select v-model="queryStatus">
                  <option value="全部">全部</option>
                  <option value="待复核">待复核</option>
                  <option value="已复核">已复核</option>
                </select>
              </label>
            </div>
            <div class="query-actions">
              <button type="button" class="secondary small" @click="resetQuery">重置</button>
            </div>

            <button type="button" class="big-add" @click="openCreate">+ 新增卸油验收批次</button>

            <div class="mini-chart">
              <div v-for="row in statusBars" :key="row.status" class="bar">
                <span>{{ row.status }}</span>
                <div class="bar-track">
                  <div
                    class="bar-fill"
                    :class="row.status === '待复核' ? 'hold-fill' : ''"
                    :style="{ width: `${(row.value / maxBar) * 100}%` }"
                  />
                </div>
                <strong>{{ row.value }}</strong>
              </div>
            </div>

            <p class="persist-hint">数据保存在本机浏览器，重开页面可继续按车牌与日期查询。</p>
          </section>
        </div>

        <!-- 右栏：批次列表 -->
        <section class="list-panel">
          <div class="toolbar">
            <h2>验收批次列表</h2>
            <span class="result-count">共 {{ filteredBatches.length }} 条</span>
          </div>

          <div class="record-grid">
            <div v-if="filteredBatches.length === 0" class="empty">
              暂无匹配批次，可调整查询条件或新增验收
            </div>
            <BatchCard
              v-for="batch in filteredBatches"
              :key="batch.id"
              :batch="batch"
              @edit="openEdit"
              @amend="openAmend"
              @review="handleReview"
              @remove="handleRemove"
            />
          </div>
        </section>
      </section>
    </div>

    <transition name="fade">
      <div v-if="toast" class="toast">{{ toast }}</div>
    </transition>
  </main>
</template>
