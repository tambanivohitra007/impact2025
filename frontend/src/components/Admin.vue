<template>
  <div class="card w-100 shadow-sm h-100 d-flex flex-column">
    <div class="card-header bg-light p-3 flex-shrink-0">
      <h2 class="h5 mb-0 text-primary d-flex align-items-center">
        <SettingsIcon class="me-2" :size="22" /> Panneau Administrateur
      </h2>
    </div>

    <div class="card-body flex-grow-1 p-3 p-md-4" style="overflow-y: auto;">

      <div v-if="adminViewMode === 'list'">
        <div class="d-flex justify-content-between align-items-center mb-3">
          <h3 class="h6 mb-0 text-secondary d-flex align-items-center">
            <UsersIcon class="me-2" :size="20" /> Gestion des Utilisateurs
          </h3>
          <button class="btn btn-success btn-sm d-flex align-items-center" @click="showAddUserForm">
            <UserPlusIcon class="me-1" :size="16" /> Ajouter un Utilisateur
          </button>
        </div>

        <div v-if="loading.users" class="text-center py-5">
          <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">Chargement</span>
          </div>
          <p class="mt-2 text-muted">Chargement des Utilisateurs...</p>
        </div>
        <div v-else-if="error.users" class="alert alert-danger" role="alert">
          <AlertCircleIcon class="me-1" :size="16" /> {{ error.users }}
        </div>
        <div v-else-if="users.length === 0" class="text-center py-5 text-muted">
          <UsersIcon :size="48" class="mb-3 opacity-50" />
          <p>Aucun Utilisateurs trouvés</p>
        </div>
        <div v-else class="table-responsive">
          <table class="table table-hover table-sm align-middle">
            <thead class="table-light">
              <tr>
                <th scope="col">ID</th>
                <th scope="col">Nom</th>
                <th scope="col">Rôle</th>
                <th scope="col">Approbation</th>
                <th scope="col" class="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="user in users" :key="user.id">
                <td>{{ user.id }}</td>
                <td>{{ user.username }}</td>
                <td>
                  <span :class="['badge', user.role === 'admin' ? 'bg-primary' : 'bg-secondary']">
                    {{ user.role }}
                  </span>
                </td>
                <td>
                  <span v-if="user.approved" class="badge bg-success">Approuvé</span>
                  <span v-else class="badge bg-warning text-dark">En attente                    
                  </span>
                </td>
                <td class="text-end">
                  
                  <div class="btn-group btn-group-sm" role="group">
                    <button 
                      v-if="!user.approved" 
                      class="btn btn-sm btn-warning ms-2" 
                      @click="approveUser(user)" 
                      :disabled="saving.editUser">
                    <Check class="me-1" :size="14" />
                    </button>
                    <button
                      class="btn btn-outline-primary d-flex align-items-center"
                      @click="showEditUserForm(user)"
                      title="Edit User"
                      :disabled="saving.deleteUser || saving.editUser"
                    >
                      <Edit3Icon class="me-1" :size="14" />
                    </button>
                    <button
                      class="btn btn-outline-danger d-flex align-items-center"
                      @click="confirmDeleteUser(user)"
                      title="Delete User"
                      :disabled="saving.deleteUser || saving.editUser || user.id === loggedInUserId"
                    >
                      <TrashIcon class="me-1" :size="14" />
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div v-if="adminViewMode === 'addUser'" class="add-user-form-container">
        <div class="d-flex justify-content-between align-items-center mb-3">
            <h3 class="h6 mb-0 text-secondary d-flex align-items-center">
                <UserPlusIcon class="me-2" :size="20" /> Add New User
            </h3>
            <button class="btn btn-outline-secondary btn-sm" @click="showUserList">
                <ArrowLeftIcon :size="16" class="me-1" /> Back to List
            </button>
        </div>
        <form @submit.prevent="handleAddNewUser" class="border p-3 p-md-4 rounded bg-light shadow-sm">
          <div v-if="error.addUser" class="alert alert-danger py-2 small">
              {{ error.addUser }}
          </div>
          <div class="mb-3">
            <label for="newUsername" class="form-label">Username</label>
            <input type="text" class="form-control" id="newUsername" v-model="newUser.username" required :disabled="saving.addUser">
          </div>
          <div class="mb-3">
            <label for="newPassword" class="form-label">Password</label>
            <input type="password" class="form-control" id="newPassword" v-model="newUser.password" required :disabled="saving.addUser">
            <div class="form-text">Password must be at least 6 characters long.</div>
          </div>
           <div class="mb-3">
            <label for="confirmNewPassword" class="form-label">Confirm Password</label>
            <input type="password" class="form-control" id="confirmNewPassword" v-model="newUser.confirmPassword" required :disabled="saving.addUser">
          </div>
          <div class="mb-3">
            <label for="newUserRole" class="form-label">Role</label>
            <select class="form-select" id="newUserRole" v-model="newUser.role" :disabled="saving.addUser">
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div class="d-flex justify-content-end">
            <button type="button" class="btn btn-outline-secondary btn-sm me-2" @click="showUserList" :disabled="saving.addUser">Cancel</button>
            <button type="submit" class="btn btn-primary btn-sm d-flex align-items-center" :disabled="saving.addUser">
              <span v-if="saving.addUser" class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
              <SaveIcon v-else class="me-1" :size="16" />
              {{ saving.addUser ? 'Adding...' : 'Add User' }}
            </button>
          </div>
        </form>
      </div>

      <div v-if="adminViewMode === 'editUser' && editingUser" class="edit-user-form-container">
         <div class="d-flex justify-content-between align-items-center mb-3">
            <h3 class="h6 mb-0 text-secondary d-flex align-items-center">
                <Edit3Icon class="me-2" :size="20" /> Edit User: {{ editingUser.username }}
            </h3>
            <button class="btn btn-outline-secondary btn-sm" @click="showUserList">
                 <ArrowLeftIcon :size="16" class="me-1" /> Back to List
            </button>
        </div>
        <form @submit.prevent="handleUpdateUser" class="border p-3 p-md-4 rounded bg-light shadow-sm">
          <div v-if="error.editUser" class="alert alert-danger py-2 small">
              {{ error.editUser }}
          </div>
          <div class="mb-3">
            <label for="editUsername" class="form-label">Username</label>
            <input type="text" class="form-control" id="editUsername" v-model="editingUser.username" required :disabled="saving.editUser">
          </div>
          <div class="mb-3">
            <label for="editUserRole" class="form-label">Role</label>
            <select class="form-select" id="editUserRole" v-model="editingUser.role" :disabled="saving.editUser || editingUser.id === loggedInUserId">
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
             <div v-if="editingUser.id === loggedInUserId && editingUser.role !== 'admin'" class="form-text text-danger small mt-1">
              Warning: Changing your own role from admin might lock you out of admin functions if you are the only admin.
            </div>
             <div v-else-if="editingUser.id === loggedInUserId" class="form-text text-muted small mt-1">
              You are editing your own account. Be careful with role changes.
            </div>
          </div>
          <p class="form-text">Password changes should be done by the user via a "Forgot Password" feature or by an admin through a dedicated "Reset Password" function for security.</p>
          <div class="d-flex justify-content-end">
            <button type="button" class="btn btn-outline-secondary btn-sm me-2" @click="showUserList" :disabled="saving.editUser">Cancel</button>
            <button type="submit" class="btn btn-primary btn-sm d-flex align-items-center" :disabled="saving.editUser || !editingUser">
              <span v-if="saving.editUser" class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
              <SaveIcon v-else class="me-1" :size="16" />
              {{ saving.editUser ? 'Saving...' : 'Save Changes' }}
            </button>
          </div>
        </form>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue';
