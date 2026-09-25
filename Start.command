#!/bin/zsh -l
# Doppelklick im Finder: startet die Component Factory und öffnet sie im Browser.
cd "${0:A:h}"
PORT=${PORT:-4173}
if lsof -ti tcp:$PORT >/dev/null 2>&1; then
  echo "Die Fabrik läuft schon auf http://localhost:$PORT"
  open "http://localhost:$PORT"
  exit 0
fi
(sleep 1 && open "http://localhost:$PORT") &
node tools/serve.mjs
