<script setup lang="ts">
import { reactive, ref, watch } from "vue";
import type { UnloadBatch } from "../domain/types";
import { ISSUE_LABELS } from "../domain/types";

const props = defineProps<{
  batch: UnloadBatch | null;
}>();

const emit = defineEmits<{
  close: [];
  confirmed: [batchId: string, payload: { reviewer: string; responsibility: string; disposition: string }];
}>();

const RESPONSIBILITY_OPTIONS = ["承运方", "司机", "加油站", "计量器具", "共同承担", "无责（正常范围）"];

const form = reactive({
  reviewer: "",
  owner: RESPONSIBILITY_OPTIONS[0],
  responsibility: "",
  disposition: ""
});
const error = ref("");

watch(
  () => props.batch?.id,
  () => {
    form.reviewer = "";
    form.owner = RESPONSIBILITY_OPTIONS[0];
    form.responsibility = "";
    form.disposition = "";
    error.value = "";
  }
);

function confirm() {
  if (!props.batch) return;
  if (!form.reviewer.trim()) {
    error.value = "请填写复核人";
    return;
  }
  if (!form.responsibility.trim()) {
    error.value = "请填明责任认定与原因";
    return;
  }
  if (!form.disposition.trim()) {
    error.value = "请填写处置意见后才能入账";
    return;
  }
  emit("confirmed", props.batch.id, {
    reviewer: form.reviewer.trim(),
    responsibility: `${form.owner}：${form.responsibility.trim()}`,
    disposition: form.disposition.trim()
  });
}
</script>

<template>
  <div v-if="batch" class="modal-mask" @click.self="emit('close')">
    <div class="modal">
      <header class="modal-head">
        <h3>停待复核 · {{ batch.plate }} / {{ batch.batchNo }}</h3>
        <button class="secondary mini" type="button" @click="emit('close')">关闭</button>
      </header>

      <div class="modal-body">
        <div class="review-issues">
          <p class="review-tip">
            本批次命中停待条件，复核人填明责任和处置后才能入账：
          </p>
          <ul>
            <li v-for="code in batch.issues" :key="code">
              <i class="issue-tag">{{ ISSUE_LABELS[code] }}</i>
            </li>
          </ul>
          <p class="review-nums">
            交付 {{ batch.deliveredQty.toFixed(2) }}L ｜ 实收
            {{ batch.receivedQty.toFixed(2) }}L ｜ 短溢
            <b :class="batch.diffQty > 0 ? 'val-up' : 'val-down'">
              {{ batch.diffQty > 0 ? "+" : "" }}{{ batch.diffQty.toFixed(2) }}L
              （{{ (batch.diffRate * 100).toFixed(2) }}%）
            </b>
          </p>
        </div>

        <label>
          复核人 <i>*</i>
          <input v-model="form.reviewer" placeholder="姓名/职务，如 站长 陈立" />
        </label>
        <label>
          责任归属 <i>*</i>
          <select v-model="form.owner">
            <option v-for="item in RESPONSIBILITY_OPTIONS" :key="item">{{ item }}</option>
          </select>
        </label>
        <label>
          责任认定与原因 <i>*</i>
          <textarea v-model="form.responsibility" placeholder="说明异常原因、核查经过与责任认定"></textarea>
        </label>
        <label>
          处置意见 <i>*</i>
          <textarea v-model="form.disposition" placeholder="如：补偿/拒收/准予入账/上报公司等具体处置"></textarea>
        </label>

        <p v-if="error" class="form-error">{{ error }}</p>
      </div>

      <footer class="modal-foot">
        <button type="button" @click="confirm">复核通过并入账</button>
        <button type="button" class="secondary" @click="emit('close')">取消</button>
      </footer>
    </div>
  </div>
</template>
