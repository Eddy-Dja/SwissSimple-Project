import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabaseClient';
import AuthModal from '../../components/AuthModal';
import './RadarFiscal.css';

// ============================================================
// INTERFACES STRICTES
// ============================================================
interface Commune {
  id: number;
  commune: string;
  canton: string;
  canton_id: number;
  coeff_revenu_canton: number;
  coeff_revenu_commune: number;
  coeff_revenu_eglise_reforme: number;
  coeff_revenu_eglise_catholique: number;
}

interface BaremeTranche {
  montant_tranche: number;
  taux: number;
  montant_base: number;
}

interface DeductionRow {
  nom_deduction: string;
  categorie: string;
  montant: number;
  pourcent: number;
  minimum: number;
  maximum: number;
  statut: string;
  type_impot: string;
}

interface DeductionPalier {
  nom_deduction: string;
  categorie: string;
  revenu_seuil: number;
  deduction_montant: number;
  statut: string;
  type_impot: string;
}

interface ResultatFiscal {
  revenuNet: number;
  totalDeductionsFed: number;
  totalDeductionsCant: number;
  revenuImposableFederal: number;
  revenuImposableCantonal: number;
  impotCantonal: number;
  impotCommunal: number;
  impotParoissial: number;
  impotFederal: number;
  impotTotal: number;
}

type StatutCivil = 'celibataire' | 'marie';
type Religion = 'aucune' | 'reforme' | 'catholique';
type ClasseAge = 'aucune' | '25-34' | '35-44' | '45-54' | '55-65';

// ============================================================
// DICTIONNAIRES DE STRATÉGIES ET DE SECOURS
// ============================================================
type CantonStrategy = {
  couple2RevenusStrategy?: 'LIRE_MAXIMUM' | 'LIRE_MONTANT';
  assuranceStrategy?: 'LIRE_MAXIMUM_COMME_GLOBAL' | 'DOUBLER_MAXIMUM';
  deductionMarieStrategy?: 'MONTANT_GLOBAL_SANS_DOUBLER' | 'DOUBLER_MONTANT';
  useProportionalTax?: boolean;
};

const CANTON_RULES: Record<number, CantonStrategy> = {
  10: { assuranceStrategy: 'LIRE_MAXIMUM_COMME_GLOBAL', deductionMarieStrategy: 'MONTANT_GLOBAL_SANS_DOUBLER', useProportionalTax: true },
  2: { deductionMarieStrategy: 'DOUBLER_MONTANT' },
  22: { couple2RevenusStrategy: 'LIRE_MAXIMUM' },
  12: { assuranceStrategy: 'DOUBLER_MAXIMUM', deductionMarieStrategy: 'MONTANT_GLOBAL_SANS_DOUBLER' },
  25: { couple2RevenusStrategy: 'LIRE_MAXIMUM' }
};

type CantonFallback = {
  reductionImpotBase?: number;
  fraisProf?: { celibataire: number; marie: number; };
  assuranceMaladie?: { celibataire: number; marie: number; };
  couple2Revenus?: number;
  statut?: { celibataire: number; marie: number; };
  hardcodedBareme?: { celibataire: BaremeTranche[]; marie: BaremeTranche[]; };
  hardcodedBaremeCommunal?: { celibataire: BaremeTranche[]; marie: BaremeTranche[]; };
  coeffCantonOverride?: number;
};

const CANTON_FALLBACK: Record<number, CantonFallback> = {
  22: { reductionImpotBase: 0.95 },
  25: { reductionImpotBase: 0.88, fraisProf: { celibataire: 1817, marie: 3634 }, assuranceMaladie: { celibataire: 4560, marie: 9120 }, couple2Revenus: 1054 },
  12: { fraisProf: { celibataire: 4200, marie: 8400 }, assuranceMaladie: { celibataire: 4200, marie: 8400 }, couple2Revenus: 1100, statut: { celibataire: 19500, marie: 38000 } },
  26: { fraisProf: { celibataire: 4100, marie: 8200 }, assuranceMaladie: { celibataire: 3400, marie: 6800 }, couple2Revenus: 2700, statut: { celibataire: 1800, marie: 3700 } },
  3: {
    coeffCantonOverride: 145,
    hardcodedBareme: {
      celibataire: [
        { montant_tranche: 0, taux: 0, montant_base: 0 }, { montant_tranche: 9900, taux: 0.5, montant_base: 0 }, { montant_tranche: 12300, taux: 1.0, montant_base: 12 }, { montant_tranche: 15500, taux: 2.0, montant_base: 44 }, { montant_tranche: 16700, taux: 3.0, montant_base: 68 }, { montant_tranche: 17900, taux: 4.0, montant_base: 104 }, { montant_tranche: 20800, taux: 4.5, montant_base: 220 }, { montant_tranche: 25100, taux: 5.0, montant_base: 413.5 }, { montant_tranche: 110100, taux: 5.25, montant_base: 4663.5 }, { montant_tranche: 163900, taux: 5.5, montant_base: 7488 }, { montant_tranche: 2096800, taux: 5.8, montant_base: 119517.5 }
      ],
      marie: [
        { montant_tranche: 0, taux: 0, montant_base: 0 }, { montant_tranche: 19900, taux: 0.5, montant_base: 0 }, { montant_tranche: 24000, taux: 1.5, montant_base: 20.5 }, { montant_tranche: 25000, taux: 2.5, montant_base: 35.5 }, { montant_tranche: 26200, taux: 3.0, montant_base: 65.5 }, { montant_tranche: 28300, taux: 3.5, montant_base: 128.5 }, { montant_tranche: 32500, taux: 4.5, montant_base: 275.5 }, { montant_tranche: 99200, taux: 5.0, montant_base: 3277 }, { montant_tranche: 138100, taux: 5.5, montant_base: 5222 }, { montant_tranche: 159200, taux: 5.8, montant_base: 6382.5 }
      ]
    }
  },
  7: { fraisProf: { celibataire: 4483, marie: 8966 }, assuranceMaladie: { celibataire: 1800, marie: 3700 }, couple2Revenus: 1200 },
  6: { fraisProf: { celibataire: 2689, marie: 5378 }, assuranceMaladie: { celibataire: 1700, marie: 3300 }, couple2Revenus: 3400, statut: { celibataire: 10000, marie: 20000 } },
  4: { fraisProf: { celibataire: 2689, marie: 5378 }, assuranceMaladie: { celibataire: 1800, marie: 3700 }, couple2Revenus: 3700, statut: { celibataire: 15300, marie: 26900 } },
  23: {
    hardcodedBaremeCommunal: { 
      celibataire: [
        { montant_tranche: 0, taux: 2.0, montant_base: 0 }, { montant_tranche: 5000, taux: 2.7, montant_base: 100 }, { montant_tranche: 10000, taux: 3.6, montant_base: 270 }, { montant_tranche: 15000, taux: 4.4, montant_base: 540 }, { montant_tranche: 20000, taux: 5.8, montant_base: 880 }, { montant_tranche: 30000, taux: 6.8, montant_base: 1740 }, { montant_tranche: 40000, taux: 7.5, montant_base: 2720 }, { montant_tranche: 50000, taux: 8.0, montant_base: 3750 }, { montant_tranche: 60000, taux: 8.4, montant_base: 4800 }, { montant_tranche: 70000, taux: 8.8, montant_base: 5880 }, { montant_tranche: 80000, taux: 9.0, montant_base: 7040 }, { montant_tranche: 90000, taux: 9.1, montant_base: 8100 }, { montant_tranche: 100000, taux: 9.2, montant_base: 9100 }, { montant_tranche: 110000, taux: 9.3, montant_base: 10120 }, { montant_tranche: 120000, taux: 9.4, montant_base: 11160 }, { montant_tranche: 130000, taux: 9.5, montant_base: 12220 }, { montant_tranche: 140000, taux: 9.6, montant_base: 13300 }, { montant_tranche: 150000, taux: 9.7, montant_base: 14400 }, { montant_tranche: 160000, taux: 9.8, montant_base: 15520 }, { montant_tranche: 170000, taux: 9.9, montant_base: 16660 }, { montant_tranche: 180000, taux: 9.95, montant_base: 17820 }, { montant_tranche: 190000, taux: 10.0, montant_base: 18905 }, { montant_tranche: 200000, taux: 10.0, montant_base: 20000 }
      ],
      marie: [
        { montant_tranche: 0, taux: 2.0, montant_base: 0 }, { montant_tranche: 5000, taux: 2.7, montant_base: 100 }, { montant_tranche: 10000, taux: 3.6, montant_base: 270 }, { montant_tranche: 15000, taux: 4.4, montant_base: 540 }, { montant_tranche: 20000, taux: 5.8, montant_base: 880 }, { montant_tranche: 30000, taux: 6.8, montant_base: 1740 }, { montant_tranche: 40000, taux: 7.5, montant_base: 2720 }, { montant_tranche: 50000, taux: 8.0, montant_base: 3750 }, { montant_tranche: 60000, taux: 8.4, montant_base: 4800 }, { montant_tranche: 70000, taux: 8.8, montant_base: 5880 }, { montant_tranche: 80000, taux: 9.0, montant_base: 7040 }, { montant_tranche: 90000, taux: 9.1, montant_base: 8100 }, { montant_tranche: 100000, taux: 9.2, montant_base: 9100 }, { montant_tranche: 110000, taux: 9.3, montant_base: 10120 }, { montant_tranche: 120000, taux: 9.4, montant_base: 11160 }, { montant_tranche: 130000, taux: 9.5, montant_base: 12220 }, { montant_tranche: 140000, taux: 9.6, montant_base: 13300 }, { montant_tranche: 150000, taux: 9.7, montant_base: 14400 }, { montant_tranche: 160000, taux: 9.8, montant_base: 15520 }, { montant_tranche: 170000, taux: 9.9, montant_base: 16660 }, { montant_tranche: 180000, taux: 9.95, montant_base: 17820 }, { montant_tranche: 190000, taux: 10.0, montant_base: 18905 }, { montant_tranche: 200000, taux: 10.0, montant_base: 20000 }
      ]
    }
  }
};

