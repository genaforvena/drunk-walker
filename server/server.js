/**
 * Drunk Walker Backend Server
 * Minimal Express + SQLite service for collecting walk paths
 */

const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '..')));

// Database setup
const dbPath = path.join(__dirname, 'walks.db');
const db = new sqlite3.Database(dbPath);

// Initialize database schema
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS walks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      steps_json TEXT NOT NULL,
      step_count INTEGER NOT NULL
    )
  `);
  console.log('🗄️  Database initialized:', dbPath);
});

/**
 * POST /api/submit-walk
 * Accept walk path data and store in database
 */
app.post('/api/submit-walk', (req, res) => {
  const { timestamp, steps } = req.body;

  // Validate payload
  if (!timestamp || !Array.isArray(steps)) {
    return res.status(400).json({
      error: 'Invalid payload. Expected { timestamp: string, steps: array }'
    });
  }

  // Validate each step
  for (const step of steps) {
    if (!step || typeof step.url !== 'string' || typeof step.rotation !== 'number') {
      return res.status(400).json({
        error: 'Invalid step. Each step must have { url: string, rotation: number }'
      });
    }
  }

  const stepsJson = JSON.stringify(steps);
  const stepCount = steps.length;

  // Insert into database
  db.run(
    'INSERT INTO walks (timestamp, steps_json, step_count) VALUES (?, ?, ?)',
    [timestamp, stepsJson, stepCount],
    function(err) {
      if (err) {
        console.error('❌ Database error:', err.message);
        return res.status(500).json({ error: 'Failed to store walk data' });
      }
      console.log(`✅ Walk stored: ID=${this.lastID}, Steps=${stepCount}`);
      res.json({ success: true, id: this.lastID, stepCount });
    }
  );
});

/**
 * GET /api/stats
 * Return aggregate statistics
 */
app.get('/api/stats', (req, res) => {
  db.get(
    'SELECT COUNT(*) as totalWalks, COALESCE(SUM(step_count), 0) as totalSteps FROM walks',
    (err, row) => {
      if (err) {
        console.error('❌ Database error:', err.message);
        return res.status(500).json({ error: 'Failed to get stats' });
      }
      res.json({
        totalWalks: row.totalWalks,
        totalSteps: row.totalSteps
      });
    }
  );
});

/**
 * GET /api/walks
 * Return list of recent walks (paginated)
 */
app.get('/api/walks', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const offset = parseInt(req.query.offset) || 0;

  db.all(
    'SELECT id, timestamp, step_count FROM walks ORDER BY id DESC LIMIT ? OFFSET ?',
    [limit, offset],
    (err, rows) => {
      if (err) {
        console.error('❌ Database error:', err.message);
        return res.status(500).json({ error: 'Failed to get walks' });
      }
      res.json({ walks: rows, total: rows.length });
    }
  );
});

/**
 * GET /api/walk/:id
 * Return detailed walk data including steps
 */
app.get('/api/walk/:id', (req, res) => {
  const walkId = parseInt(req.params.id);

  db.get(
    'SELECT * FROM walks WHERE id = ?',
    [walkId],
    (err, row) => {
      if (err) {
        console.error('❌ Database error:', err.message);
        return res.status(500).json({ error: 'Failed to get walk' });
      }
      if (!row) {
        return res.status(404).json({ error: 'Walk not found' });
      }

      // Parse steps JSON
      try {
        row.steps = JSON.parse(row.steps_json);
      } catch (e) {
        row.steps = [];
      }
      delete row.steps_json;

      res.json(row);
    }
  );
});

/**
 * Serve dashboard page
 */
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'dashboard.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Drunk Walker server running on http://localhost:${PORT}`);
  console.log(`📊 Dashboard: http://localhost:${PORT}/dashboard`);
  console.log(`📈 Stats API: http://localhost:${PORT}/api/stats`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down...');
  db.close((err) => {
    if (err) console.error('Error closing database:', err.message);
    process.exit(0);
  });
});
