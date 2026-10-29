# Vue 3 recipe

```vue
<script setup>
import { onMounted, onBeforeUnmount, shallowRef } from "vue";
import SDK from "@onlyoffice/docspace-sdk-js";

const props = defineProps({ portalUrl: String, frameId: { default: "ds-frame" } });
const instance = shallowRef(null);

onMounted(() => {
  instance.value = new SDK().initManager({
    frameId: props.frameId,
    src: props.portalUrl,
    events: {
      onAppReady: () => {},
      onAppError: (m) => console.error(m),
    },
  });
});

onBeforeUnmount(() => {
  instance.value?.destroyFrame();
  instance.value = null;
});
</script>

<template>
  <div :id="frameId" style="height: 700px" />
</template>
```

Key points:

- **`shallowRef`, not `ref`/`reactive`** — the SDK instance must not be wrapped in a deep
  reactive proxy (it holds an iframe and private state; proxying breaks `#`-private
  fields and wastes memory).
- Destroy in `onBeforeUnmount`; the container div must exist when `init*` runs, so init
  strictly in `onMounted`.
- To switch the embedded entity, prefer a `:key` on the component (full remount) over
  mutating config; or call `instance.setConfig({ id }, true)` for an in-place reload.
- Nuxt: the component must be client-only (`<ClientOnly>` or a `.client.vue` suffix) —
  the SDK module touches `window` at import time.
- Keep event handlers plain functions; don't pass template refs or reactive objects into
  `config.events`.
