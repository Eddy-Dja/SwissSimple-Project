import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabaseClient';
import './Assurance.css';
import { useLocalStorageState } from '../../hooks/useLocalStorageState';
import SEO from '../../components/SEO';

interface Prime {
  id: number;
  Versicherer: string;
  Kanton: string;
  Region: string;
  Altersklasse: string;
  Altersuntergruppe: string;
  Unfalleinschluss: string;
  Tarif: string;
  Tariftyp: string;
  Franchise: number;
  Prämie: number;
  Tarifbezeichnung: string;
}

interface RegionOption { value: string; label: string; }

// ✏️ 2027 : ce que chaque canton propose réellement (interrogé à la volée)
interface CantonOptions {
  franchisesAdultes: number[];        // échelle adulte (ERW + JUG)
  franchisesEnfants: number[];        // échelle enfant standard (K1)
  franchisesEnfantsRabais: number[];  // ✏️ 2027b : paliers où K3/K4/K5 existe (rabais famille)
  modeles: string[];                  // tariftyps présents dans le canton
  rabaisFamille: boolean;             // K3/K4/K5 présents ? (dérivé : au moins un palier)
}

// ✏️ 2027 : plus de sous-groupe K2 dans les données BAG — les enfants sont K1
// (sans réduction) ou K3/K4/K5 (rabais famille). L'option KIN-K2 (clé conservée
// pour ne pas casser le localStorage) devient « Enfant – rabais famille ».
const AGE_CONFIG: Record<string, { klasse: string; untergruppe: string; untergruppen?: string[]; label: string }> = {
  'KIN-K1': { klasse: 'AKL-KIN', untergruppe: 'K1', label: 'Enfant (0-18 ans)' },
  'KIN-K2': { klasse: 'AKL-KIN', untergruppe: '', untergruppen: ['K3', 'K4', 'K5'], label: 'Enfant – rabais famille' },
  'JUG': { klasse: 'AKL-JUG', untergruppe: '', label: 'Jeune (19-25 ans)' },
  'ERW': { klasse: 'AKL-ERW', untergruppe: '', label: 'Adulte (26+ ans)' }
};
const AGE_KEYS = Object.keys(AGE_CONFIG);
const KIN_UNTERGRUPPEN = ['K1', 'K2', 'K3', 'K4', 'K5'];

const FRACT_ERW = [300, 500, 1000, 1500, 2000, 2500];
const FRACT_KIN = [0, 100, 200, 300, 400, 500, 600];

const CANTONS = ['AG','AI','AR','BE','BL','BS','FR','GE','GL','GR','JU','LU','NE','NW','OW','SG','SH','SO','SZ','TG','TI','UR','VD','VS','ZG','ZH', 'ZE', 'ZR'];

// ✏️ 2027 : TAR-HMO retiré (aucun tarif BAG ne porte ce code — tous les HMO
// sont codés TAR-HAM) ; le libellé TAR-HAM mentionne désormais les réseaux HMO.
const TARIFTYP_LABELS: Record<string, string> = {
  '': '📋 Tous les modèles',
  'TAR-BASE': '🏥 Assurance de Base',
  'TAR-HAM': '👨‍⚕️ Médecin de famille / Réseau HMO',
  'TAR-DIV': '📞 Télémédecine'
};

const INSURER_NAMES: Record<string, string> = {
  '8': 'CSS', 
  '32': 'Aquilana', 
  '134': 'Einsiedler Krankenkasse', 
  '194': 'Sumiswalder', 
  '246': 'Steffisburg', 
  '290': 'Concordia', 
  '312': 'Atupri', 
  '343': 'Avenir (Groupe Mutuel)', 
  '360': 'Luzerner Hinterland', 
  '376': 'KPT (Groupe Visana)', 
  '455': 'ÖKK', 
  '509': 'Sympany', 
  '780': 'Glarner', 
  '820': 'curaulta', 
  '881': 'EGK', 
  '923': 'SLKK', 
  '941': 'sodalis', 
  '966': 'vita surselva', 
  '1040': 'Visperterminen', 
  '1113': 'Vallée d\'Entremont (Groupe Mutuel)', 
  '1318': 'Wädenswil', 
  '1322': 'Birchmeier', 
  '1384': 'SWICA', 
  '1386': 'Galenos (Groupe Visana)', 
  '1401': 'rhenusana', 
  '1479': 'Mutuel (Groupe Mutuel)', 
  '1507': 'AMB Assurances (Groupe Mutuel)', 
  '1509': 'Sanitas', 
  '1535': 'Philos (Groupe Mutuel)', 
  '1542': 'Assura', 
  '1555': 'Visana', 
  '1560': 'Agrisano', 
  '1562': 'Helsana', 
  '1568': 'sana24 (Groupe Visana)',
  '901': 'curaulta (ex-Sanavals)', 
  '1570': 'Galenos (ex-Vivacare)',
  '12': 'Helsana', 
  '17': 'Assura', 
  '48': 'SWICA', 
  '61': 'Concordia', 
  '63': 'KPT', 
  '73': 'Sanitas', 
  '96': 'Groupe Mutuel', 
  '98': 'Groupe Mutuel (Supra)', 
  '99': 'Groupe Mutuel (Philos)', 
  '100': 'Visana', 
  '101': 'Visana', 
  '102': 'Visana (Vivacare)', 
  '105': 'ÖKK', 
  '110': 'Wincare', 
  '113': 'SLKK', 
  '125': 'Atupri', 
  '140': 'Sodalis', 
  '145': 'Sanitas (Compact)', 
  '160': 'Galenos', 
  '166': 'Rhenusana', 
  '170': 'Salus', 
  '185': 'Kolping', 
  '190': 'Securus', 
  '199': 'Ambri', 
  '200': 'Advita', 
  '203': 'Avenir Santé', 
  '205': 'Flexia', 
  '210': 'Nova', 
  '215': 'Helsana (Sansan)', 
  '230': 'KLuG', 
  '240': 'Groupe Mutuel (EasySana)', 
  '250': 'Helsana (Progrès)', 
  '265': 'Luzerner Krankenkasse', 
  '300': 'Groupe Mutuel', 
  '345': 'Sanitas', 
  '400': 'Helsana', 
  '410': 'Helsana', 
  '420': 'Helsana', 
  '500': 'Assura', 
  '700': 'CSS', 
  '800': 'SWICA', 
  '900': 'KPT'
};

