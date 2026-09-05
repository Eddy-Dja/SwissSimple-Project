"""Ingestion V2 — même pipeline (PDFs -> chunks par paragraphes ->
Supabase) mais vectorisation via l'API Gemini au lieu du modèle local.
Écrit dans tax_documents_v2. La V1 reste intacte.
Version avec SAUT des cantons déjà complets : reprise possible après
un épuisement de quota journalier sans re-consommer de requêtes."""
import os
import re
import time
import unicodedata

from dotenv import load_dotenv
from supabase import create_client
from openai import OpenAI
import pdfplumber

load_dotenv(dotenv_path=".env")
SB_URL = os.getenv("SUPABASE_URL")
SB_KEY = os.getenv("SUPABASE_KEY")
GEMINI_KEY = os.getenv("GEMINI_KEY")

EMBEDDING_MODEL = "gemini-embedding-001"   # confirmé par test_embedding.py
BATCH_SIZE = 20            # textes par appel API
PAUSE_ENTRE_LOTS = 1.0     # secondes (anti rate-limit)

print("Initialisation du client embeddings Gemini...")
gemini_client = OpenAI(
    api_key=GEMINI_KEY,
    base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
)
supabase = create_client(SB_URL, SB_KEY)

# ============================================================
# RÉSOLUTION des noms de cantons (identique à la V1)
# ============================================================
ALIASES = {
    'Aargau':                  ['aargau', 'argovie'],
    'Appenzell Ausserrhoden':  ['appenzellausserrhoden', 'appenzellrhodesexterieures',
                                 'appenzellouterrhoden', 'rhodesexterieures'],
    'Appenzell Innerrhoden':   ['appenzellinnerrhoden', 'appenzellrhodesinterieures',
                                 'rhodesinterieures'],
    'Basel-Landschaft':        ['basellandschaft', 'balecampagne', 'baselcampagne',
                                 'baselland', 'bale campagne'],
    'Basel-Stadt':             ['baselstadt', 'baleville', 'baselville', 'bale ville'],
    'Bern':                    ['bern', 'berne'],
    'Fribourg':                ['fribourg', 'freiburg'],
    'Genève':                  ['geneve', 'genf'],
    'Glarus':                  ['glarus', 'glaris'],
    'Graubünden':              ['graubunden', 'grisons', 'grissons', 'grigioni'],
    'Jura':                    ['jura'],
    'Luzern':                  ['luzern', 'lucerne'],
    'Neuchâtel':               ['neuchatel', 'neuenburg'],
    'Nidwalden':               ['nidwalden', 'nidwald'],
    'Obwalden':                ['obwalden', 'obwald'],
    'Schaffhausen':            ['schaffhausen', 'schaffhouse'],
    'Schwyz':                  ['schwyz', 'schwytz'],
    'Solothurn':               ['solothurn', 'soleure'],
    'St. Gallen':              ['stgallen', 'saintgall', 'sanktgallen'],
    'Thurgau':                 ['thurgau', 'thurgovie'],
    'Ticino':                  ['ticino', 'tessin'],
    'Uri':                     ['uri'],
    'Valais':                  ['valais', 'vallais', 'wallis'],
    'Vaud':                    ['vaud', 'waadt'],
    'Zug':                     ['zug', 'zoug'],
    'Zürich':                  ['zurich', 'zuerich'],
}

def normalize(s):
    s = unicodedata.normalize('NFD', s)
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    return re.sub(r'[^a-z]', '', s.lower())

LOOKUP = {}
for canonical, aliases in ALIASES.items():
    LOOKUP[normalize(canonical)] = canonical
    for alias in aliases:
        LOOKUP[alias] = canonical

def resolve_canton(filename):
    key = normalize(os.path.splitext(filename)[0])
    if key.startswith('kanton'):
        key = key[len('kanton'):]
    return LOOKUP.get(key)

# ============================================================
# CHUNKING par paragraphe légal (identique à la V1)
# ============================================================
def split_into_blocks(full_text):
    blocks, current = [], []
    for line in full_text.split("\n"):
        if line.strip().startswith("§") and current:
            blocks.append("\n".join(current))
            current = [line]
        else:
            current.append(line)
    if current:
        blocks.append("\n".join(current))
    return [b.strip() for b in blocks if b.strip()]

def hard_split(block, max_size=1600, overlap=200):
    parts = []
    while len(block) > max_size:
        parts.append(block[:max_size])
        block = block[max_size - overlap:]
    parts.append(block)
    return parts

