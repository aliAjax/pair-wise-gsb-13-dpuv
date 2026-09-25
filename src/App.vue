<script setup lang="ts">
import { ref } from "vue";
import { useUnloadStore } from "./stores/unload";
import type { BatchDraft, UnloadBatch } from "./domain/types";
import { toDraft } from "./data/unloadRepository";
import UnloadForm from "./components/UnloadForm.vue";
import BatchCard from "./components/BatchCard.vue";
import ReviewDialog from "./components/ReviewDialog.vue";

const store = useUnloadStore();

const reviewTarget = ref<UnloadBatch | null>(null);
const amendTarget = ref<UnloadBatch | null>(null);
const amendDraft = ref<BatchDraft | null>(null);
const formKey = ref(0);
const flash = ref("");

function onSubmitted(draft: BatchDraft, reason: string) {
  if (amendTarget.value && amendDraft.value) {
    const versioned = store.amend(amendTarget.value, draft, reason);
    amendTarget.value = null;
    amendDraft.value = null;
    flash.value = `已另存为 v${versioned.version}，旧版冻结保留：${versioned.status === "held" ? "本版需复核后入账" : "本版已入账"}`;
  } else {
    const batch = store.saveNew(draft);
    flash.value =
      batch.status === "held"
        ? `批次 ${batch.batchNo} 命中停待条件，已停待，复核入账前不计账`
        : `批次 ${batch.batchNo} 验收合格，已入账`;
  }
  formKey.value += 1;
}

function startAmend(batch: UnloadBatch) {
  amendTarget.value = batch;
  amendDraft.value = toDraft(batch);
  formKey.value += 1;
  flash.value = "";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function cancelAmend() {
  amendTarget.value = null;
  amendDraft.value = null;
  formKey.value += 1;
}

function onReviewConfirmed(batchId: string, payload: {
  reviewer: string;
  responsibility: string;
  disposition: string;
}) {
  store.review(batchId, payload);
  reviewTarget.value = null;
  flash.value = "复核完成，本批次已入账";
}

function resetQuery() {
  store.query.plate = "";
  store.query.date = "";
  store.query.status = "all";
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
            按仓登记铅封、交接温度、罐车表与站内表，以 20℃ 为基准自动折算交付量；
            铅封不符、温差超 3℃ 或折算短溢超 0.5% 先停待复核，复核定责后入账；
            已复核批次冻结，改单带原因另建版本并保留旧值。
          </p>
        </div>
        <div class="stack">
          <span class="tag">Vue3</span>
          <span class="tag">TypeScript</span>
          <span class="tag">Element Plus</span>
          <span class="tag">本地持久化</span>
        </div>
      </header>

      <section class="metrics">
        <article class="metric">
          <span>批次（当前筛选）</span>
          <strong>{{ store.metrics.total }}</strong>
        </article>
        <article class="metric metric-held">
          <span>停待复核</span>
          <strong>{{ store.metrics.held }}</strong>
        </article>
        <article class="metric metric-posted">
          <span>已入账</span>
          <strong>{{ store.metrics.posted }}</strong>
        </article>
        <article class="metric">
          <span>已入账短溢合计 L</span>
          <strong :class="store.metrics.diff > 0 ? 'val-up' : 'val-down'">
            {{ store.metrics.diff > 0 ? "+" : "" }}{{ store.metrics.diff.toFixed(2) }}
          </strong>
        </article>
      </section>

      <UnloadForm
        :key="formKey"
        :mode="amendTarget ? 'amend' : 'create'"
        :initial="amendDraft ?? undefined"
        @submitted="onSubmitted"
        @cancelled="cancelAmend"
      />

      <p v-if="flash" class="flash">{{ flash }}</p>

      <section class="list-panel">
        <div class="toolbar">
          <h2>交接批次查询</h2>
          <div class="query-bar">
            <label class="query-item">
              车牌
              <input v-model="store.query.plate" placeholder="按车牌查询" />
            </label>
            <label class="query-item">
              日期
              <input v-model="store.query.date" type="date" />
            </label>
            <label class="query-item">
              状态
              <select v-model="store.query.status">
                <option value="all">全部</option>
                <option value="held">停待复核</option>
                <option value="posted">已入账</option>
              </select>
            </label>
            <button type="button" class="secondary" @click="resetQuery">重置</button>
          </div>
        </div>

        <div class="record-grid">
          <div v-if="store.filteredBatches.length === 0" class="empty">
            没有按车牌和日期查到批次，换个条件试试
          </div>
          <BatchCard
            v-for="batch in store.filteredBatches"
            :key="batch.id"
            :batch="batch"
            :versions="store.versionsOf(batch)"
            @review="reviewTarget = $event"
            @amend="startAmend"
          />
        </div>
      </section>

      <ReviewDialog
        :batch="reviewTarget"
        @close="reviewTarget = null"
        @confirmed="onReviewConfirmed"
      />
    </div>
  </main>
</template>
