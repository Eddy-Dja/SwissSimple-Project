📄 FEUILLE DE ROUTE DÉTAILLÉE : Architecture "State-Specific Strategy" (SwissSimple V2.0)
🎯 VISION ET OBJECTIFS
Nom du Projet : SwissSimple
Objectif Principal : Fournir un estimateur d'impôt sur le revenu (IFD + ICC) au centime près pour les 26 cantons suisses et leurs communes, en se basant strictement sur les données officielles de l'AFC (Administration Fédérale des Contributions).
Principe Absolu : Zéro donnée chiffrée codée en dur dans React. Toute la logique doit lire la base de données Supabase de manière dynamique. Les incohérences de l'Open Data de l'AFC seront gérées via un dictionnaire de "Stratégies" (CANTON_RULES) et des fonctions de calcul séparées pour chaque canton (Architecture State-Specific).

🛠 STACK TECHNIQUE (IMMUABLE)
Frontend : React 18+ avec TypeScript (Strict Mode).
Build Tool : Vite.
Routing : React Router DOM (Architecture SPA).
Backend/BDD : Supabase (Auth, PostgreSQL, RLS).
Style : CSS pur / CSS Modules. INTERDICTION ABSOLUE d'utiliser Tailwind CSS, MUI, Chakra ou toute autre librairie UI.
Format Monétaire : Toujours utiliser .toLocaleString('fr-CH').
State Management : useState et useEffect natifs. Pas de Redux ou Zustand.
Typage : Composants en fonctions fléchées avec typage React.FC. Pas de any ou @ts-ignore.
🗄️ SCHÉMA DE LA BASE DE DONNÉES (SUPABASE)
Les noms de tables et de colonnes doivent être strictement respectés.

Table communes

id (int, PK), commune (string), canton (string), canton_id (int)
coeff_revenu_canton (float) - Ex: 96 pour 96%
coeff_revenu_commune (float) - Ex: 80 pour 80%
coeff_revenu_eglise_reforme (float)
coeff_revenu_eglise_catholique (float)
Table baremes

canton_id (int) - 0 pour la Confédération, 1-26 pour les cantons.
statut (string: 'celibataire' | 'marie')
autorite_fiscale (string: 'Canton' | 'Confédération')
montant_tranche (float) - Limite inférieure de la tranche de revenu.
taux (float) - Taux d'imposition marginal pour la tranche (en %).
montant_base (float) - Impôt cumulé des tranches précédentes.
Table deductions

canton_id (int), nom_deduction (string), montant (float), pourcent (float), minimum (float), maximum (float), statut (string)
Table deductions_paliers

canton_id (int), nom_deduction (string), revenu_seuil (float), deduction_montant (float), statut (string)
🧮 MOTEUR FISCAL : LOGIQUE MATHÉMATIQUE STRICTE
Étape 1 : Du Revenu Brut au Revenu Net
Si l'utilisateur saisit un revenu Brut, le code soustrait les cotisations sociales (part employé) :

