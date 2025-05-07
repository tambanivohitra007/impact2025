# IMPACT 2025 For secretary

A locally hosted application designed to help church secretaries manage evangelistic campain participants, track attendance for various sessions, and record referral information. Built with a focus on offline usability and a clear, manageable interface.

## Features

* **Participant Management:**
    * Add, edit, and delete participant profiles.
    * Record participant name, contact information, and date joined.
    * Track who referred whom among participants.
* **Study Session Management:**
    * Create and manage study sessions with dates and optional topics.
    * Delete sessions (which also removes associated attendance records).
* **Attendance Tracking:**
    * Mark attendance for each participant for a specific study session.
    * View attendance summaries (e.g., how many attended a session).
* **Search & Filter:**
    * Quickly search for participants within the participant list and attendance tracking views.
* **Local Data Storage:**
    * All data is stored locally in an SQLite database, ensuring the application can run without an internet connection.
* **User-Friendly Interface:**
    * Clean and intuitive UI built with Vue.js and Bootstrap 5.

## Technology Stack

* **Frontend:**
    * [Vue.js 3](https://vuejs.org/) (Composition API)
    * [Bootstrap 5](https://getbootstrap.com/) for styling and UI components.
    * [Lucide Icons](https://lucide.dev/) for vector icons.
    * [Vite](https://vitejs.dev/) as the build tool and development server.
* **Backend:**
    * [Node.js](https://nodejs.org/)
    * [Express.js](https://expressjs.com/) for the REST API.
    * [SQLite3](https://www.sqlite.org/index.html) as the local database.
    * `cors` for enabling cross-origin requests from the frontend.

## Project Structure

The project is organized into two main directories:

* `frontend/`: Contains the Vue.js application.
    * `src/`: Main source code for the Vue app.
        * `components/`: Reusable Vue components (e.g., `ParticipantList.vue`, `BaseModal.vue`).
        * `App.vue`: The main application component.
        * `main.js`: Vue application entry point.
* `backend/`: Contains the Node.js/Express server and SQLite database.
    * `server.js`: The main backend server file.
    * `biblestudy.db`: The SQLite database file (created automatically on first run).

## Prerequisites

* [Node.js](https://nodejs.org/) (which includes npm) installed on your system.

## Setup and Running

1.  **Clone the Repository (if applicable):**
    ```bash
    git clone <your-repository-url>
    cd bible-study-tracker
    ```

2.  **Backend Setup:**
    * Navigate to the `backend` directory:
        ```bash
        cd backend
        ```
    * Install dependencies:
        ```bash
        npm install
        ```
    * Start the backend server:
        ```bash
        node server.js
        ```
    * The backend server will typically run on `http://localhost:3001`. The `biblestudy.db` file will be created in this directory.

3.  **Frontend Setup:**
    * Open a **new terminal window/tab**.
    * Navigate to the `frontend` directory:
        ```bash
        cd ../frontend
        # or from the root: cd frontend
        ```
    * Install dependencies:
        ```bash
        npm install
        # You will also need to install Bootstrap and Lucide Icons if not already in package.json:
        # npm install bootstrap lucide-vue-next
        ```
    * Start the frontend development server:
        ```bash
        npm run dev
        ```
    * The frontend will typically be accessible at `http://localhost:5173` (Vite will confirm the port).

4.  **Access the Application:**
    * Open your web browser and navigate to the frontend URL (e.g., `http://localhost:5173`).

## How to Use

1.  **Navigate Sections:** Use the "Participants" and "Sessions & Attendance" navigation tabs to switch between views.
2.  **Manage Participants:**
    * Click "Add New Participant" to open a modal and enter participant details.
    * Use the edit (<Edit /> icon) and delete (<Trash2 /> icon) buttons next to each participant in the list.
3.  **Manage Sessions:**
    * Click "Add New Session" to create a new study session with a date and topic.
    * Click the "Attendance" button next to a session to view or record attendance for that session.
    * Delete sessions using the delete icon (this also removes related attendance).
4.  **Track Attendance:**
    * In the attendance view for a session, check/uncheck the boxes next to participant names.
    * Click "Save Attendance" to persist changes.

## Future Enhancements (Optional Ideas)

* Reporting features (e.g., attendance trends, participant statistics).
* Notes field for attendance records.
* User authentication for multiple secretaries (if deployed on a shared network resource).
* Data backup and restore functionality.
* More advanced filtering and sorting options.

---

