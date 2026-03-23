#!/usr/bin/env python3
"""
Drunk Walker - Walk Data Analysis Tool

Analyzes exported walk data from Drunk Walker experiments.
Generates statistics, visualizations, and insights.

Usage:
    python analyze-walk.py <walk-file.json> [--output-dir ./analysis-output]
    
Example:
    python analyze-walk.py drunk-walker-1774224040575.json --output-dir ./results
"""

import json
import sys
import os
import argparse
from datetime import datetime
from collections import defaultdict
from typing import Dict, List, Any, Optional, Tuple

# Try to import optional dependencies
try:
    import networkx as nx
    HAS_NETWORKX = True
except ImportError:
    HAS_NETWORKX = False
    print("Note: Install networkx for graph analysis: pip install networkx")

try:
    import matplotlib.pyplot as plt
    HAS_MATPLOTLIB = True
except ImportError:
    HAS_MATPLOTLIB = False
    print("Note: Install matplotlib for visualizations: pip install matplotlib")


class WalkAnalyzer:
    """Analyzes Drunk Walker experiment data."""
    
    def __init__(self, data: Dict[str, Any]):
        self.data = data
        self.path = data.get('path', [])
        self.graph_data = data.get('graph', None)
        self.experiment = data.get('experiment', {})
        
        # Computed metrics
        self.metrics = {}
        self.graph = None
        
    def compute_basic_metrics(self) -> Dict[str, Any]:
        """Compute basic walk statistics."""
        steps = len(self.path)
        
        # Extract unique locations
        locations = set()
        location_visits = defaultdict(int)
        
        for step in self.path:
            loc = step.get('location')
            if loc:
                locations.add(loc)
                location_visits[loc] += 1
        
        unique = len(locations)
        ratio = unique / steps if steps > 0 else 0
        
        # Visit distribution
        visit_counts = defaultdict(int)
        for loc, count in location_visits.items():
            visit_counts[count] += 1
        
        max_visits = max(location_visits.values()) if location_visits else 0
        
        # Time analysis
        timestamps = [s.get('timestamp', 0) for s in self.path if s.get('timestamp')]
        duration_ms = timestamps[-1] - timestamps[0] if len(timestamps) > 1 else 0
        duration_min = duration_ms / 60000
        
        self.metrics['basic'] = {
            'total_steps': steps,
            'unique_locations': unique,
            'progress_ratio': round(ratio, 4),
            'steps_per_minute': round(steps / duration_min, 2) if duration_min > 0 else 0,
            'unique_per_minute': round(unique / duration_min, 2) if duration_min > 0 else 0,
            'duration_minutes': round(duration_min, 2),
            'max_visits_per_node': max_visits,
            'visit_distribution': dict(visit_counts)
        }
        
        return self.metrics['basic']
    
    def compute_graph_metrics(self) -> Dict[str, Any]:
        """Compute graph-theoretic metrics."""
        if not self.graph_data or not HAS_NETWORKX:
            return {}
        
        # Build networkx graph
        G = nx.DiGraph()
        
        for node in self.graph_data.get('nodes', []):
            G.add_node(
                node['id'],
                lat=node['lat'],
                lng=node['lng'],
                tried_yaws=len(node.get('triedYaws', [])),
                successful_yaws=len(node.get('successfulYaws', [])),
                fully_explored=node.get('isFullyExplored', False)
            )
        
        for edge in self.graph_data.get('edges', []):
            G.add_edge(edge['from'], edge['to'])
        
        self.graph = G
        
        # Compute metrics
        num_nodes = G.number_of_nodes()
        num_edges = G.number_of_edges()
        
        # Degree statistics
        in_degrees = [d for n, d in G.in_degree()]
        out_degrees = [d for n, d in G.out_degree()]
        
        # Connected components (weakly connected for directed graph)
        weakly_connected = nx.number_weakly_connected_components(G)
        
        # Largest component size
        largest_component = max(nx.weakly_connected_components(G), key=len)
        largest_component_size = len(largest_component)
        
        # Cycles (simple cycles - may be slow for large graphs)
        # Only compute for small graphs
        num_cycles = 0
        if num_nodes < 500:
            try:
                cycles = list(nx.simple_cycles(G))
                num_cycles = len(cycles)
            except:
                num_cycles = -1  # Too many cycles
        
        self.metrics['graph'] = {
            'num_nodes': num_nodes,
            'num_edges': num_edges,
            'avg_in_degree': round(sum(in_degrees) / len(in_degrees), 2) if in_degrees else 0,
            'avg_out_degree': round(sum(out_degrees) / len(out_degrees), 2) if out_degrees else 0,
            'max_in_degree': max(in_degrees) if in_degrees else 0,
            'max_out_degree': max(out_degrees) if out_degrees else 0,
            'weakly_connected_components': weakly_connected,
            'largest_component_size': largest_component_size,
            'largest_component_ratio': round(largest_component_size / num_nodes, 4) if num_nodes > 0 else 0,
            'num_simple_cycles': num_cycles,
            'density': round(nx.density(G), 6) if num_nodes > 0 else 0
        }
        
        return self.metrics['graph']
    
    def analyze_efficiency(self) -> Dict[str, Any]:
        """Analyze exploration efficiency over time."""
        if not self.path:
            return {}
        
        # Cumulative unique over time
        seen = set()
        cumulative_unique = []
        
        for i, step in enumerate(self.path):
            loc = step.get('location')
            if loc:
                seen.add(loc)
            cumulative_unique.append(len(seen))
        
        # Compute efficiency in windows
        window_size = 100
        window_efficiency = []
        
        for i in range(0, len(cumulative_unique), window_size):
            window_start = i
            window_end = min(i + window_size, len(cumulative_unique))
            
            if window_end > window_start:
                unique_in_window = cumulative_unique[window_end - 1] - cumulative_unique[window_start]
                efficiency = unique_in_window / (window_end - window_start)
                window_efficiency.append({
                    'window_start': window_start,
                    'window_end': window_end,
                    'unique_new': unique_in_window,
                    'efficiency': round(efficiency, 4)
                })
        
        self.metrics['efficiency'] = {
            'final_ratio': round(cumulative_unique[-1] / len(self.path), 4) if self.path else 0,
            'window_size': window_size,
            'windows': window_efficiency,
            'efficiency_trend': self._compute_efficiency_trend(window_efficiency)
        }
        
        return self.metrics['efficiency']
    
    def _compute_efficiency_trend(self, windows: List[Dict]) -> str:
        """Determine if efficiency is improving, stable, or declining."""
        if len(windows) < 3:
            return 'insufficient_data'
        
        first_half_avg = sum(w['efficiency'] for w in windows[:len(windows)//2]) / (len(windows)//2)
        second_half_avg = sum(w['efficiency'] for w in windows[len(windows)//2:]) / (len(windows) - len(windows)//2)
        
        change = (second_half_avg - first_half_avg) / first_half_avg if first_half_avg > 0 else 0
        
        if change > 0.1:
            return 'improving'
        elif change < -0.1:
            return 'declining'
        else:
            return 'stable'
    
    def generate_report(self) -> str:
        """Generate text report."""
        lines = []
        lines.append("=" * 60)
        lines.append("DRUNK WALKER - WALK ANALYSIS REPORT")
        lines.append("=" * 60)
        lines.append("")
        
        # Basic metrics
        if 'basic' in self.metrics:
            m = self.metrics['basic']
            lines.append("BASIC STATISTICS:")
            lines.append(f"  Total Steps:        {m['total_steps']:,}")
            lines.append(f"  Unique Locations:   {m['unique_locations']:,}")
            lines.append(f"  Progress Ratio:     {m['progress_ratio']:.2%}")
            lines.append(f"  Duration:           {m['duration_minutes']:.2f} minutes")
            lines.append(f"  Steps/minute:       {m['steps_per_minute']:.2f}")
            lines.append(f"  Unique/minute:      {m['unique_per_minute']:.2f}")
            lines.append(f"  Max visits/node:    {m['max_visits_per_node']}")
            lines.append("")
        
        # Graph metrics
        if 'graph' in self.metrics:
            m = self.metrics['graph']
            lines.append("GRAPH STATISTICS:")
            lines.append(f"  Nodes:              {m['num_nodes']:,}")
            lines.append(f"  Edges:              {m['num_edges']:,}")
            lines.append(f"  Avg in-degree:      {m['avg_in_degree']:.2f}")
            lines.append(f"  Avg out-degree:     {m['avg_out_degree']:.2f}")
            lines.append(f"  Connected comps:    {m['weakly_connected_components']}")
            lines.append(f"  Largest component:  {m['largest_component_size']:,} ({m['largest_component_ratio']:.2%})")
            lines.append(f"  Graph density:      {m['density']:.6f}")
            if m['num_simple_cycles'] >= 0:
                lines.append(f"  Simple cycles:      {m['num_simple_cycles']:,}")
            lines.append("")
        
        # Efficiency
        if 'efficiency' in self.metrics:
            m = self.metrics['efficiency']
            lines.append("EFFICIENCY ANALYSIS:")
            lines.append(f"  Final ratio:        {m['final_ratio']:.2%}")
            lines.append(f"  Trend:              {m['efficiency_trend']}")
            lines.append("")
        
        # Export info
        if 'exportTime' in self.data:
            lines.append(f"Export time: {self.data['exportTime']}")
        
        lines.append("")
        lines.append("=" * 60)
        
        return "\n".join(lines)
    
    def create_visualizations(self, output_dir: str) -> List[str]:
        """Create visualization plots."""
        if not HAS_MATPLOTLIB:
            print("matplotlib not available, skipping visualizations")
            return []
        
        created_files = []
        os.makedirs(output_dir, exist_ok=True)
        
        # 1. Progress over time
        if self.path:
            fig, ax = plt.subplots(figsize=(12, 4))
            
            seen = set()
            cumulative = []
            for step in self.path:
                loc = step.get('location')
                if loc:
                    seen.add(loc)
                cumulative.append(len(seen))
            
            ax.plot(cumulative, label='Unique locations')
            ax.plot(range(len(self.path)), label='Total steps', alpha=0.5)
            ax.set_xlabel('Step')
            ax.set_ylabel('Count')
            ax.set_title('Exploration Progress')
            ax.legend()
            ax.grid(True, alpha=0.3)
            
            path = os.path.join(output_dir, 'progress.png')
            plt.savefig(path, dpi=150, bbox_inches='tight')
            plt.close()
            created_files.append(path)
        
        # 2. Efficiency over time (windowed)
        if 'efficiency' in self.metrics and 'windows' in self.metrics['efficiency']:
            fig, ax = plt.subplots(figsize=(12, 4))
            
            windows = self.metrics['efficiency']['windows']
            x = [w['window_start'] for w in windows]
            y = [w['efficiency'] for w in windows]
            
            ax.plot(x, y, marker='o', markersize=3)
            ax.axhline(y=0.5, color='r', linestyle='--', label='50% efficiency')
            ax.axhline(y=0.7, color='g', linestyle='--', label='70% efficiency')
            ax.set_xlabel('Step')
            ax.set_ylabel('Efficiency (unique/steps in window)')
            ax.set_title('Exploration Efficiency Over Time')
            ax.legend()
            ax.grid(True, alpha=0.3)
            
            path = os.path.join(output_dir, 'efficiency.png')
            plt.savefig(path, dpi=150, bbox_inches='tight')
            plt.close()
            created_files.append(path)
        
        # 3. Visit distribution
        if 'basic' in self.metrics and 'visit_distribution' in self.metrics['basic']:
            fig, ax = plt.subplots(figsize=(10, 4))
            
            dist = self.metrics['basic']['visit_distribution']
            visits = sorted(dist.keys())
            counts = [dist[v] for v in visits]
            
            ax.bar(visits, counts)
            ax.set_xlabel('Number of visits')
            ax.set_ylabel('Number of nodes')
            ax.set_title('Node Visit Distribution')
            ax.grid(True, alpha=0.3, axis='y')
            
            path = os.path.join(output_dir, 'visit_distribution.png')
            plt.savefig(path, dpi=150, bbox_inches='tight')
            plt.close()
            created_files.append(path)
        
        # 4. Graph visualization (if networkx available and small enough)
        if self.graph and HAS_NETWORKX and self.graph.number_of_nodes() < 1000:
            fig, ax = plt.subplots(figsize=(12, 12))
            
            # Get positions from node coordinates
            pos = {}
            for node, data in self.graph.nodes(data=True):
                pos[node] = (data.get('lng', 0), data.get('lat', 0))
            
            # Color by exploration status
            node_colors = []
            for node, data in self.graph.nodes(data=True):
                if data.get('fully_explored'):
                    node_colors.append('red')
                elif data.get('successful_yaws', 0) > 2:
                    node_colors.append('green')
                else:
                    node_colors.append('blue')
            
            nx.draw_networkx(
                self.graph, pos,
                node_size=20,
                node_color=node_colors,
                edge_color='gray',
                alpha=0.7,
                ax=ax
            )
            
            ax.set_title('Street View Graph')
            ax.axis('off')
            
            path = os.path.join(output_dir, 'graph.png')
            plt.savefig(path, dpi=150, bbox_inches='tight')
            plt.close()
            created_files.append(path)
        
        return created_files


def load_walk_data(filepath: str) -> Dict[str, Any]:
    """Load walk data from JSON file."""
    with open(filepath, 'r', encoding='utf-8') as f:
        return json.load(f)


def main():
    parser = argparse.ArgumentParser(
        description='Analyze Drunk Walker experiment data'
    )
    parser.add_argument(
        'input_file',
        help='Path to walk data JSON file'
    )
    parser.add_argument(
        '--output-dir', '-o',
        default='./analysis-output',
        help='Output directory for results (default: ./analysis-output)'
    )
    parser.add_argument(
        '--no-plots',
        action='store_true',
        help='Skip generating plots'
    )
    
    args = parser.parse_args()
    
    # Load data
    print(f"Loading walk data from: {args.input_file}")
    try:
        data = load_walk_data(args.input_file)
    except Exception as e:
        print(f"Error loading file: {e}")
        sys.exit(1)
    
    # Create analyzer
    analyzer = WalkAnalyzer(data)
    
    # Compute metrics
    print("Computing basic metrics...")
    analyzer.compute_basic_metrics()
    
    print("Computing graph metrics...")
    analyzer.compute_graph_metrics()
    
    print("Analyzing efficiency...")
    analyzer.analyze_efficiency()
    
    # Generate report
    print("\n" + analyzer.generate_report())
    
    # Save report
    os.makedirs(args.output_dir, exist_ok=True)
    report_path = os.path.join(args.output_dir, 'analysis-report.txt')
    with open(report_path, 'w', encoding='utf-8') as f:
        f.write(analyzer.generate_report())
    print(f"\nReport saved to: {report_path}")
    
    # Create visualizations
    if not args.no_plots:
        print("\nGenerating visualizations...")
        plot_files = analyzer.create_visualizations(args.output_dir)
        for path in plot_files:
            print(f"  Created: {path}")
    
    # Save metrics as JSON
    metrics_path = os.path.join(args.output_dir, 'metrics.json')
    with open(metrics_path, 'w', encoding='utf-8') as f:
        json.dump(analyzer.metrics, f, indent=2)
    print(f"\nMetrics saved to: {metrics_path}")
    
    print("\n✅ Analysis complete!")


if __name__ == '__main__':
    main()
