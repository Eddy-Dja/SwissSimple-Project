# 🇨🇭 SwissSimple V2.1 : Estimateur d'impôts suisse + Copilot IA (RAG)

> **En production** : https://swisssimple.ch (génération V2, multi-cloud gratuit, coût d'exploitation 0 CHF).
> Deux générations du backend Copilot sont documentées : **V1** (locale, autonome, embeddings sur machine) et **V2** (déployée, embeddings par API, conteneur Docker). « V2.1 » désigne la version du produit.

**Application double :**

1. **Estimateur d'impôt sur le revenu (IFD + ICC)** au centime près pour les 26 cantons et leurs communes, basé strictement sur l'Open Data officiel de l'AFC (Administration Fédérale des Contributions).
2. **Tax Copilot IA** : assistant RAG cross-lingual qui répond aux questions fiscales cantonales en citant les paragraphes de loi (§) et les montants exacts, dans la langue de l'utilisateur (fr/de/it/en).

## Sommaire

1. Vision et objectifs
2. Les deux modules : architecture V1 puis V2
3. L'avant/après : pourquoi deux générations
4. Stack technique
5. Structure du projet
6. Schéma de données Supabase
7. Module 1 : moteur fiscal de l'estimateur
8. Module 2 : Tax Copilot IA (RAG)
9. Fournisseurs LLM
10. Installation et lancement
11. Tests et validation
12. Dépannage
13. Limites connues
14. Roadmap
15. Interdictions absolues
16. Sécurité
17. Bilan : les chiffres de l'avant/après

## 1. Vision et objectifs

- **Nom du projet** : SwissSimple
- **Objectif principal** : un estimateur d'impôt (IFD + ICC) au centime près pour les 26 cantons et leurs communes, basé strictement sur les données officielles de l'AFC, et un assistant conversationnel capable de justifier chaque réponse par le texte de loi cantonal source.
- **Principe absolu** : zéro donnée chiffrée codée en dur, ni dans React, ni dans les prompts IA. Toute la logique lit la base Supabase dynamiquement. Les incohérences de l'Open Data AFC sont gérées via le dictionnaire CANTON_RULES (architecture State-Specific). Le Copilot n'affiche que des montants présents dans les extraits de loi récupérés.

## 2. Les deux modules : architecture V1 puis V2

### 2.1 Génération V1 : tout en local (l'originale)

```
                ┌──────────────────────────────────┐
                │            Supabase              │
                │      PostgreSQL + pgvector       │
                ├────────────────┬─────────────────┤
                │ Tables         │ Table           │
                │ estimateur     │ tax_documents   │
                │ (data AFC)     │ (lois ESTV)     │
                └───────┬────────┴────────┬────────┘
                        │                 │
          ┌─────────────┘                 └─────────────┐
          ▼                                             ▼
 ┌───────────────────┐                       ┌──────────────────────┐
 │  React (Vite)     │                       │  FastAPI (api.py)    │
 │  Estimateur       │── fetch ─────────────▶│  RAG : embeddings    │
 │  RadarFiscal.tsx  │  POST /api/           │  LOCAUX (MiniLM)     │
 │  TaxCopilot.tsx   │  tax-copilot          │  + LLM Gemini/Groq   │
 │                   │◀─ JSON Markdown ──────│  + cache mémoire     │
 └───────────────────┘                       └──────────────────────┘
```

- **Estimateur** : calcul déterministe, exact au centime, 100 % côté client (React lit les tables de calcul).
- **Copilot** : recherche sémantique (top-5 par canton) + génération contrainte par les extraits, avec garde-fous anti-hallucination.

### 2.2 Génération V2 : en production (l'actuelle)

```
📱 UTILISATEUR (téléphone / PC, n'importe quelle langue)
     │
     ▼
🌐 CLOUDFLARE (swisssimple.ch)
     Frontend React : construit à chaque git push (VITE_API_URL injectée au build)
     Envoie : question + profil (canton, statut, enfants, profession) + langue
     │
     ▼ fetch (VITE_API_URL)
🐳 RENDER (backend V2, conteneur Docker, 512 Mo)
     FastAPI + uvicorn
     │
     ├─ 1 ─► CACHE (RAM puis Supabase : question déjà posée ? réponse instantanée, 0 token)
     ├─ 2 ─► VECTORISATION (question → 3072 dimensions, API Gemini embeddings)
     ├─ 3 ─► RECHERCHE VECTORIELLE (top-7 extraits du canton, scan séquentiel exact)
     ├─ 4 ─► GARDE-FOU (similarité < 0.55 ? réponse de présentation, 0 token LLM)
     ├─ 5 ─► RAG (prompt = extraits + profil + consignes → cascade Gemini → Groq)
     ├─ 6 ─► STREAMING (NDJSON : la réponse s'écrit mot par mot)
     └─ 7 ─► CACHE (sauvegarde RAM + Supabase pour les suivants)
     │
     ▼
📊 RÉPONSE SOURCÉE : montants exacts + paragraphes de loi cités (§ 42 StG…)
```

