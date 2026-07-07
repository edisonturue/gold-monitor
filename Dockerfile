FROM python:3.13-slim

ENV PYTHONUNBUFFERED=1 \
    HOST=0.0.0.0 \
    PORT=8080 \
    POLL_INTERVAL_SEC=5 \
    DB_PATH=/data/gold_monitor.db

WORKDIR /app
COPY . /app

EXPOSE 8080
CMD ["python3", "main.py"]
