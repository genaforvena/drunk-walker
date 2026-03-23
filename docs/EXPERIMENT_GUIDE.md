# 🧪 Drunk Walker Experiment Guide

**Long-Running Walk Automation & Analysis**

This guide covers the experiment framework for running and analyzing long Drunk Walker sessions.

---

## 📦 What's Included

| Module | Purpose | Location |
|--------|---------|----------|
| **Auto-Save** | Crash recovery, progress backup | `src/experiment/autosave.js` |
| **Config** | Experiment settings management | `src/experiment/config.js` |
| **Exporter** | Data export (JSON, CSV, GeoJSON) | `src/experiment/exporter.js` |
| **Monitor** | Real-time statistics, anomaly detection | `src/experiment/monitor.js` |
| **Analyzer** | Python analysis script | `analysis/analyze-walk.py` |

---

## 🚀 Quick Start

### 1. Load Drunk Walker

```javascript
// In Google Maps Street View console (F12)
// Paste the latest drunk walker code
```

### 2. Start Experiment

```javascript
// Initialize experiment framework
const experiment = DRUNK_WALKER.experiment;

// Start with default settings
experiment.start();

// Or customize
experiment.start({
  name: 'amsterdam-exploration',
  targetSteps: 10000,
  pace: 2000
});
```

### 3. Monitor Progress

```javascript
// Show current statistics
experiment.showStats();

// Or check programmatically
const stats = experiment.getStats();
console.log(stats);
```

### 4. Export Data

```javascript
// Manual export
experiment.export('json');     // Complete data
experiment.export('csv');      // Path only
experiment.export('geojson');  // For mapping tools
experiment.export('summary');  // Quick stats

// Auto-export happens every 500 steps automatically
```

### 5. Stop & Analyze

```javascript
// Stop experiment (auto-exports final data)
experiment.stop();

// Download the JSON file and analyze with Python:
// python analysis/analyze-walk.py drunk-walker-*.json
```

---

## ⚙️ Configuration Options

### Experiment Settings

```javascript
experiment.start({
  // Identification
  name: 'my-experiment',
  description: 'Exploring Amsterdam center',
  
  // Targets
  targetSteps: 10000,      // Stop after N steps
  targetVisited: 5000,     // Stop after N unique locations
  maxDuration: 28800000,   // Stop after 8 hours (ms)
  
  // Pacing
  pace: 2000,              // Base decision interval (ms)
  paceVariance: 500,       // Random variance (ms)
  maxStepsPerHour: 1800,   // Rate limiting
  
  // Export
  exportInterval: 500,     // Auto-export every N steps
  autoSaveInterval: 60000, // Auto-save every N ms
  
  // Safety
  maxStuckCount: 50,       // Pause if stuck too many times
  autoPauseOnCaptcha: true,
  
  // Monitoring
  enableMonitoring: true,
  logInterval: 30000       // Log stats every N ms
});
```

### Default Configuration

```javascript
{
  name: 'untitled-experiment',
  targetSteps: 10000,
  pace: 2000,
  exportInterval: 500,
  autoSaveInterval: 60000,
  logInterval: 30000,
  maxStuckCount: 50,
  algorithm: 'PLEDGE'
}
```

---

## 💾 Auto-Save & Recovery

### How It Works

- Saves every 60 seconds to browser IndexedDB
- Includes: steps, path, transition graph
- Survives page refresh, browser crash

### Manual Save

```javascript
// Force immediate save
DRUNK_WALKER.autosaver.save();
```

### Recovery After Crash

```javascript
// Check for backup
const backup = await DRUNK_WALKER.autosaver.load();
if (backup) {
  console.log('Found backup from step', backup.engine.steps);
  
  // Restore and continue
  const restored = await DRUNK_WALKER.autosaver.restore();
  if (restored) {
    DRUNK_WALKER.engine.start();
  }
}
```

### Console Commands

```javascript
// Quick recovery one-liner
await DRUNK_WALKER.experiment.recover();
```

---

## 📊 Monitoring

### Live Statistics

```javascript
// Show formatted stats
experiment.showStats();

// Output:
// ============================================================
// 🧪 DRUNK WALKER EXPERIMENT STATUS
// ============================================================
// | Property      | Value     |
// |---------------|-----------|
// | name          | amsterdam |
// | steps         | 2547      |
// | visited       | 1823      |
// | ratio         | 0.7158    |
// | elapsed       | 85 min    |
// | progress      | 25.5%     |
// ============================================================
```

