/**
 * Benchmark Dashboard and Reporting
 *
 * Generates comprehensive reports from test results.
 * Can be used programmatically or via CLI.
 *
 * Usage:
 *   node src/core/benchmark-dashboard.js
 *   node src/core/benchmark-dashboard.js --format=json --output=report.json
 */

import { TerritoryOracle } from './territory-oracle.js';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// CONFIGURATION
// ============================================================================

const WALKS_DIR = path.join(__dirname, '../../walks');
const REPORTS_DIR = path.join(__dirname, '../../docs/benchmark-reports');

const METRIC_WEIGHTS = {
  escapeSuccess: 0.30,
  maxVisits: 0.25,
  stepsPerLocation: 0.20,
  turnsPer100: 0.15,
  coverage: 0.10
};

// ============================================================================
// DASHBOARD CLASS
// ============================================================================

export class BenchmarkDashboard {
  constructor() {
    this.results = [];
    this.history = [];
  }

  /**
   * Add test result to dashboard
   */
  addResult(result) {
    this.results.push({
      ...result,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Add historical result (for comparison)
   */
  addHistoricalResult(result) {
    this.history.push(result);
  }

  /**
   * Calculate overall score (0-100)
   */
  calculateOverallScore(result) {
    let score = 0;

    // Escape success (30%)
    score += (result.reachedExit ? 1 : 0) * METRIC_WEIGHTS.escapeSuccess * 100;

    // Max visits (25%) - lower is better
    const visitsScore = Math.max(0, 1 - (result.maxArrivals - 1) / 5);
    score += visitsScore * METRIC_WEIGHTS.maxVisits * 100;

    // Steps per location (20%) - lower is better
    const stepsScore = Math.max(0, 1 - result.stepsPerLocation / 10);
    score += stepsScore * METRIC_WEIGHTS.stepsPerLocation * 100;

    // Turns per 100 (15%) - lower is better
    const turnsScore = Math.max(0, 1 - result.turnsPer100 / 50);
    score += turnsScore * METRIC_WEIGHTS.turnsPer100 * 100;

    // Coverage (10%)
    score += (result.coverage || 1) * METRIC_WEIGHTS.coverage * 100;

    return Math.round(score * 10) / 10;
  }

  /**
   * Generate summary report
   */
  generateSummary() {
    if (this.results.length === 0) {
      return { error: 'No results to summarize' };
    }

    const summaries = [];
    const byCategory = {};
    const byDifficulty = {};

    for (const result of this.results) {
      const score = this.calculateOverallScore(result);
      const summary = {
        name: result.testName || 'Unknown',
        category: result.category || 'uncategorized',
        difficulty: result.difficulty || 'unknown',
        score,
        reachedExit: result.reachedExit,
        maxArrivals: result.maxArrivals,
        stepsPerLocation: Math.round(result.stepsPerLocation * 100) / 100,
        turnsPer100: Math.round(result.turnsPer100 * 10),
        coverage: Math.round((result.coverage || 1) * 100) / 100,
        ticks: result.ticks
      };

      summaries.push(summary);

      // Group by category
      if (!byCategory[summary.category]) {
        byCategory[summary.category] = [];
      }
      byCategory[summary.category].push(summary);

      // Group by difficulty
      if (!byDifficulty[summary.difficulty]) {
        byDifficulty[summary.difficulty] = [];
      }
      byDifficulty[summary.difficulty].push(summary);
    }

    // Calculate category averages
    const categoryAverages = {};
    for (const [category, results] of Object.entries(byCategory)) {
      categoryAverages[category] = {
        count: results.length,
        avgScore: Math.round(results.reduce((sum, r) => sum + r.score, 0) / results.length * 10) / 10,
        escapeRate: Math.round(results.filter(r => r.reachedExit).length / results.length * 100),
        avgMaxVisits: Math.round(results.reduce((sum, r) => sum + r.maxArrivals, 0) / results.length * 10) / 10
      };
    }

    // Sort by score
    summaries.sort((a, b) => b.score - a.score);

    return {
      totalTests: this.results.length,
      avgScore: Math.round(summaries.reduce((sum, r) => sum + r.score, 0) / summaries.length * 10) / 10,
      escapeRate: Math.round(summaries.filter(r => r.reachedExit).length / summaries.length * 100),
      summaries,
      categoryAverages,
      byDifficulty,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Generate comparison with historical results
   */
  generateComparison() {
    if (this.history.length === 0) {
      return { error: 'No historical results for comparison' };
    }

    const current = this.generateSummary();
    const historical = {
      avgScore: Math.round(this.history.reduce((sum, r) => sum + r.score, 0) / this.history.length * 10) / 10,
      escapeRate: Math.round(this.history.filter(r => r.reachedExit).length / this.history.length * 100)
    };

    return {
      current,
      historical,
      scoreChange: Math.round((current.avgScore - historical.avgScore) * 10) / 10,
      escapeRateChange: current.escapeRate - historical.escapeRate,
      improved: current.avgScore > historical.avgScore
    };
  }

  /**
   * Export results to JSON
   */
  exportJSON(filePath) {
    const report = {
      summary: this.generateSummary(),
      results: this.results,
      history: this.history,
      exportedAt: new Date().toISOString()
    };

    if (filePath) {
      fs.writeFileSync(filePath, JSON.stringify(report, null, 2));
    }

    return report;
  }

  /**
   * Generate markdown report
   */
  generateMarkdownReport() {
    const summary = this.generateSummary();

    let md = '# 🤪 Drunk Walker - Benchmark Dashboard\n\n';
    md += `**Generated:** ${new Date().toISOString()}\n\n`;

    md += '## 📊 Overall Summary\n\n';
    md += `| Metric | Value |\n`;
    md += `|--------|-------|\n`;
    md += `| Total Tests | ${summary.totalTests} |\n`;
    md += `| Average Score | ${summary.avgScore}/100 |\n`;
    md += `| Escape Rate | ${summary.escapeRate}% |\n\n`;

    md += '## 🏆 Top Performers\n\n';
    md += '| Rank | Test | Score | Escape | Max Visits | Steps/Loc |\n';
    md += '|------|------|-------|--------|------------|----------|\n';

    for (let i = 0; i < Math.min(10, summary.summaries.length); i++) {
      const r = summary.summaries[i];
      md += `| ${i + 1} | ${r.name} | ${r.score} | ${r.reachedExit ? '✅' : '❌'} | ${r.maxArrivals} | ${r.stepsPerLocation} |\n`;
    }

    md += '\n## 📈 By Category\n\n';
    md += '| Category | Tests | Avg Score | Escape Rate | Avg Max Visits |\n';
    md += '|----------|-------|-----------|-------------|----------------|\n';

    for (const [category, stats] of Object.entries(summary.categoryAverages)) {
      md += `| ${category} | ${stats.count} | ${stats.avgScore} | ${stats.escapeRate}% | ${stats.avgMaxVisits} |\n`;
    }

    if (this.history.length > 0) {
      const comparison = this.generateComparison();
      md += '\n## 🔄 Historical Comparison\n\n';
      md += `| Metric | Current | Historical | Change |\n`;
      md += `|--------|---------|------------|--------|\n`;
      md += `| Avg Score | ${comparison.current.avgScore} | ${comparison.historical.avgScore} | ${comparison.scoreChange > 0 ? '+' : ''}${comparison.scoreChange} |\n`;
      md += `| Escape Rate | ${comparison.current.escapeRate}% | ${comparison.historical.escapeRate}% | ${comparison.escapeRateChange > 0 ? '+' : ''}${comparison.escapeRateChange}% |\n`;
    }

    return md;
  }

  /**
   * Save report to file
   */
  saveReport(format = 'markdown', outputDir = REPORTS_DIR) {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);

    if (format === 'json') {
      const filePath = path.join(outputDir, `report-${timestamp}.json`);
      this.exportJSON(filePath);
      console.log(`📄 JSON report saved: ${filePath}`);
    }

    if (format === 'markdown' || format === 'md') {
      const filePath = path.join(outputDir, `report-${timestamp}.md`);
      const md = this.generateMarkdownReport();
      fs.writeFileSync(filePath, md);
      console.log(`📄 Markdown report saved: ${filePath}`);
    }

    // Also update latest report
    const latestPath = path.join(outputDir, 'latest.md');
    fs.writeFileSync(latestPath, this.generateMarkdownReport());
    console.log(`📄 Latest report updated: ${latestPath}`);
  }
}

// ============================================================================
// WALK LOG ANALYZER
// ============================================================================

export class WalkLogAnalyzer {
  constructor(walksDir = WALKS_DIR) {
    this.walksDir = walksDir;
    this.results = [];
  }

  /**
   * Analyze all walk logs
   */
  analyzeAll() {
    if (!fs.existsSync(this.walksDir)) {
      console.error(`❌ Walks directory not found: ${this.walksDir}`);
      return [];
    }

    const files = fs.readdirSync(this.walksDir)
      .filter(f => f.startsWith('dw-logs-') && f.endsWith('.txt'));

    console.log(`\n📁 Analyzing ${files.length} walk logs...`);

    for (const fileName of files) {
      const filePath = path.join(this.walksDir, fileName);
      const result = this.analyzeWalkLog(filePath);
      if (result) {
        this.results.push(result);
      }
    }

    return this.results;
  }

  /**
   * Analyze single walk log
   */
  analyzeWalkLog(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      const steps = [];
      const locationVisits = new Map();
      let stuckTotal = 0;
      let turnTotal = 0;

      for (const line of lines) {
        // Parse step line: [21:00:00] 💓 [326] STUCK: 0 | YAW: 18° | LOC: 52.3723561,4.8725284
        const stepMatch = line.match(/\[\d+:\d+:\d+\]\s+💓\s+\[(\d+)\]\s+STUCK:\s*(\d+)\s*\|\s*YAW:\s*([\d.]+)°?\s*\|\s*LOC:\s*([\d.-]+,[\d.-]+)/);
        if (stepMatch) {
          const stuck = parseInt(stepMatch[2]);
          const location = stepMatch[4];
          steps.push({ stuck, location });

          const count = (locationVisits.get(location) || 0) + 1;
          locationVisits.set(location, count);

          if (stuck > 0) stuckTotal++;
        }

        if (line.includes('decision=') && line.includes('"turn":true')) {
          turnTotal++;
        }
      }

      const uniqueLocations = locationVisits.size;
      const maxVisits = uniqueLocations > 0 ? Math.max(...Array.from(locationVisits.values())) : 0;
      const totalSteps = steps.length;

      return {
        fileName: path.basename(filePath),
        totalSteps,
        uniqueLocations,
        maxVisits,
        visitedStepsRatio: totalSteps > 0 ? uniqueLocations / totalSteps : 0,
        turnsPer100: totalSteps > 0 ? (turnTotal / totalSteps) * 100 : 0,
        stuckRatio: totalSteps > 0 ? stuckTotal / totalSteps : 0,
        locationVisits: new Map(locationVisits)
      };
    } catch (error) {
      console.error(`❌ Error analyzing ${filePath}: ${error.message}`);
      return null;
    }
  }

  /**
   * Generate summary
   */
  generateSummary() {
    if (this.results.length === 0) {
      return { error: 'No results to summarize' };
    }

    const avgVisitedRatio = this.results.reduce((sum, r) => sum + r.visitedStepsRatio, 0) / this.results.length;
    const avgMaxVisits = this.results.reduce((sum, r) => sum + r.maxVisits, 0) / this.results.length;
    const avgTurnsPer100 = this.results.reduce((sum, r) => sum + r.turnsPer100, 0) / this.results.length;
    const avgStuckRatio = this.results.reduce((sum, r) => sum + r.stuckRatio, 0) / this.results.length;

    // Find worst walks
    const worstByVisits = [...this.results].sort((a, b) => b.maxVisits - a.maxVisits).slice(0, 5);
    const worstByStuck = [...this.results].sort((a, b) => b.stuckRatio - a.stuckRatio).slice(0, 5);
    const worstByEfficiency = [...this.results].sort((a, b) => a.visitedStepsRatio - b.visitedStepsRatio).slice(0, 5);

    return {
      totalWalks: this.results.length,
      avgVisitedRatio,
      avgMaxVisits,
      avgTurnsPer100,
      avgStuckRatio,
      worstByVisits,
      worstByStuck,
      worstByEfficiency
    };
  }

  /**
   * Generate markdown report
   */
  generateMarkdownReport() {
    const summary = this.generateSummary();

    let md = `# 🚶 Walk Log Analysis Report\n\n`;
    md += `**Generated:** ${new Date().toISOString()}\n\n`;
    md += `## 📊 Summary (${summary.totalWalks} walks)\n\n`;
    md += '| Metric | Average |\n';
    md += '|--------|--------|\n';
    md += `| Visited/Steps Ratio | ${(summary.avgVisitedRatio * 100).toFixed(1)}% |\n`;
    md += `| Max Visits | ${summary.avgMaxVisits.toFixed(1)} |\n`;
    md += `| Turns/100 | ${summary.avgTurnsPer100.toFixed(1)} |\n`;
    md += `| Stuck Ratio | ${(summary.avgStuckRatio * 100).toFixed(1)}% |\n\n`;

    md += '## 🐌 Worst by Max Visits\n\n';
    md += '| Rank | File | Max Visits | Stuck Ratio |\n';
    md += '|------|------|------------|-------------|\n';
    for (let i = 0; i < summary.worstByVisits.length; i++) {
      const w = summary.worstByVisits[i];
      md += `| ${i + 1} | ${w.fileName} | ${w.maxVisits} | ${(w.stuckRatio * 100).toFixed(0)}% |\n`;
    }

    md += '\n## 🐌 Worst by Stuck Ratio\n\n';
    md += '| Rank | File | Stuck Ratio | Max Visits |\n';
    md += '|------|------|-------------|------------|\n';
    for (let i = 0; i < summary.worstByStuck.length; i++) {
      const w = summary.worstByStuck[i];
      md += `| ${i + 1} | ${w.fileName} | ${(w.stuckRatio * 100).toFixed(0)}% | ${w.maxVisits} |\n`;
    }

    md += '\n## 🐌 Worst by Efficiency\n\n';
    md += '| Rank | File | Visited/Steps | Max Visits |\n';
    md += '|------|------|---------------|------------|\n';
    for (let i = 0; i < summary.worstByEfficiency.length; i++) {
      const w = summary.worstByEfficiency[i];
      md += `| ${i + 1} | ${w.fileName} | ${(w.visitedStepsRatio * 100).toFixed(1)}% | ${w.maxVisits} |\n`;
    }

    return md;
  }

  /**
   * Save report
   */
  saveReport(outputDir = REPORTS_DIR) {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filePath = path.join(outputDir, `walk-analysis-${timestamp}.md`);
    fs.writeFileSync(filePath, this.generateMarkdownReport());
    console.log(`📄 Walk analysis saved: ${filePath}`);

    // Also update latest
    const latestPath = path.join(outputDir, 'walk-analysis-latest.md');
    fs.writeFileSync(latestPath, this.generateMarkdownReport());
    console.log(`📄 Latest walk analysis updated: ${latestPath}`);
  }
}

// ============================================================================
// CLI INTERFACE
// ============================================================================

function printHelp() {
  console.log(`
🤪 Drunk Walker - Benchmark Dashboard

Usage:
  node benchmark-dashboard.js [command] [options]

Commands:
  analyze-walks     Analyze all walk logs
  generate-report   Generate benchmark report
  help              Show this help

Options:
  --format=FORMAT   Output format: json, markdown (default: markdown)
  --output=DIR      Output directory (default: docs/benchmark-reports)
  --verbose         Show detailed output

Examples:
  node benchmark-dashboard.js analyze-walks
  node benchmark-dashboard.js generate-report --format=json
`);
}

// Main CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === 'help') {
    printHelp();
    process.exit(0);
  }

  const format = args.find(a => a.startsWith('--format='))?.split('=')[1] || 'markdown';
  const output = args.find(a => a.startsWith('--output='))?.split('=')[1] || REPORTS_DIR;
  const verbose = args.includes('--verbose');

  if (command === 'analyze-walks') {
    const analyzer = new WalkLogAnalyzer();
    analyzer.analyzeAll();
    analyzer.saveReport(output);

    if (verbose) {
      const summary = analyzer.generateSummary();
      console.log('\n📊 Summary:');
      console.log(`   Total walks: ${summary.totalWalks}`);
      console.log(`   Avg efficiency: ${(summary.avgVisitedRatio * 100).toFixed(1)}%`);
      console.log(`   Avg max visits: ${summary.avgMaxVisits.toFixed(1)}`);
    }
  } else if (command === 'generate-report') {
    const dashboard = new BenchmarkDashboard();
    // Note: Dashboard needs results to be added programmatically from tests
    console.log('⚠️  Dashboard needs test results. Run tests first.');
  } else {
    console.error(`❌ Unknown command: ${command}`);
    printHelp();
    process.exit(1);
  }
}
