<script setup>
import { ref, reactive } from 'vue';
import { AlertCircle } from 'lucide-vue-next'; // Icon for error messages

// --- Props ---
// saving: Boolean passed from parent to disable form during API calls
const props = defineProps({
  saving: Boolean,
});

// --- Emits ---
// save: Emits the session data payload when the form is submitted successfully
// cancel: Emits when the user cancels the form (e.g., closes the modal)
const emit = defineEmits(['save', 'cancel']);

// --- Helper Functions ---
// Helper to get today's date in YYYY-MM-DD format
const todayDateString = () => new Date().toLocaleDateString('en-CA');

// --- State ---
// Reactive object to hold the form data, initialized with today's date
const formData = reactive({
  session_date: todayDateString(),
  topic: '',
});
// Ref to store any validation or API errors for display
const formError = ref('');

// --- Methods ---
// Function to reset the form fields to their initial state
const resetForm = () => {
  formData.session_date = todayDateString();
  formData.topic = '';
  formError.value = ''; // Clear any previous errors
};

// Method called when the form is submitted (e.g., by clicking the Save button in the modal footer)
const submit = async () => {
  formError.value = ''; // Clear previous errors

  // Basic validation
  if (!formData.session_date) {
    formError.value = 'Session date is required.';
    return; // Stop submission if validation fails
  }
  // More robust date format validation
  if (!/^\d{4}-\d{2}-\d{2}$/.test(formData.session_date)) {
      formError.value = 'Invalid date format. Please use YYYY-MM-DD.';
      return;
  }

  // Prepare the data payload to be sent
  const dataToSave = {
    session_date: formData.session_date,
    topic: formData.topic.trim(), // Trim whitespace from topic
  };

  // Emit the 'save' event with the data. The parent component (App.vue)
  // will handle the actual API call and pass back any errors.
  const apiError = await emit('save', dataToSave);
  if (apiError) {
     // Handle specific duplicate date error message from backend
     if (apiError.toLowerCase().includes('already exists for this date') || apiError.toLowerCase().includes('unique constraint failed')) {
         formError.value = 'A session already exists for this date. Please choose a different date.';
    } else {
        formError.value = apiError; // Display other API errors returned from parent
    }
  } else {
      // Only reset form if the save was successful (no error returned)
      resetForm();
  }
};

// Expose the submit and resetForm methods so the parent component can trigger them
defineExpose({
  submit,
  resetForm // Expose reset if parent needs to manually reset it on modal open/close
});

</script>

<template>
  <form @submit.prevent="submit">
    <div v-if="formError" class="alert alert-danger d-flex align-items-center p-2 small" role="alert">
      <AlertCircle class="me-2 flex-shrink-0" :size="18" />
      <div>{{ formError }}</div>
    </div>

    <div class="mb-3">
      <label for="session-form-date" class="form-label">Session Date <span class="text-danger">*</span></label>
      <input
        id="session-form-date"
        type="date"
        v-model="formData.session_date"
        required
        class="form-control form-control-sm"
        :disabled="saving"
      >
    </div>

    <div class="mb-3">
      <label for="session-form-topic" class="form-label">Topic (Optional)</label>
      <input
        id="session-form-topic"
        v-model="formData.topic"
        type="text"
        placeholder="e.g., Genesis Chapter 1"
        class="form-control form-control-sm"
        :disabled="saving"
      >
    </div>

    </form>
</template>

<style scoped>
/* Add component-specific styles if necessary */
.form-label {
    font-weight: 500;
}
</style>
