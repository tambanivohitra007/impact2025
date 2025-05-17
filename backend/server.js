// server.js
// Backend server for the Bible Study Tracker application

const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3001;

const JWT_SECRET = process.env.JWT_SECRET || 'your-very-strong-and-secret-key-please-change-me';
const JWT_EXPIRES_IN = '1h'; // Token expiration time

// --- Default Admin Configuration ---
const DEFAULT_ADMIN_USERNAME = process.env.DEFAULT_ADMIN_USERNAME || 'admin';
const DEFAULT_ADMIN_PASSWORD = process.env.DEFAULT_ADMIN_PASSWORD || 'adminImpact2025'; // CHANGE THIS IN PRODUCTION

const DB_PATH = path.join(__dirname, 'biblestudy.db');
const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error("Error opening database:", err.message);
        process.exit(1);
    } else {
        console.log("Connected to the SQLite database.");
        db.serialize(() => {
            // Users Table for Authentication
            db.run(`
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT NOT NULL UNIQUE,
                    password_hash TEXT NOT NULL,
                    role TEXT DEFAULT 'user' CHECK(role IN ('user', 'admin')),
                    approved INTEGER DEFAULT 0, -- 0 = not approved, 1 = approved
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `, (err) => {
                if (err) {
                    console.error("Error creating users table:", err.message);
                } else {
                    console.log("Users table checked/created.");
                    // Add columns if they don't exist
                    db.run(`ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user' CHECK(role IN ('user', 'admin'))`, (alterErr) => {
                        if (alterErr && !alterErr.message.includes('duplicate column name')) {
                            console.error("Error adding role column to users table:", alterErr.message);
                        } else {
                            db.run(`ALTER TABLE users ADD COLUMN approved INTEGER DEFAULT 0`, (apprErr) => {
                                if (apprErr && !apprErr.message.includes('duplicate column name')) {
                                    console.error("Error adding approved column to users table:", apprErr.message);
                                } else {
                                    // After users table is confirmed, check/create default admin
                                    checkAndCreateDefaultAdmin();
                                }
                            });
                        }
                    });
                }
            });

            function checkAndCreateDefaultAdmin() {
                db.get(`SELECT * FROM users WHERE username = ?`, [DEFAULT_ADMIN_USERNAME], async (err, row) => {
                    if (err) {
                        console.error("Error checking for default admin user:", err.message);
                        return;
                    }
                    if (!row) {
                        console.log(`Default admin user "${DEFAULT_ADMIN_USERNAME}" not found. Creating...`);
                        try {
                            const salt = await bcrypt.genSalt(10);
                            const passwordHash = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, salt);
                            db.run(`INSERT INTO users (username, password_hash, role, approved) VALUES (?, ?, ?, ?)`,
                                [DEFAULT_ADMIN_USERNAME, passwordHash, 'admin', 1],
                                function (insertErr) {
                                    if (insertErr) {
                                        console.error("Error creating default admin user:", insertErr.message);
                                    } else {
                                        console.log(`Default admin user "${DEFAULT_ADMIN_USERNAME}" created successfully with ID ${this.lastID}.`);
                                        console.warn(`IMPORTANT: Please change the default admin password for "${DEFAULT_ADMIN_USERNAME}" immediately after first login.`);
                                    }
                                }
                            );
                        } catch (hashError) {
                            console.error("Error hashing default admin password:", hashError);
                        }
                    } else {
                        console.log(`Default admin user "${DEFAULT_ADMIN_USERNAME}" already exists with role "${row.role}".`);
                    }
                });
            }


            // Trigger for users updated_at
            db.run(`
                CREATE TRIGGER IF NOT EXISTS update_users_updated_at
                AFTER UPDATE ON users
                FOR EACH ROW
                BEGIN
                    UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
                END;
            `, (err) => { if (err) console.error("Error creating users update trigger:", err.message); });

            // Participants Table
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
                    baptism_interest BOOLEAN DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (referred_by_participant_id) REFERENCES participants(id) ON DELETE SET NULL
                )
            `, (err) => {
                if (err) console.error("Error creating participants table:", err.message);
                else {
                    console.log("Participants table checked/created.");
                    db.run(`ALTER TABLE participants ADD COLUMN gender TEXT CHECK(gender IN ('M', 'F'))`, (e) => { if (e && !e.message.includes('duplicate column name')) console.error("Error adding gender column:", e.message); });
                    db.run(`ALTER TABLE participants ADD COLUMN baptism_interest BOOLEAN DEFAULT 0`, (e) => { if (e && !e.message.includes('duplicate column name')) console.error("Error adding baptism_interest column:", e.message); });
                }
            });
             db.run(`CREATE TRIGGER IF NOT EXISTS update_participants_updated_at AFTER UPDATE ON participants FOR EACH ROW BEGIN UPDATE participants SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id; END;`, (err) => { if (err) console.error("Error creating participants update trigger:", err.message); });


            // Study Sessions Table
            db.run(`
                CREATE TABLE IF NOT EXISTS study_sessions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_date DATE NOT NULL UNIQUE,
                    topic TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `, (err) => {
                if (err) console.error("Error creating study_sessions table:", err.message);
                else console.log("Study sessions table checked/created.");
            });

            // Attendance Table
            db.run(`
                CREATE TABLE IF NOT EXISTS attendance (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id INTEGER NOT NULL,
                    participant_id INTEGER NOT NULL,
                    attended BOOLEAN DEFAULT FALSE,
                    notes TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(session_id, participant_id),
                    FOREIGN KEY (session_id) REFERENCES study_sessions(id) ON DELETE CASCADE,
                    FOREIGN KEY (participant_id) REFERENCES participants(id) ON DELETE CASCADE
                )
            `, (err) => {
                if (err) console.error("Error creating attendance table:", err.message);
                else console.log("Attendance table checked/created.");
            });
            db.run(`CREATE TRIGGER IF NOT EXISTS update_attendance_updated_at AFTER UPDATE ON attendance FOR EACH ROW BEGIN UPDATE attendance SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id; END;`, (err) => { if (err) console.error("Error creating attendance update trigger:", err.message); });
        });
    }
});

app.use(cors());
app.use(express.json());

function handleDatabaseError(err, res, customMessage = "Database error") {
    if (err) {
        console.error(customMessage + ":", err.message);
        if (err.message && (err.message.includes('UNIQUE constraint failed') || err.message.includes('CHECK constraint failed'))) {
            res.status(409).json({ error: "Data conflict or validation error.", details: err.message });
        } else if (err.message && err.message.includes('NOT NULL constraint failed')) {
            res.status(400).json({ error: "Missing required field.", details: err.message });
        } else {
            res.status(500).json({ error: customMessage, details: err.message });
        }
        return true;
    }
    return false;
}

// --- Authentication Middleware ---
function verifyToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

    if (token == null) {
        console.warn("Access denied: No token provided.");
        return res.status(401).json({ error: "Access denied. No token provided." });
    }

    jwt.verify(token, JWT_SECRET, (err, decodedUser) => {
        if (err) {
            console.warn("Access denied: Invalid or expired token.", err.message);
            return res.status(403).json({ error: "Access denied. Token is not valid or has expired." });
        }
        req.user = decodedUser;
        next();
    });
}

function verifyAdminRole(req, res, next) {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        console.warn(`Forbidden: User ${req.user?.username} (ID: ${req.user?.id}, Role: ${req.user?.role}) attempted admin action.`);
        return res.status(403).json({ error: "Forbidden. Admin privileges required." });
    }
}

// --- Authentication API Routes ---
app.post('/api/auth/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Username and password are required." });
    if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters long." });

    try {
        const userExistsSql = `SELECT id FROM users WHERE username = ?`;
        db.get(userExistsSql, [username], async (err, row) => {
            if (handleDatabaseError(err, res, "Error checking username")) return;
            if (row) return res.status(409).json({ error: "Username already taken." });

            const salt = await bcrypt.genSalt(10);
            const passwordHash = await bcrypt.hash(password, salt);
            const defaultRole = (username === DEFAULT_ADMIN_USERNAME) ? 'admin' : 'user';
            // All new users except default admin must be approved by admin
            const approved = (defaultRole === 'admin') ? 1 : 0;

            const insertSql = `INSERT INTO users (username, password_hash, role, approved) VALUES (?, ?, ?, ?)`;
            db.run(insertSql, [username, passwordHash, defaultRole, approved], function (err) {
                if (handleDatabaseError(err, res, "Error registering user")) return;
                const userId = this.lastID;
                if (approved === 1) {
                    // Only auto-login if admin
                    const token = jwt.sign({ id: userId, username: username, role: defaultRole }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
                    res.status(201).json({ message: "Admin user registered and approved.", token, user: { id: userId, username: username, role: defaultRole } });
                } else {
                    res.status(201).json({ message: "User registered successfully. Awaiting admin approval.", user: { id: userId, username: username, role: defaultRole, approved: 0 } });
                }
            });
        });
    } catch (error) {
        console.error("Server error during registration:", error);
        res.status(500).json({ error: "Server error during registration.", details: error.message });
    }
});

app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Username and password are required." });

    const sql = `SELECT id, username, password_hash, role, approved FROM users WHERE username = ?`;
    db.get(sql, [username], async (err, user) => {
        if (handleDatabaseError(err, res, "Error during login")) return;
        if (!user) return res.status(401).json({ error: "Invalid username or password." });
        if (!user.approved) return res.status(403).json({ error: "Votre compte n'a pas encore été approuvé par un administrateur." });

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) return res.status(401).json({ error: "Invalid username or password." });

        const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
        res.json({ message: "Login successful.", token, user: { id: user.id, username: user.username, role: user.role } });
    });
});

app.post('/api/auth/logout', (req, res) => {
    res.json({ message: "Logout successful. Please clear your token on the client-side." });
});

// --- Admin User Management API Routes ---
app.get('/api/admin/users', verifyToken, verifyAdminRole, (req, res) => {
    const sql = `SELECT id, username, role, approved, created_at, updated_at FROM users ORDER BY username ASC`;
    db.all(sql, [], (err, rows) => {
        if (handleDatabaseError(err, res, "Error fetching users")) return;
        res.json(rows);
    });
});

app.put('/api/admin/users/:userId/approve', verifyToken, verifyAdminRole, (req, res) => {
    const { userId } = req.params;
    const sql = `UPDATE users SET approved = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
    db.run(sql, [userId], function(err) {
        if (handleDatabaseError(err, res, `Error approving user ${userId}`)) return;
        if (this.changes === 0) return res.status(404).json({ error: "User not found or already approved." });
        res.json({ message: "User approved successfully.", userId: parseInt(userId) });
    });
});

