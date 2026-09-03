import os
import re
import time
import unicodedata

from sentence_transformers import SentenceTransformer
from supabase import create_client
from dotenv import load_dotenv
import pdfplumber

# 1. Charger les clés
load_dotenv(dotenv_path=".env")
SB_URL = os.getenv("SUPABASE_URL")
SB_KEY = os.getenv("SUPABASE_KEY")

print("Initialisation du modèle de vectorisation local...")
model = SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2')
supabase = create_client(SB_URL, SB_KEY)

# ============================================================
# RÉSOLUTION : nom de fichier -> valeur EXACTE du dropdown
# ============================================================
DROPDOWN_CANTONS = [
    'Zürich', 'Bern', 'Luzern', 'Uri', 'Schwyz', 'Obwalden', 'Nidwalden',
    'Glarus', 'Zug', 'Fribourg', 'Solothurn', 'Basel-Stadt', 'Basel-Landschaft',
    'Schaffhausen', 'Appenzell Ausserrhoden', 'Appenzell Innerrhoden',
    'St. Gallen', 'Graubünden', 'Aargau', 'Thurgau', 'Ticino', 'Vaud',
    'Valais', 'Neuchâtel', 'Genève', 'Jura',
]

ALIASES = {
    'Zürich':                  ['zurich', 'zuerich'],
    'Bern':                    ['bern', 'berne'],
    'Luzern':                  ['luzern', 'lucerne'],
    'Uri':                     ['uri'],
    'Schwyz':                  ['schwyz', 'schwytz'],
    'Obwalden':                ['obwalden', 'obwald'],
    'Nidwalden':               ['nidwalden', 'nidwald'],
    'Glarus':                  ['glarus', 'glaris'],
    'Zug':                     ['zug', 'zoug'],
    'Fribourg':                ['fribourg', 'freiburg'],
    'Solothurn':               ['solothurn', 'soleure'],
    'Basel-Stadt':             ['baselstadt', 'baleville', 'baselville'],
    'Basel-Landschaft':        ['basellandschaft', 'balecampagne', 'baselcampagne', 'baselland'],
    'Schaffhausen':            ['schaffhausen', 'schaffhouse'],
    'Appenzell Ausserrhoden':  ['appenzellausserrhoden', 'appenzellrhodesexterieures',
                                'appenzellouterrhoden', 'rhodesexterieures'],
    'Appenzell Innerrhoden':   ['appenzellinnerrhoden', 'appenzellrhodesinterieures',
                                'rhodesinterieures'],
    'St. Gallen':              ['stgallen', 'saintgall', 'sanktgallen'],
    'Graubünden':              ['graubunden', 'grisons', 'grissons', 'grigioni'],
    'Aargau':                  ['aargau', 'argovie'],
    'Thurgau':                 ['thurgau', 'thurgovie'],
    'Ticino':                  ['ticino', 'tessin'],
    'Vaud':                    ['vaud', 'waadt'],
    'Valais':                  ['valais', 'vallais', 'wallis'],
    'Neuchâtel':               ['neuchatel', 'neuenburg'],
    'Genève':                  ['geneve', 'genf'],
    'Jura':                    ['jura'],
}

def normalize(s):
    """minuscules, sans accents, rien d'autre que des lettres."""
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
# VALIDATION PRÉALABLE : tout vérifier AVANT de toucher la base
# ============================================================
pdf_files = sorted(f for f in os.listdir("PDFs") if f.lower().endswith(".pdf"))
print(f"\n{len(pdf_files)} PDF détectés dans le dossier PDFs.")

unknown = [f for f in pdf_files if resolve_canton(f) is None]
if unknown:
    print("\n=== FICHIERS NON RECONNUS (RIEN n'a été ingéré) ===")
    for f in unknown:
        print(f"   - {f}")
    raise SystemExit(1)

print("Tous les noms sont reconnus. Démarrage de l'ingestion...\n")

# ============================================================
# CHUNKING PAR PARAGRAPHE LÉGAL
# Principe : un paragraphe "§ ..." est INSÉCABLE. Son embedding
# reflète UN sujet -> la recherche sémantique le trouve.
# ============================================================
def split_into_blocks(full_text):
    """Un bloc = un paragraphe légal (ligne commençant par '§')
    ou le texte entre deux paragraphes."""
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
    """Un paragraphe trop long (ex: un § géant) est découpé
    avec chevauchement : la fin d'un morceau est répétée au
    début du suivant."""
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

    # On jette tout ce qui précède le premier "§" :
    # préfaces, tables des matières = bruit vectoriel.
    first_law = next((i for i, b in enumerate(blocks) if b.startswith("§")), 0)
    blocks = blocks[first_law:]

    chunks, current = [], ""
    for block in blocks:
        if len(block) < 120:          # fragments / pieds de page
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
# INGESTION (idempotente : remplace, n'accumule pas)
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
    sizes = [len(c) for c in chunks]
    print(f"   {len(chunks)} chunks (taille min {min(sizes)}, max {max(sizes)}, "
          f"moyenne {sum(sizes)//len(sizes)}). Remplacement de l'ancien contenu...")

    supabase.table("tax_documents").delete().eq("canton", canton_name).execute()

    for i, chunk in enumerate(chunks):
        embedding = model.encode(chunk).tolist()
        supabase.table("tax_documents").insert({
            "canton": canton_name,
            "content": chunk,
            "embedding": embedding,
        }).execute()
        if (i + 1) % 10 == 0 or i + 1 == len(chunks):
            print(f"   -> {i+1}/{len(chunks)}")
        time.sleep(0.3)
    print()

for filename in pdf_files:
    ingest_pdf(os.path.join("PDFs", filename), resolve_canton(filename))

print("=== INGESTION TERMINÉE : chunks alignés sur la structure légale ===")


