<script setup>
import { ref, watch } from 'vue';
import { ShieldCheck, UserPlus, LogIn } from 'lucide-vue-next'; // Optional: for icons
import logo from '../assets/impact.png'; // Import the logo

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
// For client-side validation errors (e.g., empty fields)
const clientErrorMessage = ref('');

// Watch for external error messages and clear client-side ones
watch(() => props.externalErrorMessage, (newValue) => {
  if (newValue) {
    clientErrorMessage.value = ''; // Clear client error if server error appears
  }
});


// Define the events this component can emit
// 'login' will carry the credentials object
// 'show-register-form' will signal App.vue to switch to RegistrationView
const emit = defineEmits(['login', 'show-register-form']);

const handleLoginSubmit = () => {
  // Basic client-side validation
  if (!username.value.trim() || !password.value) {
    clientErrorMessage.value = 'Please enter both username and password.';
    return;
  }
  clientErrorMessage.value = ''; // Clear any previous client-side error

  // Emit the 'login' event with an object containing username and password
  emit('login', { username: username.value, password: password.value });
};

const requestRegistrationView = () => {
  clientErrorMessage.value = ''; // Clear errors when switching view
  // Emit the event to tell App.vue to show the registration form
  emit('show-register-form');
};
</script>

<template>
  <div class="card shadow-sm">
    <div class="card-body p-4 p-md-5">
      <div class="text-center mb-4">
        <img :src="logo" alt="Logo" style="width: 100px; height: auto;">
      </div>
      <h2 class="card-title text-center mb-4 fw-bold">
        Se Connecter
      </h2>

      <div v-if="props.externalErrorMessage" class="alert alert-danger py-2 small mb-3" role="alert">
        {{ props.externalErrorMessage }}
      </div>
      <div v-if="clientErrorMessage" class="alert alert-warning py-2 small mb-3" role="alert">
        {{ clientErrorMessage }}
      </div>

      <form @submit.prevent="handleLoginSubmit">
        <div class="mb-3">
          <label for="loginUsername" class="form-label">Utilisateur</label>
          <input
            type="text"
            class="form-control form-control-lg"
            id="loginUsername"
            v-model="username"
            placeholder="Enter your username"
            required
            :disabled="props.loading"
          />
        </div>

        <div class="mb-3">
          <label for="loginPassword" class="form-label">Mot de passe</label>
          <input
            type="password"
            class="form-control form-control-lg"
            id="loginPassword"
            v-model="password"
            placeholder="Enter your password"
            required
            :disabled="props.loading"
          />
        </div>

        <div class="d-grid gap-2 mb-3">
          <button
            type="submit"
            class="btn btn-primary btn-lg d-flex align-items-center justify-content-center"
            :disabled="props.loading"
          >
            <span v-if="props.loading" class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
            <LogIn v-else :size="20" class="me-2" />
            {{ props.loading ? 'Logging in...' : 'Login' }}
          </button>
        </div>
      </form>

      <div class="text-center">
        <p class="mb-0">
          Avez-vous un compte?
          <button
            type="button"
            class="btn btn-link p-0 align-baseline"
            @click="requestRegistrationView"
            :disabled="props.loading"
          >
             S'inscrire Ici
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