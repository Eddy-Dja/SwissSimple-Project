import os
import re
import traceback
import time
import json
from fastapi.responses import StreamingResponse

from fastapi import FastAPI
from pydantic import BaseModel
from supabase import create_client
from dotenv import load_dotenv
from groq import Groq
from openai import OpenAI
from fastapi.middleware.cors import CORSMiddleware

# 1. Charger les clés
load_dotenv(dotenv_path=".env")
SB_URL = os.getenv("SUPABASE_URL")
SB_KEY = os.getenv("SUPABASE_KEY")
GROQ_KEY = os.getenv("GROQ_KEY")
GEMINI_KEY = os.getenv("GEMINI_KEY")

# 2. Initialiser — AUCUN modèle ML chargé : zéro torch, zéro RAM lourde.
#    La vectorisation se fait par appel API.
supabase = create_client(SB_URL, SB_KEY)
groq_client = Groq(api_key=GROQ_KEY)
gemini_client = OpenAI(
    api_key=GEMINI_KEY,
    base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
) if GEMINI_KEY else None

GEMINI_MODEL = "gemini-3.5-flash"
EMBEDDING_MODEL = "gemini-embedding-001"   # ← confirme avec test_embedding.py
MODEL = "openai/gpt-oss-20b"

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

LANGUE_NOMS = {
    "fr": "français",
    "de": "allemand (Deutsch, Hochdeutsch)",
    "it": "italien (Italiano)",
    "en": "anglais (English)",
}

SECTION_HEADERS = {
    "fr": ("📊 Résumé exécutif", "📋 Détails des déductions", "💡 Points clés à retenir",
           "| Type de déduction | Montant/Condition | Référence Légale |"),
    "de": ("📊 Zusammenfassung", "📋 Details der Abzüge", "💡 Wesentliche Punkte",
           "| Abzugsart | Betrag/Bedingung | Gesetzesgrundlage |"),
    "it": ("📊 Résumé esecutivo", "📋 Dettagli delle detrazioni", "💡 Punti chiave",
           "| Tipo di detrazione | Importo/Condizione | Riferimento legale |"),
    "en": ("📊 Executive Summary", "📋 Detailed Deductions", "💡 Key Takeaways",
           "| Type of Deduction | Amount/Condition | Legal Reference |"),
}

# ⚠️ Le seuil doit être RECALIBRÉ pour les embeddings Gemini :
# les similarités ne sont PAS comparables entre modèles. Voir
# /api/debug-retrieval après les premiers tests.
SEUIL_SIMILARITE = 0.55

HORS_CHAMP = {
    "fr": "Je suis **SwissSimple Tax Copilot**, votre assistant fiscal pour les 26 cantons suisses. Ma spécialité : répondre à vos questions d'impôts en citant les lois cantonales officielles. Posez-moi par exemple : « Quelles sont les déductions pour les enfants ? »",
    "de": "Ich bin der **SwissSimple Tax Copilot**, Ihr Steuerassistent für die 26 Schweizer Kantone. Meine Spezialität: Antworten auf Ihre Steuerfragen mit Zitaten der kantonalen Gesetze. Fragen Sie z. B.: « Welche Abzüge gelten für Kinder? »",
    "it": "Sono il **SwissSimple Tax Copilot**, il vostro assistente fiscale per i 26 cantoni svizzeri. La mia specialità: rispondere alle vostre domande fiscali citando le leggi cantonali. Chiedete ad esempio: « Quali sono le detrazioni per i figli? »",
    "en": "I am the **SwissSimple Tax Copilot**, your tax assistant for the 26 Swiss cantons. My specialty: answering your tax questions with citations from official cantonal law. Try asking: « What are the deductions for children? »",
}

ANSWER_CACHE = {}
CACHE_TABLE = "answer_cache_v2"          # cache séparé de la V1
RPC_NAME = "match_tax_docs_v2"           # table v2

class Question(BaseModel):
    user_question: str
    canton: str
    statut: str = "Non précisé"
    enfants: str = "0"
    profession: str = "Non précisé"
    langue: str = "fr"

