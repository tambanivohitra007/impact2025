<script setup>
import { ref, watch } from 'vue';
import { UserPlus, XCircle, CheckCircle2 } from 'lucide-vue-next'; // Optional: for icons

// Props passed from App.vue
const props = defineProps({
  loading: {
    type: Boolean,
    default: false,
  },
  // This prop will receive error messages from App.vue (e.g., from API calls)
  externalErrorMessage: {
    type: String,
    default: '',
  }
});

const username = ref('');
const password = ref('');
const confirmPassword = ref('');
// For client-side validation errors
const clientErrorMessage = ref('');

// Watch for external error messages and clear client-side ones
watch(() => props.externalErrorMessage, (newValue) => {
  if (newValue) {
    clientErrorMessage.value = ''; // Clear client error if server error appears
  }
});

// Define the events this component can emit
const emit = defineEmits(['register', 'cancel']);

const handleSubmitRegistration = () => {
  // Basic client-side validation
  if (!username.value.trim() || !password.value || !confirmPassword.value) {
    clientErrorMessage.value = 'Please fill in all fields.';
    return;
  }
  if (password.value !== confirmPassword.value) {
    clientErrorMessage.value = 'Passwords do not match.';
    return;
  }
  if (password.value.length < 6) {
    clientErrorMessage.value = 'Password must be at least 6 characters long.';
    return;
  }
  clientErrorMessage.value = ''; // Clear any previous client-side error

  // Emit the 'register' event with an object containing username and password
  emit('register', { username: username.value, password: password.value });
};

const handleCancelRegistration = () => {
  clientErrorMessage.value = ''; // Clear errors when cancelling
  emit('cancel');
};
</script>

<template>
  <div class="card shadow-sm">
    <div class="card-body p-4 p-md-5">
      <h2 class="card-title text-center mb-4 fw-bold">
        <UserPlus :size="32" class="me-2 text-primary" /> S'inscrire
      </h2>

      <div v-if="props.externalErrorMessage" class="alert alert-danger py-2 small mb-3" role="alert">
        {{ props.externalErrorMessage }}
      </div>
      <div v-if="clientErrorMessage" class="alert alert-warning py-2 small mb-3" role="alert">
        {{ clientErrorMessage }}
      </div>

      <form @submit.prevent="handleSubmitRegistration">
        <div class="mb-3">
          <label for="registerUsername" class="form-label">Nom</label>
          <input
            type="text"
            class="form-control form-control-md"
            id="registerUsername"
            v-model="username"
            placeholder="Choisissez un nom d'utilisateur"
            required
            :disabled="props.loading"
          />
        </div>

        <div class="mb-3">
          <label for="registerPassword" class="form-label">Mot de Passe</label>
          <input
            type="password"
            class="form-control form-control-md"
            id="registerPassword"
            v-model="password"
            placeholder="Mot de passe d'au moins 6 caractères"
            required
            :disabled="props.loading"
          />
        </div>

        <div class="mb-3">
          <label for="confirmPassword" class="form-label">Confirmation</label>
          <input
            type="password"
            class="form-control form-control-md"
            id="confirmPassword"
            v-model="confirmPassword"
            placeholder="Confirmer votre mot de passe"
            required
            :disabled="props.loading"
          />
        </div>

        <div class="d-grid gap-2 mb-3">
          <button
            type="submit"
            class="btn btn-success btn-md d-flex align-items-center justify-content-center"
            :disabled="props.loading"
          >
            <span v-if="props.loading" class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
            <CheckCircle2 v-else :size="20" class="me-2" />
            {{ props.loading ? 'Registering...' : 'Register' }}
          </button>
          <button
            type="button"
            class="btn btn-outline-secondary btn-md d-flex align-items-center justify-content-center"
            @click="handleCancelRegistration"
            :disabled="props.loading"
          >
            <XCircle :size="20" class="me-2" />
            Cancel
          </button>
        </div>
      </form>
       <div class="text-center mt-2">
        <p class="mb-0">
          Avez-vous déjà un compte?
          <button
            type="button"
            class="btn btn-link p-0 align-baseline"
            @click="handleCancelRegistration"
            :disabled="props.loading"
          >
             Se connecter Ici
          </button>
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Scoped styles can be kept minimal if Bootstrap is handling most of it */
.card {
  border: none; /* Remove default card border if using shadow for elevation */
}
.btn-link {
  text-decoration: none;
  font-weight: 500;
}
.btn-link:hover {
  text-decoration: underline;
}
/* Ensure icons are vertically aligned with button text */
.btn .lucide {
  vertical-align: middle;
}
</style>
