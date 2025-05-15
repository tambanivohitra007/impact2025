// server.js
// Backend server for the Bible Study Tracker application

const express = require('express');
const sqlite3 = require('sqlite3').verbose(); // Use verbose for more detailed error messages
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001; // Backend server port


// --- Database Setup ---
// Use a file named 'biblestudy.db' in the same directory as the server
const DB_PATH = path.join(__dirname, 'biblestudy.db');
const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error("Error opening database:", err.message);
        // Exit if the database cannot be opened, as the app is useless without it.
        process.exit(1);
    } else {
        console.log("Connected to the SQLite database.");
        // Create tables if they don't exist
        db.serialize(() => { // Use serialize to ensure sequential execution
            db.run(`
                CREATE TABLE IF NOT EXISTS participants (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    contact_info TEXT,
                    age INTEGER,
                    gender TEXT CHECK(gender IN ('M', 'F')),
                    main_address TEXT,
                    locality TEXT,
                    date_joined DATE DEFAULT CURRENT_DATE,
                    referred_by_participant_id INTEGER,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (referred_by_participant_id) REFERENCES participants(id) ON DELETE SET NULL
                )
            `, (err) => {
                if (err) console.error("Error creating participants table:", err.message);
                else console.log("Participants table checked/created.");
            });

            // Add gender column if it doesn't exist
            db.run(`
                ALTER TABLE participants ADD COLUMN gender TEXT CHECK(gender IN ('M', 'F'))
            `, (err) => {
                if (err && !err.message.includes('duplicate column name')) {
                    console.error("Error adding gender column:", err.message);
                } else {
                    console.log("Gender column checked/added.");
                }
            });
            // Add baptism_interest column if it doesn't exist
            db.run(`
                ALTER TABLE participants ADD COLUMN baptism_interest BOOLEAN DEFAULT 0
            `, (err) => {
                if (err && !err.message.includes('duplicate column name')) {
                    console.error("Error adding baptism_interest column:", err.message);
                } else {
                    console.log("Baptism interest column checked/added.");
                }
            });


            db.run(`
                CREATE TABLE IF NOT EXISTS study_sessions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_date DATE NOT NULL UNIQUE, -- Ensure only one session per date
                    topic TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `, (err) => {
                if (err) console.error("Error creating study_sessions table:", err.message);
                else console.log("Study sessions table checked/created.");
            });

            db.run(`
                CREATE TABLE IF NOT EXISTS attendance (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id INTEGER NOT NULL,
                    participant_id INTEGER NOT NULL,
                    attended BOOLEAN DEFAULT FALSE,
                    notes TEXT, -- Optional notes for attendance record
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(session_id, participant_id), -- Ensure one record per participant per session
                    FOREIGN KEY (session_id) REFERENCES study_sessions(id) ON DELETE CASCADE,
                    FOREIGN KEY (participant_id) REFERENCES participants(id) ON DELETE CASCADE
                )
            `, (err) => {
                if (err) console.error("Error creating attendance table:", err.message);
                else console.log("Attendance table checked/created.");
            });

            // Triggers to update 'updated_at' timestamps
            db.run(`
                CREATE TRIGGER IF NOT EXISTS update_participants_updated_at
                AFTER UPDATE ON participants
                FOR EACH ROW
                BEGIN
                    UPDATE participants SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
                END;
            `, (err) => {
                if (err) console.error("Error creating participants update trigger:", err.message);
            });

             db.run(`
                CREATE TRIGGER IF NOT EXISTS update_attendance_updated_at
                AFTER UPDATE ON attendance
                FOR EACH ROW
                BEGIN
                    UPDATE attendance SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
                END;
            `, (err) => {
                if (err) console.error("Error creating attendance update trigger:", err.message);
            });
        });
    }
});

// --- Middleware ---
app.use(cors()); // Enable Cross-Origin Resource Sharing for frontend requests
app.use(express.json()); // Parse JSON request bodies

// --- API Routes ---

// Helper function for database operations to handle errors
function handleDatabaseError(err, res, customMessage = "Database error") {
    if (err) {
        console.error(customMessage + ":", err.message);
        res.status(500).json({ error: customMessage, details: err.message });
        return true; // Indicates an error occurred
    }
    return false; // No error
}

// == Participants ==
// GET all participants (including referrer name)
app.get('/api/participants', (req, res) => {
    const sql = `
        SELECT p.*, ref.name as referrer_name
        FROM participants p
        LEFT JOIN participants ref ON p.referred_by_participant_id = ref.id
        ORDER BY p.id ASC
    `;
    db.all(sql, [], (err, rows) => {
        if (handleDatabaseError(err, res, "Error fetching participants")) return;
        res.json(rows);
    });
});