# ============================================================
# VECTORISATION PAR API — le cœur de la V2 (remplace torch)
# ============================================================
def get_embedding(text: str) -> list:
    """Vectorise un texte via l'API Gemini. 3 tentatives."""
    if gemini_client is None:
        raise RuntimeError("GEMINI_KEY absente : embeddings impossibles en V2.")
    for attempt in range(3):
        try:
            resp = gemini_client.embeddings.create(model=EMBEDDING_MODEL, input=text)
            emb = list(resp.data[0].embedding)
            if emb:
                return emb
            raise RuntimeError("embedding vide")
        except Exception as e:
            if attempt == 2:
                raise RuntimeError(f"Embedding API échouée après 3 tentatives : {e}")
            print(f"[EMBED] Tentative {attempt + 1} échouée ({e})...")
            time.sleep(2 * (attempt + 1))

# ============================================================
# CACHE 2 NIVEAUX (identique V1, table v2)
# ============================================================
def _cache_key_str(qd: Question) -> str:
    return json.dumps([
        qd.user_question.strip().lower(),
        qd.canton, qd.statut, qd.enfants, qd.profession, qd.langue,
    ], ensure_ascii=False)

def _get_cached_answer(key: str):
    if key in ANSWER_CACHE:
        return ANSWER_CACHE[key]
    try:
        res = (supabase.table(CACHE_TABLE)
               .select("answer, fournisseur")
               .eq("cache_key", key).limit(1).execute())
        if res.data:
            answer, fourn = res.data[0]["answer"], res.data[0]["fournisseur"]
            ANSWER_CACHE[key] = (answer, fourn)
            print("[CACHE-DB] Réponse trouvée dans Supabase (v2).")
            return (answer, fourn)
    except Exception as e:
        print(f"[CACHE-DB] Lecture impossible ({e}) — on continue sans cache.")
    return None

def _save_cached_answer(key: str, answer: str, fournisseur: str):
    ANSWER_CACHE[key] = (answer, fournisseur)
    try:
        supabase.table(CACHE_TABLE).upsert({
            "cache_key": key, "answer": answer, "fournisseur": fournisseur,
        }).execute()
    except Exception as e:
        print(f"[CACHE-DB] Écriture impossible ({e}) — cache RAM seul.")

def _similarity_de(doc: dict):
    val = doc.get('similarity')
    if val is None:
        return None
    try:
        return float(val)
    except (TypeError, ValueError):
        return None

@app.get("/health")
def health():
    actifs = []
    if gemini_client:
        actifs.append(f"Gemini ({GEMINI_MODEL})")
        actifs.append(f"Embeddings API ({EMBEDDING_MODEL})")
    actifs.append(f"Groq ({MODEL})")
    return {"status": "ok", "version": "v2 (allégé, zéro modèle local)", "fournisseurs": actifs}

@app.post("/api/debug-retrieval")
def debug_retrieval(question_data: Question):
    q_embedding = get_embedding(question_data.user_question)
    response = supabase.rpc(RPC_NAME, {
        'query_embedding': q_embedding,
        'match_count': 5,
        'filter_canton': question_data.canton
    }).execute()
    docs = response.data or []
    return {
        "nb_extraits": len(docs),
        "canton_demande": question_data.canton,
        "similarites": [_similarity_de(doc) for doc in docs],
        "apercus": [doc['content'][:300] for doc in docs],
    }

