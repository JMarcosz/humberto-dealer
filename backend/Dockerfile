# ==============================================================================
# Multi-Stage Dockerfile for Humberto Dealer Backend (Flask 3 + Gunicorn)
# Base: Python 3.12-slim (Debian)
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Builder (compilación de dependencias en virtualenv)
# ------------------------------------------------------------------------------
FROM python:3.12-slim AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /build

# Dependencias del sistema para compilar librerías criptográficas / C extensions
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libffi-dev \
    && rm -rf /var/lib/apt/lists/*

# Crear entorno virtual aislado
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Copiar e instalar dependencias Python aprovechando el caché de Docker
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# ------------------------------------------------------------------------------
# Stage 2: Runtime (imagen final mínima y segura)
# ------------------------------------------------------------------------------
FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/opt/venv/bin:$PATH" \
    PORT=5001 \
    UPLOAD_FOLDER=/app/uploads

WORKDIR /app

# Copiar únicamente el virtualenv preparado desde el builder
COPY --from=builder /opt/venv /opt/venv

# Crear usuario sin privilegios por seguridad (evita ejecutar como root)
RUN groupadd -g 10001 appgroup && \
    useradd -u 10001 -g appgroup -s /bin/bash -m appuser && \
    mkdir -p /app/uploads && \
    chown -R appuser:appgroup /app

# Copiar código fuente
COPY --chown=appuser:appgroup . /app

# Cambiar a usuario no root
USER appuser

EXPOSE 5001

# Healthcheck interno sin depender de utilidades externas
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD python -c "import urllib.request; sys_exit = 0 if urllib.request.urlopen('http://127.0.0.1:5001/api/health').getcode() == 200 else 1; exit(sys_exit)"

# Ejecución en producción con Gunicorn WSGI
CMD ["gunicorn", \
     "--bind", "0.0.0.0:5001", \
     "--workers", "3", \
     "--threads", "2", \
     "--timeout", "60", \
     "--access-logfile", "-", \
     "--error-logfile", "-", \
     "run:crear_app()"]