import {
    Settings as SettingsIcon,
    Users as UsersIcon,
    Trash2 as TrashIcon,
    UserPlus as UserPlusIcon,
    AlertCircle as AlertCircleIcon,
    Save as SaveIcon,
    Edit3 as Edit3Icon,
    ArrowLeft as ArrowLeftIcon,
    Check
} from 'lucide-vue-next';

const { notify } = useNotification(); // Destructure notify function

const props = defineProps({
  apiCall: {
    type: Function,
    required: true
  },
});

const adminViewMode = ref('list'); // 'list', 'addUser', 'editUser'

const users = ref([]);
const loading = reactive({
  users: false,
});
const saving = reactive({
    addUser: false,
    deleteUser: false,
    editUser: false,
});
const error = reactive({ // These are for form-specific errors displayed in alert divs
  users: null,
  addUser: null,
  deleteUser: null, // This might be better handled by a notification directly
  editUser: null,
});

const newUser = reactive({
  username: '',
  password: '',
  confirmPassword: '',
  role: 'user',
});

const editingUser = ref(null);

const loggedInUserId = computed(() => {
    const token = localStorage.getItem('authToken');
    if (token) {
        try {
            const payloadBase64 = token.split('.')[1];
            if (!payloadBase64) return null;
            const decodedPayload = JSON.parse(atob(payloadBase64));
            return decodedPayload.id;
        } catch (e) {
            console.error("Error decoding token for UI hint:", e);
            return null;
        }
    }
    return null;
});