### Programmatic Access

```javascript
const stats = experiment.getStats();

console.log('Steps:', stats.experiment.steps);
console.log('Ratio:', stats.experiment.ratio);
console.log('Auto-saves:', stats.autosave.saveCount);
```

### Anomaly Detection

The monitor automatically detects:

| Anomaly | Threshold | Action |
|---------|-----------|--------|
| Low efficiency | ratio < 0.3 after 1000 steps | Warning |
| High stuck count | stuck > 20 | Warning |
| Possible CAPTCHA | stuck > 50 | Auto-pause (optional) |

```javascript
// Check anomaly state
const anomalies = experiment.monitor.getAnomalyState();
console.log(anomalies);

// Reset warnings
experiment.monitor.resetAnomalies();
```

---

## 📤 Data Export

### Export Formats

#### JSON (Complete)
```javascript
experiment.export('json');
```

Includes:
- Full walk path with timestamps
- Transition graph (nodes + edges)
- Node metadata (tried yaws, successful yaws)
- Experiment configuration

#### CSV (Path Only)
```javascript
experiment.export('csv');
```

Columns: `step,timestamp,lat,lng,url`

#### GeoJSON (Mapping)
```javascript
experiment.export('geojson');
```

Compatible with:
- QGIS
- ArcGIS
- Google My Maps
- geojson.io

#### Summary
```javascript
experiment.export('summary');
```

Quick statistics for logging.

---

## 🐍 Python Analysis

### Requirements

```bash
pip install networkx matplotlib
```

### Basic Analysis

```bash
python analysis/analyze-walk.py drunk-walker-1774224040575.json
```

### With Output Directory

```bash
python analysis/analyze-walk.py walk.json --output-dir ./results
```

### Output Files

| File | Description |
|------|-------------|
| `analysis-report.txt` | Text summary |
| `metrics.json` | All computed metrics |
| `progress.png` | Exploration over time |
| `efficiency.png` | Efficiency trend |
| `visit_distribution.png` | Node revisit histogram |
| `graph.png` | Network visualization |

### Metrics Computed

**Basic:**
- Total steps, unique locations
- Progress ratio (unique/steps)
- Steps/minute, unique/minute
- Visit distribution

**Graph:**
- Node/edge count
- Degree statistics
- Connected components
- Graph density
- Cycle count (small graphs only)

**Efficiency:**
- Windowed efficiency (per 100 steps)
- Trend analysis (improving/stable/declining)

---

## 🧪 Running a 10K Step Experiment

### Preparation

1. **Charge laptop** or connect to power
2. **Close unnecessary tabs** (reduce memory pressure)
3. **Disable sleep mode** (system settings)
4. **Stable internet connection**

### Step-by-Step

```javascript
// 1. Load Drunk Walker in Street View
// 2. Paste code, wait for panel to appear
// 3. Configure experiment
DRUNK_WALKER.experiment.start({
  name: '10k-amsterdam',
  targetSteps: 10000,
  pace: 2000,
  autoSaveInterval: 30000  // Save every 30s for safety
});

// 4. Verify it's running
// - Check panel shows WALKING
// - Watch steps counter increase
// - Check console for monitor output

// 5. Monitor periodically
experiment.showStats();  // Every 30 min or so

// 6. When complete (or to stop early)
experiment.stop();

// 7. Export final data
experiment.export('json');
```

### Expected Duration

| Pace | Steps/Hour | 10K Steps |
|------|------------|-----------|
| 1000ms | ~3600 | ~2.8 hours |
| 2000ms | ~1800 | ~5.5 hours |
| 3000ms | ~1200 | ~8.3 hours |

---

## 🔧 Troubleshooting

### Experiment Won't Start

```javascript
// Check if module loaded
console.log(DRUNK_WALKER.experiment);
// Should show object, not undefined

// If undefined, the experiment module didn't load
// Try refreshing the page and reloading drunk walker
```

### Auto-Save Not Working

```javascript
// Check IndexedDB availability
console.log(typeof indexedDB);
// Should be "object", not "undefined"

// Manual save test
DRUNK_WALKER.autosaver.save();
// Should log "💾 [AUTOSAVE] Saved: step=..."
```

