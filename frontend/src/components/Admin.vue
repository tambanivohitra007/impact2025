<template>
  <div class="app-wrapper bg-light min-vh-100 d-flex flex-column">
    <header class="py-3 py-md-4 text-center shadow-sm bg-white">
      <h1 class="h2 mb-1 d-flex align-items-center justify-content-center gap-2 text-primary">
        <span style="font-size: 2rem;">🔒</span> IMPACT 2025
      </h1>
      <p class="text-muted small mb-0">Participant & Attendance Tracker</p>
    </header>
    <div class="flex-grow-1"></div>
    <footer class="mt-auto pt-3 pb-3 text-center text-muted small bg-white border-top">
      IMPACT2025 - Madagascar &copy; {{ new Date().getFullYear() }}
    </footer>
  </div>
</template>

<script setup>
// Pas de logique spécifique pour cette page
</script>

<style scoped>
.app-wrapper {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}
</style> 