# app/Dockerfile

FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

COPY app/ .
COPY requirements.txt .
RUN pip3 install -r requirements.txt

#EXPOSE 8501
EXPOSE 8080

HEALTHCHECK CMD curl --fail http://localhost:8080/_stcore/health

WORKDIR /
ENTRYPOINT ["streamlit", "run", "app/app.py", "--server.port=8080", "--server.address=0.0.0.0"]