AVS/AI/APG : 5.30% (plafonné à 148'200 CHF).
AC : 1.10% (plafonné à 148'200 CHF).
LAA : 0.40% (plafonné à 148'200 CHF).
LPP : S'applique si Brut > 22'680 CHF. Base = Min(Brut, 90720) - 26460. Taux selon l'âge (3.5%, 5.0%, 7.5%, 9.0%).
Le total est affiché dans un champ modifiable "Cotisations sociales".
Étape 2 : Du Revenu Net au Revenu Imposable (Le Cœur du Moteur)
Le code calcule deux revenus imposables : Fédéral et Cantonal. Les déductions sont lues dans la table deductions.
Sécurité absolue : Le code DOIT ignorer les lignes contenant : total, valeur locative, fortune, frais d'entretien, immobilier, accessoire, sans cotisations, moyenne, seuil, facteur, loyer, modeste, social, logement, revenu accessoire, intérêts technique, finma, prime unique.

Étape 3 : Calcul de l'Impôt de Base (Barème Progressif)
Fonction calculateTax(revenuImposable, bareme) :

Filtrer les tranches où revenuImposable >= montant_tranche.
Prendre la tranche applicable la plus haute.
Calculer : (montant_base) + (revenuImposable - montant_tranche) * (taux / 100).
Note : Le script Python a déjà géré l'élargissement des tranches pour les mariés. Le code React n'applique AUCUN diviseur.
Étape 4 : Multiplication des Coefficients (ICC vs IFD)
IFD : calculateTax(revFed, baremeFederal). AUCUN coefficient appliqué.
ICC : calculateTax(revCant, baremeCantonal) donne l'Impôt de Base Cantonal.
Impôt Cantonal = Base * (coeff_revenu_canton / 100)
Impôt Communal = Base * (coeff_revenu_commune / 100)
Impôt Paroissial = Base * (coeff_eglise / 100)
Total : IFD + ICC.
🏗️ ARCHITECTURE "STATE-SPECIFIC STRATEGY" (NOUVEAUTÉ V2.0)
Puisque l'Open Data de l'AFC est incohérent entre les cantons (certains mettent les montants dans montant, d'autres dans maximum, certains doublent les montants pour les couples, d'autres non), l'application adopte une architecture modulaire par canton.

Phase 1 : Le Dictionnaire des Stratégies (CANTON_RULES)
En haut du fichier RadarFiscal.tsx, on déclare un dictionnaire CANTON_RULES.
Règle absolue : Ce dictionnaire ne contient AUCUN chiffre. Il ne contient que des flags (instructions) qui disent au code comment lire la base de données pour ce canton précis.

typescript

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
  // Les autres cantons utiliseront le calculateur générique par défaut
};
Phase 2 : Le Moteur de Dispatch
La fonction principale calculerTotalDeductions ne contient plus de logique mathématique complexe. Elle fait un simple switch sur le cantonId et redirige vers une fonction dédiée à chaque canton.

typescript

const calculerTotalDeductions = (cantonId, statut, deductionsData, ...) => {
  if (statut === 'marie') {
    switch (cantonId) {
      case 10: return calculerFribourg(deductionsData, ...);
      case 22: return calculerVaud(deductionsData, ...);
      case 25: return calculerGeneve(deductionsData, ...);
      default: return calculerGenerique(deductionsData, ...);
    }
  }
  return calculerGenerique(deductionsData, ...); // Les célibataires utilisent le générique
};
Phase 3 : Les Fonctions Cantonnales (Exemple : Fribourg)
Dans la fonction calculerFribourg, on lit la base de données passée en paramètre, mais on applique les règles mathématiques exactes de Fribourg en utilisant les flags du dictionnaire.

Frais professionnels : Lire la ligne frais_professionnels. Si marié, montant * 2 (plafonné à maximum * 2).
Assurances : Lire la ligne assurance_adulte. Si le flag est LIRE_MAXIMUM_COMME_GLOBAL, on prend la valeur maximum de la BDD et on ne la multiplie pas par 2 (c'est déjà le montant global du ménage).
Couple à 2 revenus : Lire la ligne couple_2_revenus. Si le flag est LIRE_MAXIMUM et que montant est 0, on prend maximum.
Déduction de statut (Marié) : Si le flag est MONTANT_GLOBAL_SANS_DOUBLER, on lit montant et on ne le multiplie pas.
Phase 4 : Le Moteur Générique (Fallback)
Pour les célibataires et les cantons qui n'ont pas encore de fonction dédiée, on utilise calculerGenerique. Ce moteur applique les règles standards (ex: doubler les montants statut = 'tous' pour les mariés, lire maximum si montant est 0, etc.). Il servira de filet de sécurité tout en permettant de corriger les cantons un par un sans tout casser.

🎨 INTERFACE UTILISATEUR (UI) ET OPTIONS AVANCÉES
Filtres de base : Revenu (Brut/Net), Classe d'âge (LPP), Statut (Célibataire/Marié), Religion, Enfants à charge, Commune.
Options Avancées (Toggle) : Cotisations sociales (auto-calculé, modifiable), Frais de transport réels, Primes d'assurance réelles, Frais médicaux, Dons, Pilier 3a, Frais de garde, Revenu Net du conjoint (si marié), Case à cocher "Je suis retraité AVS/AI".
Affichage des Résultats : Séparation claire des impôts (Cantonal, Communal, Paroissial, Fédéral Direct) avec Montant Total et Taux effectif.
⛔ INTERDICTIONS ABSOLUES
Ne jamais utiliser @ts-ignore ou any non justifié.
Ne jamais installer de nouvelle dépendance npm sans autorisation.
Ne jamais appliquer de coefficients communaux ou d'église sur l'Impôt Fédéral Direct (IFD).
Ne jamais coder de règles fiscales chiffrées en dur dans React (ex: if canton === 'Fribourg' avec des montants fixes). Toute la logique doit être dynamique et lire la base de données Supabase, guidée par le dictionnaire CANTON_RULES.
Ne jamais utiliser de classes CSS utilitaires (style Tailwind) inline. Utiliser du CSS traditionnel dans des fichiers .css dédiés.