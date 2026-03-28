#!/usr/bin/env python3
"""
Detailed analysis of Tool Usage, specifically focusing on SQL queries.
Extracts: Query, Success/Fail, Error Message, User Goal (inferred).
"""

import json
import re
import sys
from collections import Counter, defaultdict

def parse_log_line(line):
    """Extract JSON data from a log line."""
    if '📥 REQUEST:' in line:
        try:
            return 'request', json.loads(line.split('📥 REQUEST:', 1)[1].strip())
        except:
            return None, None
    elif '✗ RESPONSE:' in line or '✓ RESPONSE:' in line:
        try:
            marker = '✗ RESPONSE:' if '✗ RESPONSE:' in line else '✓ RESPONSE:'
            return 'response', json.loads(line.split(marker, 1)[1].strip())
        except:
            return None, None
    return None, None

def analyze_tools(log_path):
    print(f"📖 Analyzing tool usage in: {log_path}")
    
    interactions = []
    current_interaction = {'user_query': None, 'tool_calls': [], 'result': None}
    
    with open(log_path, 'r', encoding='utf-8', errors='ignore') as f:
        for line in f:
            type_, data = parse_log_line(line)
            if not data:
                continue
            
            if type_ == 'request':
                msg = data.get('user_message', '')
                if not msg: continue
                
                # Check if this is a tool output fed back as a user message
                if "Error executing tool query" in msg:
                    # This is a tool failure result
                    if current_interaction['user_query']:
                        current_interaction['result'] = 'failure'
                        current_interaction['error'] = extract_error_message(msg)
                        current_interaction['query'] = extract_query_from_error(msg)
                        interactions.append(current_interaction)
                        current_interaction = {'user_query': None, 'tool_calls': [], 'result': None}
                    else:
                        # Orphaned error (maybe from previous context)
                        interactions.append({
                            'user_query': "(Unknown/Orphaned)",
                            'result': 'failure',
                            'error': extract_error_message(msg),
                            'query': extract_query_from_error(msg)
                        })
                
                elif is_data_table(msg):
                    # This is a tool success result
                    if current_interaction['user_query']:
                        current_interaction['result'] = 'success'
                        current_interaction['rows'] = count_rows(msg)
                        interactions.append(current_interaction)
                        current_interaction = {'user_query': None, 'tool_calls': [], 'result': None}
                
                else:
                    # This is likely a real user query
                    # If we had a previous pending interaction that didn't get a result, save it
                    if current_interaction['user_query']:
                        interactions.append(current_interaction)
                    
                    current_interaction = {
                        'user_query': msg,
                        'tool_calls': [],
                        'result': 'pending'  # might be chat-only
                    }

    # Summary Generation
    print("\n🔍 SQL TOOL USAGE ANALYSIS")
    print("-" * 60)
    
    sql_interactions = [i for i in interactions if i['result'] in ['success', 'failure']]
    print(f"Total SQL interactions detected: {len(sql_interactions)}")
    
    failures = [i for i in sql_interactions if i['result'] == 'failure']
    successes = [i for i in sql_interactions if i['result'] == 'success']
    
    print(f"Failed Interactions: {len(failures)}")
    print(f"Successful Interactions: {len(successes)}")
    
    if len(sql_interactions) > 0:
        rate = len(successes) / len(sql_interactions) * 100
        print(f"Success Rate: {rate:.1f}%")

    print("\n❌ COMMON FAILURES")
    print("-" * 60)
    error_counts = Counter([i.get('error', 'Unknown') for i in failures])
    for err, count in error_counts.most_common(10):
        print(f"  [{count}x] {err}")

    print("\n📝 DETAILED FAILURE LOG")
    print("-" * 60)
    for i in failures:
        print(f"User Asked: {i['user_query'][:100]}")
        if i.get('query'):
            print(f"Query Tried: {i['query']}")
        print(f"Error: {i.get('error')}")
        print("-" * 30)

    print("\n✅ SUCCESSFUL QUERIES (Sample)")
    print("-" * 60)
    for i in successes[:5]:
        print(f"User Asked: {i['user_query'][:100]}")
        print(f"Result Rows: {i.get('rows')}")
        print("-" * 30)


def extract_query_from_error(msg):
    # Pattern 1: Explicit "Query: " prefix
    match = re.search(r'Query:\s*(SELECT.+)', msg, re.IGNORECASE | re.DOTALL)
    if match:
        return clean_query(match.group(1))
    
    # Pattern 2: Markdown code block with SQL
    match = re.search(r'```sql\s*(.+?)\s*```', msg, re.IGNORECASE | re.DOTALL)
    if match:
        return clean_query(match.group(1))
        
    # Pattern 3: Just the SELECT statement (fallback)
    match = re.search(r'(SELECT\s+.+?(?:;|$))', msg, re.IGNORECASE | re.DOTALL)
    if match:
        return clean_query(match.group(1))
        
    return None

def clean_query(query):
    # Remove any trailing error messages or connecting text
    # Heuristic: SQL usually ends with ; or is the end of the block
    if ";" in query:
        query = query.split(";")[0] + ";"
    return query.strip()

def extract_error_message(msg):
    # Split by newline and take the first relevant line
    lines = msg.split('\n')
    for line in lines:
        if "Error" in line or "failed" in line or "Exception" in line:
            return line.strip()
    return msg[:100]

def is_data_table(msg):
    # Check for markdown table structure
    if "|" in msg and "--+" in msg:
        return True
    # Check for JSON array of objects
    if msg.strip().startswith('[{"') and "}]" in msg:
        return True
    # Check for GeoJSON feature collection
    if 'FeatureCollection' in msg and 'coordinates' in msg:
        return True
    return False

def count_rows(msg):
    return msg.count('\n')

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python analyze_tool_usage.py <log_file>")
        sys.exit(1)
    
    analyze_tools(sys.argv[1])