def chunk_text(full_text, max_size=1100):
    blocks = []
    for block in split_into_blocks(full_text):
        if len(block) > 1600:
            blocks.extend(hard_split(block))
        else:
            blocks.append(block)
    first_law = next((i for i, b in enumerate(blocks) if b.startswith("§")), 0)
    blocks = blocks[first_law:]
    chunks, current = [], ""
    for block in blocks:
        if len(block) < 120:
            continue
        if current and len(current) + len(block) + 2 <= max_size:
            current += "\n\n" + block
        else:
            if current:
                chunks.append(current)
            current = block
    if current:
        chunks.append(current)
    return chunks

# ============================================================
# EMBEDDING par LOT via l'API (avec réessais patients)
# ============================================================
def embed_batch(texts: list) -> list:
    """Vectorise un lot de textes. En cas de 429 (limite de débit),
    attend et réessaie PATIEMMENT : le quota se relève en <1 minute."""
    tentatives_max = 8
    for attempt in range(tentatives_max):
        try:
            resp = gemini_client.embeddings.create(
                model=EMBEDDING_MODEL, input=texts)
            data = sorted(resp.data, key=lambda d: getattr(d, "index", 0) or 0)
            embeddings = [list(d.embedding) for d in data]
            if len(embeddings) != len(texts):
                raise RuntimeError(f"{len(embeddings)} vecteurs pour {len(texts)} textes")
            return embeddings
        except Exception as e:
            is_rate = "429" in str(e) or "RESOURCE_EXHAUSTED" in str(e)
            if attempt == tentatives_max - 1:
                raise RuntimeError(
                    f"Lot définitivement échoué après {tentatives_max} tentatives : {e}"
                ) from e
            # 429 -> attente longue (la fenêtre de débit se relève en ~60s)
            # autre erreur -> attente courte
            wait = 65 if is_rate else 3 * (attempt + 1)
            print(f"   [EMBED] Lot rejeté (tentative {attempt + 1}) — "
                  f"attente {wait}s..." + (" [429 : limite de débit]" if is_rate else f" ({e})"))
            time.sleep(wait)

# ============================================================
# INGESTION — idempotente et REPRISE SUR SAUT :
# canton déjà complet -> sauté (zéro requête d'embedding consommée)
# canton partiel -> effacé et réingéré entièrement
# canton absent -> ingéré
# ============================================================
def ingest_pdf(file_path, canton_name):
    print(f"=== {canton_name} ({os.path.basename(file_path)}) ===")
    full_text = ""
    with pdfplumber.open(file_path) as pdf:
        for page in pdf.pages:
            text = page.extract_text()
            if text:
                full_text += text + "\n"

    chunks = chunk_text(full_text)
    if not chunks:
        print("   ATTENTION : aucun chunk extrait !")
        return

    # Compter ce qui est déjà en base pour ce canton
    res = (supabase.table("tax_documents_v2")
           .select("id", count="exact")
           .eq("canton", canton_name).execute())
    deja = res.count or 0
    if deja >= len(chunks):
        print(f"   Déjà complet ({deja}/{len(chunks)} chunks) — canton sauté.")
        return
    if deja > 0:
        print(f"   Partiel ({deja}/{len(chunks)}) — effacement et réingestion complète du canton.")

    print(f"   {len(chunks)} chunks. Effacement de l'ancien contenu v2...")
    supabase.table("tax_documents_v2").delete().eq("canton", canton_name).execute()

    total = len(chunks)
    done = 0
    for i in range(0, total, BATCH_SIZE):
        batch = chunks[i:i + BATCH_SIZE]
        embeddings = embed_batch(batch)
        rows = [{"canton": canton_name, "content": c, "embedding": e}
                for c, e in zip(batch, embeddings)]
        supabase.table("tax_documents_v2").insert(rows).execute()
        done = min(i + BATCH_SIZE, total)
        print(f"   -> {done}/{total}")
        time.sleep(PAUSE_ENTRE_LOTS)
    print()

pdf_files = sorted(f for f in os.listdir("PDFs") if f.lower().endswith(".pdf"))
print(f"\n{len(pdf_files)} PDF détectés.")

unknown = [f for f in pdf_files if resolve_canton(f) is None]
if unknown:
    print("FICHIERS NON RECONNUS (RIEN ingéré) :")
    for f in unknown:
        print(f"   - {f}")
    raise SystemExit(1)

print("Lancement de l'ingestion V2 (cantons complets sautés)...\n")
for filename in pdf_files:
    ingest_pdf(os.path.join("PDFs", filename), resolve_canton(filename))

print("=== INGESTION V2 TERMINÉE ===")