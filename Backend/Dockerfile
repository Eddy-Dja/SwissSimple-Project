FROM python:3.13-slim

WORKDIR /app

# 1. Dépendances d'abord (couche cachée : changer api.py ne relance pas pip)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 2. Puis le code (change souvent -> couche séparée)
COPY api.py ingest.py ./

# 3. uvicorn en mode conteneur : 0.0.0.0 = écouter le monde extérieur
CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "8080"]