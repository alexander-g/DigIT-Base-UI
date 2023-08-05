#!/bin/bash -e

COVERAGE_DIR=./tests/coverage
rm -rf $COVERAGE_DIR

./deno.sh check frontend/ts/index.tsx
./deno.sh test                  \
    --allow-read=.,/tmp         \
    --allow-write=/tmp          \
    --allow-env=DENO_DIR        \
    --allow-net=cdn.jsdelivr.net \
    --no-prompt                 \
    --cached-only               \
    --coverage=$COVERAGE_DIR/raw    \
    $@

NO_COLOR=1 ./deno.sh coverage --exclude=./tests $COVERAGE_DIR/raw > $COVERAGE_DIR/coverage.txt
./tests/combine_coverage.ts $COVERAGE_DIR/coverage.txt > $COVERAGE_DIR/coverage_summary.txt
cat $COVERAGE_DIR/coverage_summary.txt