const fetchUsers = async () => {
  loading.users = true;
  error.users = null;
  try {
    users.value = await props.apiCall('/admin/users', 'GET');
  } catch (err) {
    console.error("Failed to fetch users:", err);
    const errorMessage = err.response?.data?.error || err.message || 'Failed to load users.';
    error.users = errorMessage;
    notify({ type: "error", title: "Error Fetching Users", text: errorMessage });
  } finally {
    loading.users = false;
  }
};

const showUserList = () => {
    adminViewMode.value = 'list';
    editingUser.value = null;
    newUser.username = '';
    newUser.password = '';
    newUser.confirmPassword = '';
    newUser.role = 'user';
    error.addUser = null;
    error.editUser = null;
};

const showAddUserForm = () => {
  newUser.username = '';
  newUser.password = '';
  newUser.confirmPassword = '';
  newUser.role = 'user';
  error.addUser = null;
  adminViewMode.value = 'addUser';
};

const handleAddNewUser = async () => {
  // Client-side validation
  if (!newUser.username.trim() || !newUser.password || !newUser.confirmPassword) {
    error.addUser = "All fields are required.";
    notify({ type: "warn", title: "Validation Error", text: "All fields are required." });
    return;
  }
  if (newUser.password !== newUser.confirmPassword) {
    error.addUser = "Passwords do not match.";
    notify({ type: "warn", title: "Validation Error", text: "Passwords do not match." });
    return;
  }
  if (newUser.password.length < 6) {
    error.addUser = "Password must be at least 6 characters long.";
    notify({ type: "warn", title: "Validation Error", text: "Password must be at least 6 characters long." });
    return;
  }
  if (!['user', 'admin'].includes(newUser.role)) {
    error.addUser = "Invalid role selected.";
     notify({ type: "warn", title: "Validation Error", text: "Invalid role selected." });
    return;
  }
  error.addUser = null; // Clear form-specific error display
  saving.addUser = true;
  try {
    await props.apiCall('/admin/users', 'POST', {
      username: newUser.username,
      password: newUser.password,
      role: newUser.role,
    });
    notify({ type: "success", title: "User Added", text: `User "${newUser.username}" created successfully.` });
    await fetchUsers();
    showUserList();
  } catch (err) {
    console.error("Failed to add user:", err);
    const errorMessage = err.response?.data?.error || err.message || 'Failed to add user.';
    error.addUser = errorMessage; // For display in the form's alert div
    notify({ type: "error", title: "Add User Failed", text: errorMessage });
  } finally {
    saving.addUser = false;
  }
};

const showEditUserForm = (user) => {
  editingUser.value = { id: user.id, username: user.username, role: user.role };
  error.editUser = null;
  adminViewMode.value = 'editUser';
};