@app.post("/api/tax-copilot")
def tax_copilot(question_data: Question):
    try:
        user_question = question_data.user_question
        canton = question_data.canton
        statut = question_data.statut
        enfants = question_data.enfants
        profession = question_data.profession
        langue = question_data.langue
        langue_nom = LANGUE_NOMS.get(langue.lower(), langue)
        h1, h2, h3, cols = SECTION_HEADERS.get(langue.lower(), SECTION_HEADERS["fr"])

        cache_key = _cache_key_str(question_data)
        cached = _get_cached_answer(cache_key)
        if cached is not None:
            print("[CACHE] Réponse servie depuis le cache (RAM ou Supabase).")
            return {"answer": cached[0], "fournisseur": f"{cached[1]} (cache)", "cache": True}

        # 1. Vectoriser la question — PAR API (zéro RAM locale)
        q_embedding = get_embedding(user_question)

        # 2. Chercher dans Supabase (table v2)
        response = supabase.rpc(RPC_NAME, {
            'query_embedding': q_embedding,
            'match_count': 5,
            'filter_canton': canton
        }).execute()

        if not response.data:
            return {"answer": "Je n'ai pas trouvé cette information dans les lois de ce canton."}

        top_similarity = _similarity_de(response.data[0])
        if top_similarity is not None and top_similarity < SEUIL_SIMILARITE:
            print(f"[RAG] Question hors-champ détectée (similarité {top_similarity:.2f} < {SEUIL_SIMILARITE}).")
            reponse = HORS_CHAMP.get(langue.lower(), HORS_CHAMP["fr"])
            _save_cached_answer(cache_key, reponse, "garde-fou anti-hors-sujet")
            return {"answer": reponse, "fournisseur": "garde-fou anti-hors-sujet (0 token)"}

        context = "\n\n---\n\n".join([doc['content'] for doc in response.data])
        print(f"[RAG] {len(response.data)} extraits pour {canton} (similarité top: {top_similarity}).")

        MAX_CONTEXT_CHARS = 10000
        if len(context) > MAX_CONTEXT_CHARS:
            context = context[:MAX_CONTEXT_CHARS]

        system_prompt = (
            f"Tu es un assistant fiscaliste suisse expert. "
            f"RÈGLE ABSOLUE : tu rédiges 100 % de ta réponse en {langue_nom} — "
            f"le texte, les titres de sections, les en-têtes de tableaux et les listes. "
            f"Même si la question est posée en français, la réponse doit être en {langue_nom}. "
            "Tu tiens compte du profil familial et professionnel de l'utilisateur. "
            "Tu n'inventes JAMAIS de chiffre : tout montant, taux ou référence doit venir des extraits fournis."
        )

        user_prompt = f"""
Profil de l'utilisateur : Il habite dans le canton de {canton}, est {statut}, a {enfants} enfant(s) et est {profession}.

Voici des extraits officiels du livre d'impôts du canton de {canton} :
{context}

Réponds à cette question de l'utilisateur : "{user_question}"

CONSIGNES STRICTES :
0. AVANT TOUT : Si la question n'est PAS une question fiscale relative aux impôts, lois, déductions, barèmes ou procédures du canton (ex: "qui es-tu", "quel temps fait-il", "raconte une blague"), ne cherche PAS dans les extraits et réponds brièvement par une présentation d'une à deux phrases : tu es l'assistant fiscal SwissSimple, tu réponds aux questions d'impôts cantonales en te basant sur les lois officielles ingérées, puis invite l'utilisateur à poser sa vraie question fiscale. Dans ce cas, n'affiche PAS de tableau et respecte le format simple d'une conversation courante.
1. Énumère TOUTES les déductions présentes dans les extraits (montants, conditions, références légales), même si elles ne s'appliquent pas au profil de l'utilisateur. Ne réponds jamais "aucune" quand les extraits contiennent des informations.
2. Si le texte source contient des chiffres, des pourcentages ou des montants, cite-les obligatoirement, sans les modifier ni en inventer.
3. Cite le paragraphe ou la loi mentionnée (ex: § 42 Abs. 1 Bst. a StG) si elle est dans le texte, à côté du montant concerné. Ne raccorde jamais une référence à un montant si elle n'est pas adjacente dans l'extrait.
4. RÉPONDS INTÉGRALEMENT en {langue_nom}. Si la langue demandée n'est pas le français, il est interdit d'écrire ne serait-ce qu'une phrase en français. Traduis aussi les titres "Résumé exécutif", "Détails des déductions" et "Points clés à retenir" dans la langue demandée.
5. Si les extraits ne contiennent PAS la réponse à la question posée, réponds UNIQUEMENT "Je n'ai pas trouvé cette information dans les lois de ce canton." dans la langue {langue_nom} — sans ajouter de tableau, de déductions ou d'informations non sollicitées.
6. Termine toujours ta réponse complètement, sans jamais t'arrêter en pleine phrase.
7. APRÈS le tableau, indique clairement lesquelles de ces déductions s'appliquent au profil de l'utilisateur ({statut}, {enfants} enfant(s), {profession}) et lesquelles non, avec la raison (ex: montants réservés aux parents imposés séparément).
8. Sois précis et dense : une ligne de tableau par déduction, conditions résumées en une phrase, maximum 4 puces dans les points clés, application au profil en 3 lignes.

FORMAT DE SORTIE OBLIGATOIRE :
### {h1}
(Un résumé de 2-3 phrases de la situation pour l'utilisateur)

### {h2}
(Un tableau Markdown avec les colonnes : {cols})

### {h3}
(Une liste à puces des 3 points les plus importants)
"""

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]

        gemini_params = {"temperature": 0.0, "max_tokens": 6000}
        providers = []
        if gemini_client:
            for model_id in (GEMINI_MODEL, "gemini-3.8-flash", "gemini-3.6-flash"):
                providers.append(("Gemini", gemini_client, model_id, gemini_params))
        providers.append(("Groq", groq_client, MODEL,
                          {"temperature": 0.0, "max_completion_tokens": 6000,
                           "reasoning_effort": "low"}))

        chat_completion = None
        last_error = None
        elapsed = 0.0
        for i, (name, client, model_id, params) in enumerate(providers, start=1):
            try:
                t0 = time.time()
                chat_completion = client.chat.completions.create(
                    messages=messages,
                    model=model_id,
                    **params,
                    timeout=45.0,
                )
                elapsed = time.time() - t0
                print(f"[{name}] OK configuration {i} ({model_id}) en {elapsed:.1f}s")
                break
            except Exception as e:
                last_error = e
                print(f"[{name}] Configuration {i} refusée ({e}) -> essai suivant...")
        if chat_completion is None:
            raise RuntimeError(f"Tous les fournisseurs IA ont échoué. Dernière erreur : {last_error}")

        choice = chat_completion.choices[0]
        answer = choice.message.content or ""

        if getattr(choice, "finish_reason", None) == "length":
            print("[LLM] ATTENTION : réponse coupée (finish_reason=length).")

        if not answer or not answer.strip():
            return {"answer": "Le modèle n'a rien généré. Relance la question."}

        answer = re.sub(r"ab.?d[ée]duction", "déduction", answer)

        _save_cached_answer(cache_key, answer, f"{name} ({model_id})")
        return {"answer": answer, "fournisseur": f"{name} ({model_id}) — {elapsed:.1f}s", "config": i}

    except Exception as e:
        print("\n=== ERREUR BACKEND (traceback complet) ===")
        traceback.print_exc()
        print("==========================================\n")
        return {"error": f"Erreur backend : {type(e).__name__} — {e}"}


