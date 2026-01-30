#!/bin/bash
set -e

echo "🔍 Running checks..."

echo "Linting..."
npm run lint

echo "Building..."
npm run build

echo "✅ All checks passed!"