**Coût total : 0 CHF. PC éteint possible. Défaillance d'un fournisseur absorbée.**

## 3. L'avant/après : pourquoi deux générations

**V1 n'était pas un brouillon.** C'était la bonne architecture pour ses contraintes : embeddings 100 % locaux (MiniLM via SentenceTransformers), gratuits et **illimités**, aucune dépendance à un quota externe, vectorisation possible machine éteinte du cloud. Système complet, fonctionnel, fact-checké.

**Le nouveau besoin** : mettre le Copilot en ligne sur swisssimple.ch. Le palier gratuit de Render plafonne à 512 Mo de RAM ; V1 exigeait ~700 Mo (torch + modèle chargés). Aucun hébergeur gratuit ne le portait.

**La décision** : remplacer le calcul local des embeddings par un appel API (Gemini). Le backend devient un routeur HTTP léger.

| Métrique | V1 (locale) | V2 (production) |
|---|---|---|
| RAM backend | ~700 Mo | ~100 Mo (compatible tout hébergeur gratuit) |
| Dépendances | ~100 | 7 |
| Build Docker | 14 min | 37 s |
| Démarrage serveur | 60 s | 2 s |
| Embeddings | MiniLM local, 384 dim, illimités | API Gemini, 3072 dim, 1000 req/j |
| Déploiement | uvicorn local (8000) | Docker sur Render + Cloudflare |
| Cache réponses | mémoire, volatile | RAM + base, persistant et partagé |

**Le coût du changement** : ré-ingestion complète des 26 cantons (les vecteurs des deux modèles vivent dans des espaces différents, impossibles à mélanger) et re-validation intégrale du fact-check. Payé, validé, déployé.

## 4. Stack technique (règles immuables, moteurs évolutifs)

Les règles sont identiques depuis V1 : composants `React.FC`, aucun `any` ni `@ts-ignore`, pas de Redux/Zustand (`useState`/`useEffect` natifs), CSS pur dans fichiers dédiés (interdits : Tailwind, MUI, Chakra), `.toLocaleString('fr-CH')` partout, une seule dépendance npm autorisée (remark-gfm, exception documentée : sans elle, aucun tableau Markdown du Copilot ne s'affiche, GFM ≠ Markdown de base).

Seuls le moteur d'embeddings et l'infrastructure ont évolué (décision documentée §3) :

| Couche | V1 | V2 |
|---|---|---|
| Frontend | React 18 + TypeScript (Strict), Vite, React Router (SPA) | identique |
| BDD | Supabase (Auth, PostgreSQL, RLS) | identique |
| Backend | FastAPI + uvicorn, sentence-transformers, pdfplumber, python-dotenv, groq, openai | FastAPI + uvicorn, pdfplumber, python-dotenv, groq, openai (torch retiré) |
| Embeddings | paraphrase-multilingual-MiniLM-L12-v2, local, 384 dim, cross-lingual FR↔DE | API Gemini, 3072 dim, multilingue, quota gratuit 1000 req/j |
| LLM | Gemini (principal) → Groq gpt-oss-20b (repli), temperature 0.0 | cascade : 3 modèles Gemini puis Groq |
| Infra | localhost:8000 | Docker sur Render, front Cloudflare, CI/CD GitHub |

## 5. Structure du projet

```
SwissSimple/
├── Frontend/                            # identique V1/V2
│   ├── src/
│   │   ├── pages/RadarFiscal.tsx        # estimateur + CANTON_RULES
│   │   ├── components/TaxCopilot.tsx    # Copilot (V2 : lecture du flux streaming)
│   │   └── *.css                        # styles dédiés, pas d'inline utilitaire
│   └── package.json
└── Backend/
    ├── api.py               # V1 : backend local (embeddings MiniLM sur machine)
    ├── ingest.py            # V1 : ingestion locale
    ├── api_v2.py            # V2 : production (API embeddings, garde-fou, cascade, streaming)
    ├── ingest_v2.py         # V2 : ingestion par lots, backoff, quotas
    ├── Dockerfile           # V2
    ├── requirements.txt     # V1
    ├── requirements_v2.txt  # V2 : 7 dépendances
    ├── PDFs/                # 26 lois cantonales (documents ESTV)
    └── .env                 # clés : JAMAIS commité (voir §16)
```

## 6. Schéma de données Supabase

### 6.1 Tables de l'estimateur (identiques V1/V2, noms stricts)

**communes** : `id (int, PK)`, `commune`, `canton`, `canton_id (int)`, `coeff_revenu_canton (float)` (ex. 96 pour 96 %), `coeff_revenu_commune (float)`, `coeff_revenu_eglise_reforme (float)`, `coeff_revenu_eglise_catholique (float)`

**baremes** : `canton_id (int)` (0 = Confédération, 1-26 = cantons), `statut ('celibataire' | 'marie')`, `autorite_fiscale ('Canton' | 'Confédération')`, `montant_tranche (float)` (limite inférieure), `taux (float)` (taux marginal %), `montant_base (float)` (impôt cumulé des tranches précédentes)

**deductions** : `canton_id`, `nom_deduction`, `montant`, `pourcent`, `minimum`, `maximum`, `statut`

**deductions_paliers** : `canton_id`, `nom_deduction`, `revenu_seuil`, `deduction_montant`, `statut`

### 6.2 Table vectorielle du Copilot

**V1** : `tax_documents (id, canton, content, embedding VECTOR(384))`, RPC `match_tax_docs(query_embedding, match_count, filter_canton)`, similarité cosinus filtrée par canton, `match_count = 5`.

**V2** : `tax_documents_v2 (id, canton, content, embedding VECTOR(3072))`, RPC `match_tax_docs_v2`, `match_count = 7`. Décision technique : pas d'index vectoriel (ivfflat/hnsw plafonne à 2000 dimensions) ; avec le filtre par canton (~800 lignes max), le scan séquentiel est rapide ET exact (l'index approximatif peut rater le meilleur chunk, le séquentiel ne rate jamais).

