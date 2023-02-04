#!/bin/bash


./deno.sh test                  \
    --allow-read=.,/tmp         \
    --allow-write=/tmp          \
    --allow-net=esm.sh \
    --no-prompt                 \
    --cached-only               \
    --no-lock                   \
    tests/testcases_deno/       \
    $@