# ============================================================
# ENDPOINT STREAMING (identique V1, table/RPC v2)
# ============================================================
def _build_rag_messages(question_data: Question):
    langue = question_data.langue
    langue_nom = LANGUE_NOMS.get(langue.lower(), langue)
    h1, h2, h3, cols = SECTION_HEADERS.get(langue.lower(), SECTION_HEADERS["fr"])

    q_embedding = get_embedding(question_data.user_question)
    response = supabase.rpc(RPC_NAME, {
        'query_embedding': q_embedding,
        'match_count': 7,
        'filter_canton': question_data.canton
    }).execute()
    docs = response.data or []
    top_sim = _similarity_de(docs[0]) if docs else None

    context = "\n\n---\n\n".join([doc['content'] for doc in docs])
    if len(context) > 10000:
        context = context[:10000]

    system_prompt = (
        f"Tu es un assistant fiscaliste suisse expert. "
        f"RÈGLE ABSOLUE : tu rédiges 100 % de ta réponse en {langue_nom} — "
        f"le texte, les titres de sections, les en-têtes de tableaux et les listes. "
        f"Même si la question est posée en français, la réponse doit être en {langue_nom}. "
        "Tu tiens compte du profil familial et professionnel de l'utilisateur. "
        "Tu n'inventes JAMAIS de chiffre : tout montant, taux ou référence doit venir des extraits fournis."
    )

    user_prompt = f"""
Profil de l'utilisateur : Il habite dans le canton de {question_data.canton}, est {question_data.statut}, a {question_data.enfants} enfant(s) et est {question_data.profession}.

Voici des extraits officiels du livre d'impôts du canton de {question_data.canton} :
{context}

Réponds à cette question de l'utilisateur : "{question_data.user_question}"

CONSIGNES STRICTES :
0. AVANT TOUT : Si la question n'est PAS une question fiscale relative aux impôts, lois, déductions, barèmes ou procédures du canton (ex: "qui es-tu", "quel temps fait-il", "raconte une blague"), ne cherche PAS dans les extraits et réponds brièvement par une présentation d'une à deux phrases : tu es l'assistant fiscal SwissSimple, tu réponds aux questions d'impôts cantonales en te basant sur les lois officielles ingérées, puis invite l'utilisateur à poser sa vraie question fiscale. Dans ce cas, n'affiche PAS de tableau et respecte le format simple d'une conversation courante.
1. Énumère TOUTES les déductions présentes dans les extraits (montants, conditions, références légales), même si elles ne s'appliquent pas au profil de l'utilisateur. Ne réponds jamais "aucune" quand les extraits contiennent des informations.
2. Si le texte source contient des chiffres, des pourcentages ou des montants, cite-les obligatoirement, sans les modifier ni en inventer.
3. Cite le paragraphe ou la loi mentionnée (ex: § 42 Abs. 1 Bst. a StG) si elle est dans le texte, à côté du montant concerné. Ne raccorde jamais une référence à un montant si elle n'est pas adjacente dans l'extrait.
4. RÉPONDS INTÉGRALEMENT en {langue_nom}, quelle que soit la langue de la question posée (même si la question est en français ou dans une autre langue). Si la langue de réponse demandée n'est pas le français, il est interdit d'écrire ne serait-ce qu'une phrase dans une autre langue. Traduis aussi les titres de sections ("Résumé exécutif", "Détails des déductions", "Points clés à retenir") et les termes techniques allemands (Reinvermögen → fortune nette, Reineinkommen → revenu net, Abzug → déduction) dans la langue de réponse.
5. Si les extraits ne contiennent PAS la réponse à la question posée, réponds UNIQUEMENT "Je n'ai pas trouvé cette information dans les lois de ce canton." dans la langue {langue_nom} — sans ajouter de tableau, de déductions ou d'informations non sollicitées.
6. Termine toujours ta réponse complètement, sans jamais t'arrêter en pleine phrase.
7. APRÈS le tableau, indique clairement lesquelles de ces déductions s'appliquent au profil de l'utilisateur ({question_data.statut}, {question_data.enfants} enfant(s), {question_data.profession}) et lesquelles non, avec la raison.
8. Sois précis et dense : une ligne de tableau par déduction, conditions résumées en une phrase, maximum 4 puces dans les points clés, application au profil en 3 lignes.

FORMAT DE SORTIE OBLIGATOIRE :
### {h1}
(Un résumé de 2-3 phrases)

### {h2}
(Un tableau Markdown avec les colonnes : {cols})

### {h3}
(Une liste à puces des 3 points les plus importants)
"""

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]
    return messages, top_sim, len(docs)


