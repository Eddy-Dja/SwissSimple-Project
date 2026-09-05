"""Test de l'API d'embeddings Gemini — AVANT tout le reste.
Affiche le modèle qui fonctionne et la DIMENSION des vecteurs.
Reporte ces deux valeurs dans le SQL et dans les scripts v2."""
import os
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv(dotenv_path=".env")
GEMINI_KEY = os.getenv("GEMINI_KEY")

client = OpenAI(
    api_key=GEMINI_KEY,
    base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
)

texte_test = "Quelles sont les déductions pour les enfants ?"

for model_id in ("gemini-embedding-001", "gemini-embedding-2", "gemini-embedding-2-preview"):
    try:
        resp = client.embeddings.create(model=model_id, input=texte_test)
        emb = resp.data[0].embedding
        print(f"✅ Modèle qui fonctionne : {model_id}")
        print(f"   Dimension des vecteurs : {len(emb)}")
        print(f"   Premières valeurs : {[round(v, 4) for v in emb[:3]]}")
        print(f"\n>>> Reporte '{model_id}' comme EMBEDDING_MODEL dans ingest_v2.py ET api_v2.py")
        print(f">>> Reporte {len(emb)} à la place de 768 dans le SQL (VECTOR({len(emb)}))")
        break
    except Exception as e:
        print(f"❌ {model_id} : {e}")