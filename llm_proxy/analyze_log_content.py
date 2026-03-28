#!/usr/bin/env python3
"""
Qualitative analysis of LLM Proxy logs.
Focus: Duplicate detection, common questions clustering, and failure analysis.
"""

import json
from collections import Counter, defaultdict
import sys
from pathlib import Path
from datetime import datetime
import re

def parse_log_line(line):
    """Extract JSON data from a log line."""
    if '📥 REQUEST:' in line:
        try:
            return 'request', json.loads(line.split('📥 REQUEST:', 1)[1].strip())
        except:
            return None, None
    elif '✗ RESPONSE:' in line or '✓ RESPONSE:' in line:
        try:
            # Handle both success and failure markers
            marker = '✗ RESPONSE:' if '✗ RESPONSE:' in line else '✓ RESPONSE:'
            return 'response', json.loads(line.split(marker, 1)[1].strip())
        except:
            return None, None
    return None, None

def analyze_content(log_path):
    print(f"📖 Analyzing content of: {log_path}")
    
    # Trackers
    all_timestamps = []
    user_queries = []
    failures = []
    short_responses = []
    
    # For duplicate detection
    unique_entries = set()
    exact_duplicates = 0
    
    with open(log_path, 'r', encoding='utf-8', errors='ignore') as f:
        for line in f:
            type_, data = parse_log_line(line)
            if not data:
                continue
                
            # thorough duplicate check stringifying the whole data dict
            data_str = json.dumps(data, sort_keys=True)
            if data_str in unique_entries:
                exact_duplicates += 1
                continue
            unique_entries.add(data_str)
            
            # Content Analysis
            if type_ == 'request':
                msg = data.get('user_message', '').strip()
                if msg:
                    user_queries.append(msg)
                    
            elif type_ == 'response':
                # Check for explicit errors
                if 'error' in data:
                    failures.append(f"Error: {data['error']}")
                
                # Check for short responses (potential failures)
                if not data.get('error'):
                    preview = data.get('content_preview', '')
                    if len(preview) < 20 and not data.get('tool_calls'):
                        short_responses.append(f"Short response ({len(preview)} chars): {preview}")

    # 1. Duplicate Analysis
    print("\n🔍 DUPLICATE ANALYSIS")
    print("-" * 60)
    print(f"Total unique log entries processed: {len(unique_entries)}")
    print(f"Exact duplicates removed: {exact_duplicates}")
    if exact_duplicates > 0:
        print("  (This confirms the logs had overlaps which were safely handled)")
    else:
        print("  (No exact duplicates found)")

    # 2. Common Questions (Clustering)
    print("\n💬 COMMON QUESTIONS")
    print("-" * 60)
    # Normalize queries for better grouping (lowercase, remove punctuation)
    normalized_queries = defaultdict(list)
    for q in user_queries:
        norm = re.sub(r'[^\w\s]', '', q.lower())
        normalized_queries[norm].append(q)
    
    # Sort by frequency
    sorted_queries = sorted(normalized_queries.items(), key=lambda x: len(x[1]), reverse=True)
    
    print(f"Top {min(10, len(sorted_queries))} most frequent question types:")
    for norm, originals in sorted_queries[:10]:
        count = len(originals)
        example = originals[0].replace('\n', ' ')[:80]
        if len(example) < len(originals[0]): example += "..."
        print(f"  [{count:3d}x] {example}")

    # 3. Unique Questions (Random sample of singletons)
    print("\n🦄 UNIQUE QUESTIONS (Sample)")
    print("-" * 60)
    singletons = [orig[0] for norm, orig in sorted_queries if len(orig) == 1]
    import random
    sample_size = min(5, len(singletons))
    if sample_size > 0:
        for q in random.sample(singletons, sample_size):
            clean_q = q.replace('\n', ' ')[:100]
            print(f"  - {clean_q}")
    else:
        print("  No unique questions found.")

    # 4. Failure/Issue Analysis
    print("\n⚠️  POTENTIAL FAILURES")
    print("-" * 60)
    if failures:
        print(f"Found {len(failures)} explicit errors:")
        for fail in failures[:10]:
            print(f"  - {fail}")
    else:
        print("  No explicit 'error' fields found in responses.")

    if short_responses:
        print(f"\nFound {len(short_responses)} suspiciously short responses:")
        for resp in short_responses[:10]:
            print(f"  - {resp}")
            
    # Check queries for help signals
    help_keywords = ['error', 'broken', 'fail', 'help', 'stuck', 'not working']
    distress_signals = [q for q in user_queries if any(k in q.lower() for k in help_keywords)]
    
    if distress_signals:
        print(f"\nUser queries containing 'error', 'fail', etc. ({len(distress_signals)}):")
        for q in distress_signals[:10]:
            print(f"  - {q.replace('\n', ' ')[:80]}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python analyze_log_content.py <log_file>")
        sys.exit(1)
    
    analyze_content(sys.argv[1])
