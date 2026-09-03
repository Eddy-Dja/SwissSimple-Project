4. Le README complet, version maximale
🇨🇭 SwissSimple V2.1 — Estimateur d'impôts suisse + Copilot IA (RAG)
Application double :

Estimateur d'impôt sur le revenu (IFD + ICC) au centime près pour les26 cantons et leurs communes, basé strictement sur l'Open Data officielde l'AFC (Administration Fédérale des Contributions).
Tax Copilot IA : un assistant RAG cross-lingual qui répond auxquestions fiscales cantonales en citant les paragraphes de loi (§) etles montants exacts, dans la langue de l'utilisateur (fr/de/it/en).
Sommaire
Vision et objectifs
Les deux modules en un coup d'œil
Stack technique (immuable)
Structure du projet
Schéma de données Supabase
Module 1 — Moteur fiscal de l'estimateur
Module 2 — Tax Copilot IA (RAG)
Fournisseurs LLM (Gemini → Groq)
Installation et lancement
Tests et validation
Dépannage
Limites connues
Roadmap
Interdictions absolues
Sécurité
1. Vision et objectifs
Nom du projet : SwissSimple

Objectif principal : fournir un estimateur d'impôt (IFD + ICC) au centimeprès pour les 26 cantons suisses et leurs communes, en se basantstrictement sur les données officielles de l'AFC, et un assistantconversationnel capable de justifier chaque réponse par le texte de loicantonal source.

Principe absolu : zéro donnée chiffrée codée en dur — ni dans React,ni dans les prompts IA. Toute la logique lit la base Supabasedynamiquement. Les incohérences de l'Open Data AFC sont gérées via ledictionnaire CANTON_RULES (architecture State-Specific). Le Copilotn'affiche que des montants présents dans les extraits de loi récupérés.

2. Les deux modules en un coup d'œil
                    ┌────────────────────────────┐                    │        Supabase            │                    │ PostgreSQL + pgvector      │                    ├──────────────┬─────────────┤                    │ Tables       │ Table       │                    │ estimateur   │ tax_documents                    │ (AFC data)   │ (lois ESTV) │                    └──────┬───────┴──────┬──────┘                           │              │             ┌─────────────┘              └──────────────┐             ▼                                           ▼   ┌───────────────────┐                    ┌────────────────────┐   │ React (Vite)      │                    │ FastAPI (api.py)   │   │ Estimateur        │── fetch ──────────▶│ RAG : embeddings   │   │ RadarFiscal.tsx   │  /api/tax-copilot  │ + LLM (Gemini/Groq)│   │ TaxCopilot.tsx    │◀── JSON Markdown ──│ + cache mémoire    │   └───────────────────┘                    └────────────────────┘
Estimateur : calcul déterministe, exact au centime, 100 % côté client(React lit les tables de calcul).
Copilot : recherche sémantique (top-k par canton) + générationcontrainte par les extraits, avec garde-fous anti-hallucination.
3. Stack technique (IMMUABLE)
Couche	Technologie	Contrainte
Frontend	React 18+ TypeScript (Strict Mode)	Composants en fonctions fléchées React.FC ; pas de any ni @ts-ignore
Build	Vite	—
Routing	React Router DOM (SPA)	—
State	useState / useEffect natifs	Pas de Redux ni Zustand
Style	CSS pur / CSS Modules	Interdit : Tailwind, MUI, Chakra, toute lib UI
Monnaie	.toLocaleString('fr-CH')	Partout
BDD	Supabase (Auth, PostgreSQL, RLS)	—
Backend IA	FastAPI, sentence-transformers, pdfplumber, python-dotenv, groq, openai (pour Gemini)	—
Embeddings	paraphrase-multilingual-MiniLM-L12-v2 (local, 384 dim)	Cross-lingual FR↔DE
LLM	Gemini (principal) → Groq openai/gpt-oss-20b (repli)	temperature=0.0
Dépendance npm autorisée	remark-gfm	Exception documentée : sans elle, aucun tableau Markdown du Copilot ne s'affiche (GFM ≠ Markdown de base)
4. Structure du projet
SwissSimple/├── Frontend/│   ├── src/│   │   ├── pages/RadarFiscal.tsx     # estimateur + CANTON_RULES│   │   ├── components/TaxCopilot.tsx # Copilot IA│   │   └── *.css                     # styles dédiés (pas d'inline utilitaire)│   └── package.json└── Backend/    ├── api.py        # FastAPI : /health, /api/tax-copilot, /api/debug-retrieval    ├── ingest.py     # PDF → chunks paragraphe → vecteurs → Supabase    ├── PDFs/         # 26 lois cantonales (documents ESTV)    ├── .env          # clés — JAMAIS commité (voir §15)    └── requirements.txt
5. Schéma de données Supabase
5.1 Tables de l'estimateur (noms stricts)
communes

