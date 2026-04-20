# ─── Stage: Runtime ───────────────────────────────────────────────────────────
# FROM tells Docker which base image to start from.
# Think of a base image as a pre-built computer with an OS already installed.
# "python:3.13-slim" means: Linux (Debian) + Python 3.13, slim = no extras.
# This single line gives us a working Linux machine with Python — we didn't
# have to install an OS or Python ourselves.
FROM python:3.13-slim

# Create a non-root user called "appuser".
# By default Docker runs everything as root (the most powerful Linux user).
# That's a security risk — if someone hacks your app they get root access.
# We create a restricted user and run the app as that user instead.
RUN adduser --disabled-password --gecos '' appuser

# WORKDIR sets the working directory inside the container.
# Every command after this runs from /app, and files land here.
# It's like doing "mkdir /app && cd /app" permanently.
WORKDIR /app

# COPY <source on your machine> <destination inside container>
# We copy requirements.txt first — BEFORE copying the app code.
# Why? Docker builds in layers and caches each one.
# If you copy requirements.txt separately, Docker only re-runs pip install
# when requirements.txt changes — not every time you change a .py file.
# This makes rebuilds much faster.
COPY requirements.txt .

# RUN executes a shell command while building the image.
# pip install --no-cache-dir: installs all dependencies, skips pip's download
# cache (we don't need it in the image — saves disk space).
RUN pip install --no-cache-dir -r requirements.txt

# Now copy the rest of the application code into the container.
# Because this comes AFTER pip install, code changes don't bust the
# dependency cache layer above.
COPY . .

# Give appuser ownership of everything in /app.
# We installed packages as root, so we fix ownership before switching users.
RUN chown -R appuser:appuser /app

# Switch to the non-root user for all commands from here on.
USER appuser

# EXPOSE documents which port the app listens on.
# This is informational — it doesn't actually open the port.
# Railway (and other platforms) read this to know where to route traffic.
EXPOSE 8000

# ENTRYPOINT defines the command that runs when the container starts.
# We point to our entrypoint script which runs migrations then starts the server.
ENTRYPOINT ["./entrypoint.sh"]