### Recovery Fails

```javascript
// Check for backup
const backup = await DRUNK_WALKER.autosaver.load();
console.log(backup);
// null = no backup found

// This can happen if:
// - Browser was closed before first auto-save (60s)
// - IndexedDB was cleared
// - Different browser/computer
```

### Monitor Not Logging

```javascript
// Check if monitor is running
console.log(DRUNK_WALKER.experiment.monitor.isRunning);

// Start manually
DRUNK_WALKER.experiment.monitor.start();
```

### Export Fails

```javascript
// Check for popup blocker
// Exports use download links that may be blocked

// Try manual export with smaller format first
DRUNK_WALKER.experiment.export('summary');
// If this works, the issue is file size

// For large exports, use the console directly:
const data = DRUNK_WALKER.experiment.exporter.exportJSON();
// Data is returned as object, can inspect in console
```

---

## 📈 Best Practices

### For Long Runs (10K+ steps)

1. **Start early in the day** - Monitor progress
2. **Enable auto-save every 30s** - Minimize data loss
3. **Check every hour** - Verify still running
4. **Export at milestones** - 1K, 5K, 10K steps

### For Analysis

1. **Export at end** - Complete JSON export
2. **Run Python analysis** - Get metrics and plots
3. **Compare multiple runs** - Different algorithms/locations
4. **Save raw data** - Keep original JSON files

### For Algorithm Testing

```javascript
// Test different algorithms
experiment.start({ algorithm: 'PLEDGE', targetSteps: 1000 });
// Wait for completion, export

experiment.start({ algorithm: 'RANDOM', targetSteps: 1000 });
// Compare efficiency
```

---

## 🧩 API Reference

### Experiment

```javascript
experiment.start(config)      // Start with configuration
experiment.stop()             // Stop and export
experiment.export(format)     // Export data
experiment.getStats()         // Get statistics object
experiment.showStats()        // Log stats to console
experiment.recover()          // Restore from backup
experiment.updateConfig({})   // Update settings
```

### Autosaver

```javascript
autosaver.start()             // Begin auto-save interval
autosaver.stop()              // Stop auto-save
autosaver.save()              // Force save now
autosaver.load()              // Load latest backup
autosaver.restore()           // Restore engine state
autosaver.getStats()          // Get save statistics
```

### Monitor

```javascript
monitor.start()               // Begin monitoring
monitor.stop()                // Stop monitoring
monitor.getStats()            // Get current stats
monitor.logStats()            // Log to console now
monitor.getAnomalyState()     // Check anomaly flags
monitor.resetAnomalies()      // Clear anomaly warnings
```

### Exporter

```javascript
exporter.exportJSON()         // Complete data export
exporter.exportCSV()          // Path as CSV
exporter.exportGeoJSON()      // Graph for mapping
exporter.exportSummary()      // Quick statistics
exporter.autoExport()         // Check if export needed
exporter.getStats()           // Export statistics
```

---

## 📝 Example Session

```javascript
// ===== SETUP =====
// Open Google Maps Street View
// F12 → Console
// Paste drunk walker code

// ===== START EXPERIMENT =====
DRUNK_WALKER.experiment.start({
  name: 'copenhagen-test',
  targetSteps: 5000,
  pace: 2000,
  autoSaveInterval: 30000
});

// ===== MONITOR (every 30 min) =====
DRUNK_WALKER.experiment.showStats();

// ===== CHECKPOINT (at 2500 steps) =====
DRUNK_WALKER.experiment.export('summary');

// ===== COMPLETE =====
// When target reached, auto-stops and exports
// Or manually:
DRUNK_WALKER.experiment.stop();

// ===== ANALYZE =====
// Download JSON file
// Run: python analysis/analyze-walk.py drunk-walker-*.json
```

---

## 🔗 Related Documentation

- [HOW_IT_WALKS.md](../docs/HOW_IT_WALKS.md) - PLEDGE algorithm
- [WALK_ANALYSIS.md](../docs/WALK_ANALYSIS.md) - Performance metrics
- [ALGORITHM.md](../docs/ALGORITHM.md) - Technical reference

---

*Experiment framework v1.0.0 - Run long walks with confidence*
