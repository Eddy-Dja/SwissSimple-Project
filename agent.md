# 🇨🇭 SwissSimple V2.2 : Estimateur d'impôts suisse + Copilot IA (RAG), bilingue FR/DE

> **En production** : https://swisssimple.ch (génération V2, multi-cloud gratuit, coût d'exploitation 0 CHF).
> Ne pas confondre les numéros de version : **V1 / V2** = les deux générations du backend Copilot (locale puis déployée). **V2.1** = le produit avec Copilot en ligne. **V2.2** = le produit actuel : bilingue français/allemand indexable, SEO complet, dépôt nettoyé.

**Application double, désormais bilingue :**

1. **Estimateur d'impôt sur le revenu (IFD + ICC)** au centime près pour les 26 cantons et leurs communes, basé strictement sur l'Open Data officiel de l'AFC (Administration Fédérale des Contributions).
2. **Tax Copilot IA** : assistant RAG cross-lingual qui répond aux questions fiscales cantonales en citant les paragraphes de loi (§) et les montants exacts, dans la langue de l'utilisateur (fr/de/it/en).

Chaque page existe en deux versions indexables : française à la racine (`/radar-fiscal`) et allemande (`/de/radar-fiscal`). L'URL est la source de vérité de la langue affichée.

## Sommaire

1. Vision et objectifs
2. Les deux modules : architecture V1 puis V2
3. L'avant/après : pourquoi deux générations
4. Stack technique
5. La version allemande : le site bilingue FR/DE
6. Le SEO et l'indexation Google
7. Structure du projet
8. Schéma de données Supabase
9. Module 1 : moteur fiscal de l'estimateur
10. Module 2 : Tax Copilot IA (RAG)
11. Fournisseurs LLM
12. Installation et lancement
13. Hygiène du dépôt Git
14. Règles de collaboration humain-agent
15. Tests et validation
16. Dépannage
17. Limites connues
18. Roadmap
19. Interdictions absolues
20. Sécurité
21. Bilan : les chiffres de l'avant/après

## 1. Vision et objectifs

- **Nom du projet** : SwissSimple
- **Objectif principal** : un estimateur d'impôt (IFD + ICC) au centime près pour les 26 cantons et leurs communes, basé strictement sur les données officielles de l'AFC, et un assistant conversationnel capable de justifier chaque réponse par le texte de loi cantonal source.
- **Mission bilingue (V2.2)** : le même site en allemand sous `/de`, indexable par Google (hreflang), pour le public alémanique. Une seule base de code, deux familles d'URLs.
- **Vocation pédagogique** : chaque modification est appliquée pas à pas par le développeur, comprise, reproduite, puis expliquée à un public non-initié.
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

Les règles sont identiques depuis V1 : composants `React.FC`, aucun `any` ni `@ts-ignore`, pas de Redux/Zustand (`useState`/`useEffect` natifs), CSS pur dans fichiers dédiés (interdits : Tailwind, MUI, Chakra), `.toLocaleString('fr-CH')` partout, et une liste **FERMÉE** de dépendances npm, toutes documentées dans la table ci-dessous (règle §19 : toute nouvelle dépendance doit être documentée ici).

**Frontend (état exact V2.2, vérifié dans package.json) :**