const REGION_NAMES: Record<string, Record<string, string>> = {
  'BE': { 'PR-REG CH1': 'Région 1 (Oberland bernois)', 'PR-REG CH2': 'Région 2 (Seeland / Bienne)', 'PR-REG CH3': 'Région 3 (Jura bernois / Mittelland)' },
  'BL': { 'PR-REG CH1': 'Région 1', 'PR-REG CH2': 'Région 2' },
  'FR': { 'PR-REG CH1': 'Région 1 (Sarine / Singine)', 'PR-REG CH2': 'Région 2 (Reste du canton - Gruyère / Broye)' },
  'GR': { 'PR-REG CH1': 'Région 1 (Prättigau / Davos)', 'PR-REG CH2': 'Région 2 (Engadine)', 'PR-REG CH3': 'Région 3 (Grisons centraux / Rheinwald)' },
  'LU': { 'PR-REG CH1': 'Région 1 (Lucerne-Ville / Hinterland)', 'PR-REG CH2': 'Région 2 (Emmental)', 'PR-REG CH3': 'Région 3 (Willisau / Sursee)' },
  'SG': { 'PR-REG CH1': 'Région 1 (Fürstenland / Toggenbourg)', 'PR-REG CH2': 'Région 2 (Saint-Gall / Rorschach)', 'PR-REG CH3': 'Région 3 (Linth / Sargans)' },
  'SH': { 'PR-REG CH1': 'Région 1', 'PR-REG CH2': 'Région 2' },
  'TI': { 'PR-REG CH1': 'Région 1 (Sopraceneri - Bellinzona / Locarno)', 'PR-REG CH2': 'Région 2 (Sottoceneri - Lugano / Mendrisio)' },
  'VD': { 'PR-REG CH1': 'Région 1 (La Côte, Morges, Nyon)', 'PR-REG CH2': 'Région 2 (Lausanne, Riviera, Chablais)' },
  'VS': { 'PR-REG CH1': 'Région 1 (Haut-Valais)', 'PR-REG CH2': 'Région 2 (Bas-Valais / Chablais)' },
  'ZH': { 'PR-REG CH1': 'Région 1 (Ville de Zurich / Winterthour)', 'PR-REG CH2': 'Région 2 (Agglomération)', 'PR-REG CH3': 'Région 3 (Reste du canton)' }
};

const REGION_NAMES_DE: Record<string, Record<string, string>> = {
  'BE': { 'PR-REG CH1': 'Region 1 (Berner Oberland)', 'PR-REG CH2': 'Region 2 (Seeland / Biel)', 'PR-REG CH3': 'Region 3 (Berner Jura / Mittelland)' },
  'BL': { 'PR-REG CH1': 'Region 1', 'PR-REG CH2': 'Region 2' },
  'FR': { 'PR-REG CH1': 'Region 1 (Saane / Sense)', 'PR-REG CH2': 'Region 2 (Rest des Kantons - Greyerz / Broye)' },
  'GR': { 'PR-REG CH1': 'Region 1 (Prättigau / Davos)', 'PR-REG CH2': 'Region 2 (Engadin)', 'PR-REG CH3': 'Region 3 (Mittelbünden / Rheinwald)' },
  'LU': { 'PR-REG CH1': 'Region 1 (Stadt Luzern / Hinterland)', 'PR-REG CH2': 'Region 2 (Emmental)', 'PR-REG CH3': 'Region 3 (Willisau / Sursee)' },
  'SG': { 'PR-REG CH1': 'Region 1 (Fürstenland / Toggenburg)', 'PR-REG CH2': 'Region 2 (St. Gallen / Rorschach)', 'PR-REG CH3': 'Region 3 (Linth / Sargans)' },
  'SH': { 'PR-REG CH1': 'Region 1', 'PR-REG CH2': 'Region 2' },
  'TI': { 'PR-REG CH1': 'Region 1 (Sopraceneri - Bellinzona / Locarno)', 'PR-REG CH2': 'Region 2 (Sottoceneri - Lugano / Mendrisio)' },
  'VD': { 'PR-REG CH1': 'Region 1 (La Côte, Morges, Nyon)', 'PR-REG CH2': 'Region 2 (Lausanne, Riviera, Chablais)' },
  'VS': { 'PR-REG CH1': 'Region 1 (Oberwallis)', 'PR-REG CH2': 'Region 2 (Unterwallis / Chablais)' },
  'ZH': { 'PR-REG CH1': 'Region 1 (Stadt Zürich / Winterthur)', 'PR-REG CH2': 'Region 2 (Agglomeration)', 'PR-REG CH3': 'Region 3 (Rest des Kantons)' }
};

