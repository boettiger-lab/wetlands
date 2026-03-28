#!/usr/bin/env python3
"""
Analyze LLM Proxy logs to extract query statistics and model usage patterns.

Usage:
    python analyze_logs.py --days 7     # Analyze logs from the past 7 days
    python analyze_logs.py <log_file>   # Analyze a specific log file
"""

import json
import re
import sys
import subprocess
import tempfile
from collections import defaultdict, Counter
from pathlib import Path
from datetime import datetime, timedelta
import argparse


def parse_log_file(log_path):
    """Parse a log file and extract request/response data, removing duplicates."""

    """Parse a log file and extract request/response data, removing duplicates."""
    requests = []
    responses = []
    seen_request_timestamps = set()
    seen_response_timestamps = set()
    duplicate_requests = 0
    duplicate_responses = 0
    
    with open(log_path, 'r', encoding='utf-8', errors='ignore') as f:
        for line in f:
            # Look for REQUEST and RESPONSE log entries
            if '📥 REQUEST:' in line:
                try:
                    json_str = line.split('📥 REQUEST:', 1)[1].strip()
                    req_data = json.loads(json_str)
                    timestamp = req_data.get('timestamp')
                    
                    # Skip if we've already seen this timestamp
                    if timestamp and timestamp in seen_request_timestamps:
                        duplicate_requests += 1
                        continue
                    
                    if timestamp:
                        seen_request_timestamps.add(timestamp)
                    requests.append(req_data)
                except (json.JSONDecodeError, IndexError):
                    pass
            elif '✓ RESPONSE:' in line:
                try:
                    json_str = line.split('✓ RESPONSE:', 1)[1].strip()
                    resp_data = json.loads(json_str)
                    timestamp = resp_data.get('timestamp')
                    
                    # Skip if we've already seen this timestamp
                    if timestamp and timestamp in seen_response_timestamps:
                        duplicate_responses += 1
                        continue
                    
                    if timestamp:
                        seen_response_timestamps.add(timestamp)
                    responses.append(resp_data)
                except (json.JSONDecodeError, IndexError):
                    pass
    
    if duplicate_requests > 0 or duplicate_responses > 0:
        print(f"ℹ️  Removed {duplicate_requests} duplicate requests and {duplicate_responses} duplicate responses")
    
    return requests, responses


def analyze_requests(requests):
    """Analyze request patterns and extract unique queries."""
    model_counts = Counter()
    provider_counts = Counter()
    unique_queries = []
    tool_usage = Counter()
    
    for req in requests:
        model = req.get('model', 'unknown')
        provider = req.get('provider', 'unknown')
        user_msg = req.get('user_message', '')
        tools_count = req.get('tools_count', 0)
        
        model_counts[model] += 1
        provider_counts[provider] += 1
        
        # Store unique queries (truncate if too long)
        if user_msg and user_msg not in [q['message'] for q in unique_queries]:
            truncated_msg = user_msg[:200] + '...' if len(user_msg) > 200 else user_msg
            unique_queries.append({
                'message': user_msg,
                'display': truncated_msg,
                'timestamp': req.get('timestamp', ''),
                'model': model,
                'tools_count': tools_count
            })
    
    return {
        'model_counts': model_counts,
        'provider_counts': provider_counts,
        'unique_queries': unique_queries,
        'tool_usage': tool_usage
    }


def analyze_responses(responses):
    """Analyze response patterns including latency and token usage."""
    latencies = []
    total_tokens = 0
    total_cost = 0.0
    tool_calls_made = Counter()
    
    for resp in responses:
        latency = resp.get('latency_ms', 0)
        if latency:
            latencies.append(latency)
        
        tokens = resp.get('tokens', {})
        total_tokens += tokens.get('total_tokens', 0)
        total_cost += tokens.get('cost', 0.0)
        
        # Count tool calls
        tool_calls = resp.get('tool_calls', [])
        if isinstance(tool_calls, list):
            for tool in tool_calls:
                tool_calls_made[tool] += 1
    
    avg_latency = sum(latencies) / len(latencies) if latencies else 0
    
    return {
        'avg_latency_ms': avg_latency,
        'min_latency_ms': min(latencies) if latencies else 0,
        'max_latency_ms': max(latencies) if latencies else 0,
        'total_tokens': total_tokens,
        'total_cost': total_cost,
        'tool_calls_made': tool_calls_made,
        'response_count': len(responses)
    }


