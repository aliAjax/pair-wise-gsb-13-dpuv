<script setup lang="ts">
// 批次卡片：展示版本链、每仓折算与挂起原因；已复核只读，待复核可修正/复核/删除
import { computed, ref } from "vue";
import type { Batch } from "../types";
import {
  analyzeBatch,
  flagReasons,
} from "../lib/calc";
import {
  fmtDateTime,
  fmtFactor,
  fmtPercent,
  fmtSigned,
  fmtVolume,
} from "../lib/format";
import type { ReviewInput } from "../stores/batches";

const props = defineProps<{
  batch: Batch;
}>();

const emit = defineEmits<{
  (e: "edit", batch: Batch): void;
  (e: "amend", batch: Batch): void;
  (e: "review", id: string, input: ReviewInput): void;
  (e: "remove", id: string): void;
}>();

const selectedVersion = ref(props.batch.versions.length);
const version = computed(
  () => props.batch.versions[selectedVersion.value - 1]
);
const analysis = computed(() => analyzeBatch(version.value.data));
const current = computed(() => props.batch.versions[props.batch.versions.length - 1]);
const isFrozen = computed(() => current.value.status === "已复核");
// 查看历史版本时所有操作禁用，仅最新版本可操作
const viewingLatest = computed(
  () => selectedVersion.value === props.batch.versions.length
);

const showReview = ref(false);
const reviewForm = ref<ReviewInput>({ reviewer: "", responsibility: "", handling: "" });
const reviewError = ref("");

const RESPONSIBILITY_OPTIONS = ["运输方", "油站方", "计量误差", "待定责，挂账处理"];

function submitReview() {
  if (!reviewForm.value.reviewer.trim()) return (reviewError.value = "请填写复核人");
  if (!reviewForm.value.responsibility.trim())
    return (reviewError.value = "请填明责任归属");
  if (!reviewForm.value.handling.trim()) return (reviewError.value = "请填写处置意见");
  reviewError.value = "";
  emit("review", props.batch.id, { ...reviewForm.value });
  showReview.value = false;
  reviewForm.value = { reviewer: "", responsibility: "", handling: "" };
}

function confirmRemove() {
  if (confirm(`确认删除待复核批次 ${props.batch.code}？该操作不可恢复。`)) {
    emit("remove", props.batch.id);
  }
}
</script>