id (int, PK), commune (string), canton (string), canton_id (int)
coeff_revenu_canton (float) — ex. 96 pour 96 %
coeff_revenu_commune (float) — ex. 80 pour 80 %
coeff_revenu_eglise_reforme (float), coeff_revenu_eglise_catholique (float)
baremes

canton_id (int) — 0 = Confédération, 1–26 = cantons
statut (string: 'celibataire' | 'marie')
autorite_fiscale (string: 'Canton' | 'Confédération')
montant_tranche (float) — limite inférieure de la tranche
taux (float) — taux marginal en %
montant_base (float) — impôt cumulé des tranches précédentes
deductions

canton_id (int), nom_deduction (string), montant (float),pourcent (float), minimum (float), maximum (float), statut (string)
deductions_paliers

canton_id (int), nom_deduction (string), revenu_seuil (float),deduction_montant (float), statut (string)
5.2 Table vectorielle du Copilot
tax_documents

id, canton (string) — valeur exacte du dropdown (voir §5.3)
content (string) — chunk de loi
embedding (vector, 384 dim)
RPC match_tax_docs(query_embedding, match_count, filter_canton) :similarité cosinus, filtrée par canton, match_count = 5.

5.3 Convention de nommage des cantons (source de vérité unique)
Les valeurs stockées dans tax_documents.canton doivent être identiques aucaractère près aux value du <select> du frontend :

Zürich, Bern, Luzern, Uri, Schwyz, Obwalden, Nidwalden, Glarus, Zug,Fribourg, Solothurn, Basel-Stadt, Basel-Landschaft, Schaffhausen,Appenzell Ausserrhoden, Appenzell Innerrhoden, St. Gallen, Graubünden,Aargau, Thurgau, Ticino, Vaud, Valais, Neuchâtel, Genève, Jura.

ingest.py garantit cet alignement via le dictionnaire ALIASES(voir §7.2). Un désalignement produit le symptôme « Je n'ai pas trouvé cetteinformation dans les lois de ce canton » pour un canton pourtant ingéré.

6. Module 1 — Moteur fiscal de l'estimateur
Étape 1 : du revenu brut au revenu net
Si l'utilisateur saisit un revenu brut, on soustrait les cotisationssociales (part employé) :

