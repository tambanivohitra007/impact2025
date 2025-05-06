<script setup>
import { ref, reactive, computed, watch } from 'vue';
import { AlertCircle } from 'lucide-vue-next'; // Icon for error messages

// --- Props ---
// initialParticipant: Object passed when editing (null/undefined for adding)
// participants: Full list needed for the 'Referred By' dropdown
// saving: Boolean passed from parent to disable form during API calls
const props = defineProps({
  initialParticipant: Object,
  participants: {
    type: Array,
    default: () => [] // Default to empty array if not provided
  },
  saving: Boolean,
});

// --- Emits ---
// save: Emits the participant data payload when the form is submitted successfully
// cancel: Emits when the user cancels the form (e.g., closes the modal)
const emit = defineEmits(['save', 'cancel']);

// --- State ---
// Reactive object to hold the form data
const formData = reactive({
  id: null,
  name: '',
  contact_info: '',
  date_joined: '',
  referred_by_participant_id: '',
});
// Ref to store any validation or API errors for display
const formError = ref('');

// --- Helper Functions ---
// Helper to format date to YYYY-MM-DD for the date input
const formatDateForInput = (dateString) => {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    // Adjust for timezone offset when creating the date string
    const offset = date.getTimezoneOffset() * 60000;
    const adjustedDate = new Date(date.getTime() + offset);
    return adjustedDate.toLocaleDateString('en-CA'); // YYYY-MM-DD format
  } catch (e) {
    console.error("Error formatting date for input:", dateString, e);
    return '';
  }
};

// Helper to get today's date in YYYY-MM-DD format
const todayDateString = () => new Date().toLocaleDateString('en-CA');

// Function to reset the form fields based on the initialParticipant prop
const resetForm = (participant) => {
  formData.id = participant?.id || null;
  formData.name = participant?.name || '';
  formData.contact_info = participant?.contact_info || '';
  formData.date_joined = formatDateForInput(participant?.date_joined) || todayDateString();
  formData.referred_by_participant_id = participant?.referred_by_participant_id || '';
  formError.value = ''; // Clear any previous errors
};

// --- Watchers ---
// Watch the initialParticipant prop. When it changes (e.g., modal opens for edit/add),
// reset the form data accordingly. 'immediate: true' ensures it runs on initial mount.
watch(() => props.initialParticipant, (newVal) => {
  resetForm(newVal);
}, { immediate: true, deep: true }); // deep might be needed if initialParticipant is complex

// --- Computed Properties ---
// Filter the participants list to exclude the person being edited from the 'Referred By' dropdown
const availableReferrers = computed(() => {
  return props.participants.filter(p => p.id !== formData.id);
});

// --- Methods ---
// Method called when the form is submitted (e.g., by clicking the Save button in the modal footer)
const submit = async () => {
  formError.value = ''; // Clear previous errors

  // Basic validation
  if (!formData.name.trim()) {
    formError.value = 'Participant name cannot be empty.';
    return; // Stop submission if validation fails
  }
  if (!formData.date_joined) {
      formError.value = 'Date joined cannot be empty.';
      return;
  }

  // Prepare the data payload to be sent
  const dataToSave = {
    name: formData.name.trim(),
    contact_info: formData.contact_info.trim(),
    date_joined: formData.date_joined,
    // Ensure referred_by ID is an integer or null
    referred_by_participant_id: formData.referred_by_participant_id
                                  ? parseInt(formData.referred_by_participant_id, 10)
                                  : null,
  };

  // Emit the 'save' event with the data. The parent component (App.vue)
  // will handle the actual API call and pass back any errors.
  // We capture the potential error message returned by the parent.
  const apiError = await emit('save', dataToSave);
  if (apiError) {
    formError.value = apiError; // Display API error returned from parent
  }
  // Note: Form reset/modal close is handled by the parent upon successful save
};

// Expose the submit method so the parent component (modal footer) can trigger it
defineExpose({
  submit
});

</script>

<template>
  <form @submit.prevent="submit">
    <div v-if="formError" class="alert alert-danger d-flex align-items-center p-2 small" role="alert">
      <AlertCircle class="me-2 flex-shrink-0" :size="18" />
      <div>{{ formError }}</div>
    </div>

    <div class="mb-3">
      <label for="part-form-name" class="form-label">Name <span class="text-danger">*</span></label>
      <input
        id="part-form-name"
        v-model="formData.name"
        type="text"
        required
        class="form-control form-control-sm"
        :disabled="saving"
      >
    </div>

    <div class="mb-3">
      <label for="part-form-contact" class="form-label">Contact Info (Phone/Email)</label>
      <input
        id="part-form-contact"
        v-model="formData.contact_info"
        type="text"
        class="form-control form-control-sm"
        :disabled="saving"
      >
    </div>

    <div class="mb-3">
      <label for="part-form-joined" class="form-label">Date Joined <span class="text-danger">*</span></label>
      <input
        id="part-form-joined"
        type="date"
        v-model="formData.date_joined"
        required
        class="form-control form-control-sm"
        :disabled="saving"
      >
    </div>

    <div class="mb-3">
      <label for="part-form-referrer" class="form-label">Referred By</label>
      <select
        id="part-form-referrer"
        v-model="formData.referred_by_participant_id"
        class="form-select form-select-sm"
        :disabled="saving"
      >
        <option value="">-- None --</option>
        <option v-for="p in availableReferrers" :key="p.id" :value="p.id">
          {{ p.name }}
        </option>
      </select>
    </div>

    </form>
</template>

<style scoped>
/* Add component-specific styles if necessary */
.form-label {
    font-weight: 500; /* Slightly bolder labels */
}
</style>
