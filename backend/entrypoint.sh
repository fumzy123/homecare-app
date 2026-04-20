#!/bin/bash
# The shebang line above tells the OS to run this file with bash.

# set -e means: stop immediately if any command fails.
# Without this, if "alembic upgrade head" fails, the script would keep going
# and start the server against a broken database. We never want that.
set -e

echo "Running database migrations..."
alembic upgrade head

echo "Starting server..."
# exec replaces this shell process with uvicorn.
# This makes uvicorn PID 1 in the container, which means it receives
# shutdown signals (SIGTERM) correctly when Railway stops the container.
# Without exec, bash would be PID 1 and uvicorn would never get the signal.
#
# PORT is injected by Railway at runtime. We default to 8000 for local use.
exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