// GET attendance summary for all participants (how many sessions attended / total)
app.get('/api/participants/attendance-summary', (req, res) => {
    const sql = `
        WITH total_sessions AS (
            SELECT COUNT(*) AS total FROM study_sessions
        ),
        participant_attendance AS (
            SELECT
                p.id,
                p.name,
                COUNT(a.id) AS attended_sessions
            FROM participants p
            LEFT JOIN attendance a ON p.id = a.participant_id AND a.attended = 1
            GROUP BY p.id
        )
        SELECT 
            pa.id,
            pa.name,
            pa.attended_sessions,
            ts.total
        FROM participant_attendance pa
        CROSS JOIN total_sessions ts
        ORDER BY pa.name COLLATE NOCASE
    `;

    db.all(sql, [], (err, rows) => {
        if (handleDatabaseError(err, res, "Error fetching attendance summary")) return;
        res.json(rows);
    });
});

app.get('/api/participants/interested-in-baptism', (req, res) => {
    const sql = `SELECT * FROM participants WHERE baptism_interest = 1 ORDER BY name`;
    db.all(sql, [], (err, rows) => {
        if (handleDatabaseError(err, res, "Error fetching baptism interested participants")) return;
        res.json(rows);
    });
});


// GET a single participant by ID (including referrer name)
app.get('/api/participants/:id', (req, res) => {
    const { id } = req.params;
    const sql = `
        SELECT p.*, ref.name as referrer_name
        FROM participants p
        LEFT JOIN participants ref ON p.referred_by_participant_id = ref.id
        WHERE p.id = ?
    `;
    db.get(sql, [id], (err, row) => {
        if (handleDatabaseError(err, res, `Error fetching participant ${id}`)) return;
        if (row) {
            res.json(row);
        } else {
            res.status(404).json({ error: "Participant not found" });
        }
    });
});