AVS/AI/APG : 5.30 % (plafonné à 148'200 CHF)
AC : 1.10 % (plafonné à 148'200 CHF)
LAA : 0.40 % (plafonné à 148'200 CHF)
LPP : s'applique si Brut > 22'680 CHF. Base = Min(Brut, 90'720) − 26'460.Taux selon l'âge : 3.5 %, 5.0 %, 7.5 %, 9.0 %.
Le total est affiché dans un champ modifiable « Cotisations sociales ».

Étape 2 : du revenu net au revenu imposable (le cœur du moteur)
Le code calcule deux revenus imposables : fédéral et cantonal. Lesdéductions sont lues dans la table deductions.

Sécurité absolue — ignorer les lignes contenant : total, valeur locative,fortune, frais d'entretien, immobilier, accessoire, sans cotisations,moyenne, seuil, facteur, loyer, modeste, social, logement, revenuaccessoire, intérêts technique, finma, prime unique.

Étape 3 : impôt de base (barème progressif)
calculateTax(revenuImposable, bareme) :

Filtrer les tranches où revenuImposable >= montant_tranche.
Prendre la tranche applicable la plus haute.
Calculer : montant_base + (revenuImposable − montant_tranche) × (taux / 100).
Note : le script Python d'import a déjà géré l'élargissement des tranchespour les mariés. Le code React n'applique aucun diviseur.

Étape 4 : multiplication des coefficients (ICC vs IFD)
IFD : calculateTax(revFed, baremeFederal) — AUCUN coefficient appliqué.
ICC : calculateTax(revCant, baremeCantonal) = Impôt de Base Cantonal, puis :
Impôt cantonal = Base × coeff_revenu_canton / 100
Impôt communal = Base × coeff_revenu_commune / 100
Impôt paroissial = Base × coeff_eglise / 100
Total = IFD + ICC.
6.1 Architecture « State-Specific Strategy »
L'Open Data AFC est incohérent entre cantons (montants dans montant oumaximum, montants doublés pour les couples ou non). L'application adopteune architecture modulaire par canton.

Phase 1 — dictionnaire des stratégies (CANTON_RULES), en haut deRadarFiscal.tsx. Règle absolue : ce dictionnaire ne contient aucunchiffre, uniquement des flags :

type CantonStrategy = {  couple2RevenusStrategy?: 'LIRE_MAXIMUM' | 'LIRE_MONTANT';  assuranceStrategy?: 'LIRE_MAXIMUM_COMME_GLOBAL' | 'DOUBLER_MAXIMUM';  deductionMarieStrategy?: 'MONTANT_GLOBAL_SANS_DOUBLER' | 'DOUBLER_MONTANT';};const CANTON_RULES: Record<number, CantonStrategy> = {  10: { // Fribourg    assuranceStrategy: 'LIRE_MAXIMUM_COMME_GLOBAL',    deductionMarieStrategy: 'MONTANT_GLOBAL_SANS_DOUBLER'  },  22: { // Vaud    couple2RevenusStrategy: 'LIRE_MAXIMUM'  },  12: { // Bâle-Ville    deductionMarieStrategy: 'MONTANT_GLOBAL_SANS_DOUBLER'  }  // Les autres cantons utilisent le calculateur générique par défaut};
Phase 2 — moteur de dispatch : calculerTotalDeductions fait un simpleswitch sur cantonId :

const calculerTotalDeductions = (cantonId, statut, deductionsData, ...) => {  if (statut === 'marie') {    switch (cantonId) {      case 10: return calculerFribourg(deductionsData, ...);      case 22: return calculerVaud(deductionsData, ...);      case 25: return calculerGeneve(deductionsData, ...);      default: return calculerGenerique(deductionsData, ...);    }  }  return calculerGenerique(deductionsData, ...); // célibataires : générique};
Phase 3 — fonctions cantonales (exemple Fribourg) :

Frais professionnels : lire frais_professionnels ; si marié,montant × 2 (plafonné à maximum × 2).
Assurances : lire assurance_adulte ; si flagLIRE_MAXIMUM_COMME_GLOBAL, prendre maximum sans multiplier(montant global du ménage).
Couple à 2 revenus : lire couple_2_revenus ; si flag LIRE_MAXIMUMet montant = 0, prendre maximum.
Déduction de statut (marié) : si flag MONTANT_GLOBAL_SANS_DOUBLER,lire montant sans multiplier.
Phase 4 — moteur générique (fallback) : pour les célibataires et lescantons sans fonction dédiée (doubler les montants statut = 'tous' pourles mariés, lire maximum si montant = 0, etc.). Filet de sécuritépermettant de corriger les cantons un par un sans tout casser.

6.2 Interface utilisateur
Filtres de base : revenu (brut/net), classe d'âge (LPP), statut(célibataire/marié), religion, enfants à charge, commune.
Options avancées (toggles) : cotisations sociales (auto-calculé,modifiable), frais de transport réels, primes d'assurance réelles, fraismédicaux, dons, pilier 3a, frais de garde, revenu net du conjoint (simarié), case « Je suis retraité AVS/AI ».
Résultats : séparation claire cantonal / communal / paroissial / IFD,avec montant total et taux effectif.
7. Module 2 — Tax Copilot IA (RAG)
7.1 Flux de bout en bout
React TaxCopilot.tsx (question + profil + langue)   │  POST /api/tax-copilot (JSON)   ▼FastAPI api.py   ├─ 0. cache mémoire (question déjà posée ? → réponse immédiate, 0 token)   ├─ 1. embed_model.encode(question)          [sentence-transformers, local]   ├─ 2. Supabase RPC match_tax_docs           [top-5, filtré par canton]   ├─ 3. prompt = extraits + profil + consignes strictes   ├─ 4. LLM : Gemini (repli Groq)             [temperature 0.0]   └─ 5. nettoyage + cache + réponse JSON   ▼ReactMarkdown + remark-gfm (tableaux)
7.2 Ingestion (ingest.py)
Chunking par paragraphe légal — le cœur de la qualité du RAG :

Un paragraphe « § … » est insécable : l'embedding d'un chunk doitrefléter UN sujet (un paragraphe enfant noyé dans un bloc à dominanteimmobilière est introuvable en recherche sémantique).
Regroupement des blocs jusqu'à 1100 caractères.
Découpage dur (avec chevauchement 200) uniquement pour un § géant (> 1600).
Fragments < 120 caractères écartés ; tout ce qui précède le premier §(préface, sommaire) jeté — bruit vectoriel.
Noms de cantons : mapping ALIASES (FR + DE, normalisation sansaccents/ponctuation) aligné sur les value du dropdown — une seule sourcede vérité. Validation préalable : le script vérifie les 26 fichiers AVANTd'écrire en base et s'arrête net avec la liste des fichiers non reconnus.

Idempotence : chaque canton est effacé avant réinsertion — relançablesans doublons. Durée : 20–30 minutes pour les 26 cantons (~0,3 s/insertion).

7.3 Backend (api.py)
Endpoints :

GET /health — état du serveur + modèle actif.
POST /api/tax-copilot — question + profil + langue → réponse Markdown.
POST /api/debug-retrieval — renvoie les extraits bruts récupérés(diagnostic retrieval, sans consommer de tokens LLM).
Paramètres LLM : temperature=0.0 (déterminisme des montants),budget de sortie 3000 tokens (Groq compte entrée + budget de sortie dans lataille de requête : contexte + 8000 > limite TPM → erreur 413),reasoning_effort="low" chez Groq (économie de tokens de raisonnement),max_tokens=3000 chez Gemini. Chaîne de repli fournisseurs.

Garde-fous :

troncature du contexte à 10 000 caractères (anti-413) ;
détection finish_reason == "length" (réponse coupée) ;
ANSWER_CACHE en mémoire : question identique → réponse instantanée,zéro token (clé = question + canton + statut + enfants + profession +langue ; volatil : vidé au redémarrage d'uvicorn) ;
nettoyage regex du mot-valise « ab-déduction » ;
consigne anti-invention : tout montant doit venir des extraits ;
traceback complet au terminal en cas d'erreur.
7.4 Frontend (TaxCopilot.tsx)
5 sélecteurs (canton — les 26 valeurs canoniques, statut civil, enfants,profession, langue de réponse) ; ReactMarkdown avecremarkPlugins={[remarkGfm]} (sinon les tableaux s'affichent en bouillie :le tableau est du GFM, pas du Markdown de base) ; overflowX: 'auto' surle conteneur de réponse.

7.5 Mécanique multilingue
Un code langue (« de ») injecté dans un prompt français ne suffit pas àcontraindre le modèle (« tu réponds toujours en de » est du françaisnon-signifiant). Trois leviers :

LANGUE_NOMS : code → nom complet (« allemand (Deutsch, Hochdeutsch) »).
Interdiction explicite d'écrire en français quand la langue ≠ fr.
SECTION_HEADERS : les titres de sections et en-têtes de tableau fournisdirectement dans la langue cible — le modèle suit au lieu de traduire.
Le Cross-Lingual RAG fonctionne grâce àparaphrase-multilingual-MiniLM-L12-v2 : question en français, extraitsen allemand, réponse dans la langue choisie.

8. Fournisseurs LLM (Gemini → Groq)
Gemini (AI Studio)	Groq (gpt-oss-20b)
Rôle	Principal	Repli
Coût	Gratuit (~1500 req/j)	Gratuit (200 k tokens/j, 8 k/min, requête ≤ 8 k)
SDK	openai + base_url="https://generativelanguage.googleapis.com/v1beta/openai/"	groq
Paramètres	max_tokens	max_completion_tokens, reasoning_effort
Données d'entraînement	⚠️ le palier gratuit peut utiliser les données	Non
Règle clé : une clé API n'est valable que sur l'endpoint de sonfournisseur (mettre une clé Gemini dans le client Groq → 401). Vérifier lenom du modèle Gemini actuel dans AI Studio (les noms évoluent).

Architecture : liste de fournisseurs ordonnée, essayés l'un aprèsl'autre ; le premier qui répond gagne ; si tous échouent → erreur remontéeavec la dernière exception. Le service ne tombe jamais en panne totalepour un seul fournisseur.

9. Installation et lancement
# ---- Backend ----cd Backendpython -m venv venv.\venv\Scripts\activate            # (Windows)pip install fastapi uvicorn sentence-transformers supabase \            python-dotenv groq pdfplumber openai# .env (JAMAIS commité) :#   SUPABASE_URL=...#   SUPABASE_KEY=...#   GROQ_KEY=...#   GEMINI_KEY=...        (optionnel — active Gemini en principal)python ingest.py                   # une fois, 20-30 minpython -m py_compile api.py        # réflexe : vérifier la syntaxe AVANT uvicornuvicorn api:app --reload           # attendre "Application startup complete."# ---- Frontend ----cd Frontendnpm installnpm install remark-gfmnpm run dev
Rituels de stabilité :

Après chaque sauvegarde de api.py, attendre Application startup complete. (~5 s) avant de questionner l'API — sinon ❌ « Erreur deconnexion ».
Vérifier http://127.0.0.1:8000/health avant tout test.
Préparer une démo : le cache vit en mémoire du serveur — poser lesquestions de démonstration après le dernier redémarrage d'uvicorn ; ellesressortent instantanément, gratuitement, à l'abri des quotas.
10. Tests et validation
Audits SQL :

-- 26 cantons présents, aucun à 0 :WITH dropdown(v) AS (  VALUES ('Zürich'),('Bern'),('Luzern'),('Uri'),('Schwyz'),         ('Obwalden'),('Nidwalden'),('Glarus'),('Zug'),('Fribourg'),         ('Solothurn'),('Basel-Stadt'),('Basel-Landschaft'),('Schaffhausen'),         ('Appenzell Ausserrhoden'),('Appenzell Innerrhoden'),('St. Gallen'),         ('Graubünden'),('Aargau'),('Thurgau'),('Ticino'),('Vaud'),         ('Valais'),('Neuchâtel'),('Genève'),('Jura'))SELECT d.v AS canton, COUNT(t.canton) AS nb_chunksFROM dropdown dLEFT JOIN tax_documents t ON t.canton = d.vGROUP BY d.v ORDER BY d.v;-- un paragraphe donné est-il bien en base ?SELECT LEFT(content, 500) FROM tax_documentsWHERE canton = 'Luzern' AND content LIKE '%Kind 12500%';
Fact-check systématique (vérité terrain = les PDF ESTV). ExempleLuzern, question « déductions pour les enfants » — la réponse DOIT contenir :8 100 Fr (§ 42 Abs. 1 Bst. a, < 6 ans), 13 200 Fr (§ 42 a, formation horsdomicile), 2 000 Fr (§ 42 b, propre garde), 20 200 Fr (§ 40 Abs. 1 Bst. l,garde tierce), 12 500 Fr (§ 52 Abs. 1 Bst. c, fortune).

Stabilité : poser la même question 3× → montants et référencesidentiques (temp 0.0). La formulation peut varier légèrement (modèle deraisonnement) — les chiffres sont le critère de vérité.

Diagnostic retrieval : POST /api/debug-retrieval (via /docs) — montreles extraits bruts sans consommer de tokens LLM.

11. Dépannage
Symptôme	Cause probable	Solution
❌ « Erreur de connexion au serveur backend »	uvicorn éteint ou en redémarrage (sauvegarde de api.py) ou SyntaxError	Attendre Application startup complete. ; regarder le terminal ; python -m py_compile api.py
⚠️ 429 (TPD/TPM)	Quota Groq	Attendre la réinitialisation (délai dans le message) ; utiliser le cache ; Gemini
⚠️ 413 « Request too large »	Groq compte entrée + budget de sortie	max_completion_tokens ≤ 3000 ; troncature du contexte
⚠️ 404 model_not_found	Nom de modèle inexistant sur le compte	Nom exact du modèle (vérifier chez le fournisseur)
⚠️ 401	Clé du mauvais fournisseur (ex. clé Gemini dans le client Groq)	Faire correspondre clé et base_url
« Je n'ai pas trouvé » sur un canton ingéré	Nom de canton désaligné (ex. « Lucerne » en base, « Luzern » envoyé)	Audit SQL §10 ; UPDATE ou re-ingestion (ALIASES)
Montant manquant (ex. 12 500)	Chunk pollué multi-sujets / top-k insuffisant	Chunking paragraphe (§7.2) ; vérifier match_count
Tableaux affichés en bouillie de `	`	remark-gfm absent
Réponse en français malgré langue = de	Code langue non contraignant	LANGUE_NOMS + interdiction explicite + SECTION_HEADERS
TypeError: multiple values for keyword 'temperature'	Paramètres en dur ET via **params	Les paramètres viennent UNIQUEMENT de **params
TypeError: 'int' and 'dict' (puissance)	Virgule manquante avant **params (lu comme 8000 ** params)	Virgule après l'argument précédent
12. Limites connues
Top-k retrieval ≠ rappel 100 % sur question générique (atténué par lechunking paragraphe ; pistes : reranking, déduplication, multi-requêtes).
À température 0, un modèle de raisonnement peut varier en formulation —les montants et références restent le critère de vérité.
Quotas : Groq ~40 questions nouvelles/jour ; Gemini ~1500 req/j ; lecache n'est pas décompté.
ANSWER_CACHE volatile (redémarrage = vidage).
Le Copilot est un outil d'information — il ne remplace ni ladéclaration officielle, ni un conseil fiscal.
Le Copilot requiert le backend local (http://localhost:8000) : enl'état, il ne fonctionne que sur la machine où uvicorn tourne (voir §15).
13. Roadmap
Reranking des extraits + déduplication des quasi-copies.
Historique conversationnel multi-tours.
Auth Supabase + RLS sur les questions des utilisateurs.
Backend hébergé (le Copilot utilisable depuis le site déployé).
Extension du Copilot aux barèmes communaux.
Inférence locale (Ollama) — seul « vraiment illimité » (machine allumée).
14. Interdictions absolues
Jamais de @ts-ignore ni any non justifié.
Jamais de nouvelle dépendance npm non documentée (exception autorisée :remark-gfm).
Jamais de coefficients communaux ou d'église sur l'IFD.
Jamais de règle fiscale chiffrée en dur dans React (ni dans les promptsIA — les montants viennent des extraits de loi dans Supabase).
Jamais de classes CSS utilitaires inline style-Tailwind — CSStraditionnel dans des fichiers .css dédiés.
15. Sécurité
.env jamais commité — vérifier .gitignore (.env, venv/,node_modules/). En cas de fuite de clé : révoquer et régénérerimmédiatement chez le fournisseur.
allow_origins=["*"] = développement uniquement ; restreindre auxdomaines réels en production.
Le frontend appelle http://localhost:8000 : le Copilot est, en l'état,une fonctionnalité locale — héberger le backend avant de l'exposer sur lesite en ligne.
Pour finir, la mise au point stratégique
Migration Gemini : fais-la si tu veux, mais pas obligatoirement avant lundi. Ton système actuel (Groq + cache + 3000 tokens) tient une démo sans problème. La chaîne Gemini→Groq est une amélioration de quota et de confort, pas un correctif urgent.
Vérifie ton .gitignore avant ton prochain push — c'est le seul point de ce message qui peut te coûter cher : des clés poussées sur un repo public doivent être révoquées immédiatement.
La comparaison « qui est le meilleur LLM » dans un entretien se répond exactement comme le fait le §8 de ce README : ça dépend du critère — quota, vitesse, qualité, souveraineté des données — d'où mon architecture de repli multi-fournisseurs. C'est une réponse de développeur, pas de fan. 🎯