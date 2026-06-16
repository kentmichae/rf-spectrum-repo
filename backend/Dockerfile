FROM python:3.11-slim AS base

# Install system dependencies for psycopg2 and healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Stage 1: Install dependencies
FROM base AS deps
COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# Stage 2: Production builder
FROM deps AS build
COPY . .

# Stage 3: Final image
FROM python:3.11-slim AS production

# Install curl for healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user for security
RUN groupadd -r appuser && useradd -r -g appuser appuser

WORKDIR /app

# Copy installed dependencies
COPY --from=deps /root/.local /home/appuser/.local
COPY --from=deps /app /app

# Copy application code
COPY app ./app

# Ensure user can read app files
RUN chown -R appuser:appuser /app

USER appuser

# Add local pip directory to PATH
ENV PATH=/home/appuser/.local/bin:$PATH

ENV PYTHONUNBUFFERED=1

EXPOSE 8000

# Run uvicorn
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

# rebuilt-1781643913

# fix-1781644040
# patched-backend-1781645332

# rebuilt-1781645400
# patched-1781645452
