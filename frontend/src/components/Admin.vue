<template>
  <div class="card w-100 shadow-sm h-100 d-flex flex-column">
    <div class="card-header bg-light p-3 flex-shrink-0">
      <h2 class="h5 mb-0 text-primary d-flex align-items-center">
        <SettingsIcon class="me-2" :size="22" /> Admin Settings
      </h2>
    </div>

    <div class="card-body flex-grow-1 d-flex flex-column justify-content-center align-items-center text-muted p-3" style="overflow-y: auto;">
      <template v-if="isEmpty">
        <SettingsIcon :size="48" class="mb-3 opacity-50" />
        <h4 class="text-muted">Admin Area</h4>
        <p class="text-muted small">This section is under construction or has no specific content to display </p>
        </template>
      <template v-else>
        <p>Admin features and settings will be displayed here.</p>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { Settings as SettingsIcon } from 'lucide-vue-next'; // Renamed to avoid conflict

// Example: Replace with actual logic to determine if admin content is present
// For now, we'll assume it's always showing the placeholder.
const isEmpty = ref(true);
</script>

<style scoped>
.card.h-100 {
  /* Ensures the card itself tries to take full height of its parent (.view-wrapper) */
}
.card-body {
  /* flex-grow-1 and d-flex setup handles content filling and centering */
}
.card-header h2.h5 {
    margin-bottom: 0 !important;
}
</style>