#!/bin/bash
npm install bower
cd mycelyso_inspector/static
../../node_modules/bower/bin/bower --allow-root install
cd ../..
$PYTHON -m pip install . --no-deps --ignore-installed --no-cache-dir -vvv
