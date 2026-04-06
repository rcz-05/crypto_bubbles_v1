#!/bin/sh

set -eu

STATIC_DIR=".next/static/local-build"

(
  while :
  do
    mkdir -p "$STATIC_DIR"
    sleep 1
  done
) &
watcher=$!

cleanup() {
  kill "$watcher" 2>/dev/null || true
}

trap cleanup EXIT INT TERM

next build --webpack
