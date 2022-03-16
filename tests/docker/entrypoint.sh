#!/bin/sh

#MEANT TO BE RUN IN DOCKER


export STATIC_PATH=/root/static
mkdir $STATIC_PATH
export ROOT_PATH=/root/workspace
export PYTHONPATH=$ROOT_PATH
coverage run --include=/root/workspace/backend/* -m pytest --tb=native --disable-warnings --show-capture=all --html=/root/latest_logs/pytest_report.html --self-contained-html --pdb
coverage html --directory=/root/latest_logs/coverage/
coverage report | tee /root/latest_logs/coverage_report.txt
python3 /root/workspace/tests/generate_js_codecoverage_report.py

chmod -R a+w latest_logs/*
