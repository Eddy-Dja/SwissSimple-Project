FROM python:3.13-slim

WORKDIR /app

# 1. Dépendances d'abord (couche cachée : changer api_v2.py ne relance pas pip)
COPY requirements_v2.txt .
RUN pip install --no-cache-dir -r requirements_v2.txt

# 2. Puis le code (change souvent -> couche séparée)
COPY api_v2.py ingest_v2.py ./

# 3. uvicorn en mode conteneur : 0.0.0.0 = écouter le monde extérieur
CMD ["uvicorn", "api_v2:app", "--host", "0.0.0.0", "--port", "8080"]