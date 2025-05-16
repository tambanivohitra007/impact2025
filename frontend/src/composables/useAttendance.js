// filepath: src/composables/useAttendance.js
import { ref } from 'vue';

export function useAttendance(API_BASE_URL, currentAttendance, participants, selectedSession, loading, error) {
    async function apiCall(url, method = 'GET', body = null) {
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
            },
        };

        const token = localStorage.getItem('authToken');
        if (token) {
            options.headers['Authorization'] = `Bearer ${token}`;
        } else {
            console.warn(`No auth token found for API call to ${url}`);
        }

        if (body) {
            options.body = JSON.stringify(body);
        }

        if (method !== 'GET') saving.value = true;
        error.value = null;

        try {
            const response = await fetch(`${API_BASE_URL}${url}`, options);
            const data = await response.json();

            if (!response.ok) {
                const errorMessage = data?.error || `API Error: ${response.status} ${response.statusText}`;
                const errorDetails = data?.details || '';
                console.error(`API call failed to ${url}:`, errorMessage, errorDetails);
                throw new Error(data?.error || `${response.status} ${response.statusText}`);
            }
            return data;
        } catch (err) {
            console.error(`Error in apiCall to ${url}:`, err);
            error.value = err.message || 'An unexpected error occurred.';
            throw err;
        } finally {
            if (method !== 'GET') saving.value = false;
        }
    }
    const fetchAttendanceForSession = async (sessionId) => {
        if (!sessionId) return;
        loading.attendance = true; error.value = null; currentAttendance.value = [];
        try {
            const rawAttendance = await apiCall(`/attendance/${sessionId}`);
            const attendanceMap = rawAttendance.reduce((acc, record) => {
                acc[record.participant_id] = { attended: !!record.attended, notes: record.notes || '' };
                return acc;
            }, {});
            currentAttendance.value = participants.value.map(p => ({
                participant_id: p.id,
                participant_name: p.name,
                attended: attendanceMap[p.id]?.attended || false,
                notes: attendanceMap[p.id]?.notes || '',
            }));
        } catch (err) { /* Handled by apiCall */ }
        finally { loading.attendance = false; }
    };

    return { fetchAttendanceForSession };
}