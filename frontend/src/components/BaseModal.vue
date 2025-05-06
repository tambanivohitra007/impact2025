<script setup>
// --- Start of the SINGLE script setup block ---
import { ref, onMounted, watch } from 'vue';
import bootstrap from 'bootstrap/dist/js/bootstrap.bundle.min.js';
import { X } from 'lucide-vue-next'; // For the close button icon

// --- Props ---
// Define what data this component accepts from the parent
const props = defineProps({
  show: Boolean,      // Controls visibility from the parent (used with v-model:show)
  title: String,      // Modal title text
  size: String,       // Optional size class (e.g., 'modal-lg', 'modal-sm')
  hideHeader: Boolean, // Option to hide the entire header section
  hideFooter: Boolean, // Option to hide the entire footer section
});

// --- Emits ---
// Define events this component can send back up to the parent
const emit = defineEmits([
    'close',        // Emitted when the modal requests to be closed (e.g., via button)
    'update:show'   // Used for v-model binding to sync the 'show' prop
]);

// --- State ---
// Reactive reference to the modal's root DOM element
const modalElementRef = ref(null);
// Reference to store the initialized Bootstrap 5 modal instance
const modalInstance = ref(null);

// --- Methods ---
// Function to initialize the Bootstrap modal JS instance
const initializeModal = () => {
  if (modalElementRef.value) {
    // Create a new Bootstrap modal instance associated with our DOM element
    modalInstance.value = new bootstrap.Modal(modalElementRef.value, {
      // Options (uncomment to customize):
      // backdrop: 'static', // Prevent closing on backdrop click
      // keyboard: false   // Prevent closing with the Escape key
    });

    // Listen for Bootstrap's 'hidden.bs.modal' event.
    // This event fires after the modal has finished hiding.
    modalElementRef.value.addEventListener('hidden.bs.modal', () => {
      // When Bootstrap hides the modal, notify the parent component
      // by emitting 'update:show' with false. This keeps the v-model sync correct.
      emit('update:show', false);
      // Also emit the generic 'close' event for other potential listeners
      emit('close');
    });

    // Optional: Listen for the 'shown.bs.modal' event if needed
    // modalElementRef.value.addEventListener('shown.bs.modal', () => {
    //   console.log('Bootstrap modal instance shown.');
    // });
  }
};

// Function to handle clicks on the header's close button (or any explicit close request)
const handleClose = () => {
  // Request the parent to hide the modal by emitting 'update:show' with false.
  // The watcher below will then call modalInstance.value.hide().
  emit('update:show', false);
};

// --- Lifecycle Hooks ---
// When the component is mounted to the DOM, initialize the Bootstrap modal JS
onMounted(() => {
  initializeModal();
});

// --- Watchers ---
// Watch the 'show' prop passed down from the parent component.
watch(() => props.show, (newValue) => {
  // If the modal instance exists (i.e., component is mounted)
  if (modalInstance.value) {
    // If the parent wants to show the modal (props.show becomes true)
    if (newValue) {
      modalInstance.value.show(); // Call Bootstrap's show method
    } else {
      // If the parent wants to hide the modal (props.show becomes false)
      modalInstance.value.hide(); // Call Bootstrap's hide method
    }
  }
});
// --- End of the SINGLE script setup block ---
</script>

<template>
  <div
    class="modal fade"
    ref="modalElementRef"
    tabindex="-1"
    :aria-labelledby="title ? 'modalTitle-' + title.replace(/\s+/g, '') : null"
    aria-hidden="true"
    data-bs-backdrop="static" data-bs-keyboard="false" >
    <div class="modal-dialog modal-dialog-centered" :class="size">
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
            @click="handleClose"
            aria-label="Close"
          ></button>
        </div>

        <div class="modal-body">
          <slot></slot>
        </div>

        <div v-if="!hideFooter" class="modal-footer">
           <slot name="footer">
            <button type="button" class="btn btn-secondary btn-sm" @click="handleClose">
                Close
             </button>
          </slot>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Add any component-specific styles here if needed */
.modal-header, .modal-footer {
   /* Example: Add a slightly lighter background */
   background-color: rgba(0, 0, 0, 0.03);
}
</style>