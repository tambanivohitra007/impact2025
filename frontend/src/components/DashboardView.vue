<script setup>
import { ref, computed, onMounted, nextTick, watch } from 'vue';
import { Users, TrendingUp, Award, MapPin, BarChart2, UserPlus, CalendarCheck, AlertCircle } from 'lucide-vue-next';
import Chart from 'chart.js/auto';
import 'chartjs-adapter-date-fns'; // Import the date adapter

// --- Props (if you decide to pass apiCall function later) ---
// const props = defineProps({
//   apiCall: {
//     type: Function,
//     required: true // If you centralize API calls
//   }
// });

// --- State ---
const stats = ref({
  totalParticipants: 0,
  attendanceBySession: [],
  topReferrers: [],
  perfectAttendance: [],
  todayAttendanceByLocality: [],
  newParticipantsByDay: [],
  futureBaptisms: [], // Added this to stats object for consistency
});

const totalPresentToday = computed(() => {
  return stats.value.todayAttendanceByLocality?.reduce((sum, row) => sum + row.present_count, 0) || 0;
});

// Removed baptismInterested as a separate ref, merged into stats.value.futureBaptisms
const showBaptismListModal = ref(false);

const loading = ref(true);
const error = ref(null);
const selectedDate = ref(new Date().toISOString().split('T')[0]);

// Chart instances
let attendanceChartInstance = null;
let newParticipantsChartInstance = null;