// ✏️ 2027 : « le canton propose-t-il au moins une ligne pour ce filtre ? »
// Comptage seul (head: true) — aucune donnée transférée, très rapide.
const existeLignes = async (
  canton: string,
  klassen: string[] | null,
  filtres: Record<string, string | number | string[]>
): Promise<boolean> => {
  let q = supabase
    .from('primes_lamal')
    .select('id', { count: 'exact', head: true })
    .eq('Kanton', canton)
    .eq('Geschäftsjahr', 2027);
  if (klassen) q = q.in('Altersklasse', klassen);
  for (const [col, val] of Object.entries(filtres)) {
    q = Array.isArray(val) ? q.in(col, val) : q.eq(col, val);
  }
  const { count } = await q;
  return (count ?? 0) > 0;
};

// ✏️ 2027 : options réellement disponibles dans un canton.
// Ex. ZR = franchise unique (300 adulte / 0 enfant), Base uniquement, pas de
// rabais famille ; ZE = Base uniquement, rabais famille à la franchise 0 (SWICA).
// ✏️ 2027b : 22 sondages parallèles — les 7 sondages rabais par palier
// remplacent l'ancien sondage unique « rabais existe » : la liste doit être
// exacte PAR PALIER, sinon « rabais famille + 300 » affiche des combos vides.
const ADULTES = ['AKL-ERW', 'AKL-JUG'];
const fetchCantonOptions = async (canton: string): Promise<CantonOptions> => {
  const RABAIS = ['K3', 'K4', 'K5'];
  const [a300, a500, a1000, a1500, a2000, a2500,
         k0, k100, k200, k300, k400, k500, k600,
         r0, r100, r200, r300, r400, r500, r600,
         ham, div] = await Promise.all([
    existeLignes(canton, ADULTES, { Franchise: 300 }),
    existeLignes(canton, ADULTES, { Franchise: 500 }),
    existeLignes(canton, ADULTES, { Franchise: 1000 }),
    existeLignes(canton, ADULTES, { Franchise: 1500 }),
    existeLignes(canton, ADULTES, { Franchise: 2000 }),
    existeLignes(canton, ADULTES, { Franchise: 2500 }),
    existeLignes(canton, ['AKL-KIN'], { Franchise: 0 }),
    existeLignes(canton, ['AKL-KIN'], { Franchise: 100 }),
    existeLignes(canton, ['AKL-KIN'], { Franchise: 200 }),
    existeLignes(canton, ['AKL-KIN'], { Franchise: 300 }),
    existeLignes(canton, ['AKL-KIN'], { Franchise: 400 }),
    existeLignes(canton, ['AKL-KIN'], { Franchise: 500 }),
    existeLignes(canton, ['AKL-KIN'], { Franchise: 600 }),
    // ✏️ 2027b : rabais famille — le palier n'est proposé que si K3/K4/K5 y existe
    existeLignes(canton, ['AKL-KIN'], { Franchise: 0, Altersuntergruppe: RABAIS }),
    existeLignes(canton, ['AKL-KIN'], { Franchise: 100, Altersuntergruppe: RABAIS }),
    existeLignes(canton, ['AKL-KIN'], { Franchise: 200, Altersuntergruppe: RABAIS }),
    existeLignes(canton, ['AKL-KIN'], { Franchise: 300, Altersuntergruppe: RABAIS }),
    existeLignes(canton, ['AKL-KIN'], { Franchise: 400, Altersuntergruppe: RABAIS }),
    existeLignes(canton, ['AKL-KIN'], { Franchise: 500, Altersuntergruppe: RABAIS }),
    existeLignes(canton, ['AKL-KIN'], { Franchise: 600, Altersuntergruppe: RABAIS }),
    existeLignes(canton, null, { Tariftyp: 'TAR-HAM' }),
    existeLignes(canton, null, { Tariftyp: 'TAR-DIV' }),
  ]);
  const franchisesEnfantsRabais = FRACT_KIN.filter((_, i) => [r0, r100, r200, r300, r400, r500, r600][i]);
  return {
    franchisesAdultes: FRACT_ERW.filter((_, i) => [a300, a500, a1000, a1500, a2000, a2500][i]),
    franchisesEnfants: FRACT_KIN.filter((_, i) => [k0, k100, k200, k300, k400, k500, k600][i]),
    franchisesEnfantsRabais,
    modeles: ['TAR-BASE', ...(ham ? ['TAR-HAM'] : []), ...(div ? ['TAR-DIV'] : [])],
    rabaisFamille: franchisesEnfantsRabais.length > 0,
  };
};

interface AssuranceProps {
  initialMode?: 'simple' | 'comparaison';
  onPrevStep?: () => void;
  onNextStep?: () => void;
  onResultChange?: (diff: number | null, details?: { avgA: number, avgB: number, depCanton: string, depRegion: string, arrCanton: string, arrRegion: string }) => void;
  hideWarning?: boolean;
}

// On exporte la fonction avec une valeur par défaut pour éviter le crash si la langue est vide
export const getRegionLabel = (canton: string, reg: string, lang: string = 'fr') => {
  const isDe = lang ? lang.startsWith('de') : false;
  const dict = isDe ? REGION_NAMES_DE : REGION_NAMES;
  const defaultWord = isDe ? 'Region ' : 'Région ';
  return dict[canton]?.[reg] || reg.replace('PR-REG CH', defaultWord);
};