| Couche | Choix |
|---|---|
| Framework | React 19.2.6 + TypeScript Strict, Vite 8 |
| Routage | react-router-dom 7.17.0 (BrowserRouter ; 10 routes FR + 10 miroirs /de) |
| Internationalisation | i18next 26 + react-i18next 17 + i18next-browser-languagedetector 8 (locales/fr.json, de.json) |
| SEO | react-helmet-async 3 (src/components/SEO.tsx) |
| Markdown (Copilot) | react-markdown 10 + remark-gfm 4 (sans GFM, aucun tableau ne s'affiche) |
| Export PDF | jspdf 4 + jspdf-autotable 5 (src/utils/pdfGenerator.tsx) |
| Données | @supabase/supabase-js 2 |
| Police | @fontsource/inter 5 |

Seuls le moteur d'embeddings et l'infrastructure ont évolué entre les générations de backend (décision documentée §3) :

| Couche | V1 | V2 |
|---|---|---|
| BDD | Supabase (Auth, PostgreSQL, RLS) | identique |
| Backend | FastAPI + uvicorn, sentence-transformers, pdfplumber, python-dotenv, groq, openai | FastAPI + uvicorn, pdfplumber, python-dotenv, groq, openai (torch retiré) |
| Embeddings | paraphrase-multilingual-MiniLM-L12-v2, local, 384 dim, cross-lingual FR↔DE | API Gemini, 3072 dim, multilingue, quota gratuit 1000 req/j |
| LLM | Gemini (principal) → Groq gpt-oss-20b (repli), temperature 0.0 | cascade : 3 modèles Gemini puis Groq |
| Infra | localhost:8000 | Docker sur Render, front Cloudflare, CI/CD GitHub |

## 5. La version allemande : le site bilingue FR/DE (V2.2)

**Principe** (commentaire « BILINGUISME SEO » dans App.tsx) : chaque page existe sous DEUX URLs. FR : `/radar-fiscal` (racine, inchangée — SEO existant conservé). DE : `/de/radar-fiscal` (version allemande indexable par Google). Les mêmes composants sont montés sur les deux familles de routes : mêmes chunks, même code — seule l'URL change. La langue affichée est pilotée par LangSync : **l'URL est la source de vérité**.

**Les 20 routes (App.tsx) :**

- FR : `/`, `/demenagement`, `/retraite`, `/legal`, `/radar-fiscal`, `/assurance`, `/simulateur-avs`, `/simulateur-lpp`, `/classements`, `/dashboard` (protégée : exige un utilisateur connecté)
- DE : les 10 mêmes avec le préfixe `/de` (`/de`, `/de/demenagement`, … `/de/dashboard`)
- Routes inconnues : renvoi vers `/` (ou `/de`)

**Découpage du code (code-splitting)** : Home reste EAGER (page d'atterrissage — la charger en différé provoquerait un flash blanc juste après le loader). 9 chunks en React.lazy (App.tsx, lignes 22-30) : Dashboard, DemenagementHub, RetraiteHub, Legal, RadarFiscal, Assurance, SimulateurAVS, SimulateurLPP, Classements.

**La chaîne linguistique :**

- `src/i18n.js` : i18next, clé `app_language` en localStorage
- `src/locales/fr.json` et `src/locales/de.json` : toutes les chaînes d'interface
- `GlobalToolbar` : bouton FR/DE (`toggleLanguage`)
- `src/hooks/useLocalizedNavigate.ts` : navigation qui conserve la langue
- `src/components/LangSync.tsx` (66 lignes) : synchronise URL ↔ langue

**La leçon du ping-pong (commit da246ff)** : la redirection mémoire de LangSync (`/` → `/de` pour un visiteur germanophone) se déclenchait AUSSI pendant la navigation SPA : depuis `/de`, un clic FR renvoyait vers `/`… qui rebondissait vers `/de` (ping-pong / ↔ /de). Correctif : une garde `useRef didRootCheck` (lignes 31-46) — la redirection ne s'applique qu'au TOUT PREMIER rendu, plus jamais pendant la navigation interne. Erreur TS associée vécue : les TS1005/TS1128 signalent en AVAL du vrai coupable (accolade en trop).

## 6. Le SEO et l'indexation Google (V2.2)

**Le moteur** : `src/components/SEO.tsx` (react-helmet-async). Par page : titre FR/DE, attribut `lang`, `canonical` unique, `hreflang` fr / de / x-default. Le sitemap `Frontend/public/sitemap.xml` liste 18 URLs : 9 FR + 9 DE (les dashboards sont exclus, réservés aux visiteurs connectés).

**robots.txt** : Googlebot autorisé. Google-Extended et GoogleOther (bots d'IA) sont bloqués par le robots.txt géré par Cloudflare — attention : ce ne sont PAS des robots de recherche, l'indexation Google n'est pas concernée.

**Google Search Console (état vérifié) :**

- Propriété vérifiée via `google581bf650ec8345f4.html` (le 307 initial est bénin, le fichier finit en 200)
- Sitemap soumis et ACCEPTÉ (18 URLs)
- Page racine swisssimple.ch INDEXÉE
- 10 demandes d'indexation : `/`, `/de` et les 8 pages d'outils

**L'analogie de la bibliothèque** (pour un public non-initié) : Google indexe comme une bibliothèque catalogue ses livres. Le site = les livres ; le sitemap = le catalogue remis au bibliothécaire ; hreflang = la notice qui dit « ce livre existe aussi en allemand, autre rayon ». Une page non indexée = un livre dont personne n'a rempli la fiche.

**Contrôles de production (tous verts)** : titres FR/DE, attribut lang, canonical unique par page, hreflang fr/de/x-default, zéro noindex. L'asset servi est `index-DSptW770.js` — son hash est resté inchangé après la suppression du code mort : preuve que ce code n'était jamais bundlé (jamais importé nulle part).

## 7. Structure du projet

```
SwissSimple/
├── agent.md                     ← ce document (source de vérité pour agents IA)
├── README.md
├── wrangler.jsonc               ← config Cloudflare Workers
├── estv_api.py                  ← script d'import Open Data AFC
├── data_impot/                  ← Open Data AFC + scripts d'import
│                                  (9 fichiers encore SUIVIS malgré l'ignore — voir §13)
├── .gitignore                   ← voir §13
├── Frontend/
│   ├── index.html               ← loader initial + <div id="root">
│   ├── public/sitemap.xml       ← 18 URLs (9 FR + 9 DE)
│   ├── public/robots.txt
│   ├── src/
│   │   ├── App.tsx              ← 10 routes FR + 10 miroirs /de ; 9 lazy + Home eager
│   │   ├── i18n.js              ← i18next, clé localStorage "app_language"
│   │   ├── locales/fr.json, de.json
│   │   ├── components/          ← GlobalNavbar, GlobalToolbar, LangSync, SEO,
│   │   │                          SiteFooter, ScrollToTop, AuthModal, EmailGate
│   │   ├── hooks/               ← useLocalStorageState, useLocalizedNavigate
│   │   ├── context/AuthContext.tsx
│   │   ├── lib/supabaseClient.ts
│   │   ├── utils/pdfGenerator.tsx
│   │   ├── pages/               ← Home, Dashboard, Legal, RetraiteHub, DemenagementHub
│   │   └── modules/
│   │       ├── fiscal/           ← RadarFiscal.tsx (+.css), TaxCopilot.tsx (+.css)
│   │       ├── rente_lpp/        ← SimulateurLPP
│   │       ├── rente_avs/        ← SimulateurAVS
│   │       ├── assurance_maladie/← Assurance
│   │       └── classements/      ← Classements
│   └── package.json
└── Backend/
    ├── api.py               # V1 : backend local (embeddings MiniLM sur machine)
    ├── ingest.py            # V1 : ingestion locale
    ├── api_v2.py            # V2 : production (API embeddings, garde-fou, cascade, streaming)
    ├── ingest_v2.py         # V2 : ingestion par lots, backoff, quotas
    ├── Dockerfile           # V2
    ├── requirements.txt     # V1
    ├── requirements_v2.txt  # V2 : 7 dépendances
    ├── Words/               # 26 lois cantonales en .docx (encore suivies — voir §13)
    ├── PDFs/                # 26 lois cantonales (documents ESTV)
    └── .env                 # clés : JAMAIS commité (voir §20)
```

## 8. Schéma de données Supabase

### 8.1 Tables de l'estimateur (identiques V1/V2, noms stricts)

**communes** : `id (int, PK)`, `commune`, `canton`, `canton_id (int)`, `coeff_revenu_canton (float)` (ex. 96 pour 96 %), `coeff_revenu_commune (float)`, `coeff_revenu_eglise_reforme (float)`, `coeff_revenu_eglise_catholique (float)`

**baremes** : `canton_id (int)` (0 = Confédération, 1-26 = cantons), `statut ('celibataire' | 'marie')`, `autorite_fiscale ('Canton' | 'Confédération')`, `montant_tranche (float)` (limite inférieure), `taux (float)` (taux marginal %), `montant_base (float)` (impôt cumulé des tranches précédentes)

**deductions** : `canton_id`, `nom_deduction`, `montant`, `pourcent`, `minimum`, `maximum`, `statut`

**deductions_paliers** : `canton_id`, `nom_deduction`, `revenu_seuil`, `deduction_montant`, `statut`

### 8.2 Table vectorielle du Copilot

**V1** : `tax_documents (id, canton, content, embedding VECTOR(384))`, RPC `match_tax_docs(query_embedding, match_count, filter_canton)`, similarité cosinus filtrée par canton, `match_count = 5`.

**V2** : `tax_documents_v2 (id, canton, content, embedding VECTOR(3072))`, RPC `match_tax_docs_v2`, `match_count = 7`. Décision technique : pas d'index vectoriel (ivfflat/hnsw plafonne à 2000 dimensions) ; avec le filtre par canton (~800 lignes max), le scan séquentiel est rapide ET exact (l'index approximatif peut rater le meilleur chunk, le séquentiel ne rate jamais).

### 8.3 Cache des réponses

**V1** : `ANSWER_CACHE` en mémoire du serveur (clé = question + canton + statut + enfants + profession + langue), instantané mais volatile : vidé au redémarrage d'uvicorn.

**V2** : deux niveaux. RAM d'abord, puis table `answer_cache_v2` en base : **persistante et partagée entre tous les visiteurs**. Une question populaire ne coûte qu'une fois : le cache l'absorbe pour tous les suivants. C'est ce qui rend le modèle gratuit viable (1000 embeddings/jour + cache = des dizaines de milliers de réponses servies).

### 8.4 Convention de nommage des cantons (identique V1/V2, source de vérité unique)

Les valeurs stockées dans la table vectorielle doivent être identiques au caractère près aux `value` du `<select>` du frontend :

`Zürich, Bern, Luzern, Uri, Schwyz, Obwalden, Nidwalden, Glarus, Zug, Fribourg, Solothurn, Basel-Stadt, Basel-Landschaft, Schaffhausen, Appenzell Ausserrhoden, Appenzell Innerrhoden, St. Gallen, Graubünden, Aargau, Thurgau, Ticino, Vaud, Valais, Neuchâtel, Genève, Jura`

L'ingestion garantit cet alignement via le dictionnaire ALIASES (§10.3). Un désalignement produit le symptôme « Je n'ai pas trouvé cette information dans les lois de ce canton » pour un canton pourtant ingéré.

## 9. Module 1 : moteur fiscal de l'estimateur (inchangé : V1 = V2)

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

### 9.1 Architecture « State-Specific Strategy »

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

### 9.2 Interface utilisateur

- **Filtres de base** : revenu (brut/net), classe d'âge (LPP), statut (célibataire/marié), religion, enfants à charge, commune
- **Options avancées (toggles)** : cotisations sociales (auto-calculé, modifiable), frais de transport réels, primes d'assurance réelles, frais médicaux, dons, pilier 3a, frais de garde, revenu net du conjoint, case « retraité AVS/AI »
- **Résultats** : séparation claire cantonal / communal / paroissial / IFD, montant total et taux effectif. Deux modes : simple (une commune) et comparaison (deux communes, « VS »)
- **Intégration** : le widget TaxCopilot est monté en bas de la page de l'estimateur (`<TaxCopilot />` à la fin de RadarFiscal.tsx)

## 10. Module 2 : Tax Copilot IA (RAG)

### 10.1 Flux V1 (l'original, local)

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

### 10.2 Flux V2 (l'actuel, en production)

1. **Cache** (RAM puis Supabase) : question déjà posée ? réponse instantanée, 0 token
2. **Vectorisation** : question → 3072 dimensions (API Gemini)
3. **Recherche** : top-7 extraits du canton (RPC, scan séquentiel exact)
4. **Garde-fou** : similarité du top < 0.55 ? question non fiscale → réponse de présentation, sans consommer de LLM
5. **Prompt** : extraits + profil + consignes strictes
6. **Cascade** : Gemini 3.5 → 3.8 → 3.6 → Groq (repli automatique)
7. **Streaming** : NDJSON ligne par ligne vers le navigateur
8. **Cache** : sauvegarde (RAM + Supabase) pour la prochaine fois

### 10.3 Ingestion

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

### 10.4 Backend

**Endpoints** :

- V1 : `GET /health`, `POST /api/tax-copilot` (JSON → Markdown), `POST /api/debug-retrieval`
- V2 : `GET /health`, `POST /api/tax-copilot-stream` (NDJSON), `POST /api/debug-retrieval`

**Paramètres LLM (introduits en V1, conservés en V2)** : `temperature = 0.0` (déterminisme des montants), troncature du contexte à 10 000 caractères (anti-413), budget de sortie 3000 tokens (Groq compte entrée + budget de sortie dans la taille de requête), `reasoning_effort = "low"` chez Groq (économie de tokens de raisonnement), `max_tokens = 3000` chez Gemini, détection `finish_reason == "length"` (réponse coupée), nettoyage regex du mot-valise « ab-déduction », consigne anti-invention (tout montant doit venir des extraits), traceback complet au terminal en cas d'erreur.

### 10.5 Les garde-fous anti-hallucination

V1 en avait deux (le prompt restrictif, la validation factuelle manuelle). V2 en ajoute un troisième, positionné AVANT le LLM :

1. **Prompt restrictif** : « Tu n'inventes JAMAIS de chiffre : tout montant doit venir des extraits fournis » + « si la réponse n'y est pas, dis-le »
2. **Seuil de similarité (V2, calibré empiriquement)** : les questions fiscales mesurées vivent à 0.55-0.72, les absurdités à 0.49-0.51 → seuil à 0.55 → les hors-sujets sont interceptés avant le LLM (zéro token)
3. **Protocole de validation factuelle** : tests de vérité terrain contre les PDF ESTV (voir §15)

### 10.6 La cascade de fournisseurs (V2, la résilience)

```python
providers = [Gemini 3.5, Gemini 3.8, Gemini 3.6, Groq]
# tentative 1 : 429 (quota) → tentative 2 : 503 (surcharge) → tentative 3 : OK
# l'utilisateur ne voit JAMAIS la panne : juste le badge de qui a répondu
```

Testée en conditions réelles : 429 (quotas quotidiens), 503 (surcharge) vécus, le service n'est jamais tombé. Détail précieux : les quotas Gemini sont comptés **par modèle** → trois modèles dans la cascade = trois budgets séparés.

### 10.7 Le streaming (V2, l'UX)

Le endpoint `/api/tax-copilot-stream` émet du NDJSON : `{"type":"meta"...}` puis `{"type":"chunk","text":"..."} × N` puis `{"type":"done"}`. Côté React : `getReader()` lit le flux et `setAnswer(acc)` fait s'écrire la réponse mot par mot : 20 secondes de génération sont perçues comme 2 secondes.

### 10.8 Le multilingue (identique V1/V2, la finesse)

Un code langue (« de ») injecté dans un prompt français ne suffit pas à contraindre le modèle. Trois leviers :

- **LANGUE_NOMS** : le code devient « allemand (Deutsch, Hochdeutsch) »
- **Interdiction explicite** de toute phrase hors langue demandée
- **SECTION_HEADERS** : titres de sections et en-têtes de tableau fournis directement dans la langue cible

Mécanique profonde : question FR → extraits DE → réponse IT si demandée. Le triptyque cross-lingual suisse, rendu possible par les embeddings multilingues (MiniLM en V1, Gemini 3072d en V2).

### 10.9 Frontend (TaxCopilot.tsx)

5 sélecteurs (canton : les 26 valeurs canoniques, statut civil, enfants, profession, langue de réponse) ; ReactMarkdown avec `remarkPlugins={[remarkGfm]}` (sinon les tableaux s'affichent en bouillie) ; `overflowX: 'auto'` sur le conteneur ; en V2, lecture du flux streaming via `getReader()`.

## 11. Fournisseurs LLM

| | Gemini (AI Studio) | Groq (gpt-oss-20b) |
|---|---|---|
| Rôle | principal | repli |
| Coût | gratuit (quotas journaliers) | gratuit (200 k tokens/j, 8 k/min, requête ≤ 8 k) |
| SDK | openai + `base_url="https://generativelanguage.googleapis.com/v1beta/openai/"` | groq |
| Paramètres | `max_tokens` | `max_completion_tokens`, `reasoning_effort` |
| Données d'entraînement | le palier gratuit peut utiliser les données | non |

**Règles clés** : une clé API n'est valable que sur l'endpoint de son fournisseur (clé Gemini dans le client Groq → 401) ; vérifier le nom exact du modèle actuel (ils évoluent).

**Évolution V2** : d'une simple paire principal/repli, le système est passé à la cascade de quatre fournisseurs (§10.6), chaque modèle Gemini apportant son propre budget de quota.

**Pourquoi la cascade plutôt qu'un choix unique** : « quel est le meilleur LLM » se répond par le critère (quota, vitesse, qualité, souveraineté des données). Une réponse de développeur, pas de fan.

## 12. Installation et lancement

### 12.1 V1 : backend local (mode développement autonome)

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

### 12.2 V2 : production (Docker, Render, Cloudflare)

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
| Cloudflare | frontend statique mondial + **intégration Git : chaque push sur main = build puis déploiement automatiques** | 0 CHF |
| Render | backend V2 Docker (512 Mo, veille ~15 min) | 0 CHF |
| Supabase | corpus vectoriel + cache + auth | 0 CHF |
| Gemini → Groq | embeddings + LLM en cascade | 0 CHF (quotas) |
| GitHub | source de vérité, CI/CD | 0 CHF |

**Le déploiement moderne (V2.2, décrypté depuis le dashboard Cloudflare)** : l'intégration Git du projet « swisssimple-project » construit avec `npm run build` (dossier racine /Frontend) puis déploie avec `npx wrangler deploy`, à chaque push sur main. Conséquence : **PUSH = DÉPLOIEMENT**. Le `wrangler deploy` manuel est devenu redondant — le garder uniquement en secours. Garde-fou : `npm run build` local avant chaque push (tsc attrape tout en ~8 s). Si un build échoue chez Cloudflare, le site garde la dernière version valide. Les doublons de déploiements (un manuel a4d225c4 + un build Git c56fcc61 le même soir) sont sans conséquence.

**Leçons de mise en ligne vécues** : `VITE_API_URL` vit chez l'hébergeur (injectée au build, jamais dans le repo) ; le `.env` Docker sans guillemets ni espaces (dotenv pardonne, Docker non : trois bugs appris) ; le déclencheur de build = `git push` (le commit vide comme variante) ; chaque déploiement garde la dernière version valide si le build échoue.

**Workflow de développement durable** : atelier local (`uvicorn api_v2:app --reload --port 8001` + `npm run dev`) → répétition (`npm run build`, tsc attrape tout en 8 s, + `docker run` local) → contrôle (`findstr` : aucun .env/PDF/venv ne part) → envoi (`git push` : Cloudflare + Render suivent automatiquement).

### 12.3 Rituels de stabilité

- Après chaque sauvegarde de l'api, attendre `Application startup complete.` (~5 s) avant de questionner : sinon « Erreur de connexion »
- Vérifier `/health` avant tout test
- **Préparer une démo** : V1, le cache vit en mémoire du serveur (poser les questions de démo après le dernier redémarrage) ; V2, le cache persiste en base, mais Render sort de veille : réchauffer le service avant la démo, les questions pré-posées ressortent instantanément, à l'abri des quotas

## 13. Hygiène du dépôt Git

**.gitignore actuel (racine du dépôt)** :

```
# Logs
logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
lerna-debug.log*

node_modules
dist
dist-ssr
*.local

# Editor directories and files
.vscode/*
!.vscode/extensions.json
.idea
.DS_Store
*.suo
*.ntvs*
*.njsproj
*.sln
*.sw?
.env

# ==== Backend (Tax Copilot) ====
Backend/.env
Backend/venv/
Backend/__pycache__/
Backend/PDFs/
data_impot/
data_assurance/

/package.json
/package-lock.json
.wrangler/
*.patch
```

**Les incidents vécus (et leurs leçons)** :

1. **package.json / package-lock.json parasites à la racine** (push b2e72d7, session précédente) → historique réécrit, parasites disparus. Leçon : les fichiers générés à la racine du dépôt n'ont rien à faire dans l'historique ; ils sont désormais ignorés.
2. **Le patch swisssimple-p1.patch committé par erreur** via `git add -A` (Git ≥ 2.0 ajoute TOUT l'arbre, pas seulement le dossier courant) → nettoyage `git rm --cached` + `*.patch` ajouté au .gitignore (commits 28107b95 / a30a3f3). Leçons : (a) un commit = une étiquette sur une boîte — regarder la boîte AVANT d'étiqueter (`git diff --cached`) ; (b) une liste noire (findstr) perd toujours contre .gitignore ; (c) préférer les chemins explicites à `add -A`.
3. **Code mort supprimé** (commit 91b1217) : LanguageSwitcher.tsx, LanguageSwitcher.css, AppLayout.tsx (−137 lignes). Vérifié AVANT : 0 importeur, build OK ; vérifié APRÈS : le hash de l'asset de production est inchangé — le code mort jamais importé n'est jamais bundlé.

4. **Fichiers de données encore suivis malgré l'ignore** (constat du 30.10.2026, lecture seule) : `data_impot/` figure dans .gitignore MAIS 9 fichiers restent suivis (Barèmes, Déductions, Coefficients en CSV/DOCX + 2 scripts d'import Python) — committés AVANT l'ignore. Et `Backend/Words/` (26 lois cantonales en .docx) n'est pas ignoré du tout : .gitignore n'ignore que `Backend/PDFs/`. Leçon (déjà connue avec le .patch) : **.gitignore n'annule pas le suivi existant** — seul `git rm --cached` désuivi. Décision laissée au développeur : ce sont des données publiques de l'AFC, aucun secret ; les garder (le clone contient alors toutes les données) ou les retirer du suivi (dépôt plus léger, données locales uniquement). Symptôme révélateur : `git ls-files` affiche ces noms entre guillemets (caractères accentués), ex. `"data_impot/Bar\303\250mes.docx"`.

**Chaîne de commits récente (branche main) :**

- `ebd7521` — SEO: version allemande indexable (patch P1 « bilingue-SEO », 11 fichiers, +349/−41 : 8 modifiés + LangSync.tsx, SiteFooter.tsx, useLocalizedNavigate.ts)
- `da246ff` — Fix: redirection mémoire uniquement au 1er rendu (clic FR depuis /de) — amend du commit intermédiaire 5fe1a3f, disparu
- `a30a3f3` — chore: retire le patch P1 du dépôt et ignore *.patch (avec 28107b95)
- `91b1217` — chore: supprime le code mort (LanguageSwitcher, AppLayout)

## 14. Règles de collaboration humain-agent

**Les 5 règles absolues du développeur :**

1. Jamais de fichier créé à l'initiative de l'agent ; le code se livre DANS LE CHAT.
2. Fichiers seulement sur demande explicite, nommés par le développeur, créés de son côté.
3. Après une perte de contexte : redemander au lieu de deviner (relire ce fichier).
4. Tout choix explicite du développeur est consigné (worklog / ce document).
5. Consentement explicite AVANT toute modification (code, build, commit, déploiement). Un message ambigu = demander, ne pas agir.

**Mode de travail** : le développeur applique les modifications LUI-MÊME, pas à pas — pour comprendre, reproduire, puis expliquer à un public non-initié. Rôle de l'agent : conseiller, vérifier en LECTURE SEULE, expliquer. L'agent ne possède AUCUN identifiant GitHub ni Cloudflare (c'est voulu) : il ne peut ni pousser ni déployer. Origine de la règle 5 : « Tu peux faire toutes les modifications tout seul » était une question, pas une autorisation.

**Routine de mise en ligne** : appliquer → `npm run build` (garde-fou local) → commit (`git diff --cached` d'abord) → push → Cloudflare construit et déploie (§12.2) → vérification lecture seule en production par l'agent.

## 15. Tests et validation

### 15.1 Audits SQL

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

### 15.2 Fact-check systématique (vérité terrain = les PDF ESTV)

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

### 15.3 Instruments de debug

`POST /api/debug-retrieval` (l'outil qui a calibré le seuil, diagnostiqué le § 52, mesuré le recall : extraits bruts sans consommer de tokens LLM) ; le terminal du serveur (témoins `[RAG] 7 extraits`, `[GROQ] OK`, `[CACHE-DB]`) ; `repr()` et `Get-Content` avec crochets (rendre les caractères invisibles visibles) ; `py_compile`, `npm run build`, `findstr` (les trois contrôles avant push).

### 15.4 Vérifications SEO de production (V2.2)

| Point contrôlé | Résultat |
|---|---|
| Titres FR et DE par page | ✅ |
| Attribut lang | ✅ |
| canonical unique par page | ✅ |
| hreflang fr / de / x-default | ✅ |
| Balises noindex | ✅ zéro |
| sitemap.xml | ✅ 18 URLs |
| robots.txt (Googlebot) | ✅ autorisé |
| Fichier de vérification Google | ✅ 307 puis 200 (bénin) |

## 16. Dépannage

| Symptôme | Génération | Cause probable | Solution |
|---|---|---|---|
| « Erreur de connexion au serveur backend » | V1 | uvicorn éteint ou en redémarrage (sauvegarde de api.py) ou SyntaxError | attendre `Application startup complete.` ; terminal ; `py_compile` |
| Première requête lente en ligne | V2 | Render sort de veille (~15 min d'inactivité) | réchauffer le service avant une démo |
| Frontend appelle localhost en production | V2 | `VITE_API_URL` absente chez l'hébergeur | variable de build chez Cloudflare, rebuild |
| Variables .env vides dans Docker | V2 | guillemets ou espaces dans le .env | format strict `KEY=value` |
| 429 (TPD/TPM) | V1+V2 | quotas Groq (et Gemini par modèle en V2) | cascade, cache, attendre la réinitialisation |
| 413 « Request too large » | V1+V2 | Groq compte entrée + budget de sortie | `max_completion_tokens ≤ 3000` ; troncature du contexte |
| 404 model_not_found | V1+V2 | nom de modèle inexistant sur le compte | nom exact chez le fournisseur |
| 401 | V1+V2 | clé du mauvais fournisseur | faire correspondre clé et `base_url` |
| « Je n'ai pas trouvé » sur un canton ingéré | V1+V2 | nom désaligné (« Lucerne » en base, « Luzern » envoyé) | audit SQL §15 ; ALIASES ; re-ingestion |
| Montant manquant (ex. 12 500) | V1+V2 | chunk pollué multi-sujets / top-k insuffisant | chunking paragraphe ; vérifier `match_count` |
| Tableaux en bouillie de ` ` | V1+V2 | remark-gfm absent | installer + `remarkPlugins` |
| Réponse en français malgré langue = de | V1+V2 | code langue non contraignant | LANGUE_NOMS + interdiction + SECTION_HEADERS |
| TypeError: multiple values for 'temperature' | V1+V2 | paramètres en dur ET via `**params` | uniquement `**params` |
| TypeError: 'int' and 'dict' (puissance) | V1+V2 | virgule manquante avant `**params` | virgule après l'argument précédent |
| Clic FR depuis /de : rebond vers la racine (ping-pong / ↔ /de) | V2.2 | redirection mémoire LangSync déclenchée pendant la navigation SPA | garde didRootCheck : redirection uniquement au 1er rendu (corrigé da246ff) |
| TS1005 / TS1128 en cascade | tous | accolade en trop — l'erreur TS pointe en AVAL du vrai coupable | compter les accolades du bloc modifié ; remonter vers la ligne fautive |
| Un .patch (ou fichier parasite) se retrouve committé | tous | `git add -A` ajoute tout l'arbre | `git rm --cached` + .gitignore ; `git diff --cached` avant tout commit |
| `git apply` : « No such file or directory » | tous | le patch n'a jamais été téléchargé côté machine | re-télécharger le patch avant de l'appliquer |

## 17. Limites connues (assumées, documentées)

- ~~Le Copilot requiert le backend local~~ : **résolu par V2** (en ligne sur swisssimple.ch)
- Top-k retrieval ≠ rappel 100 % sur question très courte ou générique (« déplacement » seul matche mal, St. Gallen vécu) : remèdes identifiés (placeholder incitatif, multi-requêtes, expansion de question, reranking)
- Quota embeddings 1000/jour (V2) : confortable pour un lancement grâce au cache, à lever avec le palier payant
- Cache RAM volatile (redémarrage = vidage) : le niveau base persiste (V2)
- Cache sans TTL : les lois changent chaque année → purge annuelle prévue à la ré-ingestion
- À température 0, la formulation peut varier légèrement (modèle de raisonnement) : les montants et références restent le critère
- Analytics sans cookies pas encore en place : recommandation Cloudflare Web Analytics (gratuit) ; alternatifs payants Plausible, Fathom
- Outil d'information : ne remplace ni la déclaration officielle, ni un conseil fiscal

## 18. Roadmap

**Fait (ordre chronologique) :**

- ✅ Backend hébergé (V2 : Docker sur Render, front Cloudflare, en production)
- ✅ Balises OG
- ✅ SEO des pages primes
- ✅ Pages légales
- ✅ hreflang + version /de indexable (patch P1, commit ebd7521, 11 fichiers, +349/−41)
- ✅ React.lazy vérifié (9 chunks, App.tsx lignes 22-30)
- ✅ Export des résultats en PDF (jspdf + jspdf-autotable, src/utils/pdfGenerator.tsx)
- ✅ Suppression du code mort (91b1217, −137 lignes)

**En cours :**

- 🔄 Agrandissement de l'affichage des résultats de l'estimateur : parité des tailles avec la page LPP (montants 1.5rem, libellés 1rem, boîtes padding 1.5rem) — proposition livrée, application par le développeur

**À faire :**

- ⬜ Analytics sans cookies — recommandation : Cloudflare Web Analytics (gratuit, sans cookie) ; alternatifs payants : Plausible, Fathom
- ⬜ Module Pilier 3a — cible avant décembre (fenêtre fiscale)
- ⬜ 26 pages cantonales (une par canton) — idée ouverte
- ⬜ Reranking des extraits + déduplication des quasi-copies
- ⬜ Historique conversationnel multi-tours
- ⬜ Auth Supabase + RLS sur les questions des utilisateurs
- ⬜ Extension du Copilot aux barèmes communaux
- ⬜ Inférence locale (Ollama) : le seul « vraiment illimité » (machine allumée)
- ⬜ Purge/TTL annuel du cache automatisé à la ré-ingestion

**Suivi Google (J+2/J+7 après les demandes d'indexation) :**

- Rechercher `site:swisssimple.ch` et `site:swisssimple.ch/de`
- Consulter le rapport Pages dans Search Console

## 19. Interdictions absolues

1. Jamais de `@ts-ignore` ni `any` non justifié
2. Jamais de nouvelle dépendance npm non documentée dans §4. Liste documentée actuelle : remark-gfm, react-markdown, i18next, react-i18next, i18next-browser-languagedetector, react-helmet-async, react-router-dom, jspdf, jspdf-autotable, @supabase/supabase-js, @fontsource/inter
3. Jamais de coefficients communaux ou d'église sur l'IFD
4. Jamais de règle fiscale chiffrée en dur dans React (ni dans les prompts IA : les montants viennent des extraits de loi dans Supabase)
5. Jamais de classes CSS utilitaires inline style-Tailwind : CSS traditionnel dans des fichiers `.css` dédiés

## 20. Sécurité

- `.env` jamais commité : vérifier `.gitignore` (`.env`, `venv/`, `node_modules/`). En cas de fuite de clé : révoquer et régénérer immédiatement chez le fournisseur
- Contrôle avant chaque push : `findstr` garantit qu'aucun `.env`/PDF/`venv` ne part
- Les clés vivent uniquement côté backend (Render) : le frontend ne voit jamais que l'URL publique de l'API (`VITE_API_URL` n'expose aucune clé)
- `allow_origins=["*"]` : développement uniquement ; restreindre aux domaines réels en production
- V1 : le frontend appelait `http://localhost:8000`, le Copilot restait local : héberger le backend avant de l'exposer (c'est fait en V2)
- Aucune donnée personnelle stockée : le cache ne contient que des questions anonymes et des réponses de loi publique

## 21. Bilan : les chiffres de l'avant/après

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

**Les jalons de V2.2 (cette semaine) :**

- 18 URLs dans le sitemap, sitemap accepté par Search Console, 10 demandes d'indexation, racine indexée
- Patch P1 « bilingue-SEO » : 11 fichiers, +349/−41 (commit ebd7521)
- Fix LangSync ping-pong : da246ff
- Ménage du dépôt : a30a3f3 (.patch retiré, *.patch ignoré)
- Code mort : 91b1217 (−137 lignes), hash de l'asset de production inchangé (index-DSptW770.js) — preuve qu'il n'était jamais bundlé
- Coût d'exploitation : 0 CHF maintenu