app.post('/api/admin/users', verifyToken, verifyAdminRole, async (req, res) => {
    const { username, password, role } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Username and password are required." });
    if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters long." });
    const userRole = (role && ['user', 'admin'].includes(role)) ? role : 'user';

    try {
        const userExistsSql = `SELECT id FROM users WHERE username = ?`;
        db.get(userExistsSql, [username], async (err, row) => {
            if (handleDatabaseError(err, res, "Error checking username availability")) return;
            if (row) return res.status(409).json({ error: "Username already taken." });

            const salt = await bcrypt.genSalt(10);
            const passwordHash = await bcrypt.hash(password, salt);
            const insertSql = `INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)`;
            db.run(insertSql, [username, passwordHash, userRole], function (err) {
                if (handleDatabaseError(err, res, "Error creating user by admin")) return;
                res.status(201).json({
                    message: "User created successfully by admin.",
                    user: { id: this.lastID, username: username, role: userRole }
                });
            });
        });
    } catch (error) {
        console.error("Server error during admin user creation:", error);
        res.status(500).json({ error: "Server error during admin user creation.", details: error.message });
    }
});

app.put('/api/admin/users/:userId', verifyToken, verifyAdminRole, (req, res) => {
    const { userId } = req.params;
    const { username, role } = req.body;
    const loggedInAdminId = req.user.id;

    if (!username && !role) return res.status(400).json({ error: "At least username or role must be provided for update." });
    if (username && username.trim() === '') return res.status(400).json({ error: "Username cannot be empty if provided." });
    if (role && !['user', 'admin'].includes(role)) return res.status(400).json({ error: "Invalid role specified. Must be 'user' or 'admin'." });

    if (parseInt(userId) === loggedInAdminId && role === 'user') {
        db.get(`SELECT COUNT(*) as adminCount FROM users WHERE role = 'admin' AND id != ?`, [loggedInAdminId], (err, countRow) => {
            if (err) return handleDatabaseError(err, res, "Error checking admin count");
            if (countRow.adminCount === 0) {
                 return res.status(403).json({ error: "Cannot change the role of the only admin to 'user'." });
            }
            proceedWithUserUpdate();
        });
    } else {
        proceedWithUserUpdate();
    }

    function proceedWithUserUpdate() {
        if (username) {
            const checkUsernameSql = `SELECT id FROM users WHERE username = ? AND id != ?`;
            db.get(checkUsernameSql, [username, userId], (err, row) => {
                if (handleDatabaseError(err, res, "Error checking username uniqueness for update")) return;
                if (row) return res.status(409).json({ error: "Username already taken by another user." });
                updateUserFieldsInDb();
            });
        } else {
            updateUserFieldsInDb();
        }
    }

    function updateUserFieldsInDb() {
        let updateFields = [];
        let params = [];
        if (username) { updateFields.push("username = ?"); params.push(username); }
        if (role) { updateFields.push("role = ?"); params.push(role); }
        if (updateFields.length === 0) return res.status(400).json({ error: "No valid fields provided for update." });
        params.push(userId);
        const updateSql = `UPDATE users SET ${updateFields.join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
        db.run(updateSql, params, function(err) {
            if (handleDatabaseError(err, res, `Error updating user ${userId}`)) return;
            if (this.changes === 0) return res.status(404).json({ error: "User not found or no changes made." });
            res.json({ message: "User updated successfully." });
        });
    }
});

app.delete('/api/admin/users/:userId', verifyToken, verifyAdminRole, (req, res) => {
    const { userId } = req.params;
    const loggedInAdminId = req.user.id;
    if (parseInt(userId) === loggedInAdminId) {
        return res.status(403).json({ error: "Admins cannot delete their own account." });
    }
    const sql = `DELETE FROM users WHERE id = ?`;
    db.run(sql, [userId], function(err) {
        if (handleDatabaseError(err, res, `Error deleting user ${userId}`)) return;
        if (this.changes === 0) return res.status(404).json({ error: "User not found." });
        res.json({ message: "User deleted successfully.", userId: parseInt(userId) });
    });
});

// --- Application API Routes ---
app.get('/api/participants', verifyToken, (req, res) => {
    const sql = `SELECT p.*, ref.name as referrer_name FROM participants p LEFT JOIN participants ref ON p.referred_by_participant_id = ref.id ORDER BY p.name COLLATE NOCASE ASC`;
    db.all(sql, [], (err, rows) => { if (handleDatabaseError(err, res, "Error fetching participants")) return; res.json(rows); });
});
app.get('/api/participants/attendance-summary', verifyToken, (req, res) => {
    const sql = `WITH ts AS (SELECT COUNT(*) AS total FROM study_sessions), pa AS (SELECT p.id,p.name,COUNT(a.id) AS attended_sessions FROM participants p LEFT JOIN attendance a ON p.id = a.participant_id AND a.attended = 1 GROUP BY p.id) SELECT pa.id,pa.name,pa.attended_sessions,ts.total FROM pa CROSS JOIN ts ORDER BY pa.name COLLATE NOCASE`;
    db.all(sql, [], (err, rows) => { if (handleDatabaseError(err, res, "Error fetching attendance summary")) return; res.json(rows); });
});
app.get('/api/participants/interested-in-baptism', verifyToken, (req, res) => {
    const sql = `SELECT id, name, contact_info, locality FROM participants WHERE baptism_interest = 1 ORDER BY name COLLATE NOCASE ASC`;
    db.all(sql, [], (err, rows) => { if (handleDatabaseError(err, res, "Error fetching baptism interested participants")) return; res.json(rows); });
});
app.get('/api/participants/:id', verifyToken, (req, res) => {
    const { id } = req.params;
    const sql = `SELECT p.*, ref.name as referrer_name FROM participants p LEFT JOIN participants ref ON p.referred_by_participant_id = ref.id WHERE p.id = ?`;
    db.get(sql, [id], (err, row) => { if (handleDatabaseError(err, res, `Error fetching participant ${id}`)) return; if (row) { res.json(row); } else { res.status(404).json({ error: "Participant not found" }); }});
});
app.post('/api/participants', verifyToken, (req, res) => {
    const { name, contact_info, age, gender, main_address, locality, date_joined, referred_by_participant_id, baptism_interest} = req.body;
    if (!name) return res.status(400).json({ error: "Participant name is required" });
    const rId = (referred_by_participant_id && !isNaN(parseInt(referred_by_participant_id))) ? parseInt(referred_by_participant_id) : null;
    const sql = `INSERT INTO participants (name, contact_info, age, gender, main_address, locality, date_joined, referred_by_participant_id, baptism_interest) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    const params = [name, contact_info, age, gender, main_address, locality, date_joined || new Date().toISOString().split('T')[0], rId, baptism_interest ? 1 : 0];
    db.run(sql, params, function(err) { if (handleDatabaseError(err, res, "Error adding participant")) return; res.status(201).json({ id: this.lastID, name, contact_info, age, gender, main_address, locality, date_joined: params[6], referred_by_participant_id: rId, baptism_interest }); });
});
app.patch('/api/participants/:id/baptism-interest', verifyToken, (req, res) => {
    const { id } = req.params;
    const { baptism_interest } = req.body;
    if (typeof baptism_interest !== 'boolean') return res.status(400).json({ error: "baptism_interest must be boolean" });
    const sql = `UPDATE participants SET baptism_interest = ? WHERE id = ?`;
    db.run(sql, [baptism_interest ? 1 : 0, id], function(err) { if (handleDatabaseError(err, res, `Error updating baptism_interest for participant ${id}`)) return; if (this.changes === 0) return res.status(404).json({ error: "Participant not found" }); res.json({ message: "Baptism interest updated", id: parseInt(id), baptism_interest }); });
});
app.put('/api/participants/:id', verifyToken, (req, res) => {
    const { id } = req.params;
    const { name, contact_info, age, gender, main_address, locality, date_joined, referred_by_participant_id, baptism_interest } = req.body;
    if (!name) return res.status(400).json({ error: "Participant name is required" });
    const rId = (referred_by_participant_id && !isNaN(parseInt(referred_by_participant_id))) ? parseInt(referred_by_participant_id) : null;
    const bFlag = baptism_interest ? 1 : 0;
    const sql = `UPDATE participants SET name = ?, contact_info = ?, age = ?, gender = ?, main_address = ?, locality = ?, date_joined = ?, referred_by_participant_id = ?, baptism_interest = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
    const params = [name, contact_info, age, gender, main_address, locality, date_joined, rId, bFlag, id];
    db.run(sql, params, function(err) { if (handleDatabaseError(err, res, `Error updating participant ${id}`)) return; if (this.changes === 0) return res.status(404).json({ error: "Participant not found or no changes made" }); res.json({ message: "Participant updated successfully", id: parseInt(id), changes: this.changes }); });
});
app.delete('/api/participants/:id', verifyToken, (req, res) => {
    const { id } = req.params;
    const sql = `DELETE FROM participants WHERE id = ?`;
    db.run(sql, [id], function(err) { if (handleDatabaseError(err, res, `Error deleting participant ${id}`)) return; if (this.changes === 0) return res.status(404).json({ error: "Participant not found" }); res.json({ message: "Participant deleted successfully", id: parseInt(id), changes: this.changes }); });
});
app.get('/api/sessions', verifyToken, (req, res) => {
    const sql = `SELECT * FROM study_sessions ORDER BY session_date DESC`;
    db.all(sql, [], (err, rows) => { if (handleDatabaseError(err, res, "Error fetching sessions")) return; res.json(rows); });
});
app.post('/api/sessions', verifyToken, (req, res) => {
    const { session_date, topic } = req.body;
    if (!session_date) return res.status(400).json({ error: "Session date is required" });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(session_date)) return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD." });
    const sql = `INSERT INTO study_sessions (session_date, topic) VALUES (?, ?)`;
    db.run(sql, [session_date, topic], function(err) { if (err && err.message.includes('UNIQUE constraint failed')) return res.status(409).json({ error: "A session already exists for this date.", details: err.message }); if (handleDatabaseError(err, res, "Error adding session")) return; res.status(201).json({ id: this.lastID, session_date, topic }); });
});
app.delete('/api/sessions/:id', verifyToken, (req, res) => {
    const { id } = req.params;
    const sql = `DELETE FROM study_sessions WHERE id = ?`;
    db.run(sql, [id], function(err) { if (handleDatabaseError(err, res, `Error deleting session ${id}`)) return; if (this.changes === 0) return res.status(404).json({ error: "Session not found" }); res.json({ message: "Session deleted successfully", id: parseInt(id), changes: this.changes }); });
});
app.get('/api/attendance/:sessionId', verifyToken, (req, res) => {
    const { sessionId } = req.params;
    const sql = `SELECT p.id as participant_id, p.name as participant_name, a.id as attendance_id, COALESCE(a.attended, 0) as attended, a.notes FROM participants p LEFT JOIN attendance a ON p.id = a.participant_id AND a.session_id = ? ORDER BY p.name COLLATE NOCASE ASC`;
    db.all(sql, [sessionId], (err, rows) => { if (handleDatabaseError(err, res, `Error fetching attendance for session ${sessionId}`)) return; res.json(rows); });
});
app.post('/api/attendance', verifyToken, (req, res) => {
    const attendanceList = req.body.attendance;
    if (!Array.isArray(attendanceList) || attendanceList.length === 0) return res.status(400).json({ error: "Request body must be an array of attendance records under the 'attendance' key." });
    db.serialize(() => {
        db.run("BEGIN TRANSACTION;");
        let hadError = false;
        const sql = `INSERT INTO attendance (session_id, participant_id, attended, notes, updated_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(session_id, participant_id) DO UPDATE SET attended = excluded.attended, notes = excluded.notes, updated_at = CURRENT_TIMESTAMP;`;
        const stmt = db.prepare(sql, (err) => { if (err) { console.error("Prepare statement error:", err); hadError = true; }});
        if (!hadError) {
            for (const record of attendanceList) {
                const { session_id, participant_id, attended, notes } = record;
                if (session_id == null || participant_id == null || attended == null) { console.warn("Skipping invalid attendance record:", record); continue; }
                stmt.run([session_id, participant_id, !!attended, notes || null], (err) => { if (err) { console.error("Run statement error:", err); hadError = true; }});
                if (hadError) break;
            }
        }
        stmt.finalize((finalizeErr) => {
            if (finalizeErr && !hadError) { console.error("Finalize statement error:", finalizeErr); hadError = true;}
            if (hadError) {
                db.run("ROLLBACK;", (rbErr) => { if (rbErr) console.error("Rollback error:", rbErr);});
                return res.status(500).json({ error: "Error saving one or more attendance records." });
            } else {
                db.run("COMMIT;", (commitErr) => {
                    if (commitErr) { console.error("Commit error:", commitErr); db.run("ROLLBACK;", (rbErr) => { if (rbErr) console.error("Rollback on commit error:", rbErr);}); return res.status(500).json({ error: "Error committing attendance records." }); }
                    res.status(201).json({ message: "Attendance saved successfully." });
                });
            }
        });
    });
});
app.get('/api/dashboard/stats', verifyToken, (req, res) => {
    const dateParam = req.query.date;
    const today = dateParam || new Date().toISOString().split('T')[0];
    const queries = {
        totalParticipants: `SELECT COUNT(*) as total FROM participants`,
        attendanceBySession: `SELECT s.session_date, COUNT(a.participant_id) as attendance_count FROM study_sessions s LEFT JOIN attendance a ON s.id = a.session_id AND a.attended = 1 GROUP BY s.session_date ORDER BY s.session_date DESC LIMIT 10`,
        topReferrers: `SELECT p.id, p.name, COUNT(r.id) as referral_count FROM participants p LEFT JOIN participants r ON p.id = r.referred_by_participant_id GROUP BY p.id HAVING referral_count > 0 ORDER BY referral_count DESC LIMIT 3`,
        perfectAttendance: `WITH sc AS (SELECT COUNT(*) as total_sessions FROM study_sessions), pa AS (SELECT p.id, p.name, COUNT(a.id) as attended_sessions FROM participants p LEFT JOIN attendance a ON p.id = a.participant_id AND a.attended = 1 GROUP BY p.id) SELECT pa.id, pa.name FROM pa CROSS JOIN sc WHERE pa.attended_sessions = sc.total_sessions AND sc.total_sessions > 0 ORDER BY pa.name COLLATE NOCASE ASC`,
        todayAttendanceByLocality: `SELECT p.locality, COUNT(DISTINCT a.participant_id) as present_count FROM participants p JOIN attendance a ON p.id = a.participant_id JOIN study_sessions s ON a.session_id = s.id WHERE s.session_date = ? AND a.attended = 1 AND p.locality IS NOT NULL AND p.locality != '' GROUP BY p.locality ORDER BY present_count DESC`,
        newParticipantsByDay: `SELECT date(date_joined) as join_date, COUNT(*) as new_participants FROM participants GROUP BY date(date_joined) ORDER BY join_date DESC LIMIT 30`,
        futureBaptisms: `SELECT id, name FROM participants WHERE baptism_interest = 1 ORDER BY name COLLATE NOCASE ASC`
    };
    const results = {};
    const promises = Object.entries(queries).map(([key, sql]) => {
        return new Promise((resolve, reject) => {
            const params = (key === 'todayAttendanceByLocality') ? [today] : [];
            db.all(sql, params, (err, rows) => { if (err) return reject(new Error(`Failed to fetch ${key}: ${err.message}`)); results[key] = (key === 'totalParticipants') ? rows[0]?.total || 0 : rows; resolve(); });
        });
    });
    Promise.all(promises)
        .then(() => res.json(results))
        .catch(error => { console.error("Error fetching dashboard stats:", error); res.status(500).json({ error: "Error fetching dashboard statistics", details: error.message }); });
});
app.use((req, res) => { res.status(404).json({ error: "Not Found", message: `The requested URL ${req.originalUrl} was not found on this server.` }); });
app.use((err, req, res, next) => { console.error("Unhandled error:", err.stack); res.status(500).json({ error: 'Something broke!', details: err.message }); });
app.listen(PORT, () => { console.log(`Backend server running at http://localhost:${PORT}`); });
process.on('SIGINT', () => { console.log('\nClosing database connection...'); db.close((err) => { if (err) console.error(err.message); console.log('Database connection closed.'); process.exit(0); }); });