### 6.3 Cache des réponses

**V1** : `ANSWER_CACHE` en mémoire du serveur (clé = question + canton + statut + enfants + profession + langue), instantané mais volatile : vidé au redémarrage d'uvicorn.

**V2** : deux niveaux. RAM d'abord, puis table `answer_cache_v2` en base : **persistante et partagée entre tous les visiteurs**. Une question populaire ne coûte qu'une fois : le cache l'absorbe pour tous les suivants. C'est ce qui rend le modèle gratuit viable (1000 embeddings/jour + cache = des dizaines de milliers de réponses servies).

### 6.4 Convention de nommage des cantons (identique V1/V2, source de vérité unique)

Les valeurs stockées dans la table vectorielle doivent être identiques au caractère près aux `value` du `<select>` du frontend :

`Zürich, Bern, Luzern, Uri, Schwyz, Obwalden, Nidwalden, Glarus, Zug, Fribourg, Solothurn, Basel-Stadt, Basel-Landschaft, Schaffhausen, Appenzell Ausserrhoden, Appenzell Innerrhoden, St. Gallen, Graubünden, Aargau, Thurgau, Ticino, Vaud, Valais, Neuchâtel, Genève, Jura`

L'ingestion garantit cet alignement via le dictionnaire ALIASES (§8.3). Un désalignement produit le symptôme « Je n'ai pas trouvé cette information dans les lois de ce canton » pour un canton pourtant ingéré.

## 7. Module 1 : moteur fiscal de l'estimateur (inchangé : V1 = V2)

### Étape 1 : du revenu brut au revenu net

Si l'utilisateur saisit un revenu brut, on soustrait les cotisations sociales (part employé) :