const CANTON_DIVISEURS: Record<number, number> = {
  1: 1.0, 2: 1.0, 3: 1.0, 4: 1.0, 5: 1.0, 6: 1.0, 7: 1.85, 8: 1.7,
  9: 1.0, 10: 1.0, 11: 1.9, 12: 1.0, 14: 1.9, 15: 1.0, 16: 2.0, 17: 2.0,
  18: 1.9, 19: 1.0, 20: 2.0, 21: 1.0, 22: 1.8, 23: 1.0, 24: 1.923076923, 25: 2.0, 26: 1.0
};

const IGNORED_KEYWORDS = [
  'total', 'valeur locative', 'fortune', 'frais d\'entretien', 'immobilier',
  'accessoire', 'sans cotisations', 'moyenne', 'seuil', 'facteur', 'loyer',
  'modeste', 'logement', 'revenu accessoire', 'intérêts technique', 'finma',
  'prime unique', 'bas revenu', 'avs', 'ai ', 'rentier', 'rabais', 'réduction',
  'tarif', 'impot', 'allègement', 'crédit', 'centime', 'taux d\'intérêt'
];

const isRevenuDeduction = (ded: DeductionRow): boolean => {
  if (ded.type_impot && ded.type_impot.toLowerCase().includes('fortune')) return false;
  const nom = (ded.nom_deduction || '').toLowerCase();
  return !IGNORED_KEYWORDS.some(kw => nom.includes(kw));
};

