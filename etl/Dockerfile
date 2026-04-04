FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY src/ src/

# .env is copied as a fallback for environments that don't inject variables
# via docker-compose env_file or runtime --env-file.  The file must be
# present in the etl/ build context (copy it from the repo root if needed).
# docker-compose overrides DATABASE_URL to use the container service hostname,
# so the value in .env is only used when running the image standalone.
COPY .env .env

CMD ["python", "-m", "src.pipeline"]