const handleUpdateUser = async () => {
  // Client-side validation
  if (!editingUser.value || !editingUser.value.username.trim()) {
    error.editUser = "Username cannot be empty.";
    notify({ type: "warn", title: "Validation Error", text: "Username cannot be empty." });
    return;
  }
  if (!['user', 'admin'].includes(editingUser.value.role)) {
    error.editUser = "Invalid role selected.";
    notify({ type: "warn", title: "Validation Error", text: "Invalid role selected." });
    return;
  }
  if (editingUser.value.id === loggedInUserId.value && editingUser.value.role === 'user') {
      const currentUserData = users.value.find(u => u.id === loggedInUserId.value);
      const otherAdminsExist = users.value.some(u => u.role === 'admin' && u.id !== loggedInUserId.value);
      if (currentUserData?.role === 'admin' && !otherAdminsExist) {
          const demoteError = "Cannot change the role of the only admin to 'user'.";
          error.editUser = demoteError;
          notify({ type: "error", title: "Update User Failed", text: demoteError });
          return;
      }
  }
  error.editUser = null; // Clear form-specific error display
  saving.editUser = true;
  try {
    await props.apiCall(`/admin/users/${editingUser.value.id}`, 'PUT', {
      username: editingUser.value.username,
      role: editingUser.value.role,
    });
    notify({ type: "success", title: "User Updated", text: `User "${editingUser.value.username}" updated successfully.` });
    await fetchUsers();
    showUserList();
  } catch (err) {
    console.error("Failed to update user:", err);
    const errorMessage = err.response?.data?.error || err.message || 'Failed to update user.';
    error.editUser = errorMessage; // For display in the form's alert div
    notify({ type: "error", title: "Update User Failed", text: errorMessage });
  } finally {
    saving.editUser = false;
  }
};

const confirmDeleteUser = async (user) => {
  if (user.id === loggedInUserId.value) {
    notify({ type: "warn", title: "Action Denied", text: "You cannot delete your own account using this interface." });
    return;
  }
  if (window.confirm(`Are you sure you want to delete the user "${user.username}" (Role: ${user.role})? This action cannot be undone.`)) {
    saving.deleteUser = true;
    // error.deleteUser = null; // Not using a dedicated error display for this, using notification
    try {
      await props.apiCall(`/admin/users/${user.id}`, 'DELETE');
      notify({ type: "success", title: "User Deleted", text: `User "${user.username}" deleted successfully.`});
      await fetchUsers();
      if (adminViewMode.value === 'editUser' && editingUser.value?.id === user.id) {
        showUserList();
      }
    } catch (err) {
      console.error("Failed to delete user:", err);
      const errorMessage = err.response?.data?.error || err.message || `Failed to delete user ${user.username}.`;
      // Removed alert(error.deleteUser);
      notify({ type: "error", title: "Delete User Failed", text: errorMessage });
    } finally {
      saving.deleteUser = false;
    }
  }
};

const approveUser = async (user) => {
  if (user.approved) return;
  saving.editUser = true;
  try {
    await props.apiCall(`/admin/users/${user.id}/approve`, 'PUT');
    notify({ type: "success", title: "User Approved", text: `User "${user.username}" has been approved.` });
    await fetchUsers();
  } catch (err) {
    console.error("Failed to approve user:", err);
    const errorMessage = err.response?.data?.error || err.message || 'Failed to approve user.';
    notify({ type: "error", title: "Approve User Failed", text: errorMessage });
  } finally {
    saving.editUser = false;
  }
};

const formatDateForDisplay = (dateString) => {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
        return dateString;
    }
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    return dateString;
  }
};

onMounted(() => {
  fetchUsers();
});

</script>

<style scoped>
.card-header h2.h5 {
    margin-bottom: 0 !important;
}
.table-sm th, .table-sm td {
    padding: 0.4rem;
    font-size: 0.875rem;
    vertical-align: middle;
}
.btn-sm .lucide {
    vertical-align: text-bottom;
}
.btn-group-sm > .btn .lucide {
    margin-right: 0.25rem;
}
.form-text {
    font-size: 0.8em;
}
.badge {
    vertical-align: middle;
}
.badge.bg-primary {
    background-color: var(--bs-primary) !important;
}
.badge.bg-secondary {
    background-color: var(--bs-secondary) !important;
}
.add-user-form-container, .edit-user-form-container {
    max-width: 600px;
    margin: 0 auto;
}
</style>