const SearchableSelect: React.FC<{
  label: string;
  emoji: string;
  communes: Commune[];
  onSelect: (c: Commune) => void;
}> = ({ label, emoji, communes, onSelect }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Commune | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (c: Commune): void => {
    setSelected(c); setSearch(''); setIsOpen(false); onSelect(c);
  };

  const filteredCommunes = communes.filter(c =>
    (c.commune || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.canton || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="filter-group select-wrapper" ref={wrapperRef}>
      <label>{label} {emoji}</label>
      <div className="form-input select-trigger" onClick={() => { console.log("Clic sur le menu déroulant !"); setIsOpen(!isOpen); setSearch(''); }}>
         <span className={`select-text ${selected ? 'has-value' : ''}`}>
          {selected ? `${selected.commune} (${selected.canton})` : '-- Choisir --'}
        </span>
        <span className="select-arrow">▼</span>
      </div>
      {isOpen && (
        <div className="dropdown-container">
          <div className="dropdown-search-wrapper">
            <input type="text" placeholder="Rechercher..." value={search} onChange={(e) => setSearch(e.target.value)} className="form-input dropdown-search-input" autoFocus onClick={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }} />
          </div>
          <div className="dropdown-list">
            {filteredCommunes.length === 0 && <div className="dropdown-no-result">Aucun résultat</div>}
            {filteredCommunes.map(c => (
              <div key={c.id} onMouseDown={(e) => e.preventDefault()} onClick={() => handleSelect(c)} className={`dropdown-item ${selected?.id === c.id ? 'selected' : ''}`}>
                {c.commune} <span className="dropdown-item-canton">({c.canton})</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

interface RadarFiscalProps {
  initialMode?: 'simple' | 'comparaison';
  onNextStep?: () => void;
  onResultChange?: (diff: number | null, details?: { dep: any, arr: any, depName?: string, arrName?: string }) => void;
  hideWarning?: boolean;
}

const RadarFiscal: React.FC<RadarFiscalProps> = ({ initialMode = 'simple', onNextStep, onResultChange, hideWarning }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [communes, setCommunes] = useState<Commune[]>([]);

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const mode = initialMode;
  
  const [revenuInput, setRevenuInput] = useState('100000');
  const [typeRevenu] = useState<'brut' | 'net'>('brut');
  const [statutCivil, setStatutCivil] = useState<StatutCivil>('celibataire');
  const [religion, setReligion] = useState<Religion>('aucune');
  const [nombreEnfants, setNombreEnfants] = useState(0);
  const [classeAge, setClasseAge] = useState<ClasseAge>('35-44');
  const [classeAgeConjoint, setClasseAgeConjoint] = useState<ClasseAge>('35-44');

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [cotisationsSociales, setCotisationsSociales] = useState('12000');
  const [pilier3a, setPilier3a] = useState('0');
  const [pilier3aConjoint, setPilier3aConjoint] = useState('0');
  const [fraisGarde, setFraisGarde] = useState('0');
  const [revenuConjoint, setRevenuConjoint] = useState('100000');
  const [isRetraite, setIsRetraite] = useState(false);

  const [communeDepart, setCommuneDepart] = useState<Commune | null>(null);
  const [communeArrivee, setCommuneArrivee] = useState<Commune | null>(null);

  const [resultatDepart, setResultatDepart] = useState<ResultatFiscal | null>(null);
  const [resultatArrivee, setResultatArrivee] = useState<ResultatFiscal | null>(null);
  const [difference, setDifference] = useState<number | null>(null);
  const [isUnsupported, setIsUnsupported] = useState(false);

  useEffect(() => {
    const fetchCommunes = async (): Promise<void> => {
      const { data, error } = await supabase.from('communes').select('id, commune, canton, canton_id, coeff_revenu_canton, coeff_revenu_commune, coeff_revenu_eglise_reforme, coeff_revenu_eglise_catholique').order('commune').limit(5000);
      
      console.log("Réponse de Supabase - Data:", data);
      console.log("Réponse de Supabase - Error:", error);

      if (error) console.error('Erreur chargement communes:', error);
      if (data) setCommunes(data as Commune[]);
    };
    fetchCommunes();
  }, []);

  const totalBrut = (): number => {
    const r1 = parseFloat(revenuInput) || 0;
    if (statutCivil === 'marie') return r1 + (parseFloat(revenuConjoint) || 0);
    return r1;
  };

  useEffect(() => {
    if (typeRevenu === 'net') { setCotisationsSociales('0'); return; }

    const PLAFOND_1ER_PILIER = 148200;
    const calcCotis1erPilier = (brut: number): number => {
      const plafonne = Math.min(brut, PLAFOND_1ER_PILIER);
      return plafonne * 0.053 + plafonne * 0.011 + plafonne * 0.004;
    };

    const SEUIL_LPP = 22680, PLAFOND_LPP_BRUT = 90720, DEDUCTION_COORD = 26460;
    const calcLPP = (brutIndividuel: number, ageClass: ClasseAge): number => {
      if (brutIndividuel <= SEUIL_LPP || ageClass === 'aucune') return 0;
      const salaireCoord = Math.max(0, Math.min(brutIndividuel, PLAFOND_LPP_BRUT) - DEDUCTION_COORD);
      const tauxLpp: Record<Exclude<ClasseAge, 'aucune'>, number> = { '25-34': 0.040, '35-44': 0.055, '45-54': 0.075, '55-65': 0.090 };
      return salaireCoord * tauxLpp[ageClass as Exclude<ClasseAge, 'aucune'>];
    };

    let cotisAvsAcLaa = 0, cotisLpp = 0;

    if (statutCivil === 'marie') {
      const r1 = parseFloat(revenuInput) || 0, r2 = parseFloat(revenuConjoint) || 0;
      cotisAvsAcLaa = calcCotis1erPilier(r1) + calcCotis1erPilier(r2);
      cotisLpp = calcLPP(r1, classeAge) + calcLPP(r2, classeAgeConjoint);
    } else {
      const brut = parseFloat(revenuInput) || 0;
      cotisAvsAcLaa = calcCotis1erPilier(brut);
      cotisLpp = calcLPP(brut, classeAge);
    }

    setCotisationsSociales(Math.round(cotisAvsAcLaa + cotisLpp).toString());
  }, [revenuInput, typeRevenu, classeAge, classeAgeConjoint, statutCivil, revenuConjoint]);

  const calculateNetIncome = (brut: number): number => {
    return Math.max(0, Math.round(brut - (parseFloat(cotisationsSociales) || 0)));
  };

  const getNetConjoint = (revenuBrut: number): number => {
    if (statutCivil !== 'marie' || parseFloat(revenuConjoint) <= 0) return 0;
    const grossConjoint = parseFloat(revenuConjoint) || 0;
    if (typeRevenu === 'net') return grossConjoint;
    if (revenuBrut === 0) return 0;
    return Math.max(0, grossConjoint - ((parseFloat(cotisationsSociales) || 0) * (grossConjoint / revenuBrut)));
  };

  const calculerTotalDeductions = (revenuNet: number, revenuBrut: number, deductionsData: DeductionRow[], paliersData: DeductionPalier[], statut: StatutCivil, nbEnfants: number, cantonId: number): number => {
    if (cantonId === 25 || cantonId === 12 || cantonId === 26 || cantonId === 7 || cantonId === 6 || cantonId === 4) return calculerAvecFallback(deductionsData, paliersData, statut, nbEnfants, revenuNet, revenuBrut, cantonId);
    return calculerGenerique(deductionsData, paliersData, statut, nbEnfants, revenuNet, revenuBrut, cantonId);
  };

  const calculerAvecFallback = (deductionsData: DeductionRow[], _paliersData: DeductionPalier[], statut: StatutCivil, nbEnfants: number, _revenuNet: number, revenuBrut: number, cantonId: number): number => {
    let totalDeductions = 0;
    const validDeds = deductionsData.filter(isRevenuDeduction);
    const netConjoint = getNetConjoint(revenuBrut);
    const isMarie2Revenus = (statut === 'marie' && netConjoint > 0);
    const fallback = CANTON_FALLBACK[cantonId];

    if (fallback?.fraisProf) totalDeductions += statut === 'marie' ? fallback.fraisProf.marie : fallback.fraisProf.celibataire;
    if (fallback?.assuranceMaladie) totalDeductions += statut === 'marie' ? fallback.assuranceMaladie.marie : fallback.assuranceMaladie.celibataire;
    if (isMarie2Revenus && fallback?.couple2Revenus) totalDeductions += fallback.couple2Revenus;
    if (fallback?.statut) totalDeductions += statut === 'marie' ? fallback.statut.marie : fallback.statut.celibataire;

    if (nbEnfants > 0) {
      const enfantRow = validDeds.find(d => d.categorie === 'deduction_enfant' && (d.statut === 'tous' || d.statut === statut));
      if (enfantRow) {
        let amount = enfantRow.maximum > 0 ? enfantRow.maximum : (enfantRow.montant > 0 ? enfantRow.montant : 0);
        totalDeductions += (amount * nbEnfants);
      }
      if (parseFloat(fraisGarde) > 0) {
        const gardeRow = validDeds.find(d => d.categorie === 'frais_garde' && (d.statut === 'tous' || d.statut === statut));
        if (gardeRow) totalDeductions += Math.min(parseFloat(fraisGarde), (gardeRow.maximum > 0 ? gardeRow.maximum : 0) * nbEnfants);
      }
    }

    const max3a = validDeds.find(d => d.categorie === 'pilier_3a_max_avec' || d.categorie === 'pilier_3a_max_sans')?.maximum || 0;
    if (max3a > 0) {
      let total3a = Math.min(parseFloat(pilier3a) || 0, max3a);
      if (statut === 'marie') total3a += Math.min(parseFloat(pilier3aConjoint) || 0, max3a);
      totalDeductions += total3a;
    }
    return totalDeductions;
  };
  
  const calculerGenerique = (deductionsData: DeductionRow[], paliersData: DeductionPalier[], statut: StatutCivil, nbEnfants: number, revenuNet: number, revenuBrut: number, cantonId: number): number => {
    let totalDeductions = 0;
    const rules = CANTON_RULES[cantonId] || {};
    const netConjoint = getNetConjoint(revenuBrut);
    const validDeds = deductionsData.filter(isRevenuDeduction);

    const isMarie2Revenus = (statut === 'marie' && netConjoint > 0);
    const netPrincipal = Math.max(0, revenuNet - netConjoint);
    const plusPetitRevenu = Math.min(netPrincipal, netConjoint);

    let maxAssurance = 0, totalProf = 0, maxCouple = 0, maxStatut = 0, max3a = 0, maxAssuranceEnfant = 0, maxDeductionEnfant = 0, totalGarde = 0;

    for (const ded of validDeds) {
      if (ded.statut !== 'tous' && ded.statut !== statut) continue;
      const cat = ded.categorie || 'autre';

      switch (cat) {
        case 'frais_professionnels': {
          let amount = ded.montant > 0 ? ded.montant : 0;
          let minAmount = ded.minimum > 0 ? ded.minimum : 0;
          let maxCap = ded.maximum > 0 ? ded.maximum : 0;
          let calcAmount = ded.pourcent > 0 ? Math.floor(netPrincipal * (ded.pourcent / 100)) : 0;
          if (isMarie2Revenus) {
            calcAmount *= 2;
            if (amount > 0 && ded.pourcent === 0) amount *= 2;
            if (minAmount > 0) minAmount *= 2;
            if (maxCap > 0) maxCap *= 2;
          }
          totalProf += Math.min(Math.max(amount, calcAmount, minAmount), maxCap > 0 ? maxCap : Infinity);
          break;
        }
        case 'assurance_enfant': {
          if (nbEnfants > 0) {
            let amount = ded.montant > 0 ? ded.montant : (ded.minimum > 0 ? ded.minimum : 0);
            let maxCap = ded.maximum > 0 ? ded.maximum : 0;
            if (amount === 0 && maxCap > 0) amount = maxCap;
            maxAssuranceEnfant = Math.max(maxAssuranceEnfant, maxCap > 0 ? Math.min(amount, maxCap) : amount);
          }
          break;
        }
        case 'assurance_adulte_avec_pilier':
        case 'assurance_adulte_sans_pilier': {
          let amount = ded.montant > 0 ? ded.montant : (ded.minimum > 0 ? ded.minimum : 0);
          let maxCap = ded.maximum > 0 ? ded.maximum : 0;
          if (amount === 0 && maxCap > 0) amount = maxCap;
          if (rules.assuranceStrategy === 'DOUBLER_MAXIMUM' && isMarie2Revenus) {
            amount *= 2;
            if (maxCap > 0) amount = Math.min(amount, maxCap * 2);
          }
          maxAssurance = Math.max(maxAssurance, amount);
          break;
        }
        case 'frais_garde': {
          if (nbEnfants > 0 && parseFloat(fraisGarde) > 0) {
            let maxCap = ded.maximum > 0 ? ded.maximum : 0;
            if (isMarie2Revenus) maxCap *= 2;
            totalGarde = Math.max(totalGarde, maxCap > 0 ? Math.min(parseFloat(fraisGarde), maxCap * nbEnfants) : parseFloat(fraisGarde));
          }
          break;
        }
        case 'couple_2_revenus': {
          if (isMarie2Revenus) {
            let amount = ded.montant > 0 ? ded.montant : 0;
            let minAmount = ded.minimum > 0 ? ded.minimum : 0;
            let maxCap = ded.maximum > 0 ? ded.maximum : 0;
            if (ded.pourcent === 0 && amount === 0 && minAmount === 0 && maxCap > 0) amount = maxCap;
            
            let calcAmount = ded.pourcent > 0 ? Math.floor(plusPetitRevenu * (ded.pourcent / 100)) : 0;
            calcAmount *= 2; 
            
            let forfait = Math.max(amount, calcAmount, minAmount);
            if (maxCap > 0) forfait = Math.min(forfait, maxCap);
            maxCouple = Math.max(maxCouple, forfait);
          }
          break;
        }
        case 'deduction_enfant': {
          if (nbEnfants > 0) {
            let amount = ded.montant > 0 ? ded.montant : (ded.minimum > 0 ? ded.minimum : 0);
            let maxCap = ded.maximum > 0 ? ded.maximum : 0;
            if (amount === 0 && maxCap > 0) amount = maxCap;
            maxDeductionEnfant = Math.max(maxDeductionEnfant, maxCap > 0 ? Math.min(amount, maxCap) : amount);
          }
          break;
        }
        case 'pilier_3a_max_avec':
        case 'pilier_3a_max_sans': {
          max3a = Math.max(max3a, ded.maximum);
          break;
        }
        case 'deduction_statut': {
          const nom = ded.nom_deduction.toLowerCase();
          if (nom.includes('rentier') || nom.includes('social') || nom.includes('modeste')) break;
          if (nom.includes('enfant') && nbEnfants === 0) break;
          
          if (ded.statut === 'tous' && ded.montant === 0 && ded.minimum === 0 && ded.maximum === 0) break;
          
          let amount = ded.montant > 0 ? ded.montant : (ded.minimum > 0 ? ded.minimum : 0);
          let maxCap = ded.maximum > 0 ? ded.maximum : 0;
          if (amount === 0 && ded.pourcent === 0 && ded.minimum === 0 && maxCap > 0) amount = maxCap;
          
          if (rules.deductionMarieStrategy === 'DOUBLER_MONTANT' && isMarie2Revenus) {
            amount *= 2;
            if (maxCap > 0) amount = Math.min(amount, maxCap * 2);
          }
          maxStatut += amount; 
          break;
        }
        default: {
          const nom = (ded.nom_deduction || '').toLowerCase();
          if ((nom.includes('enfant') || nom.includes('formation')) && nbEnfants === 0) break;
          if (nom.includes('assurance') || nom.includes('maladie') || nom.includes('prime') || nom.includes('épargne') || nom.includes('intérêts')) {
            let amount = ded.montant > 0 ? ded.montant : (ded.minimum > 0 ? ded.minimum : 0);
            let maxCap = ded.maximum > 0 ? ded.maximum : 0;
            if (amount === 0 && maxCap > 0) amount = maxCap;
            maxAssurance = Math.max(maxAssurance, amount);
            break;
          }
          let amount = ded.montant > 0 ? ded.montant : (ded.minimum > 0 ? ded.minimum : 0);
          const maxCap = ded.maximum > 0 ? ded.maximum : 0;
          if (amount === 0 && maxCap > 0 && nom.includes('forfait')) amount = maxCap;
          if (amount > 0) {
            if (nom.includes('enfant') && !nom.includes('famille') && nbEnfants > 0) amount *= nbEnfants;
            if (maxCap > 0) amount = Math.min(amount, maxCap * (nom.includes('enfant') ? nbEnfants : 1));
            totalDeductions += amount;
          }
          break;
        }
      }
    }

    totalDeductions += maxAssurance + maxCouple + maxStatut + totalProf + (maxAssuranceEnfant * nbEnfants) + (maxDeductionEnfant * nbEnfants) + totalGarde;

    if (max3a > 0) {
      let total3a = Math.min(parseFloat(pilier3a) || 0, max3a);
      if (statut === 'marie') total3a += Math.min(parseFloat(pilier3aConjoint) || 0, max3a);
      totalDeductions += total3a;
    }

    if (paliersData && paliersData.length > 0) {
      const palierGroups: { [key: string]: DeductionPalier[] } = {};
      for (const p of paliersData) {
        if (p.categorie === 'palier_social_a_ignorer') continue;
        if (p.statut !== 'tous' && p.statut !== statut) continue;
        if (p.type_impot && p.type_impot.toLowerCase().includes('fortune')) continue;
        const key = (p.nom_deduction || '').toLowerCase();
        if (!palierGroups[key]) palierGroups[key] = [];
        palierGroups[key].push(p);
      }
      for (const nomPalier in palierGroups) {
        const group = palierGroups[nomPalier].sort((a, b) => b.revenu_seuil - a.revenu_seuil);
        if (nomPalier.includes('rentier') && !isRetraite) continue;
        if (nomPalier.includes('modeste') && isRetraite) continue;
        const applicablePalier = group.find(p => revenuNet >= p.revenu_seuil);
        if (applicablePalier) totalDeductions += applicablePalier.deduction_montant;
      }
    }

    return totalDeductions;
  };

  const calculateTax = (revenuImposable: number, bareme: BaremeTranche[]): number => {
    if (!bareme || bareme.length === 0) return 0;
    const validBareme = bareme.filter(b => b.montant_tranche !== undefined && b.montant_tranche !== null).sort((a, b) => a.montant_tranche - b.montant_tranche);
    if (validBareme.length === 0) return 0;

    let applicableTranche = validBareme[0];
    for (let i = 0; i < validBareme.length; i++) {
      if (revenuImposable >= validBareme[i].montant_tranche) applicableTranche = validBareme[i];
      else break;
    }
    return (applicableTranche.montant_base || 0) + (Math.max(0, revenuImposable - applicableTranche.montant_tranche) * (applicableTranche.taux / 100));
  };

  const calculateTaxProportional = (revenu: number, bareme: BaremeTranche[]): number => {
    if (!bareme || bareme.length === 0 || revenu <= 0) return 0;
    const sorted = [...bareme].sort((a, b) => a.montant_tranche - b.montant_tranche);
    let idx = 0;
    for (let i = 0; i < sorted.length; i++) {
      if (revenu >= sorted[i].montant_tranche) idx = i;
      else break;
    }
    const A = sorted[idx].montant_tranche;
    const rA = sorted[idx].taux;
    let rB = rA;
    let B = A;
    if (idx < sorted.length - 1) { rB = sorted[idx + 1].taux; B = sorted[idx + 1].montant_tranche; }
    let rX = rA;
    if (B > A && rB !== rA) { rX = rA + (rB - rA) * ((revenu - A) / (B - A)); }
    return revenu * (rX / 100);
  };

const calculerImpotPrecis = (baseRevenuInput: number, baremeCantonal: BaremeTranche[], baremeFederal: BaremeTranche[], commune: Commune, deductionsFed: DeductionRow[], deductionsCant: DeductionRow[], paliersFed: DeductionPalier[], paliersCant: DeductionPalier[], statut: StatutCivil, nbEnfants: number): ResultatFiscal => {
    const revenuNet = calculateNetIncome(baseRevenuInput);
    const revenuBrut = baseRevenuInput;

    const totalDeductionsFed = calculerTotalDeductions(revenuNet, revenuBrut, deductionsFed, paliersFed, statut, nbEnfants, 0);
    const totalDeductionsCant = calculerTotalDeductions(revenuNet, revenuBrut, deductionsCant, paliersCant, statut, nbEnfants, commune.canton_id);

    const revenuImposableFederal = Math.max(0, Math.round(revenuNet - totalDeductionsFed));
    const revenuImposableCantonal = Math.max(0, Math.round(revenuNet - totalDeductionsCant));

    const diviseur = (statut === 'marie' && CANTON_DIVISEURS[commune.canton_id]) ? CANTON_DIVISEURS[commune.canton_id] : 1;
    const revPourCalculCantonal = revenuImposableCantonal / diviseur;
    
    const rules = CANTON_RULES[commune.canton_id] || {};
    const fallback = CANTON_FALLBACK[commune.canton_id] || {};
    
    const effectiveBaremeCantonal = fallback.hardcodedBareme ? fallback.hardcodedBareme[statut] : baremeCantonal;
    const impotCantonalBaseBrut = rules.useProportionalTax ? calculateTaxProportional(revPourCalculCantonal, effectiveBaremeCantonal) : calculateTax(revPourCalculCantonal, effectiveBaremeCantonal);
    let impotCantonalBase = impotCantonalBaseBrut * diviseur;

    let basePourCantonal = fallback.reductionImpotBase ? impotCantonalBase * fallback.reductionImpotBase : impotCantonalBase;
    
    const effectiveBaremeCommunal = (fallback.hardcodedBaremeCommunal && statut === 'marie') ? fallback.hardcodedBaremeCommunal[statut] : effectiveBaremeCantonal;
    const impotCommunalBaseBrut = rules.useProportionalTax ? calculateTaxProportional(revPourCalculCantonal, effectiveBaremeCommunal) : calculateTax(revPourCalculCantonal, effectiveBaremeCommunal);
    let basePourCommunal = impotCommunalBaseBrut * diviseur;

    if (commune.canton_id === 23 && statut === 'marie') {
      const reduction = Math.min(4900, Math.max(680, basePourCommunal * 0.35));
      basePourCommunal -= reduction;
    }
    
    const effectiveCoeffCantonal = fallback.coeffCantonOverride ?? commune.coeff_revenu_canton;
    const impotCantonal = Math.round(basePourCantonal * (effectiveCoeffCantonal / 100));
    
    let effectiveCoeffCommunal = commune.coeff_revenu_commune;
    if (commune.canton_id === 3 && commune.commune === 'Luzern') { effectiveCoeffCommunal = 145; }
    const impotCommunal = Math.round(basePourCommunal * (effectiveCoeffCommunal / 100));

    let impotParoissial = 0;
    if (religion === 'reforme') impotParoissial = Math.round(basePourCommunal * (commune.coeff_revenu_eglise_reforme / 100));
    if (religion === 'catholique') impotParoissial = Math.round(basePourCommunal * (commune.coeff_revenu_eglise_catholique / 100));

    const impotFederal = Math.round(calculateTax(revenuImposableFederal, baremeFederal));

    const impotICC = impotCantonal + impotCommunal + impotParoissial;

    return {
      revenuNet, totalDeductionsFed: Math.round(totalDeductionsFed), totalDeductionsCant: Math.round(totalDeductionsCant),
      revenuImposableCantonal, revenuImposableFederal, impotCantonal, impotCommunal, impotParoissial, impotFederal,
      impotTotal: impotICC + impotFederal
    };
  };
  
  const handleCompare = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!communeDepart) return alert(t('radar.alert_commune'));
    if (mode === 'comparaison' && !communeArrivee) return alert(t('radar.alert_arrivee'));

    if (communeDepart.canton_id === 13 || (mode === 'comparaison' && communeArrivee?.canton_id === 13)) {
      setIsUnsupported(true); setResultatDepart(null); setResultatArrivee(null); setDifference(null); setLoading(false);
      if (onResultChange) onResultChange(null);
      return;
    }
    setIsUnsupported(false); setLoading(true);

    try {
      const input = totalBrut();
      const statutFilter = `statut.eq.tous,statut.eq.${statutCivil}`;

      const depData = await Promise.all([
        supabase.from('baremes').select('montant_tranche, taux, montant_base').eq('canton_id', communeDepart.canton_id).eq('statut', statutCivil).eq('autorite_fiscale', 'Canton').order('montant_tranche', { ascending: true }),
        supabase.from('baremes').select('montant_tranche, taux, montant_base').eq('canton_id', 0).eq('statut', statutCivil).eq('autorite_fiscale', 'Confédération').order('montant_tranche', { ascending: true }),
        supabase.from('deductions').select('nom_deduction, categorie, montant, pourcent, minimum, maximum, statut, type_impot').eq('canton_id', 0).or(statutFilter),
        supabase.from('deductions').select('nom_deduction, categorie, montant, pourcent, minimum, maximum, statut, type_impot').eq('canton_id', communeDepart.canton_id).or(statutFilter),
        supabase.from('deductions_paliers').select('nom_deduction, categorie, revenu_seuil, deduction_montant, statut, type_impot').eq('canton_id', 0).or(statutFilter),
        supabase.from('deductions_paliers').select('nom_deduction, categorie, revenu_seuil, deduction_montant, statut, type_impot').eq('canton_id', communeDepart.canton_id).or(statutFilter)
      ]);

      const resDep = calculerImpotPrecis(input, depData[0].data as BaremeTranche[], depData[1].data as BaremeTranche[], communeDepart, depData[2].data as DeductionRow[], depData[3].data as DeductionRow[], depData[4].data as DeductionPalier[], depData[5].data as DeductionPalier[], statutCivil, nombreEnfants);
      setResultatDepart(resDep);

      if (mode === 'comparaison' && communeArrivee) {
        const arrData = await Promise.all([
          supabase.from('baremes').select('montant_tranche, taux, montant_base').eq('canton_id', communeArrivee.canton_id).eq('statut', statutCivil).eq('autorite_fiscale', 'Canton').order('montant_tranche', { ascending: true }),
          supabase.from('deductions').select('nom_deduction, categorie, montant, pourcent, minimum, maximum, statut, type_impot').eq('canton_id', communeArrivee.canton_id).or(statutFilter),
          supabase.from('deductions_paliers').select('nom_deduction, categorie, revenu_seuil, deduction_montant, statut, type_impot').eq('canton_id', communeArrivee.canton_id).or(statutFilter)
        ]);

        const resArr = calculerImpotPrecis(input, arrData[0].data as BaremeTranche[], depData[1].data as BaremeTranche[], communeArrivee, depData[2].data as DeductionRow[], arrData[1].data as DeductionRow[], depData[4].data as DeductionPalier[], arrData[2].data as DeductionPalier[], statutCivil, nombreEnfants);
        setResultatArrivee(resArr);
        
        const calculatedDiff = resDep.impotTotal - resArr.impotTotal;
        setDifference(calculatedDiff);
        if (onResultChange) onResultChange(calculatedDiff, { dep: resDep, arr: resArr, depName: communeDepart?.commune, arrName: communeArrivee?.commune });

      } else {
        setResultatArrivee(null); setDifference(null);
        if (onResultChange) onResultChange(null);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erreur inconnue';
      alert('Erreur : ' + message);
    } finally { setLoading(false); }
  };

  const formatCHF = (amount: number | null | undefined): string => {
    if (!amount) return '0';
    return amount.toLocaleString('fr-CH');
  };

  return (
    <div className="radar-container">
      <div className="radar-title-container">
        <h1 className="radar-title">{t('radar.title')}</h1>
        <p className="radar-subtitle">{mode === 'comparaison' ? t('radar.subtitle_compare') : t('radar.subtitle_simple')}</p>
      </div>
      <form onSubmit={handleCompare} className="radar-form">
        <div className="radar-filters base-filters">
          <div className="filter-group">
            <label>{t('radar.revenu_label')}</label>
            <input type="number" placeholder={t('radar.revenu_placeholder')} value={revenuInput} required onChange={(e) => setRevenuInput(e.target.value)} className="form-input" />
            <small className="filter-hint">{t('radar.revenu_hint')}</small>
          </div>
          <div className="filter-group">
            <label>{t('radar.age_label')}</label>
            <select value={classeAge} onChange={(e) => setClasseAge(e.target.value as ClasseAge)} className="form-input">
              <option value="aucune">{t('radar.age_25')}</option>
              <option value="25-34">{t('radar.age_25_34')}</option>
              <option value="35-44">{t('radar.age_35_44')}</option>
              <option value="45-54">{t('radar.age_45_54')}</option>
              <option value="55-65">{t('radar.age_55_65')}</option>
            </select>
            <small className="filter-hint">{t('radar.age_hint')}</small>
          </div>
          <div className="filter-group">
            <label>{t('radar.statut_label')}</label>
            <select value={statutCivil} onChange={(e) => setStatutCivil(e.target.value as StatutCivil)} className="form-input">
              <option value="celibataire">{t('radar.statut_celibataire')}</option>
              <option value="marie">{t('radar.statut_marie')}</option>
            </select>
          </div>
          {statutCivil === 'marie' && (
            <>
              <div className="filter-group">
                <label>{t('radar.conjoint_revenu_label', { type: typeRevenu === 'brut' ? t('radar.brut') : t('radar.net') })}</label>
                <input type="number" min="0" value={revenuConjoint} onChange={(e) => setRevenuConjoint(e.target.value)} className="form-input" />
                <small className="filter-hint">{t('radar.conjoint_revenu_hint')}</small>
              </div>
              <div className="filter-group">
                <label>{t('radar.conjoint_age_label')}</label>
                <select value={classeAgeConjoint} onChange={(e) => setClasseAgeConjoint(e.target.value as ClasseAge)} className="form-input" disabled={!revenuConjoint || parseFloat(revenuConjoint) === 0}>
                  <option value="aucune">{t('radar.age_25')}</option>
                  <option value="25-34">{t('radar.age_25_34')}</option>
                  <option value="35-44">{t('radar.age_35_44')}</option>
                  <option value="45-54">{t('radar.age_45_54')}</option>
                  <option value="55-65">{t('radar.age_55_65')}</option>
                </select>
              </div>
            </>
          )}
          <div className="filter-group">
            <label>{t('radar.religion_label')}</label>
            <select value={religion} onChange={(e) => setReligion(e.target.value as Religion)} className="form-input">
              <option value="aucune">{t('radar.religion_aucune')}</option>
              <option value="reforme">{t('radar.religion_reforme')}</option>
              <option value="catholique">{t('radar.religion_catholique')}</option>
            </select>
          </div>
          <div className="filter-group">
            <label>{t('radar.enfants_label')}</label>
            <input type="number" min="0" value={nombreEnfants} onChange={(e) => setNombreEnfants(parseInt(e.target.value) || 0)} className="form-input" />
          </div>
          {nombreEnfants > 0 && (
            <div className="filter-group">
              <label>{t('radar.garde_label')}</label>
              <input type="number" min="0" value={fraisGarde} onChange={(e) => setFraisGarde(e.target.value)} className="form-input" />
              <small className="filter-hint">{t('radar.garde_hint')}</small>
            </div>
          )}
        </div>
        <button type="button" className="advanced-toggle" onClick={() => setShowAdvanced(!showAdvanced)}>
          {showAdvanced ? t('radar.advanced_hide') : t('radar.advanced_show')}
        </button>
        {showAdvanced && (
          <div className="advanced-options">
            <div className="radar-filters base-filters">
              <div className="filter-group">
                <label>{t('radar.cotisations_label')}</label>
                <input type="number" min="0" value={cotisationsSociales} onChange={(e) => setCotisationsSociales(e.target.value)} className="form-input" />
                <small className="filter-hint">{t('radar.cotisations_hint')}</small>
              </div>
              <div className="filter-group">
                <label>{t('radar.pilier3a_label')}</label>
                <input type="number" min="0" value={pilier3a} onChange={(e) => setPilier3a(e.target.value)} className="form-input" />
                <small className="filter-hint">{t('radar.pilier3a_hint')}</small>
              </div>
              {statutCivil === 'marie' && (
                <div className="filter-group">
                  <label>{t('radar.pilier3a_conjoint_label')}</label>
                  <input type="number" min="0" value={pilier3aConjoint} onChange={(e) => setPilier3aConjoint(e.target.value)} className="form-input" />
                  <small className="filter-hint">{t('radar.pilier3a_conjoint_hint')}</small>
                </div>
              )}
              <div className="filter-group checkbox-group">
                <input type="checkbox" id="isRetraite" checked={isRetraite} onChange={(e) => setIsRetraite(e.target.checked)} className="checkbox-input" />
                <label htmlFor="isRetraite" className="checkbox-label">{t('radar.retraite_label')}</label>
              </div>
            </div>
          </div>
        )}
        <div className={`radar-filters commune-filters ${mode}`}>
          <SearchableSelect label={mode === 'comparaison' ? t('radar.commune_depart_label') : t('radar.commune_simple_label')} emoji="📍" communes={communes} onSelect={setCommuneDepart} />
          {mode === 'comparaison' && <SearchableSelect label={t('radar.commune_arrivee_label')} emoji="🚀" communes={communes} onSelect={setCommuneArrivee} />}
        </div>
        <button className="btn-primary" type="submit" disabled={loading}>
          {loading ? t('radar.calc_loading') : (mode === 'comparaison' ? t('radar.calc_btn_compare') : t('radar.calc_btn_simple'))}
        </button>
      </form>

      {isUnsupported && (
        <div className="result-container simple-result unsupported-result">
          <div className="simple-center">
            <h2 className="unsupported-title">{t('radar.unsupported_title')}</h2>
            <p className="unsupported-text" dangerouslySetInnerHTML={{ __html: t('radar.unsupported_text') }} />
          </div>
        </div>
      )}

      {resultatDepart && (
        mode === 'comparaison' && resultatArrivee && difference !== null ? (
          <div className="result-container">
            <div className={`result-diff-container ${difference > 0 ? 'benefice' : difference < 0 ? 'perte' : 'neutre'}`}>
              {difference > 0 ? (
                <><h2 className="diff-title benefice-text">{t('radar.economy_title')}</h2><h1 className="diff-amount benefice-text">+ {formatCHF(difference)} CHF / an</h1></>
              ) : difference < 0 ? (
                <><h2 className="diff-title perte-text">{t('radar.surcout_title')}</h2><h1 className="diff-amount perte-text">{formatCHF(difference)} CHF / an</h1></>
              ) : (<h2 className="diff-title neutre-text">{t('radar.diff_neutre')}</h2>)}
            </div>

             {/* DIV AVEC CLASSE CSS POUR ESPACER LES RÉSULTATS */}
            <div className="result-spacing-wrapper">
              {/* On affiche les détails des 2 communes DIRECTEMENT, sans demander d'email */}
              <div className="result-row">
                {/* COLONNE COMMUNE DE DÉPART AVEC TOUS LES DÉTAILS */}
                  <div className="result-col">
                    <p className="result-commune-name">{communeDepart?.commune}</p>
                    <p className="result-small-text">{t('radar.revenu_net')} : {formatCHF(resultatDepart.revenuNet)} CHF</p>
                    <p className="result-small-text">{t('radar.deductions_cant')} : - {formatCHF(resultatDepart.totalDeductionsCant)} CHF</p>
                    <p className="result-small-text">{t('radar.revenu_imposable_cant')} : {formatCHF(resultatDepart.revenuImposableCantonal)} CHF</p>
                    <p className="result-small-text">{t('radar.deductions_fed')} : - {formatCHF(resultatDepart.totalDeductionsFed)} CHF</p>
                    <p className="result-small-text">{t('radar.revenu_imposable_fed')} : {formatCHF(resultatDepart.revenuImposableFederal)} CHF</p>
                    <p className="result-small-text">{t('radar.impot_cantonal')} {formatCHF(resultatDepart.impotCantonal)} CHF</p>
                    <p className="result-small-text">{t('radar.impot_communal')} {formatCHF(resultatDepart.impotCommunal)} CHF</p>
                    {resultatDepart.impotParoissial > 0 && <p className="result-small-text">{t('radar.impot_paroissial')} {formatCHF(resultatDepart.impotParoissial)} CHF</p>}
                    <p className="result-small-text">{t('radar.impot_federal')} {formatCHF(resultatDepart.impotFederal)} CHF</p>
                    <h3 className="result-h3">{formatCHF(resultatDepart.impotTotal)} CHF<span className="result-period">{t('radar.periode_an')}</span></h3>
                  </div>

                <div className="result-vs">VS</div>

                {/* COLONNE COMMUNE D'ARRIVÉE AVEC TOUS LES DÉTAILS */}
                  <div className="result-col">
                    <p className="result-commune-name">{communeArrivee?.commune}</p>
                    <p className="result-small-text">{t('radar.revenu_net')} : {formatCHF(resultatArrivee.revenuNet)} CHF</p>
                    <p className="result-small-text">{t('radar.deductions_cant')} : - {formatCHF(resultatArrivee.totalDeductionsCant)} CHF</p>
                    <p className="result-small-text">{t('radar.revenu_imposable_cant')} : {formatCHF(resultatArrivee.revenuImposableCantonal)} CHF</p>
                    <p className="result-small-text">{t('radar.deductions_fed')} : - {formatCHF(resultatArrivee.totalDeductionsFed)} CHF</p>
                    <p className="result-small-text">{t('radar.revenu_imposable_fed')} : {formatCHF(resultatArrivee.revenuImposableFederal)} CHF</p>
                    <p className="result-small-text">{t('radar.impot_cantonal')} {formatCHF(resultatArrivee.impotCantonal)} CHF</p>
                    <p className="result-small-text">{t('radar.impot_communal')} {formatCHF(resultatArrivee.impotCommunal)} CHF</p>
                    {resultatArrivee.impotParoissial > 0 && <p className="result-small-text">{t('radar.impot_paroissial')} {formatCHF(resultatArrivee.impotParoissial)} CHF</p>}
                    <p className="result-small-text">{t('radar.impot_federal')} {formatCHF(resultatArrivee.impotFederal)} CHF</p>
                    <h3 className="result-h3">{formatCHF(resultatArrivee.impotTotal)} CHF<span className="result-period">{t('radar.periode_an')}</span></h3>
                  </div>
              </div>
            </div>

            {onNextStep && (
              <div className="hub-navigation hub-nav-spacing">
                <button className="btn-hub-next" onClick={onNextStep}>
                  {t('radar.next_step')}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="result-container simple-result">
            <div className="simple-center">
              <p className="simple-location-text">{t('radar.result_commune')}</p>
              <h2 className="simple-location-name">{communeDepart?.commune} ({communeDepart?.canton})</h2>
              <div className="simple-box light"><span className="simple-box-label">{t('radar.revenu_net')}</span><h3 className="simple-box-value">{formatCHF(resultatDepart.revenuNet)} CHF</h3></div>
              <div className="simple-box light"><span className="simple-box-label">{t('radar.deductions_cant')}</span><h3 className="simple-box-value">- {formatCHF(resultatDepart.totalDeductionsCant)} CHF</h3></div>
              <div className="simple-box light"><span className="simple-box-label">{t('radar.revenu_imposable_cant')}</span><h3 className="simple-box-value">{formatCHF(resultatDepart.revenuImposableCantonal)} CHF</h3></div>
              <div className="simple-box light secondary"><span className="simple-box-label">{t('radar.deductions_fed')}</span><h3 className="simple-box-value">- {formatCHF(resultatDepart.totalDeductionsFed)} CHF</h3></div>
              <div className="simple-box light secondary"><span className="simple-box-label">{t('radar.revenu_imposable_fed')}</span><h3 className="simple-box-value">{formatCHF(resultatDepart.revenuImposableFederal)} CHF</h3></div>
              <div className="simple-box dark"><span className="simple-box-label-dark">{t('radar.dont_cantonal')}</span><h3 className="simple-box-value-dark">{formatCHF(resultatDepart.impotCantonal)} CHF</h3></div>
              <div className="simple-box dark"><span className="simple-box-label-dark">{t('radar.dont_communal')}</span><h3 className="simple-box-value-dark">{formatCHF(resultatDepart.impotCommunal)} CHF</h3></div>
              {resultatDepart.impotParoissial > 0 && (<div className="simple-box dark"><span className="simple-box-label-dark">{t('radar.dont_paroissial')}</span><h3 className="simple-box-value-dark">{formatCHF(resultatDepart.impotParoissial)} CHF</h3></div>)}
              <div className="simple-box dark"><span className="simple-box-label-dark">{t('radar.dont_federal')}</span><h3 className="simple-box-value-dark">{formatCHF(resultatDepart.impotFederal)} CHF</h3></div>
              <div className="simple-box total-box"><span className="simple-box-label-dark">{t('radar.total_impot')}</span><h2 className="simple-box-value-dark">{formatCHF(resultatDepart.impotTotal)} CHF</h2></div>
              <div className="taux-effectif">{t('radar.taux_effectif')}<strong>{((resultatDepart.impotTotal / (totalBrut() || 1)) * 100).toFixed(2)}%</strong></div>
            </div>
          </div>
        )
      )}
      
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />

      {/* L'avertissement ne s'affiche que si hideWarning n'est pas vrai (pour éviter les doublons dans le Hub) */}
      {!hideWarning && (
        <div className="avertissement-legal">
          <span className="titre-avertissement">⚖️ {t('hub.warning_title')}</span>
          <span className="texte-avertissement">{t('radar.warning')}</span>
        </div>
      )}
    </div>
  );
};

export default RadarFiscal;