// ============================================================
// ✨ PARTAGE : encodage des filtres dans le lien (#s=...)
// Le destinataire ouvre le simulateur PRÉ-REMPLI — la recherche
// se lance automatiquement chez lui, et il peut modifier les
// filtres. Contenu : filtres publics uniquement, jamais de
// données de compte.
// ============================================================
interface SharedAssuranceData {
  v: number;
  age?: string;    // ERW | JUG | KIN-K1 | KIN-K2
  fr?: number;     // franchise
  acc?: string;    // MIT-UNF | OHN-UNF
  model?: string;  // '' | TAR-BASE | TAR-HAM | TAR-DIV
  cA?: string; rA?: string;  // canton + région (mode simple)
  cB?: string; rB?: string;  // canton + région (mode comparaison)
}

const encodeAssuranceShareData = (data: SharedAssuranceData): string => {
  const json = JSON.stringify(data);
  const bytes = new TextEncoder().encode(json);
  let bin = '';
  bytes.forEach(b => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const decodeAssuranceShareData = (hash: string): SharedAssuranceData | null => {
  const m = hash.match(/#s=([A-Za-z0-9\-_]+)/);
  if (!m) return null;
  try {
    let b64 = m[1].replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) { b64 += '='; }
    const bin = atob(b64);
    const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
    const d = JSON.parse(new TextDecoder().decode(bytes));
    // Garde : un lien de partage Déménagement/Retraite contient d'autres champs
    // (dep/arr, avs/lpp) — on ne l'interprète PAS comme un partage Assurance
    // (sinon l'instance intégrée au hub chercherait à se pré-remplir).
    if (!d || d.v !== 1 || (d.cA === undefined && d.age === undefined)) return null;
    return d as SharedAssuranceData;
  } catch {
    return null;
  }
};

const buildAssuranceShareLink = (data: SharedAssuranceData): string => {
  const base = `${window.location.origin}${window.location.pathname}`;
  return `${base}?src=share#s=${encodeAssuranceShareData(data)}`;
};

export default function Assurance({ initialMode = 'simple', onPrevStep, onNextStep, onResultChange, hideWarning }: AssuranceProps) {
  const { t, i18n } = useTranslation();

  const mode = initialMode;
  
  const [activeTab, setActiveTab] = useLocalStorageState<'A' | 'B'>('ass_activeTab', 'A');

  const [selectedAge, setSelectedAge] = useLocalStorageState('ass_selectedAge', 'ERW'); 
  const [franchise, setFranchise] = useLocalStorageState('ass_franchise', 300);
  const [accident, setAccident] = useLocalStorageState('ass_accident', 'MIT-UNF');
  const [tariftyp, setTariftyp] = useLocalStorageState('ass_tariftyp', ''); 
  
  const [cantonA, setCantonA] = useLocalStorageState('ass_cantonA', 'VD');
  const [availableRegionsA, setAvailableRegionsA] = useState<RegionOption[]>([]);
  const [selectedRegionA, setSelectedRegionA] = useLocalStorageState('ass_selectedRegionA', '');

  const [cantonB, setCantonB] = useLocalStorageState('ass_cantonB', 'GE');
  const [availableRegionsB, setAvailableRegionsB] = useState<RegionOption[]>([]);
  const [selectedRegionB, setSelectedRegionB] = useLocalStorageState('ass_selectedRegionB', '');

  const [resultsA, setResultsA] = useState<Prime[]>([]);
  const [resultsB, setResultsB] = useState<Prime[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

    // ✨ PARTAGE : vue partagée (lien #s=...) + pré-remplissage.
  // Actif UNIQUEMENT en mode simple — l'instance intégrée au hub
  // Déménagement utilise son propre partage de synthèse.
  const [sharedView, setSharedView] = useState<SharedAssuranceData | null>(() =>
    typeof window !== 'undefined' && initialMode === 'simple'
      ? decodeAssuranceShareData(window.location.hash)
      : null
  );
  const sharePref = useRef<SharedAssuranceData | null>(sharedView);
  const [autoSearchDone, setAutoSearchDone] = useState(false);

  // Pré-remplissage PENDANT LE RENDU (pattern React officiel « ajuster l'état
  // pendant le rendu ») : les setters s'appliquent avant le premier commit,
  // donc fetchRegions et les correctifs 2027 (franchise/modèle/rabais) partent
  // directement sur les bonnes valeurs — pas de requête avec un ancien canton
  // du localStorage. Les régions ne sont PAS posées ici : fetchRegions les
  // applique via sharePref (prefer), sinon sa réponse les écraserait.
  const [prefillApplied, setPrefillApplied] = useState(false);
  if (sharedView && !prefillApplied) {
    setPrefillApplied(true);
    const d = sharedView;
    if (d.age) setSelectedAge(d.age);
    if (typeof d.fr === 'number') setFranchise(d.fr);
    if (d.acc) setAccident(d.acc);
    if (d.model !== undefined) setTariftyp(d.model);
    if (d.cA) { setCantonA(d.cA); setSelectedRegionA(''); }
    if (d.cB) { setCantonB(d.cB); setSelectedRegionB(''); }
  }

  const isChild = selectedAge === 'KIN-K1' || selectedAge === 'KIN-K2';

  // ✏️ 2027 : options réelles de chaque canton (null pendant le chargement ->
  // on retombe sur les listes complètes, comme avant)
  const [optionsCantonA, setOptionsCantonA] = useState<CantonOptions | null>(null);
  const [optionsCantonB, setOptionsCantonB] = useState<CantonOptions | null>(null);

  // ✏️ 2027b : 3 listes enfant possibles — standard (K1) ou rabais famille (K3/K4/K5)
  const echelleReference = isChild ? FRACT_KIN : FRACT_ERW;
  const avecRabais = selectedAge === 'KIN-K2';
  const listeA = optionsCantonA
    ? (isChild
        ? (avecRabais ? optionsCantonA.franchisesEnfantsRabais : optionsCantonA.franchisesEnfants)
        : optionsCantonA.franchisesAdultes)
    : echelleReference;
  const listeB = (mode === 'comparaison' && optionsCantonB)
    ? (isChild
        ? (avecRabais ? optionsCantonB.franchisesEnfantsRabais : optionsCantonB.franchisesEnfants)
        : optionsCantonB.franchisesAdultes)
    : null;

  // ✏️ 2027 : en mode comparaison, seules les options communes aux DEUX cantons
  const franchiseOptions = listeB
    ? listeA.filter(f => listeB.includes(f))
    : listeA;

  const modelesA = optionsCantonA?.modeles ?? ['TAR-BASE', 'TAR-HAM', 'TAR-DIV'];
  const modelesB = (mode === 'comparaison' && optionsCantonB) ? optionsCantonB.modeles : null;
  const modeleOptions = modelesB ? modelesA.filter(m => modelesB.includes(m)) : modelesA;

  const rabaisDispo = (optionsCantonA?.rabaisFamille ?? true)
    && (mode !== 'comparaison' || (optionsCantonB?.rabaisFamille ?? true));

  // ✏️ 2027b : franchise choisie indisponible -> VALEUR LA PLUS PROCHE
  // (ex. 1500 en arrivant sur ZR -> 300 ; 2500 en passant adulte->enfant -> 600).
  // Un seul effet unifié : remplace l'ancien « 1re dispo » ET l'ancien reset
  // d'échelle adulte/enfant — plus de saut brutal au palier le plus bas.
  useEffect(() => {
    if (franchiseOptions.length === 0 || franchiseOptions.includes(franchise)) return;
    let plusProche = franchiseOptions[0];
    let dMin = Math.abs(plusProche - franchise);
    for (const f of franchiseOptions) {
      const d = Math.abs(f - franchise);
      if (d < dMin) { plusProche = f; dMin = d; }
    }
    setFranchise(plusProche);
  }, [franchiseOptions.join(','), franchise]);

  // ✏️ 2027 : purge des valeurs obsolètes du localStorage (ex. TAR-HMO sauvegardé
  // avant sa suppression du dropdown — sinon recherches vides sans cause visible)
  useEffect(() => {
    if (tariftyp && !Object.keys(TARIFTYP_LABELS).includes(tariftyp)) setTariftyp('');
  }, [tariftyp]);

  // ✏️ 2027 : modèle choisi indisponible dans le(s) canton(s) -> « Tous »
  useEffect(() => {
    if (tariftyp && !modeleOptions.includes(tariftyp)) setTariftyp('');
  }, [modeleOptions.join(','), tariftyp]);

  // ✏️ 2027 : rabais famille indisponible -> option enfant standard
  useEffect(() => {
    if (!rabaisDispo && selectedAge === 'KIN-K2') setSelectedAge('KIN-K1');
  }, [rabaisDispo, selectedAge]);

  // ✏️ 2027b : chargement des options réelles — ANTI-CLIGNOTEMENT :
  // on garde les options du canton précédent pendant le chargement (pas de
  // retour visuel à la liste complète) ; null uniquement en cas d'échec
  // -> listes complètes (dégradation gracieuse, comme avant).
  useEffect(() => {
    let actif = true;
    fetchCantonOptions(cantonA)
      .then(o => { if (actif) setOptionsCantonA(o); })
      .catch(() => { if (actif) setOptionsCantonA(null); });
    return () => { actif = false; };
  }, [cantonA]);

  useEffect(() => {
    let actif = true;
    fetchCantonOptions(cantonB)
      .then(o => { if (actif) setOptionsCantonB(o); })
      .catch(() => { if (actif) setOptionsCantonB(null); });
    return () => { actif = false; };
  }, [cantonB]);

  const fetchRegions = async (
    canton: string,
    setAvailableRegions: React.Dispatch<React.SetStateAction<RegionOption[]>>,
    setSelectedRegion: React.Dispatch<React.SetStateAction<string>>,
    preferRegion?: string // ✨ PARTAGE : région du lien à conserver si elle existe
  ) => {
    const { data, error } = await supabase.from('primes_lamal').select('Region').eq('Kanton', canton).eq('Geschäftsjahr', 2027);
    if (error || !data) { setAvailableRegions([]); return; }
    const uniqueRegions = [...new Set(data.map((p: { Region: string }) => p.Region))];
    const options: RegionOption[] = uniqueRegions.map(reg => ({
      value: reg,
      label: getRegionLabel(canton, reg, i18n.language)
    })).sort((a, b) => a.value.localeCompare(b.value));
    setAvailableRegions(options);
    if (options.length > 0) {
      // ✨ PARTAGE : garder la région du lien partagé si elle existe dans ce canton
      const keep = preferRegion && options.some(o => o.value === preferRegion)
        ? preferRegion
        : options[0].value;
      setSelectedRegion(keep);
    }
  };


  useEffect(() => {
    const pre = sharePref.current;
    fetchRegions(cantonA, setAvailableRegionsA, setSelectedRegionA,
      pre && pre.cA === cantonA ? pre.rA : undefined);
  }, [cantonA]);

  useEffect(() => {
    const pre = sharePref.current;
    fetchRegions(cantonB, setAvailableRegionsB, setSelectedRegionB,
      pre && pre.cB === cantonB ? pre.rB : undefined);
  }, [cantonB]);

  useEffect(() => {
    setAvailableRegionsA(prev => prev.map(opt => ({ ...opt, label: getRegionLabel(cantonA, opt.value, i18n.language) })));
  }, [i18n.language, cantonA]);

  useEffect(() => {
    setAvailableRegionsB(prev => prev.map(opt => ({ ...opt, label: getRegionLabel(cantonB, opt.value, i18n.language) })));
  }, [i18n.language, cantonB]);

  const getFilteredPrimes = async (targetCanton: string, targetRegion: string) => {
    const targetConfig = AGE_CONFIG[selectedAge];
    let query = supabase.from('primes_lamal').select('*').eq('Kanton', targetCanton).eq('Altersklasse', targetConfig.klasse).eq('Franchise', franchise).eq('Unfalleinschluss', accident).eq('Geschäftsjahr', 2027);
    // ✏️ 2027 : région filtrée uniquement si connue (un échec du chargement des
    // régions ne vide plus les résultats — CH0/ZE/ZR fonctionnent sans région)
    if (targetRegion) query = query.eq('Region', targetRegion);
    if (tariftyp) query = query.eq('Tariftyp', tariftyp);
    const { data, error } = await query.order('Prämie', { ascending: true });
    if (error) throw error;
    // ✏️ 2027 : 3 cas — rabais famille (K3/K4/K5), enfant standard (K1),
    // et JUG/ERW (aucun sous-groupe enfant ne doit passer)
    const preFiltered = (data as Prime[]).filter(p => {
      if (targetConfig.untergruppen) return targetConfig.untergruppen.includes(p.Altersuntergruppe);
      if (targetConfig.untergruppe) return p.Altersuntergruppe === targetConfig.untergruppe;
      return !KIN_UNTERGRUPPEN.includes(p.Altersuntergruppe);
    });
    return preFiltered.filter((p, index, self) => index === self.findIndex((t) => (t.Versicherer === p.Versicherer && t.Tarifbezeichnung === p.Tarifbezeichnung)));
  };

  // ✨ Refactor : logique de recherche extraite dans runSearch — déclenchable
  // par le formulaire ET automatiquement (lien partagé).
  const runSearch = async () => {
    setLoading(true);
    setSearched(true);
    try {
      const primesA = await getFilteredPrimes(cantonA, selectedRegionA);
      setResultsA(primesA);
      if (mode === 'comparaison') {
        const primesB = await getFilteredPrimes(cantonB, selectedRegionB);
        setResultsB(primesB);
        const moyA = calculateAvgPrime(primesA);
        const moyB = calculateAvgPrime(primesB);
        const calculatedDiff = moyA.annuel - moyB.annuel;
        if (onResultChange) onResultChange(calculatedDiff, {
          avgA: moyA.annuel,
          avgB: moyB.annuel,
          depCanton: cantonA,
          depRegion: selectedRegionA,
          arrCanton: cantonB,
          arrRegion: selectedRegionB
        });
      } else {
        setResultsB([]);
        if (onResultChange) onResultChange(null);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erreur inconnue';
      alert('Erreur : ' + message);
    } finally { setLoading(false); }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    await runSearch();
  };

  // ✨ PARTAGE : à l'ouverture d'un lien partagé, lancer la recherche
  // automatiquement dès que la région du canton A est connue (une seule fois).
  useEffect(() => {
    if (!sharedView || autoSearchDone || loading) return;
    if (!selectedRegionA) return;
    setAutoSearchDone(true);
    runSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sharedView, autoSearchDone, loading, selectedRegionA]);

  // ✨ PARTAGE : bouton « Partager » — le lien transporte les filtres ;
  // le destinataire voit le comparatif se recalculer chez lui.
  const handleShare = async () => {
    const cheapest = displayedResults[0]; // liste triée par prime croissante
    const shareText = t('share.ass_text', {
      canton: getCantonLabel(cantonA),
      franchise: franchise,
      price: formatCHF(cheapest ? cheapest.Prämie : avgA.mensuel)
    });
    const shareUrl = buildAssuranceShareLink({
      v: 1,
      age: selectedAge,
      fr: franchise,
      acc: accident,
      model: tariftyp,
      cA: cantonA,
      rA: selectedRegionA,
      cB: mode === 'comparaison' ? cantonB : undefined,
      rB: mode === 'comparaison' ? selectedRegionB : undefined,
    });
    const fullMessage = `${shareText}\n${t('share.test_here')} :\n${shareUrl}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'SwissSimple - Assurance', text: shareText, url: shareUrl });
      } catch { console.log('Partage annulé'); }
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(fullMessage)}`, '_blank');
    }
  };

  // ✨ PARTAGE : « Faire ma propre simulation » — repart sur un formulaire vierge.
  const startOwnSimulation = () => {
    setSharedView(null);
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    setSelectedAge('ERW'); setFranchise(300); setAccident('MIT-UNF'); setTariftyp('');
    setCantonA('VD'); setSelectedRegionA('');
    setCantonB('GE'); setSelectedRegionB('');
    setResultsA([]); setResultsB([]); setSearched(false); setAutoSearchDone(false);
    window.scrollTo(0, 0);
  };

  const calculateAvgPrime = (primes: Prime[]) => {
    if (primes.length === 0) return { mensuel: 0, annuel: 0 };
    const total = primes.reduce((sum, p) => sum + p.Prämie, 0);
    const mensuel = total / primes.length;
    return { mensuel, annuel: mensuel * 12 };
  };

  const formatCHF = (amount: number | null) => {
    if (!amount) return '0.00';
    return amount.toLocaleString('fr-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const avgA = calculateAvgPrime(resultsA);
  const avgB = calculateAvgPrime(resultsB);
  const diffAnnuel = avgA.annuel - avgB.annuel;

  const displayedResults = mode === 'simple' ? resultsA : (activeTab === 'A' ? resultsA : resultsB);

  // ✏️ 2027 : libellés explicites pour ZE/ZR (codes BAG hors des 26 cantons,
  // probablement assurés LAMal résidant à l'étranger — non documenté officiellement)
  const getCantonLabel = (c: string) =>
    (c === 'ZE' || c === 'ZR') ? t(`assurance.canton_${c.toLowerCase()}`, `${c} – hors cantons (BAG)`) : c;

  return (
    <div className="assurance-container">
      
<SEO title={t('seo.assurance_title')} description={t('seo.assurance_desc')} path="/assurance" />

      <div className="assurance-header">
        <h1 className="assurance-title">{t('assurance.title')}</h1>
        <p className="assurance-subtitle">
          {mode === 'comparaison' ? t('assurance.subtitle_compare') : t('assurance.subtitle_simple')}
        </p>
      </div>

       {/* ✨ PARTAGE : bandeau « simulation partagée » au-dessus du formulaire */}
      {sharedView && (
        <div className="share-banner">
          <span className="share-banner-text">🔗 {t('hub.shared_banner')}</span>
          <button type="button" className="btn-primary" onClick={startOwnSimulation}>
            {t('hub.shared_cta')}
          </button>
        </div>
      )}

      <form onSubmit={handleSearch} className="assurance-form">
        <div className="assurance-filters">
          <div className="locations-wrapper">
            <div className={`location-column ${mode === 'comparaison' ? 'bordered' : ''}`}>
              <div className="filter-group">
                <label>{mode === 'comparaison' ? t('assurance.canton_depart') : t('assurance.canton')}</label>
                <select value={cantonA} onChange={(e) => setCantonA(e.target.value)} className="form-input">
                  {CANTONS.map(c => <option key={c} value={c}>{getCantonLabel(c)}</option>)}
                </select>
              </div>
              {availableRegionsA.length > 1 && (
                <div className="filter-group">
                  <label>{t('assurance.region')}</label>
                  <select value={selectedRegionA} onChange={(e) => setSelectedRegionA(e.target.value)} className="form-input">
                    {availableRegionsA.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
                </div>
              )}
            </div>

            {mode === 'comparaison' && (
              <div className="location-column bordered">
                <div className="filter-group">
                  <label>{t('assurance.canton_arrivee')}</label>
                  <select value={cantonB} onChange={(e) => setCantonB(e.target.value)} className="form-input">
                    {CANTONS.map(c => <option key={c} value={c}>{getCantonLabel(c)}</option>)}
                  </select>
                </div>
                {availableRegionsB.length > 1 && (
                  <div className="filter-group">
                    <label>{t('assurance.region')}</label>
                    <select value={selectedRegionB} onChange={(e) => setSelectedRegionB(e.target.value)} className="form-input">
                      {availableRegionsB.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </select>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="common-filters-wrapper">
            <div className="filter-group">
              <label>{t('assurance.age')}</label>
              <select value={selectedAge} onChange={(e) => setSelectedAge(e.target.value)} className="form-input">
                {AGE_KEYS.filter(key => key !== 'KIN-K2' || rabaisDispo).map(key => {
                  const langKey = key === 'KIN-K1' ? 'age_k1' : key === 'KIN-K2' ? 'age_k2' : key === 'JUG' ? 'age_jug' : 'age_erw';
                  return <option key={key} value={key}>{t(`assurance.${langKey}`, AGE_CONFIG[key].label)}</option>
                })}
              </select>
            </div>
            <div className="filter-group">
              <label>{t('assurance.modele')}</label>
              <select value={tariftyp} onChange={(e) => setTariftyp(e.target.value)} className="form-input">
                {(['', ...modeleOptions]).map(key => {
                  const langKey = key === '' ? 'model_all' : `model_${key.split('-')[1].toLowerCase()}`;
                  return <option key={key} value={key}>{t(`assurance.${langKey}`, TARIFTYP_LABELS[key])}</option>
                })}
              </select>
            </div>
            <div className="filter-group">
              <label>{t('assurance.franchise')}</label>
              <select value={franchise} onChange={(e) => setFranchise(parseInt(e.target.value))} className="form-input">
                {franchiseOptions.map(f => <option key={f} value={f}>{f} CHF</option>)}
              </select>
            </div>
            <div className="filter-group">
              <label>{t('assurance.accident')}</label>
              <select value={accident} onChange={(e) => setAccident(e.target.value)} className="form-input">
                <option value="MIT-UNF">{t('assurance.accident_avec')}</option>
                <option value="OHN-UNF">{t('assurance.accident_sans')}</option>
              </select>
            </div>
          </div>
        </div>

        <button className="btn-primary" type="submit" disabled={loading}>
          {loading ? t('assurance.calc_loading') : (mode === 'comparaison' ? t('assurance.calc_btn_compare') : t('assurance.calc_btn_simple'))}
        </button>
      </form>

      <div className="assurance-results">
        {searched && !loading && resultsA.length === 0 && (
          <div className="no-results">{t('assurance.no_results')}</div>
        )}

        {mode === 'comparaison' && resultsA.length > 0 && resultsB.length > 0 && (
          <div className="comparison-summary">
            <div className="comparison-avg-row">
              <div className="comparison-avg-col">
                <h4>{t('assurance.depart_moyenne')}</h4>
                <h2>{formatCHF(avgA.mensuel)} CHF<span>/{t('assurance.per_month')}</span></h2>
              </div>
              <div className="comparison-vs">VS</div>
              <div className="comparison-avg-col">
                <h4>{t('assurance.arrivee_moyenne')}</h4>
                <h2>{formatCHF(avgB.mensuel)} CHF<span>/{t('assurance.per_month')}</span></h2>
              </div>
            </div>
            
            <div className={`comparison-diff ${diffAnnuel > 0 ? 'benefice' : diffAnnuel < 0 ? 'perte' : 'neutre'}`}>
              {diffAnnuel > 0 ? (
                <h3>{t('assurance.economy')}{formatCHF(diffAnnuel)} CHF / {t('assurance.per_year')}</h3>
              ) : diffAnnuel < 0 ? (
                <h3>{t('assurance.surcout')}{formatCHF(Math.abs(diffAnnuel))} CHF / {t('assurance.per_year')}</h3>
              ) : (
                <h3>{t('assurance.diff_neutre')}</h3>
              )}
            </div>
            <p className="comparison-subtitle">{t('assurance.comparison_subtitle', { countA: resultsA.length, countB: resultsB.length })}</p>
          </div>
        )}

        {mode === 'comparaison' && (onPrevStep || onNextStep) && (
          <div className="hub-navigation hub-nav-spacing">
            {onPrevStep && (
              <button className="btn-hub-prev" onClick={onPrevStep}>
                {t('assurance.prev_step', '← Retour aux Impôts')}
              </button>
            )}
            {onNextStep && (
              <button className="btn-hub-next" onClick={onNextStep}>
                {t('assurance.next_step', 'Vers la Synthèse Financière → 📊')}
              </button>
            )}
          </div>
        )}

        {mode === 'comparaison' && resultsA.length > 0 && resultsB.length > 0 && (
          <>
            <div className="region-tabs">
              <button type="button" className={`region-tab ${activeTab === 'A' ? 'active' : ''}`} onClick={() => setActiveTab('A')}>
                {t('assurance.offres_depart', { count: resultsA.length })}
              </button>
              <button type="button" className={`region-tab ${activeTab === 'B' ? 'active' : ''}`} onClick={() => setActiveTab('B')}>
                {t('assurance.offres_arrivee', { count: resultsB.length })}
              </button>
            </div>

            {displayedResults.length > 0 && (
              <div className="results-grid">
                {displayedResults.map((prime) => (
                  <div key={prime.id} className="prime-card">
                    <div className="prime-card-header">
                      <h3 className="assureur-name">{INSURER_NAMES[String(prime.Versicherer)] || `Caisse (${prime.Versicherer})`}</h3>
                      <span className="prime-type">{prime.Tariftyp ? t(`assurance.model_${prime.Tariftyp.split('-')[1].toLowerCase()}`) : t('assurance.model_all')}</span>
                    </div>
                    <div className="prime-card-body">
                      <p className="prime-tarif-name">{prime.Tarifbezeichnung}</p>
                      <div className="prime-price">
                        <span className="price-label">{t('assurance.prime_mensuelle')}</span>
                        <span className="price-value">{formatCHF(prime.Prämie)} CHF</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {mode === 'simple' && displayedResults.length > 0 && (
          <>
            <h2 className="results-title">{t('assurance.results_title', { count: displayedResults.length })}</h2>
            <div className="results-grid">
              {displayedResults.map((prime) => (
                <div key={prime.id} className="prime-card">
                  <div className="prime-card-header">
                    <h3 className="assureur-name">{INSURER_NAMES[String(prime.Versicherer)] || `Caisse (${prime.Versicherer})`}</h3>
                    <span className="prime-type">{prime.Tariftyp ? t(`assurance.model_${prime.Tariftyp.split('-')[1].toLowerCase()}`) : t('assurance.model_all')}</span>
                  </div>
                  <div className="prime-card-body">
                    <p className="prime-tarif-name">{prime.Tarifbezeichnung}</p>
                    <div className="prime-price">
                      <span className="price-label">{t('assurance.prime_mensuelle')}</span>
                      <span className="price-value">{formatCHF(prime.Prämie)} CHF</span>
                    </div>
                  </div>
                </div>
              ))}

      {/* ✨ Partage flottant : accessible pendant tout le scroll des résultats */}
            {searched && (
<button
  type="button"
  className="btn-primary share-fab"
  onClick={handleShare}
  aria-label={t('hub.share_result_btn')}
  title={t('hub.share_result_btn')}
>
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="18" cy="5" r="3"></circle>
    <circle cx="6" cy="12" r="3"></circle>
    <circle cx="18" cy="19" r="3"></circle>
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
  </svg>
  {t('share.fab_label', 'Partager')}
</button>
)}
            </div>
          </>
        )}
      </div>

      {!hideWarning && (
        <div className="avertissement-legal">
          <span className="titre-avertissement">⚖️ {t('hub.warning_title')}</span>
          <span className="texte-avertissement">{t('assurance.warning')}</span>
        </div>
      )}
    </div>
  );
}