@app.post("/api/tax-copilot-stream")
def tax_copilot_stream(question_data: Question):
    def event(obj: dict) -> str:
        return json.dumps(obj, ensure_ascii=False) + "\n"

    def generate():
        try:
            print("[STREAM] Début du générateur.")

            cache_key = _cache_key_str(question_data)
            cached = _get_cached_answer(cache_key)
            if cached is not None:
                print("[STREAM] Cache trouvé (RAM ou Supabase).")
                answer, fourn = cached
                yield event({"type": "meta", "fournisseur": f"{fourn} (cache)", "cache": True})
                for i in range(0, len(answer), 200):
                    yield event({"type": "chunk", "text": answer[i:i + 200]})
                yield event({"type": "done"})
                return

            print("[STREAM] Pas de cache, construction des messages...")
            messages, top_sim, n_docs = _build_rag_messages(question_data)
            print(f"[STREAM] Messages prêts ({n_docs} docs, similarité {top_sim}).")

            if n_docs == 0:
                yield event({"type": "meta", "fournisseur": "aucun document"})
                yield event({"type": "chunk", "text": "Je n'ai pas trouvé cette information dans les lois de ce canton."})
                yield event({"type": "done"})
                return

            if top_sim is not None and top_sim < SEUIL_SIMILARITE:
                print(f"[STREAM] Hors-champ (similarité {top_sim:.2f}).")
                reponse = HORS_CHAMP.get(question_data.langue.lower(), HORS_CHAMP["fr"])
                _save_cached_answer(cache_key, reponse, "garde-fou anti-hors-sujet")
                yield event({"type": "meta", "fournisseur": "garde-fou anti-hors-sujet (0 token)"})
                yield event({"type": "chunk", "text": reponse})
                yield event({"type": "done"})
                return

            gemini_params = {"temperature": 0.0, "max_tokens": 6000}
            providers = []
            if gemini_client:
                for model_id in (GEMINI_MODEL, "gemini-3.8-flash", "gemini-3.6-flash"):
                    providers.append(("Gemini", gemini_client, model_id, {**gemini_params, "stream": True}))
            providers.append(("Groq", groq_client, MODEL,
                              {"temperature": 0.0, "max_completion_tokens": 6000,
                               "reasoning_effort": "low", "stream": True}))
            print(f"[STREAM] {len(providers)} fournisseurs, essais...")

            answer_parts: list = []
            used = None
            panne_en_cours_de_flux = False
            for i, (name, client, model_id, params) in enumerate(providers, start=1):
                emitted = False
                try:
                    print(f"[STREAM] Tentative {i} : {name} ({model_id})...")
                    t0 = time.time()
                    stream = client.chat.completions.create(
                        messages=messages,
                        model=model_id,
                        timeout=45.0,
                        **params,
                    )
                    print(f"[STREAM] Connexion ouverte, itération du flux {i}...")
                    n_chunks = 0
                    for chunk in stream:
                        if not getattr(chunk, "choices", None):
                            continue
                        delta = chunk.choices[0].delta.content
                        if not delta:
                            continue
                        text = re.sub(r"ab.?d[ée]duction", "déduction", delta)
                        if not emitted:
                            used = f"{name} ({model_id})"
                            premier_mot = time.time() - t0
                            yield event({"type": "meta",
                                         "fournisseur": f"{used} — premier mot en {premier_mot:.1f}s",
                                         "config": i})
                            emitted = True
                        answer_parts.append(text)
                        yield event({"type": "chunk", "text": text})
                        n_chunks += 1
                    print(f"[STREAM] Fin du flux {i} : {n_chunks} fragments émis.")
                    if not emitted:
                        raise RuntimeError("Flux vide (aucun contenu généré)")
                    break
                except Exception as e:
                    if emitted:
                        print(f"[STREAM] Panne en cours de flux ({e}) — arrêt.")
                        panne_en_cours_de_flux = True
                        break
                    print(f"[STREAM] Tentative {i} échouée ({e}) -> suivant...")

            if answer_parts:
                if not panne_en_cours_de_flux:
                    _save_cached_answer(cache_key, "".join(answer_parts), used or "fournisseur inconnu")
                yield event({"type": "done"})
            else:
                yield event({"type": "meta", "fournisseur": "erreur"})
                yield event({"type": "chunk", "text": "⚠️ Tous les fournisseurs IA ont échoué. Réessaie dans un instant."})
                yield event({"type": "done"})

        except Exception as e:
            print("\n=== ERREUR STREAM (traceback complet) ===")
            traceback.print_exc()
            print("==========================================\n")
            yield event({"type": "meta", "fournisseur": "erreur backend"})
            yield event({"type": "chunk", "text": f"⚠️ Erreur backend : {type(e).__name__}"})
            yield event({"type": "done"})

    return StreamingResponse(generate(), media_type="text/plain")