// POST a new participant
app.post('/api/participants', (req, res) => {
    const { name, contact_info, age, gender, main_address, locality, date_joined, referred_by_participant_id, baptism_interest} = req.body;
    if (!name) {
        return res.status(400).json({ error: "Participant name is required" });
    }
    // Ensure referred_by_participant_id is null if empty or invalid
    const referrerId = (referred_by_participant_id && !isNaN(parseInt(referred_by_participant_id))) ? parseInt(referred_by_participant_id) : null;

    const sql = `INSERT INTO participants (name, contact_info, age, gender, main_address, locality, date_joined, referred_by_participant_id, baptism_interest) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    const params = [name, contact_info, age, gender, main_address, locality, date_joined || new Date().toISOString().split('T')[0], referrerId, baptism_interest ? 1 : 0] ;

    db.run(sql, params, function(err) {
        if (handleDatabaseError(err, res, "Error adding participant")) return;
        res.status(201).json({
            id: this.lastID,
            name,
            contact_info,
            age,
            gender,
            main_address,
            locality,
            date_joined: params[6],
            referred_by_participant_id: referrerId,
            baptism_interest
        });
    });
});

// PUT (update) an existing participant
app.put('/api/participants/:id', (req, res) => {
    const { id } = req.params;
    const { name, contact_info, age, gender, main_address, locality, date_joined, referred_by_participant_id, baptism_interest } = req.body;
    const baptismFlag = baptism_interest ? 1 : 0;

    if (!name) {
        return res.status(400).json({ error: "Participant name is required" });
    }
    const referrerId = (referred_by_participant_id && !isNaN(parseInt(referred_by_participant_id))) ? parseInt(referred_by_participant_id) : null;

    const sql = `
        UPDATE participants
        SET name = ?, contact_info = ?, age = ?, gender = ?, main_address = ?, locality = ?, date_joined = ?, referred_by_participant_id = ?, baptism_interest = ?
        WHERE id = ?
    `;
    const params = [name, contact_info, age, gender, main_address, locality, date_joined, referrerId, id, baptismFlag];

    db.run(sql, params, function(err) {
        if (handleDatabaseError(err, res, `Error updating participant ${id}`)) return;
        if (this.changes === 0) {
            return res.status(404).json({ error: "Participant not found or no changes made" });
        }
        res.json({ message: "Participant updated successfully", id: id, changes: this.changes });
    });
});

// DELETE a participant
app.delete('/api/participants/:id', (req, res) => {
    const { id } = req.params;
    // Note: ON DELETE CASCADE/SET NULL handles foreign key constraints in attendance/participants tables
    const sql = `DELETE FROM participants WHERE id = ?`;
    db.run(sql, [id], function(err) {
        if (handleDatabaseError(err, res, `Error deleting participant ${id}`)) return;
        if (this.changes === 0) {
            return res.status(404).json({ error: "Participant not found" });
        }
        res.json({ message: "Participant deleted successfully", id: id, changes: this.changes });
    });
});

// == Study Sessions ==
// GET all study sessions
app.get('/api/sessions', (req, res) => {
    const sql = `SELECT * FROM study_sessions ORDER BY session_date DESC`;
    db.all(sql, [], (err, rows) => {
        if (handleDatabaseError(err, res, "Error fetching sessions")) return;
        res.json(rows);
    });
});

// POST a new study session
app.post('/api/sessions', (req, res) => {
    const { session_date, topic } = req.body;
    if (!session_date) {
        return res.status(400).json({ error: "Session date is required" });
    }
    // Basic date validation (YYYY-MM-DD format expected)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(session_date)) {
         return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD." });
    }

    const sql = `INSERT INTO study_sessions (session_date, topic) VALUES (?, ?)`;
    db.run(sql, [session_date, topic], function(err) {
        // Handle potential UNIQUE constraint violation for session_date
        if (err && err.message.includes('UNIQUE constraint failed')) {
            return res.status(409).json({ error: "A session already exists for this date.", details: err.message });
        }
        if (handleDatabaseError(err, res, "Error adding session")) return;
        res.status(201).json({ id: this.lastID, session_date, topic });
    });
});

// DELETE a study session (will also delete related attendance records due to ON DELETE CASCADE)
app.delete('/api/sessions/:id', (req, res) => {
    const { id } = req.params;
    const sql = `DELETE FROM study_sessions WHERE id = ?`;
    db.run(sql, [id], function(err) {
        if (handleDatabaseError(err, res, `Error deleting session ${id}`)) return;
        if (this.changes === 0) {
            return res.status(404).json({ error: "Session not found" });
        }
        res.json({ message: "Session deleted successfully", id: id, changes: this.changes });
    });
});


// == Attendance ==
// GET attendance for a specific session, including participant names
app.get('/api/attendance/:sessionId', (req, res) => {
    const { sessionId } = req.params;

    // This query fetches all participants and joins their attendance status for the specific session.
    // If a participant has no attendance record for this session, their 'attended' status will be null/false.
    const sql = `
        SELECT
            p.id as participant_id,
            p.name as participant_name,
            a.id as attendance_id,
            COALESCE(a.attended, 0) as attended, -- Default to not attended (0/false) if no record
            a.notes
        FROM participants p
        LEFT JOIN attendance a ON p.id = a.participant_id AND a.session_id = ?
        ORDER BY p.name COLLATE NOCASE ASC
    `;

    db.all(sql, [sessionId], (err, rows) => {
        if (handleDatabaseError(err, res, `Error fetching attendance for session ${sessionId}`)) return;
        res.json(rows);
    });
});

// POST/PUT attendance status for a participant in a session (Upsert logic)
app.post('/api/attendance', (req, res) => {
    const { session_id, participant_id, attended, notes } = req.body;

    if (!session_id || !participant_id || attended === undefined || attended === null) {
        return res.status(400).json({ error: "Missing required fields: session_id, participant_id, attended" });
    }

    // Use INSERT OR REPLACE (UPSERT) to simplify adding/updating attendance
    // This requires the UNIQUE constraint on (session_id, participant_id)
    const sql = `
        INSERT INTO attendance (session_id, participant_id, attended, notes)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(session_id, participant_id) DO UPDATE SET
            attended = excluded.attended,
            notes = excluded.notes,
            updated_at = CURRENT_TIMESTAMP;
    `;
    const params = [session_id, participant_id, !!attended, notes || null]; // Ensure attended is boolean

    db.run(sql, params, function(err) {
        if (handleDatabaseError(err, res, "Error saving attendance")) return;
        // We don't get lastID reliably with UPSERT, but can confirm success
        res.status(201).json({ message: "Attendance saved successfully" });
    });
});

// == Dashboard Statistics ==
// GET dashboard statistics
app.get('/api/dashboard/stats', (req, res) => {
    const dateParam = req.query.date;
    const today = dateParam || new Date().toISOString().split('T')[0];
    
    // Requête pour le nombre total de participants
    const totalParticipantsQuery = `
        SELECT COUNT(*) as total FROM participants
    `;

    // Requête pour les participants par session
    const attendanceBySessionQuery = `
        SELECT 
            s.session_date,
            COUNT(a.participant_id) as attendance_count
        FROM study_sessions s
        LEFT JOIN attendance a ON s.id = a.session_id
        WHERE a.attended = 1
        GROUP BY s.session_date
        ORDER BY s.session_date DESC
        LIMIT 10
    `;

    // Requête pour les meilleurs parrains
    const topReferrersQuery = `
        SELECT 
            p.id,
            p.name,
            COUNT(r.id) as referral_count
        FROM participants p
        LEFT JOIN participants r ON p.id = r.referred_by_participant_id
        GROUP BY p.id
        HAVING referral_count > 0
        ORDER BY referral_count DESC
        LIMIT 3
    `;

    // Requête pour les participants avec une présence parfaite
    const perfectAttendanceQuery = `
        WITH session_counts AS (
            SELECT COUNT(*) as total_sessions
            FROM study_sessions
        ),
        participant_attendance AS (
            SELECT 
                p.id,
                p.name,
                COUNT(a.id) as attended_sessions
            FROM participants p
            LEFT JOIN attendance a ON p.id = a.participant_id AND a.attended = 1
            GROUP BY p.id
        )
        SELECT 
            pa.id,
            pa.name
        FROM participant_attendance pa
        CROSS JOIN session_counts sc
        WHERE pa.attended_sessions = sc.total_sessions
    `;

    // Requête pour les participants présents aujourd'hui par quartier
    const todayAttendanceByLocalityQuery = `
        SELECT 
            p.locality,
            COUNT(DISTINCT a.participant_id) as present_count
        FROM participants p
        LEFT JOIN attendance a ON p.id = a.participant_id
        LEFT JOIN study_sessions s ON a.session_id = s.id
        WHERE s.session_date = ? AND a.attended = 1
        GROUP BY p.locality
        ORDER BY present_count DESC
    `;

    // Requête pour les nouvelles inscriptions par jour
    const newParticipantsByDayQuery = `
        SELECT 
            date(date_joined) as join_date,
            COUNT(*) as new_participants
        FROM participants
        GROUP BY date(date_joined)
        ORDER BY join_date DESC
        LIMIT 30
    `;

    db.all(totalParticipantsQuery, [], (err, totalResult) => {
        if (err) {
            console.error('Error getting total participants:', err);
            return res.status(500).json({ error: 'Erreur lors de la récupération des statistiques' });
        }

        db.all(attendanceBySessionQuery, [], (err, attendanceResults) => {
            if (err) {
                console.error('Error getting attendance by session:', err);
                return res.status(500).json({ error: 'Erreur lors de la récupération des statistiques' });
            }

            db.all(topReferrersQuery, [], (err, referrerResults) => {
                if (err) {
                    console.error('Error getting top referrers:', err);
                    return res.status(500).json({ error: 'Erreur lors de la récupération des statistiques' });
                }

                db.all(perfectAttendanceQuery, [], (err, perfectAttendanceResults) => {
                    if (err) {
                        console.error('Error getting perfect attendance:', err);
                        return res.status(500).json({ error: 'Erreur lors de la récupération des statistiques' });
                    }

                    db.all(todayAttendanceByLocalityQuery, [today], (err, localityResults) => {
                        if (err) {
                            console.error('Error getting today attendance by locality:', err);
                            return res.status(500).json({ error: 'Erreur lors de la récupération des statistiques' });
                        }

                        db.all(newParticipantsByDayQuery, [], (err, newParticipantsResults) => {
                            if (err) {
                                console.error('Error getting new participants by day:', err);
                                return res.status(500).json({ error: 'Erreur lors de la récupération des statistiques' });
                            }

                            const futureBaptismsQuery = `
                                SELECT id, name FROM participants WHERE baptism_interest = 1
                            `;

                            db.all(futureBaptismsQuery, [], (err, futureBaptismResults) => {
                                if (err) {
                                console.error('Error getting future baptisms:', err);
                                return res.status(500).json({ error: 'Erreur lors de la récupération des futurs baptêmes' });
                                }

                                // Réponse finale avec tous les résultats
                                res.json({
                                totalParticipants: totalResult[0].total,
                                attendanceBySession: attendanceResults,
                                topReferrers: referrerResults,
                                perfectAttendance: perfectAttendanceResults,
                                todayAttendanceByLocality: localityResults,
                                newParticipantsByDay: newParticipantsResults,
                                futureBaptisms: futureBaptismResults
                                });
                            });
                        });
                    });
                });
            });
        });
    });
});

// --- Basic Error Handling for Unmatched Routes ---
app.use((req, res) => {
    res.status(404).json({ error: "Not Found" });
});

// --- Global Error Handler ---
// Catches errors passed via next(err)
app.use((err, req, res, next) => {
    console.error("Unhandled error:", err.stack);
    res.status(500).json({ error: 'Something broke!', details: err.message });
});


// --- Start Server ---
app.listen(PORT, () => {
    console.log(`Backend server running at http://localhost:${PORT}`);
});

// --- Graceful Shutdown ---
process.on('SIGINT', () => {
    console.log('\nClosing database connection...');
    db.close((err) => {
        if (err) {
            console.error(err.message);
        }
        console.log('Database connection closed.');
        process.exit(0);
    });
});
