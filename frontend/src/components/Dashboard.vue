<script setup>
import { ref, computed, onMounted } from 'vue';
import { Users, TrendingUp, Award } from 'lucide-vue-next';
import Chart from 'chart.js/auto';

const stats = ref({
    totalParticipants: 0,
    attendanceBySession: [],
    topReferrers: [],
    perfectAttendance: [],
    todayAttendanceByLocality: []
});

const loading = ref(true);
const error = ref(null);

const totalPresentToday = computed(() => {
  return stats.value.todayAttendanceByLocality?.reduce((sum, row) => sum + row.present_count, 0) || 0;
});

const joiningReasonsStats = ref([]);

const newParticipantsByDay = ref([]);
const NEW_PARTICIPANTS_START_DATE = '2025-05-07';

const fetchNewParticipantsByDay = async () => {
  try {
    const response = await fetch(`http://localhost:3001/api/participants/daily-join-stats?from=${NEW_PARTICIPANTS_START_DATE}`);
    if (!response.ok) throw new Error('Échec du chargement des participants par jour');
    newParticipantsByDay.value = await response.json();
  } catch (err) {
    console.error("Erreur lors du chargement des participants par jour :", err);
  }
};



// Fetch dashboard statistics
const fetchStats = async () => {
    loading.value = true;
    error.value = null;
    try {
        const response = await fetch('http://localhost:3001/api/dashboard/stats');
        if (!response.ok) throw new Error('Failed to fetch dashboard stats');
        stats.value = await response.json();
    } catch (err) {
        error.value = err.message;
    } finally {
        loading.value = false;
    }
};

// Initialize attendance chart
const initAttendanceChart = () => {
    const ctx = document.getElementById('attendanceChart');
    if (!ctx) return;

    const data = stats.value.attendanceBySession;
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.map(d => new Date(d.session_date).toLocaleDateString()),
            datasets: [{
                label: 'Nombre de participants',
                data: data.map(d => d.attendance_count),
                borderColor: 'rgb(75, 192, 192)',
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Participation par session'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
};

const initNewParticipantsChart = () => {
  const ctx = document.getElementById('newParticipantsChart');
  if (!ctx || !newParticipantsByDay.value.length) return;

  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: newParticipantsByDay.value.map(d => new Date(d.date).toLocaleDateString()),
      datasets: [{
        label: 'Nouveaux participants / jour',
        data: newParticipantsByDay.value.map(d => d.new_participants),
        backgroundColor: 'rgba(54, 162, 235, 0.6)'
      }]
    },
    options: {
      responsive: true,
      plugins: {
        title: {
          display: true,
          text: 'Nouveaux participants à partir du 7 mai 2025'
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            stepSize: 1
          }
        }
      }
    }
  });
};

const fetchJoiningReasonsStats = async () => {
  try {
    const response = await fetch('http://localhost:3001/api/participants/joining-reasons-stats');
    if (!response.ok) throw new Error('Échec du chargement des raisons de participation');
    joiningReasonsStats.value = await response.json();
  } catch (err) {
    console.error("Erreur lors du chargement des raisons :", err);
  }
};


onMounted(async () => {
  await fetchStats();
  await fetchNewParticipantsByDay();
  await fetchJoiningReasonsStats();
  initAttendanceChart();
  initNewParticipantsChart();
});

</script>

