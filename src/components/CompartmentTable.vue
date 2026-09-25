<script setup lang="ts">
import type { CompartmentResult } from "../domain/types";
import { ISSUE_LABELS } from "../domain/types";

defineProps<{
  compartments: CompartmentResult[];
}>();

function pct(rate: number): string {
  return `${(rate * 100).toFixed(2)}%`;
}
</script>

<template>
  <div class="cmp-table">
    <div class="cmp-row cmp-head">
      <span>仓号</span>
      <span>交接单铅封</span>
      <span>现场铅封</span>
      <span>温度℃</span>
      <span class="num">罐车表L</span>
      <span class="num">折算20℃L</span>
      <span class="num">站内表L</span>
      <span class="num">短溢L</span>
      <span class="num">短溢率</span>
      <span>异常</span>
    </div>
    <div
      v-for="item in compartments"
      :key="item.id"
      class="cmp-row"
      :class="{ 'cmp-warn': item.issues.length > 0 }"
    >
      <span class="strong">{{ item.compartmentNo }}</span>
      <span>{{ item.sealDoc }}</span>
      <span :class="{ 'seal-bad': item.issues.includes('seal_mismatch') }">
        {{ item.sealOnSite }}
      </span>
      <span :class="{ 'val-bad': item.issues.includes('temp_exceed') }">
        {{ item.temp.toFixed(1) }}
        <em class="factor">系数 {{ item.factor.toFixed(4) }}</em>
      </span>
      <span class="num">{{ item.truckGauge.toFixed(0) }}</span>
      <span class="num">{{ item.stdTruckQty.toFixed(2) }}</span>
      <span class="num">{{ item.stationQty.toFixed(2) }}</span>
      <span class="num" :class="item.diffQty > 0 ? 'val-up' : item.diffQty < 0 ? 'val-down' : ''">
        {{ item.diffQty > 0 ? "+" : "" }}{{ item.diffQty.toFixed(2) }}
      </span>
      <span class="num" :class="item.issues.includes('variance_exceed') ? 'val-bad' : ''">
        {{ pct(item.diffRate) }}
      </span>
      <span class="issue-cell">
        <i v-for="code in item.issues" :key="code" class="issue-tag">{{ ISSUE_LABELS[code] }}</i>
        <em v-if="item.issues.length === 0" class="ok">正常</em>
      </span>
    </div>
  </div>
</template>