def analyze_temporal_patterns(requests):
    """Analyze temporal patterns in request data."""
    if not requests:
        return {
            'total_calls': 0,
            'calls_by_date': {},
            'date_range': None,
            'busiest_day': None,
            'busiest_day_count': 0
        }
    
    calls_by_date = Counter()
    timestamps = []
    
    for req in requests:
        timestamp_str = req.get('timestamp', '')
        if timestamp_str:
            try:
                # Parse ISO format timestamp
                dt = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
                date_str = dt.strftime('%Y-%m-%d')
                calls_by_date[date_str] += 1
                timestamps.append(dt)
            except (ValueError, AttributeError):
                pass
    
    if not timestamps:
        return {
            'total_calls': len(requests),
            'calls_by_date': {},
            'date_range': None,
            'busiest_day': None,
            'busiest_day_count': 0
        }
    
    min_date = min(timestamps)
    max_date = max(timestamps)
    date_range = (max_date - min_date).days + 1
    
    busiest_day = calls_by_date.most_common(1)[0] if calls_by_date else (None, 0)
    
    return {
        'total_calls': len(requests),
        'calls_by_date': dict(calls_by_date),
        'date_range': date_range,
        'min_date': min_date.strftime('%Y-%m-%d'),
        'max_date': max_date.strftime('%Y-%m-%d'),
        'busiest_day': busiest_day[0],
        'busiest_day_count': busiest_day[1]
    }


