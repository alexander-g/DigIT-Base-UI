#!/bin/bash

COVERAGE_DIR=./tests/coverage
rm -r $COVERAGE_DIR 2> /dev/null;

./deno.sh test                  \
    --allow-read=.,/tmp         \
    --allow-write=/tmp          \
    --allow-net=esm.sh \
    --no-prompt                 \
    --cached-only               \
    --no-lock                   \
    --coverage=$COVERAGE_DIR/raw    \
    $@

NO_COLOR=1 ./deno.sh coverage --exclude=./tests $COVERAGE_DIR/raw > $COVERAGE_DIR/coverage.txt
./tests/combine_coverage.ts $COVERAGE_DIR/coverage.txt > $COVERAGE_DIR/coverage_summary.txt
cat $COVERAGE_DIR/coverage_summary.txt