// --- API Configuration ---
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// --- API Calls ---
const fetchStats = async (date = null) => {
  loading.value = true;
  error.value = null;
  let queryParams = '';
  if (date) {
    queryParams = `?date=${date}`;
  }

  const headers = {
    'Content-Type': 'application/json',
  };
  const token = localStorage.getItem('authToken');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  } else {
    // Immediate redirect to login if no token
    localStorage.removeItem('authToken');
    window.location.reload();
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/dashboard/stats${queryParams}`, { headers });
    if (response.status === 401) {
      // Token invalid/expired: clear sensitive state and redirect to login immediately
      localStorage.removeItem('authToken');
      window.location.reload();
      return;
    }
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Failed to fetch dashboard stats and could not parse error response.' }));
      throw new Error(errorData.error || errorData.message || `HTTP error ${response.status}`);
    }
    const fetchedStats = await response.json();
    stats.value = {
      totalParticipants: fetchedStats.totalParticipants || 0,
      attendanceBySession: fetchedStats.attendanceBySession || [],
      topReferrers: fetchedStats.topReferrers || [],
      perfectAttendance: fetchedStats.perfectAttendance || [],
      todayAttendanceByLocality: fetchedStats.todayAttendanceByLocality || [],
      newParticipantsByDay: fetchedStats.newParticipantsByDay || [],
      futureBaptisms: fetchedStats.futureBaptisms || [], // Ensure this is populated from stats
    };
  } catch (err) {
    console.error("DashboardView: Error fetching stats:", err);
    error.value = err.message; // This will display the "Access denied. No token provided." if token is missing.
  } finally {
    loading.value = false;
  }
};


// This function is now part of fetchStats, as futureBaptisms is included in the dashboard stats response
// If you still need it separately for some reason, you'd apply the same header logic:
// const fetchBaptismInterested = async () => {
//   const headers = { 'Content-Type': 'application/json' };
//   const token = localStorage.getItem('authToken');
//   if (token) {
//     headers['Authorization'] = `Bearer ${token}`;
//   } else {
//     console.warn(`DashboardView: No auth token found for API call to /participants/interested-in-baptism.`);
//   }
//   try {
//     const response = await fetch(`${API_BASE_URL}/participants/interested-in-baptism`, { headers });
//     if (!response.ok) {
//         const errorData = await response.json().catch(() => ({ message: 'Failed to fetch baptism interested and could not parse error response.' }));
//         throw new Error(errorData.error || errorData.message || `HTTP error ${response.status}`);
//     }
//     // Assuming stats.value.futureBaptisms is the correct place now
//     stats.value.futureBaptisms = await response.json();
//   } catch (err) {
//     console.error("DashboardView: Error fetching baptism participants:", err);
//     // Handle error appropriately, maybe set a specific error ref for this data
//   }
// };


// --- Chart Initialization ---
const initCharts = () => {
  if (error.value) { // Don't try to init charts if there was an error fetching data
      console.warn("Skipping chart initialization due to data fetching error.");
      return;
  }
  initAttendanceChart();
  initNewParticipantsChart();
};

const initAttendanceChart = () => {
  if (attendanceChartInstance) {
    attendanceChartInstance.destroy();
  }
  const ctx = document.getElementById('attendanceChart');
  if (!ctx || !stats.value.attendanceBySession) {
    console.warn("Attendance chart canvas not found or no data.");
    return;
  }

  if (stats.value.attendanceBySession.length === 0 && !loading.value) {
      const canvasCtx = ctx.getContext('2d');
      canvasCtx.clearRect(0, 0, ctx.width, ctx.height); // Clear previous drawing
      canvasCtx.font = "14px Arial";
      canvasCtx.fillStyle = "#6c757d"; // text-muted color
      canvasCtx.textAlign = "center";
      canvasCtx.fillText("No attendance data available for the chart.", ctx.width / 2, ctx.height / 2);
      return;
  }


  const chartData = [...stats.value.attendanceBySession].sort((a, b) => new Date(a.session_date) - new Date(b.session_date));

  attendanceChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: chartData.map(d => new Date(d.session_date)),
      datasets: [{
        label: 'Participants Present',
        data: chartData.map(d => d.attendance_count),
        borderColor: 'rgb(54, 162, 235)',
        backgroundColor: 'rgba(54, 162, 235, 0.2)',
        tension: 0.2,
        fill: true,
        pointRadius: 3,
        pointHoverRadius: 5,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (tooltipItems) => new Date(tooltipItems[0].parsed.x).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
          }
        }
      },
      scales: {
        x: {
          type: 'time',
          time: { unit: 'day', tooltipFormat: 'MMM d, yyyy', displayFormats: { day: 'MMM d' } },
          grid: { display: false }
        },
        y: {
          beginAtZero: true,
          ticks: { stepSize: 1, precision: 0 },
        }
      }
    }
  });
};

const initNewParticipantsChart = () => {
  if (newParticipantsChartInstance) {
    newParticipantsChartInstance.destroy();
  }
  const ctx = document.getElementById('newParticipantsChart');
    if (!ctx || !stats.value.newParticipantsByDay) {
    console.warn("New participants chart canvas not found or no data.");
    return;
  }

  if (stats.value.newParticipantsByDay.length === 0 && !loading.value) {
      const canvasCtx = ctx.getContext('2d');
      canvasCtx.clearRect(0, 0, ctx.width, ctx.height); // Clear previous drawing
      canvasCtx.font = "14px Arial";
      canvasCtx.fillStyle = "#6c757d"; // text-muted color
      canvasCtx.textAlign = "center";
      canvasCtx.fillText("No new participant data available for the chart.", ctx.width / 2, ctx.height / 2);
      return;
  }

  const chartData = [...stats.value.newParticipantsByDay].sort((a, b) => new Date(a.join_date) - new Date(b.join_date));

  newParticipantsChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: chartData.map(d => new Date(d.join_date)),
      datasets: [{
        label: 'New Participants',
        data: chartData.map(d => d.new_participants),
        backgroundColor: 'rgba(25, 135, 84, 0.7)',
        borderColor: 'rgb(25, 135, 84)',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
          tooltip: {
          callbacks: {
            title: (tooltipItems) => new Date(tooltipItems[0].parsed.x).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
          }
        }
      },
      scales: {
        x: {
          type: 'time',
          time: { unit: 'day', tooltipFormat: 'MMM d, yyyy', displayFormats: { day: 'MMM d' } },
          grid: { display: false }
        },
        y: {
          beginAtZero: true,
          ticks: { stepSize: 1, precision: 0 },
        }
      }
    }
  });
};

// --- Lifecycle Hooks ---
onMounted(async () => {
  await fetchStats(selectedDate.value);
  // fetchBaptismInterested is no longer needed if futureBaptisms is part of dashboard/stats
  await nextTick();
  initCharts();
});

watch(selectedDate, async (newDate) => {
    await fetchStats(newDate);
    await nextTick();
    initCharts(); // Re-initialize charts with potentially new data for the selected date
});

watch(showBaptismListModal, (val) => {
  if (val) {
    document.body.classList.add('modal-open');
  } else {
    document.body.classList.remove('modal-open');
  }
});

// Helper to format date for display
const formatDateForDisplay = (dateString) => {
    if (!dateString) return 'N/A';
    // Check if it's already a Date object (e.g., from chart labels)
    if (dateString instanceof Date) {
        return dateString.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    }
    // Attempt to parse if it's a string
    const date = new Date(dateString);
    if (isNaN(date.getTime())) { // Check if date is invalid
        return dateString; // Return original string if parsing failed
    }
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
};

</script>

<template>
    <div class="dashboard-container container-fluid py-3 h-100 d-flex flex-column">
      <div class="card shadow-sm flex-grow-1 d-flex flex-column">
        <div class="card-header bg-light p-3 flex-shrink-0">
            <div class="d-flex flex-wrap justify-content-between align-items-center">
                <h4 class="mb-0 d-flex align-items-center">
                    <BarChart2 :size="28" class="me-2 text-primary" />Tableau de Bord
                </h4>
                <div class="ms-auto mt-2 mt-md-0">
                    <label for="statsDate" class="form-label form-label-sm visually-hidden">Date des statistiques par localité</label>
                    <input type="date" class="form-control form-control-sm" id="statsDate" v-model="selectedDate" style="max-width: 180px;">
                </div>
            </div>
        </div>

        <div class="card-body flex-grow-1" style="overflow-y: auto;">
            <div v-if="loading" class="text-center p-5">
                <div class="spinner-border text-primary" style="width: 3rem; height: 3rem;" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <p class="mt-2 text-muted">Chargement de données...</p>
            </div>
            <div v-else-if="error" class="alert alert-danger mx-3" role="alert">
                <AlertCircle :size="20" class="me-2" />
                Erreur de chargement: {{ error }}
            </div>
            
            <div v-else class="row g-3 g-lg-4">
                <div class="col-sm-6 col-md-4 col-lg-3">
                    <div class="card shadow-sm h-100 border-start border-primary border-4">
                        <div class="card-body text-center d-flex flex-column justify-content-center">
                            <Users class="text-primary mb-2 mx-auto" :size="32" />
                            <h6 class="card-subtitle mb-1 text-muted small text-uppercase">Total Participants</h6>
                            <p class="display-6 fw-bold mb-0">{{ stats.totalParticipants }}</p>
                        </div>
                    </div>
                </div>
                <div class="col-sm-6 col-md-4 col-lg-3">
                    <div class="card shadow-sm h-100 border-start border-success border-4" style="cursor: pointer;" @click="showBaptismListModal = true">
                        <div class="card-body text-center d-flex flex-column justify-content-center">
                            <CalendarCheck class="text-success mb-2 mx-auto" :size="32" />
                            <h6 class="card-subtitle mb-1 text-muted small text-uppercase">Baptême à Venir</h6>
                            <p class="display-6 fw-bold mb-0">{{ stats.futureBaptisms?.length || 0 }}</p>
                        </div>
                    </div>
                </div>
                <div class="col-sm-6 col-md-4 col-lg-3">
                    <div class="card shadow-sm h-100 border-start border-info border-4">
                        <div class="card-body text-center d-flex flex-column justify-content-center">
                            <TrendingUp class="text-info mb-2 mx-auto" :size="32" />
                            <h6 class="card-subtitle mb-1 text-muted small text-uppercase">Present ({{ formatDateForDisplay(selectedDate) }})</h6>
                            <p class="display-6 fw-bold mb-0">{{ totalPresentToday }}</p>
                        </div>
                    </div>
                </div>
                <div class="col-sm-6 col-md-4 col-lg-3">
                    <div class="card shadow-sm h-100 border-start border-warning border-4">
                        <div class="card-body text-center d-flex flex-column justify-content-center">
                            <Award class="text-warning mb-2 mx-auto" :size="32" />
                            <h6 class="card-subtitle mb-1 text-muted small text-uppercase">Assiduité</h6>
                            <p class="display-6 fw-bold mb-0">{{ stats.perfectAttendance?.length || 0 }}</p>
                        </div>
                    </div>
                </div>

                <div class="col-lg-7 mt-4">
                    <div class="card shadow-sm h-100">
                        <div class="card-header bg-light py-2">
                            <h6 class="card-title d-flex align-items-center mb-0 small text-uppercase">
                                <BarChart2 class="me-2 text-primary" :size="18" /> Présence par session
                            </h6>
                        </div>
                        <div class="card-body">
                            <div style="height: 280px;">
                                <canvas id="attendanceChart"></canvas>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-lg-5 mt-4">
                    <div class="card shadow-sm h-100">
                        <div class="card-header bg-light py-2">
                            <h6 class="card-title d-flex align-items-center mb-0 small text-uppercase">
                                <TrendingUp class="me-2 text-info" :size="18" /> Meilleurs référents
                            </h6>
                        </div>
                        <div class="card-body p-0" style="max-height: 280px; overflow-y: auto;">
                            <ul v-if="stats.topReferrers && stats.topReferrers.length > 0" class="list-group list-group-flush">
                                <li v-for="ref in stats.topReferrers.slice(0, 7)" :key="ref.id" class="list-group-item d-flex justify-content-between align-items-center py-2 px-3">
                                    <span class="small text-truncate" :title="ref.name">{{ ref.name }}</span>
                                    <span class="badge bg-info rounded-pill ms-2">{{ ref.referral_count }}</span>
                                </li>
                            </ul>
                            <p v-else class="text-muted text-center small p-3 mb-0">Aucune donnée de référent disponible.</p>
                        </div>
                    </div>
                </div>

                <div class="col-lg-7 mt-4">
                    <div class="card shadow-sm h-100">
                        <div class="card-header bg-light py-2">
                            <h6 class="card-title d-flex align-items-center mb-0 small text-uppercase">
                                <UserPlus class="me-2 text-success" :size="18" /> Nouveaux participants par jour
                            </h6>
                        </div>
                        <div class="card-body">
                            <div style="height: 280px;">
                                <canvas id="newParticipantsChart"></canvas>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-lg-5 mt-4">
                    <div class="card shadow-sm h-100">
                        <div class="card-header bg-light py-2">
                            <h6 class="card-title d-flex align-items-center mb-0 small text-uppercase">
                                <Award class="me-2 text-warning" :size="18" /> Liste des présences parfaites
                            </h6>
                        </div>
                        <div class="card-body p-0" style="max-height: 280px; overflow-y: auto;">
                            <ul v-if="stats.perfectAttendance && stats.perfectAttendance.length > 0" class="list-group list-group-flush">
                                <li v-for="p in stats.perfectAttendance.slice(0, 10)" :key="p.id" class="list-group-item py-2 px-3 small text-truncate" :title="p.name">
                                    {{ p.name }}
                                </li>
                            </ul>
                            <p v-else class="text-muted text-center small p-3 mb-0">Aucun participant.</p>
                        </div>
                    </div>
                </div>

                <div class="col-12 mt-4">
                    <div class="card shadow-sm">
                        <div class="card-header bg-light py-2">
                            <h6 class="card-title d-flex align-items-center mb-0 small text-uppercase">
                                <MapPin class="me-2 text-danger" :size="18" />
                                Taux de présence par localité ({{ formatDateForDisplay(selectedDate) }})
                            </h6>
                        </div>
                        <div class="card-body p-0">
                            <div v-if="stats.todayAttendanceByLocality && stats.todayAttendanceByLocality.length > 0" class="table-responsive">
                                <table class="table table-sm table-hover table-striped mb-0">
                                    <thead class="table-light">
                                        <tr>
                                            <th>Localités</th>
                                            <th class="text-end">Nombre de présents</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr v-for="row in stats.todayAttendanceByLocality" :key="row.locality">
                                            <td>{{ row.locality || 'Not Specified' }}</td>
                                            <td class="text-end fw-medium">{{ row.present_count }}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                            <p v-else class="text-muted text-center small p-3 mb-0">Aucune donnée de présence pour les localités le {{ formatDateForDisplay(selectedDate) }}.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      </div>

        <div class="modal fade" :class="{ 'show': showBaptismListModal, 'd-block': showBaptismListModal }" tabindex="-1" aria-labelledby="baptismModalLabel" :aria-hidden="!showBaptismListModal">
            <div class="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="baptismModalLabel">Participants intéressés par le baptême</h5>
                        <button type="button" class="btn-close" @click="showBaptismListModal = false" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <div v-if="!stats.futureBaptisms || stats.futureBaptisms.length === 0" class="text-center text-muted p-3">
                           Aucun participant n’est actuellement inscrit comme intéressé par le baptême.
                        </div>
                        <table v-else class="table table-striped table-hover table-sm">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Nom</th>
                                    </tr>
                            </thead>
                            <tbody>
                                <tr v-for="p in stats.futureBaptisms" :key="p.id">
                                    <td>{{ p.id }}</td>
                                    <td>{{ p.name }}</td>
                                    </tr>
                            </tbody>
                        </table>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary btn-sm" @click="showBaptismListModal = false">Fermer</button>
                    </div>
                </div>
            </div>
        </div>
        <div v-if="showBaptismListModal" class="modal-backdrop fade show"></div>
    </div>
</template>

<style scoped>
.dashboard-container {
  /* max-width: 1600px; */ /* If you want to constrain overall width */
}
.card {
  border: none;
}
.card-header.bg-light {
    background-color: #f8f9fa !important;
    border-bottom: 1px solid #e9ecef;
}
.card-title.small {
    font-weight: 500;
    font-size: 0.9rem;
    color: #495057;
}
.card-subtitle.small {
    font-size: 0.8rem;
}
.display-6 {
    font-size: 2rem; /* Slightly smaller for stat cards */
}
.table th {
  font-weight: 500;
  white-space: nowrap;
  font-size: 0.8rem;
  text-transform: uppercase;
  color: #6c757d;
  padding-top: 0.5rem;
  padding-bottom: 0.5rem;
}
.table td {
  vertical-align: middle;
  font-size: 0.875rem;
  padding-top: 0.5rem;
  padding-bottom: 0.5rem;
}
.table-sm th, .table-sm td {
  padding: 0.4rem;
}
.list-group-item {
    font-size: 0.875rem;
    border-left:0;
    border-right:0;
}
.list-group-item:first-child {
    border-top-left-radius: 0;
    border-top-right-radius: 0;
}
.list-group-item:last-child {
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
    border-bottom:0;
}
.border-start.border-4 {
    border-left-width: 4px !important;
}
canvas {
  width: 100% !important;
  height: 100% !important;
}
.form-label-sm {
    font-size: .75rem;
    margin-bottom: .25rem;
}

/* Modal specific styles if Bootstrap's default needs override */
.modal.d-block { /* Ensure modal is displayed when showBaptismListModal is true */
  display: block;
}
.modal-open { /* Prevent body scroll when modal is open */
  overflow: hidden;
}
.modal-backdrop.show { /* Ensure backdrop is visible */
  opacity: 0.5;
}
.text-truncate {
    max-width: 150px; /* Adjust as needed for your layout */
}
</style>
