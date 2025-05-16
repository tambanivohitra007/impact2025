<script setup>
import { ref, onMounted, watch, onBeforeUnmount } from 'vue'; // Added onBeforeUnmount
import bootstrap from 'bootstrap/dist/js/bootstrap.bundle.min.js';
// import { X } from 'lucide-vue-next'; // Not used in template, can be removed if not needed elsewhere

const props = defineProps({
  show: Boolean,
  title: String,
  size: String,
  hideHeader: Boolean,
  hideFooter: Boolean,
  persistentBackdrop: { // New prop to control backdrop behavior
    type: Boolean,
    default: false, // Default is to close on backdrop click
  }
});

const emit = defineEmits(['close', 'update:show']);

const modalElementRef = ref(null);
const modalInstance = ref(null);

const initializeModal = () => {
  if (modalElementRef.value && props.show) { // Only initialize if shown and element exists
    if (modalInstance.value) { // Dispose existing instance if any
        modalInstance.value.dispose();
    }
    modalInstance.value = new bootstrap.Modal(modalElementRef.value, {
      backdrop: props.persistentBackdrop ? 'static' : true, // 'static' prevents closing on click
      keyboard: !props.persistentBackdrop, // Allow Esc key if not persistent
    });

    modalElementRef.value.addEventListener('hidden.bs.modal', handleBootstrapHideEvent);
    modalInstance.value.show(); // Show it since props.show is true
  }
};

const destroyModal = () => {
    if (modalInstance.value) {
        // Remove event listener before disposing to prevent errors
        if (modalElementRef.value) {
            modalElementRef.value.removeEventListener('hidden.bs.modal', handleBootstrapHideEvent);
        }
        modalInstance.value.dispose();
        modalInstance.value = null;
    }
    // Ensure body class is removed if modal is destroyed while shown
    if (typeof document !== 'undefined' && document.body.classList.contains('modal-open')) {
        document.body.classList.remove('modal-open');
    }
};

const handleBootstrapHideEvent = () => {
  // This is called by Bootstrap AFTER it has hidden the modal
  // So, we just sync the parent's state.
  emit('update:show', false);
  emit('close');
};

const handleCloseRequest = () => {
  // This is called by our UI elements (close button, footer button)
  // It tells the parent to set `show` to false.
  // The watcher will then call modalInstance.value.hide().
  emit('update:show', false);
};


watch(() => props.show, (newValue, oldValue) => {
  if (newValue) {
    // If props.show becomes true, and modal element is ready (due to v-if)
    // We need to ensure the modal is initialized and then shown.
    // Using nextTick to ensure DOM is updated by v-if before initializing.
    if (typeof requestAnimationFrame === 'function') { // Prefer requestAnimationFrame for smoother rendering
        requestAnimationFrame(() => {
            if (modalElementRef.value) initializeModal();
        });
    } else { // Fallback for older environments
        setTimeout(() => { // Fallback to ensure DOM is ready
            if (modalElementRef.value) initializeModal();
        }, 0);
    }
  } else {
    // If props.show becomes false, and modal instance exists
    if (modalInstance.value) {
      modalInstance.value.hide();
    }
  }
}, { immediate: false }); // No immediate needed, v-if handles initial state

// Clean up Bootstrap modal instance and body class when component is unmounted
onBeforeUnmount(() => {
  destroyModal();
});

// Handle body class for scrollbar when modal is open/closed by Bootstrap's show/hide
// This is more robust if Bootstrap's events are used.
watch(() => props.show, (newValue) => {
    if (typeof document !== 'undefined') {
        if (newValue) {
            // Bootstrap's JS usually handles adding 'modal-open' when its .show() is called.
            // However, if we are managing display with v-if, we might need to manage it.
            // For this version, we let Bootstrap's .show() method handle it.
        } else {
            // If the modal is hidden via v-if, ensure the class is removed.
            // Bootstrap's 'hidden.bs.modal' event should also trigger this.
            if (document.body.classList.contains('modal-open') && !document.querySelector('.modal.show')) {
                 document.body.classList.remove('modal-open');
            }
        }
    }
});

</script>

<template>
  <template v-if="props.show">
    <div
      class="modal fade" ref="modalElementRef"
      tabindex="-1"
      :aria-labelledby="title ? 'modalTitle-' + title.replace(/\s+/g, '') : null"
      aria-hidden="true"
      ><div class="modal-dialog modal-dialog-centered" :class="size">
        <div class="modal-content">
          <div v-if="!hideHeader" class="modal-header">
            <h5
              v-if="title"
              class="modal-title"
              :id="title ? 'modalTitle-' + title.replace(/\s+/g, '') : null"
            >
              {{ title }}
            </h5>
            <button
              type="button"
              class="btn-close"
              @click="handleCloseRequest"
              aria-label="Close"
            ></button>
          </div>

          <div class="modal-body">
            <slot></slot> </div>

          <div v-if="!hideFooter && $slots.footer" class="modal-footer">
            <slot name="footer"></slot> </div>
          <div v-else-if="!hideFooter && !$slots.footer" class="modal-footer">
            <button type="button" class="btn btn-secondary btn-sm" @click="handleCloseRequest">
                Close
            </button>
          </div>
        </div>
      </div>
    </div>
    </template>
</template>

<style scoped>
/* Add any component-specific styles here if needed */
.modal-header, .modal-footer {
   /* Example: Add a slightly lighter background */
   /* background-color: rgba(0, 0, 0, 0.03); */ /* Keep Bootstrap defaults or customize as needed */
}
/* Ensure modal is displayed correctly when .show is added by Bootstrap JS */
.modal.fade.show {
    display: block;
}
</style>
