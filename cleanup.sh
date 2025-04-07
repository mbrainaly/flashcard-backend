#!/bin/bash

# Script to remove duplicate JavaScript files from the src directory
# This should be run before building and deploying

echo "Finding JavaScript files that have TypeScript equivalents..."

# Find all JavaScript files in the src directory
find src -name "*.js" | while read js_file; do
  # Construct the equivalent TypeScript file path
  ts_file="${js_file%.js}.ts"
  
  # Check if the TypeScript file exists
  if [ -f "$ts_file" ]; then
    echo "Removing duplicate: $js_file (TypeScript version exists)"
    rm "$js_file"
  fi
done

echo "Cleanup complete!" 