def print_summary(request_analysis, response_analysis, temporal_analysis):
    """Print formatted summary of log analysis."""
    print("\n" + "="*70)
    print("LLM PROXY LOG ANALYSIS")
    print("="*70)
    
    # Temporal Patterns
    print("\n📅 TEMPORAL PATTERNS")
    print("-" * 70)
    print(f"  Total Calls: {temporal_analysis['total_calls']}")
    if temporal_analysis['date_range']:
        print(f"  Date Range: {temporal_analysis['min_date']} to {temporal_analysis['max_date']}")
        print(f"  Sampling Period: {temporal_analysis['date_range']} days")
        print(f"  Busiest Day: {temporal_analysis['busiest_day']} ({temporal_analysis['busiest_day_count']} calls)")
        avg_calls_per_day = temporal_analysis['total_calls'] / temporal_analysis['date_range']
        print(f"  Average Calls/Day: {avg_calls_per_day:.1f}")
        
        # Show daily breakdown
        if temporal_analysis['calls_by_date']:
            print("\n  Daily Breakdown:")
            for date in sorted(temporal_analysis['calls_by_date'].keys()):
                count = temporal_analysis['calls_by_date'][date]
                bar = '█' * (count // 2) if count > 0 else ''
                print(f"    {date}: {count:3d} {bar}")
    
    # Model Distribution
    print("\n📊 MODEL USAGE DISTRIBUTION")
    print("-" * 70)
    for model, count in request_analysis['model_counts'].most_common():
        percentage = (count / sum(request_analysis['model_counts'].values())) * 100
        print(f"  {model}: {count} calls ({percentage:.1f}%)")
    
    # Provider Distribution
    print("\n🌐 PROVIDER DISTRIBUTION")
    print("-" * 70)
    for provider, count in request_analysis['provider_counts'].most_common():
        percentage = (count / sum(request_analysis['provider_counts'].values())) * 100
        print(f"  {provider}: {count} calls ({percentage:.1f}%)")
    
    # Performance Metrics
    print("\n⚡ PERFORMANCE METRICS")
    print("-" * 70)
    print(f"  Total Requests: {len(request_analysis['unique_queries'])}")
    print(f"  Total Responses: {response_analysis['response_count']}")
    print(f"  Average Latency: {response_analysis['avg_latency_ms']:.0f}ms")
    print(f"  Min Latency: {response_analysis['min_latency_ms']:.0f}ms")
    print(f"  Max Latency: {response_analysis['max_latency_ms']:.0f}ms")
    
    # Token and Cost Stats
    print("\n💰 TOKEN & COST STATISTICS")
    print("-" * 70)
    print(f"  Total Tokens Used: {response_analysis['total_tokens']:,}")
    print(f"  Total Cost: ${response_analysis['total_cost']:.4f}")
    if response_analysis['response_count'] > 0:
        avg_tokens = response_analysis['total_tokens'] / response_analysis['response_count']
        avg_cost = response_analysis['total_cost'] / response_analysis['response_count']
        print(f"  Average Tokens per Request: {avg_tokens:.0f}")
        print(f"  Average Cost per Request: ${avg_cost:.4f}")
    
    # Tool Usage
    if response_analysis['tool_calls_made']:
        print("\n🔧 TOOL CALLS DISTRIBUTION")
        print("-" * 70)
        for tool, count in response_analysis['tool_calls_made'].most_common():
            print(f"  {tool}: {count} calls")
    
    # Unique Queries
    print("\n💬 UNIQUE QUERIES")
    print("-" * 70)
    print(f"  Total Unique Queries: {len(request_analysis['unique_queries'])}")
    print("\n  Recent Queries:")
    for i, query in enumerate(request_analysis['unique_queries'][-10:], 1):
        timestamp = query.get('timestamp', '')[:10]  # Just the date
        print(f"\n  {i}. [{timestamp}] ({query['model']})")
        print(f"     {query['display']}")
    
    print("\n" + "="*70)



def download_logs_from_s3(days: int) -> Path:
    """Download logs from S3 and return path to combined log file."""
    # Calculate date range
    today = datetime.now()
    start_date = today - timedelta(days=days)
    
    print(f"📥 Downloading logs from the past {days} days...")
    
    # Create temp directory for downloads
    logs_dir = Path(__file__).parent.parent / 'logs'
    logs_dir.mkdir(exist_ok=True)
    
    # Download from S3
    result = subprocess.run(
        ['rclone', 'copy', 'nrp:logs-wetlands/', str(logs_dir)],
        capture_output=True, text=True
    )
    if result.returncode != 0:
        print(f"❌ rclone failed: {result.stderr}")
        sys.exit(1)
    
    # Filter unified logs by date in filename
    combined_content = []
    for log_file in sorted(logs_dir.glob('llm-proxy-unified_*.log')):
        # Extract date from filename: llm-proxy-unified_YYYYMMDD_HHMMSS.log
        try:
            date_str = log_file.name.split('_')[1]
            file_date = datetime.strptime(date_str, '%Y%m%d')
            if file_date >= start_date:
                with open(log_file, 'r', encoding='utf-8', errors='ignore') as f:
                    combined_content.append(f.read())
        except (IndexError, ValueError):
            continue
    
    if not combined_content:
        print(f"❌ No logs found for the past {days} days")
        sys.exit(1)
    
    # Write combined file
    combined_path = logs_dir / f'combined_{days}days.log'
    with open(combined_path, 'w') as f:
        f.write('\n'.join(combined_content))
    
    print(f"✓ Combined {len(combined_content)} log files")
    return combined_path


def main():
    parser = argparse.ArgumentParser(
        description='Analyze LLM Proxy logs for query statistics and usage patterns.'
    )
    parser.add_argument(
        '--days', '-d', type=int, default=None,
        help='Analyze logs from the past N days (downloads from S3 automatically)'
    )
    parser.add_argument(
        'log_file', nargs='?', default=None,
        help='Path to a specific log file to analyze'
    )
    
    args = parser.parse_args()
    
    # Determine log source
    if args.days:
        log_path = download_logs_from_s3(args.days)
    elif args.log_file:
        log_path = Path(args.log_file)
        if not log_path.exists():
            print(f"❌ Log file not found: {log_path}")
            sys.exit(1)
    else:
        # Default: find most recent local log
        logs_dir = Path(__file__).parent.parent / 'logs'
        unified_logs = list(logs_dir.glob('llm-proxy-unified_*.log'))
        if not unified_logs:
            print("❌ No logs found. Use --days N to download from S3.")
            sys.exit(1)
        log_path = max(unified_logs, key=lambda p: p.stat().st_mtime)
    
    print(f"📖 Analyzing: {log_path}")
    
    # Parse and analyze
    requests, responses = parse_log_file(log_path)
    
    if not requests and not responses:
        print("⚠️  No request/response data found in log file.")
        sys.exit(1)
    
    request_analysis = analyze_requests(requests)
    response_analysis = analyze_responses(responses)
    temporal_analysis = analyze_temporal_patterns(requests)
    
    print_summary(request_analysis, response_analysis, temporal_analysis)


if __name__ == '__main__':
    main()