<template>
  <div class="container-fluid py-3">
    <div class="row g-4">
      <!-- Total Participants Card -->
      <div class="col-md-4">
        <div class="card h-100">
          <div class="card-body">
            <h5 class="card-title d-flex align-items-center">
              <Users class="me-2" :size="24" />
              Statistiques globales
            </h5>
            <p class="mb-2">
              <strong>Total participants :</strong><br />
              <span class="display-6">{{ stats.totalParticipants }}</span>
            </p>
            <p class="mb-0">
              <strong>Présents aujourd’hui :</strong><br />
              <span class="fs-4 text-success">{{ totalPresentToday }}</span>
            </p>
          </div>
        </div>
      </div>

      <!-- Top Referrers Card -->
      <div class="col-md-8">
        <div class="card h-100">
          <div class="card-body">
            <h5 class="card-title d-flex align-items-center">
              <TrendingUp class="me-2" :size="24" />
              Top Recommandations
            </h5>
            <div class="table-responsive">
              <table class="table table-sm">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Nom</th>
                    <th>Nombre de recommandations</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="ref in stats.topReferrers" :key="ref.id">
                    <td>{{ ref.id }}</td>
                    <td>{{ ref.name }}</td>
                    <td>{{ ref.referral_count }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <!-- Attendance Chart -->
      <div class="col-12">
        <div class="card">
          <div class="card-body">
            <h5 class="card-title d-flex align-items-center">
              <TrendingUp class="me-2" :size="24" />
              Participation par Session
            </h5>
            <canvas id="attendanceChart"></canvas>
          </div>
        </div>
      </div>

      <!-- New Participants Chart -->
      <div class="col-12">
        <div class="card">
          <div class="card-body">
            <h5 class="card-title d-flex align-items-center">
              <Users class="me-2" :size="24" />
              Nouveaux participants par jour
            </h5>
            <canvas id="newParticipantsChart"></canvas>
          </div>
        </div>
      </div>

      <!-- Section : Présents par quartier aujourd'hui -->
      <div class="row mt-4">
        <div class="col-12">
          <div class="card">
            <div class="card-body">
              <h5 class="card-title mb-3">Présents par quartier aujourd'hui</h5>
              <div class="table-responsive">
                <table class="table table-bordered mb-0">
                  <thead>
                    <tr>
                      <th>Quartier</th>
                      <th>Nombre de présents</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-if="!stats.todayAttendanceByLocality || stats.todayAttendanceByLocality.length === 0">
                      <td colspan="2" class="text-center text-muted">Aucune présence enregistrée aujourd'hui</td>
                    </tr>
                    <tr v-for="row in stats.todayAttendanceByLocality" :key="row.locality">
                      <td>{{ row.locality || 'Non spécifié' }}</td>
                      <td>{{ row.present_count }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Section : Raisons de participation -->
      <div class="row mt-4">
        <div class="col-12">
          <div class="card">
            <div class="card-body">
              <h5 class="card-title mb-3">Raisons de participation</h5>
              <div class="table-responsive">
                <table class="table table-bordered mb-0">
                  <thead>
                    <tr>
                      <th>Motif</th>
                      <th>Nombre de participants</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-if="!joiningReasonsStats.length">
                      <td colspan="2" class="text-center text-muted">Aucune donnée disponible</td>
                    </tr>
                    <tr v-for="row in joiningReasonsStats" :key="row.joining_reason || 'unknown'">
                      <td>{{ row.joining_reason || 'Non spécifié' }}</td>
                      <td>{{ row.count }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Perfect Attendance -->
      <div class="col-12">
        <div class="card">
          <div class="card-body">
            <h5 class="card-title d-flex align-items-center">
              <Award class="me-2" :size="24" />
              Participants Assidus
            </h5>
            <div class="table-responsive">
              <table class="table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Nom</th>
                    <th>Sessions suivies</th>
                    <th>Total sessions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="p in stats.perfectAttendance" :key="p.id">
                    <td>{{ p.id }}</td>
                    <td>{{ p.name }}</td>
                    <td>{{ p.attended_sessions }}</td>
                    <td>{{ p.total_sessions }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.card-title {
    font-weight: 500;
    color: #495057;
}
.display-4 {
    font-size: 2.5rem;
    font-weight: 600;
    color: #0d6efd;
}
.table th {
    font-weight: 500;
    white-space: nowrap;
}
.table td {
    vertical-align: middle;
}
canvas {
  width: 100% !important;
  height: auto !important;
}

</style> 