<template>
  <article class="record" :class="{ frozen: isFrozen && viewingLatest, history: !viewingLatest }">
    <div class="record-head">
      <div>
        <p class="record-title">
          {{ version.data.plate }}
          <span class="code">{{ batch.code }}</span>
          <span v-if="!viewingLatest" class="history-tag">查看历史版本 V{{ version.version }}</span>
        </p>
        <p class="sub">
          交接单 {{ version.data.waybillNo }} · 司机 {{ version.data.driver || "—" }}
          · 站长 {{ version.data.stationMaster || "—" }} · {{ version.data.deliveryDate }}
        </p>
      </div>
      <span class="status" :class="version.status === '已复核' ? 'ok' : 'hold'">
        {{ viewingLatest ? version.status : version.status + "（历史）" }}
      </span>
    </div>

    <div v-if="batch.versions.length > 1" class="version-bar">
      <span>版本：</span>
      <button
        v-for="v in batch.versions"
        :key="v.version"
        type="button"
        class="version-chip"
        :class="{ active: v.version === selectedVersion, posted: v.status === '已复核' }"
        @click="selectedVersion = v.version"
      >
        V{{ v.version }}
      </button>
      <span class="version-time">当前版本产生于 {{ fmtDateTime(version.createdAt) }}</span>
    </div>

    <div class="table-wrap">
      <table class="detail-table">
        <thead>
          <tr>
            <th>仓号</th>
            <th>交接单铅封</th>
            <th>现场铅封</th>
            <th>交接温度</th>
            <th>修正系数</th>
            <th>罐车表→折算20℃</th>
            <th>站内表→折算20℃</th>
            <th>短溢量/率</th>
            <th>校验</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in analysis.rows" :key="row.input.id" :class="{ 'row-flag': row.result.flagged }">
            <td>{{ row.input.compartmentNo }}</td>
            <td>{{ row.input.waybillSeal }}</td>
            <td :class="{ mismatch: row.result.sealMismatch }">
              {{ row.input.actualSeal }}
            </td>
            <td :class="{ mismatch: row.result.tempAlert }">
              {{ row.input.waybillTemp }}℃
              <small>({{ row.result.tempDelta > 0 ? "+" : "" }}{{ row.result.tempDelta }})</small>
            </td>
            <td>{{ fmtFactor(row.result.factor) }}</td>
            <td>{{ fmtVolume(row.input.truckGauge) }} → {{ fmtVolume(row.result.truckStd) }}</td>
            <td>{{ fmtVolume(row.input.stationGauge) }} → {{ fmtVolume(row.result.stationStd) }}</td>
            <td :class="{ mismatch: row.result.diffAlert }">
              {{ fmtSigned(row.result.diff) }}<br />
              <small>{{ fmtPercent(row.result.diffRate) }}</small>
            </td>
            <td>
              <span v-if="row.result.flagged" class="flag-list">
                <em v-for="reason in flagReasons(row.result)" :key="reason">{{ reason }}</em>
              </span>
              <span v-else class="pass">通过</span>
            </td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td colspan="5">合计</td>
            <td>{{ fmtVolume(analysis.totalTruckStd) }}</td>
            <td>{{ fmtVolume(analysis.totalStationStd) }}</td>
            <td :class="{ mismatch: Math.abs(analysis.totalDiffRate) > 0.005 }">
              {{ fmtSigned(analysis.totalDiff) }}<br />
              <small>{{ fmtPercent(analysis.totalDiffRate) }}</small>
            </td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </div>

    <p class="note">备注：{{ version.data.notes || "—" }}</p>

    <!-- 改单留痕 -->
    <div v-if="version.amendment" class="audit-box amend-audit">
      <strong>改单留痕（V{{ version.version }}）：</strong>
      原因：{{ version.amendment.reason }} ｜ 改单人：{{ version.amendment.amendedBy }}
      ｜ {{ fmtDateTime(version.amendment.amendedAt) }}
    </div>

    <!-- 复核信息 -->
    <div v-if="version.review" class="audit-box review-audit">
      <strong>复核入账：</strong>
      复核人 {{ version.review.reviewer }} ｜ 责任：{{ version.review.responsibility }}
      ｜ 处置：{{ version.review.review.handling }} ｜ {{ fmtDateTime(version.review.reviewedAt) }}
    </div>
    <div v-else-if="version.status === '已复核'" class="audit-box review-audit">
      <strong>自动入账：</strong>各项校验通过，于 {{ fmtDateTime(version.postedAt || version.createdAt) }} 入账
    </div>

    <!-- 挂起复核面板 -->
    <div v-if="version.status === '待复核' && viewingLatest" class="hold-banner">
      该批次命中验收红线，已挂起停收，须由复核人填明责任与处置后方可入账。
    </div>

    <div v-if="version.status === '待复核' && viewingLatest && showReview" class="review-panel">
      <div class="review-grid">
        <label>
          复核人 <span class="req">*</span>
          <input v-model="reviewForm.reviewer" placeholder="复核人姓名" />
        </label>
        <label>
          责任归属 <span class="req">*</span>
          <select v-model="reviewForm.responsibility">
            <option value="">请选择</option>
            <option v-for="opt in RESPONSIBILITY_OPTIONS" :key="opt">{{ opt }}</option>
          </select>
        </label>
        <label class="span-2">
          处置意见 <span class="req">*</span>
          <textarea v-model="reviewForm.handling" placeholder="如：短量由运输方赔付后入账 / 退回重新计量 / 挂账下期处理" />
        </label>
      </div>
      <p v-if="reviewError" class="error-text">{{ reviewError }}</p>
      <div class="review-actions">
        <button type="button" @click="submitReview">确认复核并入账（冻结）</button>
        <button type="button" class="secondary" @click="showReview = false">取消</button>
      </div>
    </div>

    <!-- 冻结提示 -->
    <div v-if="isFrozen && viewingLatest" class="frozen-banner">
      🔒 已复核批次已冻结，数据不可直接修改；如需更正请「改单」，系统另建版本并保留全部旧值。
    </div>

    <div v-if="viewingLatest" class="actions">
      <template v-if="version.status === '待复核'">
        <button type="button" @click="emit('edit', batch)">修正数据</button>
        <button type="button" class="review-btn" @click="showReview = !showReview">复核入账</button>
        <button type="button" class="danger" @click="confirmRemove">删除</button>
      </template>
      <template v-else>
        <button type="button" class="secondary" @click="emit('amend', batch)">改单（另建版本）</button>
      </template>
    </div>
  </article>
</template>
