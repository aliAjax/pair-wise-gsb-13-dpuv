<script setup lang="ts">
import { ref } from "vue";
import type { UnloadBatch } from "../domain/types";
import { ISSUE_LABELS } from "../domain/types";
import CompartmentTable from "./CompartmentTable.vue";

const props = defineProps<{
  batch: UnloadBatch;
  versions: UnloadBatch[];
}>();

const emit = defineEmits<{
  review: [batch: UnloadBatch];
  amend: [batch: UnloadBatch];
}>();

const showVersions = ref(false);
const showOld = ref<string | null>(null);

function pct(rate: number): string {
  return `${(rate * 100).toFixed(2)}%`;
}

const oldVersions = () => props.versions.filter((item) => item.id !== props.batch.id);
const viewingOld = () => props.versions.find((item) => item.id === showOld.value) ?? null;
</script>

<template>
  <article class="record" :class="{ 'is-held': batch.status === 'held' }">
    <div class="record-head">
      <div>
        <p class="record-title">
          {{ batch.plate }}
          <span class="batch-no">{{ batch.batchNo }}</span>
          <i v-if="batch.version > 1" class="version-badge">v{{ batch.version }}</i>
        </p>
        <p class="record-meta">
          {{ batch.unloadDate }} ｜ 交接单 {{ batch.waybillNo }} ｜ 司机 {{ batch.driver }} ｜
          站长 {{ batch.stationMaster }}
        </p>
      </div>
      <span class="status" :class="batch.status === 'held' ? 'status-held' : 'status-posted'">
        {{ batch.status === "held" ? "停待复核" : "已入账" }}
      </span>
    </div>

    <CompartmentTable :compartments="batch.compartments" />

    <div class="sum-line">
      <span>交付（20℃）<strong>{{ batch.deliveredQty.toFixed(2) }}L</strong></span>
      <span>实收 <strong>{{ batch.receivedQty.toFixed(2) }}L</strong></span>
      <span>
        短溢
        <strong :class="batch.diffQty > 0 ? 'val-up' : batch.diffQty < 0 ? 'val-down' : ''">
          {{ batch.diffQty > 0 ? "+" : "" }}{{ batch.diffQty.toFixed(2) }}L
          （{{ pct(batch.diffRate) }}）
        </strong>
      </span>
      <span v-if="batch.issues.length" class="issue-line">
        <i v-for="code in batch.issues" :key="code" class="issue-tag">{{ ISSUE_LABELS[code] }}</i>
      </span>
    </div>

    <div v-if="batch.status === 'held'" class="review-block">
      <p>⚠ 已停待，尚未入账。须由复核人填明责任与处置后方可入账。</p>
      <button type="button" @click="emit('review', batch)">填写复核 / 入账</button>
    </div>

    <div v-else class="review-block posted">
      <template v-if="batch.review">
        <p>
          复核人：{{ batch.review.reviewer }} ｜ 责任：{{ batch.review.responsibility }}
        </p>
        <p>处置：{{ batch.review.disposition }}</p>
      </template>
      <p v-else class="frozen-note">✓ 指标正常，保存时直接入账（{{ batch.updatedAt.slice(0, 16).replace("T", " ") }}）</p>
      <p class="frozen-note">🔒 已复核批次已冻结，不得直接改单。</p>
      <button type="button" class="secondary" @click="emit('amend', batch)">改单（另建版本）</button>
    </div>

    <div v-if="batch.amendReason" class="amend-note">
      本版改单原因：{{ batch.amendReason }}
    </div>

    <div v-if="versions.length > 1" class="version-box">
      <button type="button" class="link-btn" @click="showVersions = !showVersions">
        {{ showVersions ? "收起版本记录" : `版本记录（共 ${versions.length} 版）` }}
      </button>
      <div v-if="showVersions" class="version-list">
        <div
          v-for="item in versions"
          :key="item.id"
          class="version-item"
          :class="{ active: item.id === batch.id }"
        >
          <span>v{{ item.version }}</span>
          <span>{{ item.status === "held" ? "停待复核" : "已入账" }}</span>
          <span>短溢 {{ item.diffQty > 0 ? "+" : "" }}{{ item.diffQty.toFixed(2) }}L</span>
          <span>{{ item.updatedAt.slice(0, 16).replace("T", " ") }}</span>
          <button
            v-if="item.id !== batch.id"
            type="button"
            class="link-btn"
            @click="showOld = showOld === item.id ? null : item.id"
          >
            {{ showOld === item.id ? "关闭旧值" : "查看旧值" }}
          </button>
          <em v-else class="ok">当前版本</em>
        </div>
        <div v-if="viewingOld()" class="old-snapshot">
          <p class="frozen-note">以下为 v{{ viewingOld()!.version }} 冻结旧值，仅供查阅：</p>
          <CompartmentTable :compartments="viewingOld()!.compartments" />
          <p v-if="viewingOld()!.amendReason" class="amend-note">
            该版之后的改单原因：{{ viewingOld()!.amendReason }}
          </p>
        </div>
      </div>
    </div>
  </article>
</template>