- **AVS/AI/APG** : 5.30 % (plafonné à 148'200 CHF)
- **AC** : 1.10 % (plafonné à 148'200 CHF)
- **LAA** : 0.40 % (plafonné à 148'200 CHF)
- **LPP** : s'applique si Brut > 22'680 CHF. Base = Min(Brut, 90'720) − 26'460. Taux selon l'âge : 3.5 %, 5.0 %, 7.5 %, 9.0 %

Le total est affiché dans un champ modifiable « Cotisations sociales ».

### Étape 2 : du revenu net au revenu imposable (le cœur du moteur)

Le code calcule deux revenus imposables : fédéral et cantonal. Les déductions sont lues dans la table `deductions`.

**Sécurité absolue** : ignorer les lignes contenant : `total, valeur locative, fortune, frais d'entretien, immobilier, accessoire, sans cotisations, moyenne, seuil, facteur, loyer, modeste, social, logement, revenu accessoire, intérêts technique, finma, prime unique`.

### Étape 3 : impôt de base (barème progressif)

`calculateTax(revenuImposable, bareme)` :

1. Filtrer les tranches où `revenuImposable >= montant_tranche`
2. Prendre la tranche applicable la plus haute
3. Calcul : `montant_base + (revenuImposable − montant_tranche) × (taux / 100)`

Note : le script Python d'import a déjà géré l'élargissement des tranches pour les mariés. Le code React n'applique aucun diviseur.

### Étape 4 : multiplication des coefficients (ICC vs IFD)

- **IFD** : `calculateTax(revFed, baremeFederal)`, AUCUN coefficient appliqué
- **ICC** : `calculateTax(revCant, baremeCantonal)` = impôt de Base Cantonal, puis :
  - Impôt cantonal = Base × `coeff_revenu_canton` / 100
  - Impôt communal = Base × `coeff_revenu_commune` / 100
  - Impôt paroissial = Base × `coeff_eglise` / 100
- **Total = IFD + ICC**

### 7.1 Architecture « State-Specific Strategy »

L'Open Data AFC est incohérent entre cantons (montants dans `montant` ou `maximum`, montants doublés pour les couples ou non). L'application adopte une architecture modulaire par canton, en quatre phases.

**Phase 1 : dictionnaire des stratégies** (CANTON_RULES, en haut de `RadarFiscal.tsx`). Règle absolue : ce dictionnaire ne contient **aucun chiffre**, uniquement des flags :

```typescript
type CantonStrategy = {
  couple2RevenusStrategy?: 'LIRE_MAXIMUM' | 'LIRE_MONTANT';
  assuranceStrategy?: 'LIRE_MAXIMUM_COMME_GLOBAL' | 'DOUBLER_MAXIMUM';
  deductionMarieStrategy?: 'MONTANT_GLOBAL_SANS_DOUBLER' | 'DOUBLER_MONTANT';
};

const CANTON_RULES: Record<number, CantonStrategy> = {
  10: { // Fribourg
    assuranceStrategy: 'LIRE_MAXIMUM_COMME_GLOBAL',
    deductionMarieStrategy: 'MONTANT_GLOBAL_SANS_DOUBLER'
  },
  22: { // Vaud
    couple2RevenusStrategy: 'LIRE_MAXIMUM'
  },
  12: { // Bâle-Ville
    deductionMarieStrategy: 'MONTANT_GLOBAL_SANS_DOUBLER'
  }
  // Les autres cantons utilisent le calculateur générique par défaut
};
```

**Phase 2 : moteur de dispatch** : `calculerTotalDeductions` fait un simple `switch` sur `cantonId` (cas 10 Fribourg, 22 Vaud, 25 Genève, sinon générique ; célibataires : toujours générique).

**Phase 3 : fonctions cantonales** (exemple Fribourg) : frais professionnels doublés (plafonné à maximum × 2), assurances lues comme montant global du ménage, couple à 2 revenus via `maximum`, déduction de statut sans doubler.

**Phase 4 : moteur générique (fallback)** : doubler les montants `statut = 'tous'` pour les mariés, lire `maximum` si `montant = 0`, etc. Filet de sécurité permettant de corriger les cantons un par un sans tout casser.

### 7.2 Interface utilisateur

- **Filtres de base** : revenu (brut/net), classe d'âge (LPP), statut (célibataire/marié), religion, enfants à charge, commune
- **Options avancées (toggles)** : cotisations sociales (auto-calculé, modifiable), frais de transport réels, primes d'assurance réelles, frais médicaux, dons, pilier 3a, frais de garde, revenu net du conjoint, case « retraité AVS/AI »
- **Résultats** : séparation claire cantonal / communal / paroissial / IFD, montant total et taux effectif

## 8. Module 2 : Tax Copilot IA (RAG)

### 8.1 Flux V1 (l'original, local)

```
React TaxCopilot.tsx (question + profil + langue)
  │  POST /api/tax-copilot (JSON)
  ▼
FastAPI api.py
  ├─ 0. cache mémoire (question déjà posée ? → réponse immédiate, 0 token)
  ├─ 1. embed_model.encode(question)     [MiniLM, local, 384 dim]
  ├─ 2. Supabase RPC match_tax_docs      [top-5, filtré par canton]
  ├─ 3. prompt = extraits + profil + consignes strictes
  ├─ 4. LLM : Gemini (repli Groq)        [temperature 0.0]
  └─ 5. nettoyage + cache + réponse JSON
  ▼
ReactMarkdown + remark-gfm (tableaux)
```

### 8.2 Flux V2 (l'actuel, en production)

1. **Cache** (RAM puis Supabase) : question déjà posée ? réponse instantanée, 0 token
2. **Vectorisation** : question → 3072 dimensions (API Gemini)
3. **Recherche** : top-7 extraits du canton (RPC, scan séquentiel exact)
4. **Garde-fou** : similarité du top < 0.55 ? question non fiscale → réponse de présentation, sans consommer de LLM
5. **Prompt** : extraits + profil + consignes strictes
6. **Cascade** : Gemini 3.5 → 3.8 → 3.6 → Groq (repli automatique)
7. **Streaming** : NDJSON ligne par ligne vers le navigateur
8. **Cache** : sauvegarde (RAM + Supabase) pour la prochaine fois

### 8.3 Ingestion

**Le chunking (identique V1/V2, le cœur de la qualité du RAG)** :

- Un paragraphe « § … » est **insécable** : un chunk = un sujet légal complet (le § 42 avec ses montants)
- Regroupement des petits paragraphes jusqu'à ~1100 caractères
- Découpage dur (chevauchement 200) uniquement pour un § géant (> 1600)
- Fragments < 120 caractères écartés ; tout ce qui précède le premier § jeté (préfaces, sommaires = bruit vectoriel)
- **La leçon vécue** : le premier découpage en blocs fixes de 1500 caractères avait noyé le § 52 (fortune par enfant, 12'500 Fr) dans un chunk à dominante immobilière → introuvable en recherche. Depuis : un chunk = une idée = un vecteur pertinent.

**Les noms de cantons (identique V1/V2, la leçon Lucerne/Luzern)** : les PDF s'appellent `lucerne.pdf`, `berne.pdf` (français) ; l'interface envoie `Luzern`, `Bern` (valeurs du dropdown). Dictionnaire ALIASES (FR + DE, normalisation sans accents ni ponctuation) traduit fichier → nom canonique, avec validation préalable : le script vérifie les 26 fichiers AVANT d'écrire en base et s'arrête net avec la liste des non-reconnus. Règle d'or : une seule source de vérité (les `value` du dropdown).

**Le moteur (ce qui change entre générations)** :

| | V1 : ingest.py | V2 : ingest_v2.py |
|---|---|---|
| Vectorisation | MiniLM sur la machine | API Gemini, lots de 20 textes |
| Durée | 20-30 min pour les 26 cantons (~0,3 s/insertion) | pilotée par les quotas |
| Quotas | aucun (local illimité) | 1000 requêtes/jour, backoff patient : les 429 attendent 65 s et réessaient, reprise le lendemain |
| Idempotence | canton effacé avant réinsertion, relançable sans doublons | renforcée : un canton complet est sauté, un partiel est refait |

### 8.4 Backend

**Endpoints** :

- V1 : `GET /health`, `POST /api/tax-copilot` (JSON → Markdown), `POST /api/debug-retrieval`
- V2 : `GET /health`, `POST /api/tax-copilot-stream` (NDJSON), `POST /api/debug-retrieval`

**Paramètres LLM (introduits en V1, conservés en V2)** : `temperature = 0.0` (déterminisme des montants), troncature du contexte à 10 000 caractères (anti-413), budget de sortie 3000 tokens (Groq compte entrée + budget de sortie dans la taille de requête), `reasoning_effort = "low"` chez Groq (économie de tokens de raisonnement), `max_tokens = 3000` chez Gemini, détection `finish_reason == "length"` (réponse coupée), nettoyage regex du mot-valise « ab-déduction », consigne anti-invention (tout montant doit venir des extraits), traceback complet au terminal en cas d'erreur.

### 8.5 Les garde-fous anti-hallucination

V1 en avait deux (le prompt restrictif, la validation factuelle manuelle). V2 en ajoute un troisième, positionné AVANT le LLM :

1. **Prompt restrictif** : « Tu n'inventes JAMAIS de chiffre : tout montant doit venir des extraits fournis » + « si la réponse n'y est pas, dis-le »
2. **Seuil de similarité (V2, calibré empiriquement)** : les questions fiscales mesurées vivent à 0.55-0.72, les absurdités à 0.49-0.51 → seuil à 0.55 → les hors-sujets sont interceptés avant le LLM (zéro token)
3. **Protocole de validation factuelle** : tests de vérité terrain contre les PDF ESTV (voir §11)

### 8.6 La cascade de fournisseurs (V2, la résilience)

```python
providers = [Gemini 3.5, Gemini 3.8, Gemini 3.6, Groq]
# tentative 1 : 429 (quota) → tentative 2 : 503 (surcharge) → tentative 3 : OK
# l'utilisateur ne voit JAMAIS la panne : juste le badge de qui a répondu
```

Testée en conditions réelles : 429 (quotas quotidiens), 503 (surcharge) vécus, le service n'est jamais tombé. Détail précieux : les quotas Gemini sont comptés **par modèle** → trois modèles dans la cascade = trois budgets séparés.

### 8.7 Le streaming (V2, l'UX)

Le endpoint `/api/tax-copilot-stream` émet du NDJSON : `{"type":"meta"...}` puis `{"type":"chunk","text":"..."} × N` puis `{"type":"done"}`. Côté React : `getReader()` lit le flux et `setAnswer(acc)` fait s'écrire la réponse mot par mot : 20 secondes de génération sont perçues comme 2 secondes.

### 8.8 Le multilingue (identique V1/V2, la finesse)

Un code langue (« de ») injecté dans un prompt français ne suffit pas à contraindre le modèle. Trois leviers :

- **LANGUE_NOMS** : le code devient « allemand (Deutsch, Hochdeutsch) »
- **Interdiction explicite** de toute phrase hors langue demandée
- **SECTION_HEADERS** : titres de sections et en-têtes de tableau fournis directement dans la langue cible

Mécanique profonde : question FR → extraits DE → réponse IT si demandée. Le triptyque cross-lingual suisse, rendu possible par les embeddings multilingues (MiniLM en V1, Gemini 3072d en V2).

### 8.9 Frontend (TaxCopilot.tsx)

5 sélecteurs (canton : les 26 valeurs canoniques, statut civil, enfants, profession, langue de réponse) ; ReactMarkdown avec `remarkPlugins={[remarkGfm]}` (sinon les tableaux s'affichent en bouillie) ; `overflowX: 'auto'` sur le conteneur ; en V2, lecture du flux streaming via `getReader()`.

## 9. Fournisseurs LLM

| | Gemini (AI Studio) | Groq (gpt-oss-20b) |
|---|---|---|
| Rôle | principal | repli |
| Coût | gratuit (quotas journaliers) | gratuit (200 k tokens/j, 8 k/min, requête ≤ 8 k) |
| SDK | openai + `base_url="https://generativelanguage.googleapis.com/v1beta/openai/"` | groq |
| Paramètres | `max_tokens` | `max_completion_tokens`, `reasoning_effort` |
| Données d'entraînement | le palier gratuit peut utiliser les données | non |

**Règles clés** : une clé API n'est valable que sur l'endpoint de son fournisseur (clé Gemini dans le client Groq → 401) ; vérifier le nom exact du modèle actuel (ils évoluent).

**Évolution V2** : d'une simple paire principal/repli, le système est passé à la cascade de quatre fournisseurs (§8.6), chaque modèle Gemini apportant son propre budget de quota.

**Pourquoi la cascade plutôt qu'un choix unique** : « quel est le meilleur LLM » se répond par le critère (quota, vitesse, qualité, souveraineté des données). Une réponse de développeur, pas de fan.

## 10. Installation et lancement

### 10.1 V1 : backend local (mode développement autonome)

```bash
cd Backend
python -m venv venv
venv\Scripts\activate                # (Windows)
pip install fastapi uvicorn sentence-transformers supabase \
            python-dotenv groq pdfplumber openai
# .env (JAMAIS commité) :
#   SUPABASE_URL=...
#   SUPABASE_KEY=...
#   GROQ_KEY=...
#   GEMINI_KEY=...        (optionnel : active Gemini en principal)
python ingest.py                     # une fois, 20-30 min
python -m py_compile api.py          # réflexe : vérifier la syntaxe AVANT uvicorn
uvicorn api:app --reload             # attendre "Application startup complete."

cd ../Frontend
npm install
npm install remark-gfm
npm run dev
```

### 10.2 V2 : production (Docker, Render, Cloudflare)

```dockerfile
FROM python:3.13-slim
COPY requirements_v2.txt .
RUN pip install -r requirements_v2.txt   # couche cachée : ne se re-télécharge jamais
COPY api_v2.py ingest_v2.py ./
CMD uvicorn api_v2:app --host 0.0.0.0 --port 8080
```

Concepts clés : l'image (plan figé) vs le conteneur (processus vivant) ; isolation par le kernel Linux (namespaces/cgroups), d'où WSL2/BIOS sur Windows ; `0.0.0.0` obligatoire (127.0.0.1 dans un conteneur = parler à soi-même) ; le layer caching.

| Service | Rôle | Coût |
|---|---|---|
| Cloudflare | frontend statique, mondial, build à chaque push | 0 CHF |
| Render | backend V2 Docker (512 Mo, veille ~15 min) | 0 CHF |
| Supabase | corpus vectoriel + cache + auth | 0 CHF |
| Gemini → Groq | embeddings + LLM en cascade | 0 CHF (quotas) |
| GitHub | source de vérité, CI/CD | 0 CHF |

**Leçons de mise en ligne vécues** : `VITE_API_URL` vit chez l'hébergeur (injectée au build, jamais dans le repo) ; le `.env` Docker sans guillemets ni espaces (dotenv pardonne, Docker non : trois bugs appris) ; le déclencheur de build = `git push` (le commit vide comme variante) ; chaque déploiement garde la dernière version valide si le build échoue.

**Workflow de développement durable** : atelier local (`uvicorn api_v2:app --reload --port 8001` + `npm run dev`) → répétition (`npm run build`, tsc attrape tout en 8 s, + `docker run` local) → contrôle (`findstr` : aucun .env/PDF/venv ne part) → envoi (`git push` : Cloudflare + Render suivent automatiquement).

### 10.3 Rituels de stabilité

- Après chaque sauvegarde de l'api, attendre `Application startup complete.` (~5 s) avant de questionner : sinon « Erreur de connexion »
- Vérifier `/health` avant tout test
- **Préparer une démo** : V1, le cache vit en mémoire du serveur (poser les questions de démo après le dernier redémarrage) ; V2, le cache persiste en base, mais Render sort de veille : réchauffer le service avant la démo, les questions pré-posées ressortent instantanément, à l'abri des quotas

## 11. Tests et validation

### 11.1 Audits SQL

```sql
-- 26 cantons présents, aucun à 0 (table selon la génération : tax_documents / tax_documents_v2)
WITH dropdown(v) AS (
  VALUES ('Zürich'),('Bern'),('Luzern'),('Uri'),('Schwyz'),
         ('Obwalden'),('Nidwalden'),('Glarus'),('Zug'),('Fribourg'),
         ('Solothurn'),('Basel-Stadt'),('Basel-Landschaft'),('Schaffhausen'),
         ('Appenzell Ausserrhoden'),('Appenzell Innerrhoden'),('St. Gallen'),
         ('Graubünden'),('Aargau'),('Thurgau'),('Ticino'),('Vaud'),
         ('Valais'),('Neuchâtel'),('Genève'),('Jura'))
SELECT d.v AS canton, COUNT(t.canton) AS nb_chunks
FROM dropdown d
LEFT JOIN tax_documents_v2 t ON t.canton = d.v
GROUP BY d.v ORDER BY d.v;

-- un paragraphe donné est-il bien en base ?
SELECT LEFT(content, 500) FROM tax_documents_v2
WHERE canton = 'Luzern' AND content LIKE '%Kind 12500%';
```

### 11.2 Fact-check systématique (vérité terrain = les PDF ESTV)

| Test | Question | Canton | Attendu | Statut |
|---|---|---|---|---|
| Complétude | déductions enfants | Luzern | 8'100/13'200/2'000/20'200/12'500 + 700 assurance | ✅ 12 montants |
| Complétude | déductions enfants | Zürich | 9'400/25'300 + 1'300 assurance | ✅ |
| Complétude | frais transport | Bern | 7'000 + barème complet | ✅ |
| Complétude | frais transport | St. Gallen/Appenzell/Obwald | 8'000/7 barèmes/10'000 | ✅ |
| Garde-fou | « qui es-tu ? » / météo | quelconque | présentation, 0 token | ✅ |
| Profil | enfants = 2 vs 0 | Luzern | applicable/non applicable motivées | ✅ |
| Multilingue | DE/EN/IT | Schaffhausen | réponses intégrales dans la langue | ✅ |
| Résilience | quota Gemini épuisé | | repli Groq, service continue | ✅ vécu |
| Cache | même question | | instantané, badge (cache) | ✅ |
| Mobile | depuis un téléphone | | streaming complet, cartes empilées | ✅ |

Stabilité : poser la même question 3× → montants et références identiques (temp 0.0). La formulation peut varier légèrement (modèle de raisonnement) : **les chiffres sont le critère de vérité**.

### 11.3 Instruments de debug

`POST /api/debug-retrieval` (l'outil qui a calibré le seuil, diagnostiqué le § 52, mesuré le recall : extraits bruts sans consommer de tokens LLM) ; le terminal du serveur (témoins `[RAG] 7 extraits`, `[GROQ] OK`, `[CACHE-DB]`) ; `repr()` et `Get-Content` avec crochets (rendre les caractères invisibles visibles) ; `py_compile`, `npm run build`, `findstr` (les trois contrôles avant push).

## 12. Dépannage

| Symptôme | Génération | Cause probable | Solution |
|---|---|---|---|
| « Erreur de connexion au serveur backend » | V1 | uvicorn éteit ou en redémarrage (sauvegarde de api.py) ou SyntaxError | attendre `Application startup complete.` ; terminal ; `py_compile` |
| Première requête lente en ligne | V2 | Render sort de veille (~15 min d'inactivité) | réchauffer le service avant une démo |
| Frontend appelle localhost en production | V2 | `VITE_API_URL` absente chez l'hébergeur | variable de build chez Cloudflare, rebuild |
| Variables .env vides dans Docker | V2 | guillemets ou espaces dans le .env | format strict `KEY=value` |
| 429 (TPD/TPM) | V1+V2 | quotas Groq (et Gemini par modèle en V2) | cascade, cache, attendre la réinitialisation |
| 413 « Request too large » | V1+V2 | Groq compte entrée + budget de sortie | `max_completion_tokens ≤ 3000` ; troncature du contexte |
| 404 model_not_found | V1+V2 | nom de modèle inexistant sur le compte | nom exact chez le fournisseur |
| 401 | V1+V2 | clé du mauvais fournisseur | faire correspondre clé et `base_url` |
| « Je n'ai pas trouvé » sur un canton ingéré | V1+V2 | nom désaligné (« Lucerne » en base, « Luzern » envoyé) | audit SQL §11 ; ALIASES ; re-ingestion |
| Montant manquant (ex. 12 500) | V1+V2 | chunk pollué multi-sujets / top-k insuffisant | chunking paragraphe ; vérifier `match_count` |
| Tableaux en bouillie de ` ` | V1+V2 | remark-gfm absent | installer + `remarkPlugins` |
| Réponse en français malgré langue = de | V1+V2 | code langue non contraignant | LANGUE_NOMS + interdiction + SECTION_HEADERS |
| TypeError: multiple values for 'temperature' | V1+V2 | paramètres en dur ET via `**params` | uniquement `**params` |
| TypeError: 'int' and 'dict' (puissance) | V1+V2 | virgule manquante avant `**params` | virgule après l'argument précédent |

## 13. Limites connues (assumées, documentées)

- ~~Le Copilot requiert le backend local~~ : **résolu par V2** (en ligne sur swisssimple.ch)
- Top-k retrieval ≠ rappel 100 % sur question très courte ou générique (« déplacement » seul matche mal, St. Gallen vécu) : remèdes identifiés (placeholder incitatif, multi-requêtes, expansion de question, reranking)
- Quota embeddings 1000/jour (V2) : confortable pour un lancement grâce au cache, à lever avec le palier payant
- Cache RAM volatile (redémarrage = vidage) : le niveau base persiste (V2)
- Cache sans TTL : les lois changent chaque année → purge annuelle prévue à la ré-ingestion
- À température 0, la formulation peut varier légèrement (modèle de raisonnement) : les montants et références restent le critère
- Outil d'information : ne remplace ni la déclaration officielle, ni un conseil fiscal

## 14. Roadmap

- Reranking des extraits + déduplication des quasi-copies
- Historique conversationnel multi-tours
- Auth Supabase + RLS sur les questions des utilisateurs
- ~~Backend hébergé~~ ✅ **fait** (V2 : Docker sur Render, front Cloudflare, en production)
- Extension du Copilot aux barèmes communaux
- Inférence locale (Ollama) : le seul « vraiment illimité » (machine allumée)
- Purge/TTL annuel du cache automatisé à la ré-ingestion

## 15. Interdictions absolues

1. Jamais de `@ts-ignore` ni `any` non justifié
2. Jamais de nouvelle dépendance npm non documentée (exception autorisée : remark-gfm)
3. Jamais de coefficients communaux ou d'église sur l'IFD
4. Jamais de règle fiscale chiffrée en dur dans React (ni dans les prompts IA : les montants viennent des extraits de loi dans Supabase)
5. Jamais de classes CSS utilitaires inline style-Tailwind : CSS traditionnel dans des fichiers `.css` dédiés

## 16. Sécurité

- `.env` jamais commité : vérifier `.gitignore` (`.env`, `venv/`, `node_modules/`). En cas de fuite de clé : révoquer et régénérer immédiatement chez le fournisseur
- Contrôle avant chaque push : `findstr` garantit qu'aucun `.env`/PDF/`venv` ne part
- Les clés vivent uniquement côté backend (Render) : le frontend ne voit jamais que l'URL publique de l'API (`VITE_API_URL` n'expose aucune clé)
- `allow_origins=["*"]` : développement uniquement ; restreindre aux domaines réels en production
- V1 : le frontend appelait `http://localhost:8000`, le Copilot restait local : héberger le backend avant de l'exposer (c'est fait en V2)
- Aucune donnée personnelle stockée : le cache ne contient que des questions anonymes et des réponses de loi publique

## 17. Bilan : les chiffres de l'avant/après

**26 cantons ingérés, ~1300 chunks, noms alignés. 14 déductions rendues sur Luzern (record de complétude).**

| | V1 | V2 |
|---|---|---|
| RAM | ~700 Mo | ~100 Mo |
| Dépendances | ~100 | 7 |
| Build Docker | 14 min | 37 s |
| Démarrage | 60 s | 2 s |
| Latence perçue | réponse d'un bloc | ~2 s au premier mot (streaming) |
| Pannes absorbées | repli Groq | 429, 503, timeout 196 s, sans interruption |
| Coût d'exploitation | 0 (machine locale) | 0 CHF (multi-cloud gratuit) |

---