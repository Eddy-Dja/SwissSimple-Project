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

interface DeductionDetail {
  nom: string;
  montant: number;
}

interface ResultatFiscal {
  revenuNet: number;
  totalDeductionsFed: number;
  totalDeductionsCant: number;
  detailsDeductionsFed: DeductionDetail[];
  detailsDeductionsCant: DeductionDetail[];
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
type ClasseAge = 'aucune' | '25-34' | '35-44' | '45-54' | '55-65' | '65-70-actif' | '65-retraite';

// ============================================================
// DICTIONNAIRES DE STRATÉGIES ET DE SECOURS
// ============================================================
type CantonStrategy = {
  couple2RevenusStrategy?: 'LIRE_MAXIMUM' | 'LIRE_MONTANT';
  assuranceStrategy?: 'LIRE_MAXIMUM_COMME_GLOBAL' | 'DOUBLER_MAXIMUM';
  deductionMarieStrategy?: 'MONTANT_GLOBAL_SANS_DOUBLER' | 'DOUBLER_MONTANT';
  useProportionalTax?: boolean;
  familySplittingForSingle?: boolean;
};

const CANTON_RULES: Record<number, CantonStrategy> = {
  3: { familySplittingForSingle: true }, // <-- AJOUTE CECI
  4: { familySplittingForSingle: true }, // <-- AJOUTE CECI (Uri)
  5: { familySplittingForSingle: true }, // <-- AJOUTE CECI
  6: { familySplittingForSingle: true }, // <-- AJOUTE CECI
  7: { familySplittingForSingle: true }, // <-- AJOUTE CECI
  8: { 
    familySplittingForSingle: true 
    // Pas de useProportionalTax, Glarus utilise un barème progressif normal
  },
  10: { 
    assuranceStrategy: 'LIRE_MAXIMUM_COMME_GLOBAL', 
    deductionMarieStrategy: 'MONTANT_GLOBAL_SANS_DOUBLER', 
    useProportionalTax: true,
    familySplittingForSingle: true 
  },
  14: { familySplittingForSingle: true }, // <-- AJOUTE CECI
  21: { familySplittingForSingle: true }, // <-- AJOUTE CECI (Tessin)
  23: { familySplittingForSingle: true }, // <-- AJOUTE CECI (Valais)
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
  26: { fraisProf: { celibataire: 4100, marie: 8200 }, assuranceMaladie: { celibataire: 3400, marie: 6800 }, couple2Revenus: 2700, statut: { celibataire: 2700, marie: 3700 } },
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
  6: { fraisProf: { celibataire: 2689, marie: 5378 }, assuranceMaladie: { celibataire: 5200, marie: 6800 }, couple2Revenus: 3400, statut: { celibataire: 20000, marie: 20000 } },
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
  9: 1.0, 10: 1.0, 11: 1.9, 12: 2.0, 14: 1.9, 15: 1.0, 16: 2.0, 17: 2.0,
  18: 1.9, 19: 2.0, 20: 2.0, 21: 1.0, 22: 1.8, 23: 1.0, 24: 1.923076923, 25: 2.0, 26: 1.0
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
  const { t } = useTranslation();
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
    <div className={`filter-group select-wrapper ${isOpen ? 'is-open' : ''}`} ref={wrapperRef}>
      <label>{label} {emoji}</label>
      <div className="form-input select-trigger" onClick={() => { setIsOpen(!isOpen); setSearch(''); }}>
         <span className={`select-text ${selected ? 'has-value' : ''}`}>
          {selected ? `${selected.commune} (${selected.canton})` : t('radar.choose', '-- Choisir --')}
        </span>
        <span className="select-arrow">▼</span>
      </div>
      {isOpen && (
        <div className="dropdown-container">
          <div className="dropdown-search-wrapper">
            <input type="text" placeholder={t('radar.search_placeholder', 'Rechercher...')} value={search} onChange={(e) => setSearch(e.target.value)} className="form-input dropdown-search-input" autoFocus onClick={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }} />
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
  const [classeAge, setClasseAge] = useState<ClasseAge>('35-44');
  const [classeAgeConjoint, setClasseAgeConjoint] = useState<ClasseAge>('35-44');

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showEnfantOptions, setShowEnfantOptions] = useState(false);
  const [enfantsMineurs, setEnfantsMineurs] = useState(0); // 0-17 ans
  const [enfantsMajeurs, setEnfantsMajeurs] = useState(0); // 18-25 ans en formation
  const nombreEnfants = enfantsMineurs + enfantsMajeurs;

  const [cotisationsSociales, setCotisationsSociales] = useState('12000');
  const [pilier3a, setPilier3a] = useState('0');
  const [pilier3aConjoint, setPilier3aConjoint] = useState('0');
  const [fraisGarde, setFraisGarde] = useState('0');
  const [revenuConjoint, setRevenuConjoint] = useState('100000');

  const [communeDepart, setCommuneDepart] = useState<Commune | null>(null);
  const [communeArrivee, setCommuneArrivee] = useState<Commune | null>(null);

  const [resultatDepart, setResultatDepart] = useState<ResultatFiscal | null>(null);
  const [resultatArrivee, setResultatArrivee] = useState<ResultatFiscal | null>(null);
  const [difference, setDifference] = useState<number | null>(null);
  const [isUnsupported, setIsUnsupported] = useState(false);

  useEffect(() => {
    const fetchCommunes = async (): Promise<void> => {
      const { data, error } = await supabase.from('communes').select('id, commune, canton, canton_id, coeff_revenu_canton, coeff_revenu_commune, coeff_revenu_eglise_reforme, coeff_revenu_eglise_catholique').order('commune').limit(5000);
      
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
    const calcCotis1erPilier = (brut: number, isRetraite: boolean): number => {
      if (isRetraite) return 0; 
      const plafonne = Math.min(brut, PLAFOND_1ER_PILIER);
      return plafonne * 0.053 + plafonne * 0.011 + plafonne * 0.004;
    };

    const SEUIL_LPP = 22680, PLAFOND_LPP_BRUT = 90720, DEDUCTION_COORD = 26460;
    const calcLPP = (brutIndividuel: number, ageClass: ClasseAge): number => {
      if (ageClass === '65-retraite' || ageClass === 'aucune') return 0; // Seul le "Retraité" ne paie plus du tout
      if (brutIndividuel <= SEUIL_LPP) return 0;
      const salaireCoord = Math.max(0, Math.min(brutIndividuel, PLAFOND_LPP_BRUT) - DEDUCTION_COORD);
      // On inclut '65-70-actif' dans le typage et on lui donne le taux de 9% (comme 55-65)
      const tauxLpp: Record<Exclude<ClasseAge, 'aucune' | '65-retraite'>, number> = { 
        '25-34': 0.035, 
        '35-44': 0.05, 
        '45-54': 0.075, 
        '55-65': 0.090,
        '65-70-actif': 0.090 
      };
      return salaireCoord * tauxLpp[ageClass as Exclude<ClasseAge, 'aucune' | '65-retraite'>];
    };

    let cotisAvsAcLaa = 0, cotisLpp = 0;

    if (statutCivil === 'marie') {
      const r1 = parseFloat(revenuInput) || 0, r2 = parseFloat(revenuConjoint) || 0;
      cotisAvsAcLaa = calcCotis1erPilier(r1, classeAge === '65-retraite') + calcCotis1erPilier(r2, classeAgeConjoint === '65-retraite');
      cotisLpp = calcLPP(r1, classeAge) + calcLPP(r2, classeAgeConjoint);
    } else {
      const brut = parseFloat(revenuInput) || 0;
      cotisAvsAcLaa = calcCotis1erPilier(brut, classeAge === '65-retraite');
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

  type DeductionResult = { total: number; details: DeductionDetail[] };

  const calculerTotalDeductions = (revenuNet: number, revenuBrut: number, deductionsData: DeductionRow[], paliersData: DeductionPalier[], statut: StatutCivil, nbMineurs: number, nbMajeurs: number, cantonId: number): DeductionResult => {
    const nbEnfants = nbMineurs + nbMajeurs;
    const netConjoint = getNetConjoint(revenuBrut);
    const isMarie2Revenus = (statut === 'marie' && netConjoint > 0);
    
    // On ajoute le canton 26 (Jura) ici
    if (cantonId === 25 || cantonId === 12 || cantonId === 26 || cantonId === 7 || cantonId === 6 || cantonId === 4 ||
      cantonId === 3 || cantonId === 14 || cantonId === 5 || cantonId === 21 ||
       cantonId === 23 || cantonId === 22 || cantonId === 9 || cantonId === 18) {
      return calculerAvecFallback(deductionsData, statut, nbEnfants, cantonId, isMarie2Revenus, nbMineurs, nbMajeurs, revenuNet);
    }
    return calculerGenerique(deductionsData, paliersData, statut, nbEnfants, nbMineurs, nbMajeurs, revenuNet, revenuBrut, cantonId);
  };

  const calculerAvecFallback = (deductionsData: DeductionRow[], statut: StatutCivil, nbEnfants: number, cantonId: number, isMarie2Revenus: boolean, nbMineurs: number, _nbMajeurs: number, revenuNet: number): DeductionResult => {
    let totalDeductions = 0;
    let details: DeductionDetail[] = [];
    
    // ==========================================
    // LOGIQUE SPÉCIFIQUE JURA (26)
    // ==========================================
    if (cantonId === 26) {
      const fraisProf = statut === 'marie' ? 8200 : 4100;
      totalDeductions += fraisProf;
      details.push({ nom: 'Frais professionnels', montant: fraisProf });

      const assBase = statut === 'marie' ? 6800 : 3400;
      let totalAss = assBase;
      if (nbEnfants > 0) totalAss += 1020 * nbEnfants; // Bonus assurance enfant Jura
      totalDeductions += totalAss;
      details.push({ nom: 'Primes assurances et intérêts', montant: totalAss });

      // Le Jura donne 2700 pour les couples à 2 revenus ET 2700 pour les parents seuls
      if (isMarie2Revenus) {
        totalDeductions += 2700;
        details.push({ nom: 'Couple à deux revenus', montant: 2700 });
      } else if (statut === 'celibataire' && nbEnfants > 0) {
        totalDeductions += 2700;
        details.push({ nom: 'Déduction pour famille monoparentale', montant: 2700 });
      }

      if (statut === 'marie') {
        totalDeductions += 3700;
        details.push({ nom: 'Déductions de statut', montant: 3700 });
      }

      if (nbEnfants > 0) {
        // Loi Jura : 6400 par enfant dès le 3ème, sinon 5700
        const montEnfant = nbEnfants >= 3 ? 6400 : 5700;
        const v = montEnfant * nbEnfants;
        totalDeductions += v;
        details.push({ nom: 'Déductions pour enfants', montant: v });
      }

      const max3a = deductionsData.find(d => d.categorie === 'pilier_3a_max_avec')?.maximum || 0;
      if (max3a > 0) {
        let total3a = Math.min(parseFloat(pilier3a) || 0, max3a);
        if (statut === 'marie') total3a += Math.min(parseFloat(pilier3aConjoint) || 0, max3a);
        if (total3a > 0) {
          totalDeductions += total3a;
          details.push({ nom: 'Pilier 3a', montant: total3a });
        }
      }

      return { total: totalDeductions, details };
    }

    // ==========================================
    // LOGIQUE SPÉCIFIQUE LUCERNE (3)
    // ==========================================
    if (cantonId === 3) {
      const fraisProf = statut === 'marie' ? 5378 : 2689;
      totalDeductions += fraisProf;
      details.push({ nom: 'Frais professionnels', montant: fraisProf });

      // 5200 pour marié, 2600 pour célibataire + 700 par enfant
      const assBase = statut === 'marie' ? 5200 : 2600;
      let totalAss = assBase;
      if (nbEnfants > 0) totalAss += 700 * nbEnfants;
      totalDeductions += totalAss;
      details.push({ nom: 'Primes assurances et intérêts', montant: totalAss });

      if (isMarie2Revenus) {
        totalDeductions += 5000;
        details.push({ nom: 'Couple à deux revenus', montant: 5000 });
      }

      if (nbEnfants > 0) {
        // Loi Lucerne : 8000 par enfant (déduction principale) + 2000 par enfant (Eigenbetreuung/garde)
        const mainEnfant = 8000 * nbEnfants;
        const eigenbetreuung = 2000 * nbEnfants;
        const totalEnfant = mainEnfant + eigenbetreuung;
        totalDeductions += totalEnfant;
        details.push({ nom: 'Déductions pour enfants', montant: totalEnfant });
      }

      const max3a = deductionsData.find(d => d.categorie === 'pilier_3a_max_avec')?.maximum || 0;
      if (max3a > 0) {
        let total3a = Math.min(parseFloat(pilier3a) || 0, max3a);
        if (statut === 'marie') total3a += Math.min(parseFloat(pilier3aConjoint) || 0, max3a);
        if (total3a > 0) {
          totalDeductions += total3a;
          details.push({ nom: 'Pilier 3a', montant: total3a });
        }
      }

      return { total: totalDeductions, details };
    }

    // ==========================================
    // LOGIQUE SPÉCIFIQUE OBWALDEN (6)
    // ==========================================
    if (cantonId === 6) {
      const fraisProf = statut === 'marie' ? 5378 : 2689;
      totalDeductions += fraisProf;
      details.push({ nom: 'Frais professionnels', montant: fraisProf });

      const assBase = statut === 'marie' ? 6800 : 5200;
      totalDeductions += assBase;
      details.push({ nom: 'Primes assurances et intérêts', montant: assBase });

      if (isMarie2Revenus) {
        totalDeductions += 3400;
        details.push({ nom: 'Couple à deux revenus', montant: 3400 });
      }

      // Obwalden a 10'000 de base + 10'000 social pour les mariés ET les parents seuls
      let statutDed = 0;
      if (statut === 'marie' || (statut === 'celibataire' && nbEnfants > 0)) {
        statutDed = 20000;
      } else {
        statutDed = 10000;
      }
      totalDeductions += statutDed;
      details.push({ nom: 'Déductions de statut', montant: statutDed });

      if (nbEnfants > 0) {
        const v = 6200 * nbEnfants;
        totalDeductions += v;
        details.push({ nom: 'Déductions pour enfants', montant: v });

        // Sonderabzug : 10% de la différence entre 100'000 et le Reineinkommen
        const reineinkommen = revenuNet - fraisProf - assBase;
        if (reineinkommen < 100000) {
          const sonderabzug = Math.round((100000 - reineinkommen) * 0.10);
          totalDeductions += sonderabzug;
          details.push({ nom: 'Sonderabzug (Revenu modeste)', montant: sonderabzug });
        }
      }

      const max3a = deductionsData.find(d => d.categorie === 'pilier_3a_max_avec')?.maximum || 0;
      if (max3a > 0) {
        let total3a = Math.min(parseFloat(pilier3a) || 0, max3a);
        if (statut === 'marie') total3a += Math.min(parseFloat(pilier3aConjoint) || 0, max3a);
        if (total3a > 0) {
          totalDeductions += total3a;
          details.push({ nom: 'Pilier 3a', montant: total3a });
        }
      }

      return { total: totalDeductions, details };
    }

    // ==========================================
    // LOGIQUE SPÉCIFIQUE SCHAFFHAUSEN (14)
    // ==========================================
    if (cantonId === 14) {
      const fraisProf = statut === 'marie' ? 5378 : 2689;
      totalDeductions += fraisProf;
      details.push({ nom: 'Frais professionnels', montant: fraisProf });

      // 7500 pour marié, 3750 pour célibataire + 1000 par enfant
      const assBase = statut === 'marie' ? 7500 : 3750;
      let totalAss = assBase;
      if (nbEnfants > 0) totalAss += 1000 * nbEnfants;
      totalDeductions += totalAss;
      details.push({ nom: 'Primes assurances et intérêts', montant: totalAss });

      if (isMarie2Revenus) {
        totalDeductions += 800;
        details.push({ nom: 'Couple à deux revenus', montant: 800 });
      }

      if (nbEnfants > 0) {
        const mainEnfant = 8400 * nbEnfants;
        totalDeductions += mainEnfant;
        details.push({ nom: 'Déductions pour enfants', montant: mainEnfant });

        // Déduction pour enfants d'âge préscolaire (3'000 CHF par enfant mineur)
        const prescolaire = 3000 * nbMineurs;
        if (prescolaire > 0) {
          totalDeductions += prescolaire;
          details.push({ nom: 'Enfants d\'âge préscolaire', montant: prescolaire });
        }
      }

      const max3a = deductionsData.find(d => d.categorie === 'pilier_3a_max_avec')?.maximum || 0;
      if (max3a > 0) {
        let total3a = Math.min(parseFloat(pilier3a) || 0, max3a);
        if (statut === 'marie') total3a += Math.min(parseFloat(pilier3aConjoint) || 0, max3a);
        if (total3a > 0) {
          totalDeductions += total3a;
          details.push({ nom: 'Pilier 3a', montant: total3a });
        }
      }

      return { total: totalDeductions, details };
    }
        // ==========================================
    // LOGIQUE SPÉCIFIQUE NIDWALDEN (7)
    // ==========================================
    if (cantonId === 7) {
      const fraisProf = statut === 'marie' ? 8966 : 4483;
      totalDeductions += fraisProf;
      details.push({ nom: 'Frais professionnels', montant: fraisProf });

      // 3700 pour marié, 1800 pour célibataire + 700 par enfant
      const assBase = statut === 'marie' ? 3700 : 1800;
      let totalAss = assBase;
      if (nbEnfants > 0) totalAss += 700 * nbEnfants;
      totalDeductions += totalAss;
      details.push({ nom: 'Primes assurances et intérêts', montant: totalAss });

      if (isMarie2Revenus) {
        totalDeductions += 1200;
        details.push({ nom: 'Couple à deux revenus', montant: 1200 });
      }

      if (nbEnfants > 0) {
        // Loi Nidwalden : 6400 par enfant (déduction principale) + 3200 par enfant de moins de 14 ans (Eigenbetreuung)
        const mainEnfant = 6400 * nbEnfants;
        const eigenbetreuung = 3200 * nbMineurs;
        const totalEnfant = mainEnfant + eigenbetreuung;
        totalDeductions += totalEnfant;
        details.push({ nom: 'Déductions pour enfants', montant: totalEnfant });
      }

      const max3a = deductionsData.find(d => d.categorie === 'pilier_3a_max_avec')?.maximum || 0;
      if (max3a > 0) {
        let total3a = Math.min(parseFloat(pilier3a) || 0, max3a);
        if (statut === 'marie') total3a += Math.min(parseFloat(pilier3aConjoint) || 0, max3a);
        if (total3a > 0) {
          totalDeductions += total3a;
          details.push({ nom: 'Pilier 3a', montant: total3a });
        }
      }

      return { total: totalDeductions, details };
    }

    // ==========================================
    // LOGIQUE SPÉCIFIQUE SCHWYZ (5)
    // ==========================================
    if (cantonId === 5) {
      const fraisProf = statut === 'marie' ? 13800 : 6900;
      totalDeductions += fraisProf;
      details.push({ nom: 'Frais professionnels', montant: fraisProf });

      // 8400 pour marié, 4200 pour célibataire + 500 par enfant
      const assBase = statut === 'marie' ? 8400 : 4200;
      let totalAss = assBase;
      if (nbEnfants > 0) totalAss += 500 * nbEnfants;
      totalDeductions += totalAss;
      details.push({ nom: 'Primes assurances et intérêts', montant: totalAss });

      if (isMarie2Revenus) {
        totalDeductions += 2100;
        details.push({ nom: 'Couple à deux revenus', montant: 2100 });
      }

      // Statut (8400 marié, 4200 célibataire + 7800 si parent seul)
      let statutDed = 0;
      if (statut === 'marie') {
        statutDed = 8400;
      } else {
        statutDed = 4200;
        if (nbEnfants > 0) statutDed += 7800; // Déduction famille monoparentale
      }
      totalDeductions += statutDed;
      details.push({ nom: 'Déductions de statut', montant: statutDed });

      if (nbEnfants > 0) {
        const v = 10000 * nbEnfants;
        totalDeductions += v;
        details.push({ nom: 'Déductions pour enfants', montant: v });
      }

      // Entlastungsabzug (Déduction sociale supplémentaire)
      // Calculé sur le revenu AVANT les déductions sociales (enfants/statut)
      const reineinkommen = revenuNet - fraisProf - totalAss - (isMarie2Revenus ? 2100 : 0);
      const limit = (statut === 'marie' ? 70000 : 35000) + (25000 * nbEnfants);
      const bemessungsgrundlage = limit - reineinkommen;
      if (bemessungsgrundlage > 0) {
        const entlastungsabzug = Math.round(bemessungsgrundlage * 0.30);
        totalDeductions += entlastungsabzug;
        details.push({ nom: 'Déduction sociale supplémentaire', montant: entlastungsabzug });
      }

      const max3a = deductionsData.find(d => d.categorie === 'pilier_3a_max_avec')?.maximum || 0;
      if (max3a > 0) {
        let total3a = Math.min(parseFloat(pilier3a) || 0, max3a);
        if (statut === 'marie') total3a += Math.min(parseFloat(pilier3aConjoint) || 0, max3a);
        if (total3a > 0) {
          totalDeductions += total3a;
          details.push({ nom: 'Pilier 3a', montant: total3a });
        }
      }

      return { total: totalDeductions, details };
    }

        // ==========================================
    // LOGIQUE SPÉCIFIQUE TICINO (21)
    // ==========================================
    if (cantonId === 21) {
      // 3000 par personne (forfait fixe tessinois)
      const fraisProf = statut === 'marie' ? 6000 : 3000;
      totalDeductions += fraisProf;
      details.push({ nom: 'Frais professionnels', montant: fraisProf });

      // 10900 pour marié, 5500 pour célibataire + 1200 par enfant
      const assBase = statut === 'marie' ? 10900 : 5500;
      let totalAss = assBase;
      if (nbEnfants > 0) totalAss += 1200 * nbEnfants;
      totalDeductions += totalAss;
      details.push({ nom: 'Primes assurances et intérêts', montant: totalAss });

      if (isMarie2Revenus) {
        totalDeductions += 8100;
        details.push({ nom: 'Couple à deux revenus', montant: 8100 });
      }

      if (nbEnfants > 0) {
        const v = 11500 * nbEnfants;
        totalDeductions += v;
        details.push({ nom: 'Déductions pour enfants', montant: v });
      }

      const max3a = deductionsData.find(d => d.categorie === 'pilier_3a_max_avec')?.maximum || 0;
      if (max3a > 0) {
        let total3a = Math.min(parseFloat(pilier3a) || 0, max3a);
        if (statut === 'marie') total3a += Math.min(parseFloat(pilier3aConjoint) || 0, max3a);
        if (total3a > 0) {
          totalDeductions += total3a;
          details.push({ nom: 'Pilier 3a', montant: total3a });
        }
      }

      return { total: totalDeductions, details };
    }

        // ==========================================
    // LOGIQUE SPÉCIFIQUE URI (4)
    // ==========================================
    if (cantonId === 4) {
      const fraisProf = statut === 'marie' ? 5378 : 2689;
      totalDeductions += fraisProf;
      details.push({ nom: 'Frais professionnels', montant: fraisProf });

      // 3700 pour marié, 1800 pour célibataire + 700 par enfant
      const assBase = statut === 'marie' ? 3700 : 1800;
      let totalAss = assBase;
      if (nbEnfants > 0) totalAss += 700 * nbEnfants;
      totalDeductions += totalAss;
      details.push({ nom: 'Primes assurances et intérêts', montant: totalAss });

      if (isMarie2Revenus) {
        totalDeductions += 3700;
        details.push({ nom: 'Couple à deux revenus', montant: 3700 });
      }

      // Uri a 26900 pour marié, 21200 pour parent seul, 15300 pour célibataire
      let statutDed = 0;
      if (statut === 'marie') {
        statutDed = 26900;
      } else {
        statutDed = nbEnfants > 0 ? 21200 : 15300;
      }
      totalDeductions += statutDed;
      details.push({ nom: 'Déductions de statut', montant: statutDed });

      if (nbEnfants > 0) {
        const v = 8500 * nbEnfants;
        totalDeductions += v;
        details.push({ nom: 'Déductions pour enfants', montant: v });
      }

      const max3a = deductionsData.find(d => d.categorie === 'pilier_3a_max_avec')?.maximum || 0;
      if (max3a > 0) {
        let total3a = Math.min(parseFloat(pilier3a) || 0, max3a);
        if (statut === 'marie') total3a += Math.min(parseFloat(pilier3aConjoint) || 0, max3a);
        if (total3a > 0) {
          totalDeductions += total3a;
          details.push({ nom: 'Pilier 3a', montant: total3a });
        }
      }

      return { total: totalDeductions, details };
    }

    // ==========================================
    // LOGIQUE SPÉCIFIQUE VALAIS (23)
    // ==========================================
    if (cantonId === 23) {
      const fraisProf = statut === 'marie' ? 5378 : 2689;
      totalDeductions += fraisProf;
      details.push({ nom: 'Frais professionnels', montant: fraisProf });

      // 7600 pour marié, 3800 pour célibataire + 1130 par enfant
      const assBase = statut === 'marie' ? 7600 : 3800;
      let totalAss = assBase;
      if (nbEnfants > 0) totalAss += 1130 * nbEnfants;
      totalDeductions += totalAss;
      details.push({ nom: 'Primes assurances et intérêts', montant: totalAss });

      if (isMarie2Revenus) {
        totalDeductions += 7000;
        details.push({ nom: 'Couple à deux revenus', montant: 7000 });
      }

      if (nbEnfants > 0) {
        // Approximation: 8940 par enfant (6-15 ans)
        const mainEnfant = 8940 * nbEnfants;
        totalDeductions += mainEnfant;
        details.push({ nom: 'Déductions pour enfants', montant: mainEnfant });

        // Garde des enfants (3130 par enfant)
        const garde = 3130 * nbEnfants;
        totalDeductions += garde;
        details.push({ nom: 'Garde des enfants', montant: garde });

        // Bonus dès 3 enfants (1240 par enfant dès le 3ème)
        if (nbEnfants >= 3) {
          const bonus = 1240 * (nbEnfants - 2);
          totalDeductions += bonus;
          details.push({ nom: 'Bonus dès 3 enfants', montant: bonus });
        }
      }

      const max3a = deductionsData.find(d => d.categorie === 'pilier_3a_max_avec')?.maximum || 0;
      if (max3a > 0) {
        let total3a = Math.min(parseFloat(pilier3a) || 0, max3a);
        if (statut === 'marie') total3a += Math.min(parseFloat(pilier3aConjoint) || 0, max3a);
        if (total3a > 0) {
          totalDeductions += total3a;
          details.push({ nom: 'Pilier 3a', montant: total3a });
        }
      }

      return { total: totalDeductions, details };
    }

    // ==========================================
    // LOGIQUE SPÉCIFIQUE VAUD (22)
    // ==========================================
    if (cantonId === 22) {
      const fraisProf = statut === 'marie' ? 5378 : 2689;
      totalDeductions += fraisProf;
      details.push({ nom: 'Frais professionnels', montant: fraisProf });

      // L'AFC utilise des forfaits fixes de 4560 / 9120 + 1200 par enfant
      const assBase = statut === 'marie' ? 9120 : 4560;
      let totalAss = assBase;
      if (nbEnfants > 0) totalAss += 1200 * nbEnfants;
      totalDeductions += totalAss;
      details.push({ nom: 'Primes assurances et intérêts', montant: totalAss });

      if (isMarie2Revenus) {
        totalDeductions += 1700;
        details.push({ nom: 'Couple à deux revenus', montant: 1700 });
      }

      // Art 39 LI (Déduction pour le logement - L'AFC ne la donne par défaut qu'aux parents seuls)
      if (statut === 'celibataire' && nbEnfants > 0) {
        const logement = 6800;
        totalDeductions += logement;
        details.push({ nom: 'Déduction pour le logement', montant: logement });
      }

      // Art 42a LI (Déduction pour famille)
      if (nbEnfants > 0) {
        const famBase = statut === 'marie' ? 1300 : 2800;
        const totalFam = famBase + (1000 * nbEnfants);
        totalDeductions += totalFam;
        details.push({ nom: 'Déduction pour famille', montant: totalFam });
      }

      // Art 42 LI (Déduction pour contribuable à revenu modeste)
      let baseModeste = 17000;
      let limitModeste = 17099;
      if (statut === 'marie') {
        baseModeste += 5700; limitModeste += 5700;
      } else if (statut === 'celibataire' && nbEnfants > 0) {
        baseModeste += 3200; limitModeste += 3200;
      }
      if (nbEnfants > 0) {
        baseModeste += 3500 * nbEnfants;
        limitModeste += 3500 * nbEnfants;
      }
      
      const incomeForModeste = revenuNet - (isMarie2Revenus ? 1700 : 0) - (statut === 'celibataire' && nbEnfants > 0 ? 6800 : 0);
      if (incomeForModeste > limitModeste) {
        const diff = incomeForModeste - limitModeste;
        const reduction = Math.floor(diff / 200) * 100;
        const dedModeste = Math.max(0, baseModeste - reduction);
        if (dedModeste > 0) {
          totalDeductions += dedModeste;
          details.push({ nom: 'Déduction pour revenu modeste', montant: dedModeste });
        }
      } else {
        totalDeductions += baseModeste;
        details.push({ nom: 'Déduction pour revenu modeste', montant: baseModeste });
      }

            // --- Rajouter ceci avant le return de VAUD ---
      const max3a = deductionsData.find(d => d.categorie === 'pilier_3a_max_avec')?.maximum || 0;
      if (max3a > 0) {
        let total3a = Math.min(parseFloat(pilier3a) || 0, max3a);
        if (statut === 'marie') total3a += Math.min(parseFloat(pilier3aConjoint) || 0, max3a);
        if (total3a > 0) {
          totalDeductions += total3a;
          details.push({ nom: 'Pilier 3a', montant: total3a });
        }
      }

      return { total: totalDeductions, details };
    }

        // ==========================================
    // LOGIQUE SPÉCIFIQUE ZOUG (9)
    // ==========================================
    if (cantonId === 9) {
      const fraisProf = statut === 'marie' ? 5378 : 2689;
      totalDeductions += fraisProf;
      details.push({ nom: 'Frais professionnels', montant: fraisProf });

      // 9120 pour marié, 4560 pour célibataire + 1200 par enfant
      const assBase = statut === 'marie' ? 9120 : 4560;
      let totalAss = assBase;
      if (nbEnfants > 0) totalAss += 1200 * nbEnfants;
      totalDeductions += totalAss;
      details.push({ nom: 'Primes assurances et intérêts', montant: totalAss });

      if (isMarie2Revenus) {
        totalDeductions += 4600;
        details.push({ nom: 'Couple à deux revenus', montant: 4600 });
      }

      // Logement (Mieterabzug)
      const logement = statut === 'marie' ? 10800 : 6726;
      totalDeductions += logement;
      details.push({ nom: 'Déduction pour le logement', montant: logement });

      // Statut (Persönlicher Abzug)
      let statutDed = (statut === 'marie' || (statut === 'celibataire' && nbEnfants > 0)) ? 24000 : 12000;
      totalDeductions += statutDed;
      details.push({ nom: 'Déductions de statut', montant: statutDed });

      if (nbEnfants > 0) {
        // 12600 (base) + 12200 (Eigenbetreuung) par enfant
        const totalEnfant = 24800 * nbEnfants;
        totalDeductions += totalEnfant;
        details.push({ nom: 'Déductions pour enfants', montant: totalEnfant });
      }

          
      const max3a = deductionsData.find(d => d.categorie === 'pilier_3a_max_avec')?.maximum || 0;
      if (max3a > 0) {
        let total3a = Math.min(parseFloat(pilier3a) || 0, max3a);
        if (statut === 'marie') total3a += Math.min(parseFloat(pilier3aConjoint) || 0, max3a);
        if (total3a > 0) {
          totalDeductions += total3a;
          details.push({ nom: 'Pilier 3a', montant: total3a });
        }
      }

      return { total: totalDeductions, details };
    }

        // ==========================================
    // LOGIQUE SPÉCIFIQUE GRAUBÜNDEN (18)
    // ==========================================
    if (cantonId === 18) {
      const fraisProf = statut === 'marie' ? 6600 : 3300;
      totalDeductions += fraisProf;
      details.push({ nom: t('radar.frais_prof'), montant: fraisProf });

      // 9200 pour marié, 4600 pour célibataire + 1000 par enfant
      const assBase = statut === 'marie' ? 9200 : 4600;
      let totalAss = assBase;
      if (nbEnfants > 0) totalAss += 1000 * nbEnfants;
      totalDeductions += totalAss;
      details.push({ nom: t('radar.assurances'), montant: totalAss });

      if (isMarie2Revenus) {
        totalDeductions += 2200;
        details.push({ nom: t('radar.couple_2_rev'), montant: 2200 });
      }

      if (nbEnfants > 0) {
        // 13700 par enfant (âge scolaire / formation)
        const v = 13700 * nbEnfants;
        totalDeductions += v;
        details.push({ nom: t('radar.enfants'), montant: v });
      }

      // --- Pilier 3a ---
      const max3a = deductionsData.find(d => d.categorie === 'pilier_3a_max_avec')?.maximum || 0;
      if (max3a > 0) {
        let total3a = Math.min(parseFloat(pilier3a) || 0, max3a);
        if (statut === 'marie') total3a += Math.min(parseFloat(pilier3aConjoint) || 0, max3a);
        if (total3a > 0) {
          totalDeductions += total3a;
          details.push({ nom: t('radar.pilier_3a'), montant: total3a });
        }
      }

      return { total: totalDeductions, details };
    }
    
    // ==========================================
    // LOGIQUE DES AUTRES CANTONS (Inchangée)
    // ==========================================
    const validDeds = deductionsData.filter(isRevenuDeduction);
    const fallback = CANTON_FALLBACK[cantonId];

    if (fallback?.fraisProf) {
      const v = statut === 'marie' ? fallback.fraisProf.marie : fallback.fraisProf.celibataire;
      totalDeductions += v; details.push({ nom: 'Frais professionnels', montant: v });
    }
    if (fallback?.assuranceMaladie) {
      const v = statut === 'marie' ? fallback.assuranceMaladie.marie : fallback.assuranceMaladie.celibataire;
      totalDeductions += v; details.push({ nom: 'Primes assurances et intérêts', montant: v });
    }
    if (fallback?.couple2Revenus && isMarie2Revenus) {
      const v = fallback.couple2Revenus;
      totalDeductions += v; details.push({ nom: 'Couple à deux revenus', montant: v });
    }
    
    if (fallback?.statut) {
      let v = statut === 'marie' ? fallback.statut.marie : fallback.statut.celibataire;
      let nomStatut = 'Déductions de statut';
      
      if (statut === 'celibataire' && nbEnfants > 0) {
        const parentRow = validDeds.find(d => 
          d.categorie === 'deduction_statut' && 
          (d.nom_deduction.toLowerCase().includes('monoparentale') || d.nom_deduction.toLowerCase().includes('alleinerziehend') || d.nom_deduction.toLowerCase().includes('isolé'))
        );
        if (parentRow) {
          v = parentRow.maximum > 0 ? parentRow.maximum : (parentRow.montant > 0 ? parentRow.montant : v);
          nomStatut = parentRow.nom_deduction;
        }
      }
      totalDeductions += v; details.push({ nom: nomStatut, montant: v });
    }

    if (nbEnfants > 0) {
      const enfantRow = validDeds.find(d => d.categorie === 'deduction_enfant' && (d.statut === 'tous' || d.statut === statut));
      if (enfantRow) {
        let amount = enfantRow.maximum > 0 ? enfantRow.maximum : (enfantRow.montant > 0 ? enfantRow.montant : 0);
        const v = amount * nbEnfants;
        totalDeductions += v; details.push({ nom: 'Déductions pour enfants', montant: v });
      }
    }

    const max3a = validDeds.find(d => d.categorie === 'pilier_3a_max_avec')?.maximum || 0;
    if (max3a > 0) {
      let total3a = Math.min(parseFloat(pilier3a) || 0, max3a);
      if (statut === 'marie') total3a += Math.min(parseFloat(pilier3aConjoint) || 0, max3a);
      if (total3a > 0) { totalDeductions += total3a; details.push({ nom: 'Pilier 3a', montant: total3a }); }
    }
    return { total: totalDeductions, details };
  };  
  
     const calculerGenerique = (deductionsData: DeductionRow[], paliersData: DeductionPalier[], statut: StatutCivil, nbEnfants: number, nbMineurs: number, nbMajeurs: number, revenuNet: number, revenuBrut: number, cantonId: number): DeductionResult => {
    let totalDeductions = 0;
    let details: DeductionDetail[] = [];
    let maxDeductionEnfantMineur = 0;
    let maxDeductionEnfantMajeur = 0;
    const rules = CANTON_RULES[cantonId] || {};
    const netConjoint = getNetConjoint(revenuBrut);
    let validDeds = deductionsData.filter(isRevenuDeduction);

    const isMarie2Revenus = (statut === 'marie' && netConjoint > 0);
    const netPrincipal = Math.max(0, revenuNet - netConjoint);
    const plusPetitRevenu = Math.min(netPrincipal, netConjoint);

    let maxAssurance = 0, totalProf = 0, maxCouple = 0, maxStatut = 0, max3a = 0, maxAssuranceEnfant = 0, maxDeductionEnfant = 0, totalGarde = 0;

    if (nbEnfants > 0 && cantonId === 10) {
      const limiteRevenu = 62700 + (10100 * (nbEnfants - 1));
      let deductionEnfantTotale = 0;
      for (let i = 1; i <= nbEnfants; i++) {
        let base = i >= 3 ? 9600 : 8600;
        let min = i >= 3 ? 8100 : 7100;
        if (revenuNet > limiteRevenu) {
          const tranches = Math.floor((revenuNet - limiteRevenu) / 1000);
          base = Math.max(min, base - (tranches * 100));
        }
        deductionEnfantTotale += base;
      }
      maxDeductionEnfant = deductionEnfantTotale;
      validDeds = validDeds.filter(d => d.categorie !== 'deduction_enfant');
    }

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
          maxAssurance += amount; 
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
            
            // CORRECTION : Approximation des frais professionnels (3% plafonné à 4000) pour se rapprocher de l'AFC
            const approxFraisProf = Math.min(plusPetitRevenu * 0.03, 4000);
            let calcAmount = ded.pourcent > 0 ? Math.floor((plusPetitRevenu - approxFraisProf) * (ded.pourcent / 100)) : 0;
            calcAmount *= 2; 
            
            let forfait = Math.max(amount, calcAmount, minAmount);
            if (maxCap > 0) forfait = Math.min(forfait, maxCap);
            maxCouple = Math.max(maxCouple, forfait);
          }
          break;
        }
        case 'deduction_enfant': {
          if (nbEnfants > 0 && cantonId !== 10) { 
            const nom = ded.nom_deduction.toLowerCase();
            let amount = ded.montant > 0 ? ded.montant : (ded.minimum > 0 ? ded.minimum : 0);
            let maxCap = ded.maximum > 0 ? ded.maximum : 0;
            if (amount === 0 && maxCap > 0) amount = maxCap;
            const val = maxCap > 0 ? Math.min(amount, maxCap) : amount;

            const isMajor = nom.includes('adulte') || nom.includes('majeur') || nom.includes('formation') || nom.includes('18') || nom.includes('25');
            
            if (isMajor) {
              maxDeductionEnfantMajeur = Math.max(maxDeductionEnfantMajeur, val);
            } else {
              if (maxDeductionEnfantMineur === 0 || val < maxDeductionEnfantMineur) {
                maxDeductionEnfantMineur = val;
              }
            }
          }
          break;
        }
         case 'pilier_3a_max_avec': {
          max3a = ded.maximum;
          break;
        }
        case 'pilier_3a_max_sans': {
          if (max3a === 0) max3a = ded.maximum; 
          break;
        }
        case 'deduction_statut': {
          const nom = ded.nom_deduction.toLowerCase();
          const isUserRetraite = classeAge === '65-retraite' || classeAgeConjoint === '65-retraite';
          const isParentSeul = statut === 'celibataire' && nbEnfants > 0;
          const isParentSeulDeduction = nom.includes('monoparentale') || nom.includes('alleinerziehend') || nom.includes('isolé') || nom.includes('seul avec enfant');
          const isRegularCelibataireDeduction = !isParentSeulDeduction && (nom.includes('célibataire') || nom.includes('celibataire') || nom.includes('ledig') || nom.includes('alleinstehend'));

          if (isParentSeul && isRegularCelibataireDeduction) break;

          if (nom.includes('rentier')) {
            if (!isUserRetraite) break; 
          } 
          else if (nom.includes('social') || nom.includes('modeste')) {
            // On laisse passer
          }
          if (nom.includes('enfant') && nbEnfants === 0) break;
          if (ded.statut === 'tous' && ded.montant === 0 && ded.minimum === 0 && ded.maximum === 0) break;
          
          let amount = ded.montant > 0 ? ded.montant : (ded.minimum > 0 ? ded.minimum : 0);
          let maxCap = ded.maximum > 0 ? ded.maximum : 0;
          if (amount === 0 && ded.pourcent === 0 && ded.minimum === 0 && maxCap > 0) amount = maxCap;
          
          if (rules.deductionMarieStrategy === 'DOUBLER_MONTANT' && isMarie2Revenus) {
            amount *= 2;
            if (maxCap > 0) amount = Math.min(amount, maxCap * 2);
          }
          
          maxStatut = Math.max(maxStatut, amount); 
          break;
        }

        default: {
          const nom = (ded.nom_deduction || '').toLowerCase();
          if ((nom.includes('enfant') || nom.includes('formation')) && nbEnfants === 0) break;
          
          // CORRECTION CRITIQUE GLARUS : Empêcher le double compte des frais de formation externes
          if (nom.includes('formation') && nom.includes('enfant')) break;
          
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
            details.push({ nom: ded.nom_deduction, montant: amount });
          }
          break;
        }
      }
    }

    if (totalProf > 0) { totalDeductions += totalProf; details.push({ nom: t('radar.frais_prof'), montant: totalProf }); }
    if (maxAssurance > 0) { totalDeductions += maxAssurance; details.push({ nom: t('radar.assurances'), montant: maxAssurance }); }
    if (maxCouple > 0) { totalDeductions += maxCouple; details.push({ nom: t('radar.couple_2_rev'), montant: maxCouple }); }
    if (maxStatut > 0) { totalDeductions += maxStatut; details.push({ nom: t('radar.statut'), montant: maxStatut }); }
    const assEnfant = maxAssuranceEnfant * nbEnfants;
    if (assEnfant > 0) { totalDeductions += assEnfant; details.push({ nom: t('radar.assu_enfants'), montant: assEnfant }); }
    
    const valMajeur = maxDeductionEnfantMajeur > 0 ? maxDeductionEnfantMajeur : maxDeductionEnfantMineur;
    
    let dedEnfant = 0;
    if (cantonId === 10 && nbEnfants > 0) {
      dedEnfant = maxDeductionEnfant; 
    } else {
      dedEnfant = (maxDeductionEnfantMineur * nbMineurs) + (valMajeur * nbMajeurs);
    }
    
    if (dedEnfant > 0) { totalDeductions += dedEnfant; details.push({ nom: t('radar.enfants'), montant: dedEnfant }); }
    
    if (totalGarde > 0) { totalDeductions += totalGarde; details.push({ nom: t('radar.frais_garde'), montant: totalGarde }); }

    if (max3a > 0) {
      let total3a = Math.min(parseFloat(pilier3a) || 0, max3a);
      if (statut === 'marie') total3a += Math.min(parseFloat(pilier3aConjoint) || 0, max3a);
      if (total3a > 0) { totalDeductions += total3a; details.push({ nom: t('radar.pilier_3a'), montant: total3a }); }
    }

    if (paliersData && paliersData.length > 0) {
      const palierGroups: { [key: string]: DeductionPalier[] } = {};
      for (const p of paliersData) {
        if (p.statut !== 'tous' && p.statut !== statut) continue;
        if (p.type_impot && p.type_impot.toLowerCase().includes('fortune')) continue;
        const key = (p.nom_deduction || '').toLowerCase();
        if (!palierGroups[key]) palierGroups[key] = [];
        palierGroups[key].push(p);
      }

      for (const nomPalier in palierGroups) {
        const group = palierGroups[nomPalier].sort((a, b) => b.revenu_seuil - a.revenu_seuil);
        const isUserRetraite = classeAge === '65-retraite' || classeAgeConjoint === '65-retraite';
        if (nomPalier.includes('rentier') && !isUserRetraite) continue;
        if (nomPalier.includes('modeste') && isUserRetraite) continue;
        const applicablePalier = group.find(p => revenuNet >= p.revenu_seuil);
        if (applicablePalier) {
          totalDeductions += applicablePalier.deduction_montant;
          details.push({ nom: applicablePalier.nom_deduction, montant: applicablePalier.deduction_montant });
        }
      }
    }

    return { total: totalDeductions, details };
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

  const calculerImpotPrecis = (baseRevenuInput: number, baremeCantonal: BaremeTranche[], baremeFederal: BaremeTranche[], commune: Commune, deductionsFed: DeductionRow[], deductionsCant: DeductionRow[], paliersFed: DeductionPalier[], paliersCant: DeductionPalier[], statut: StatutCivil, statutBareme: StatutCivil, nbMineurs: number, nbMajeurs: number): ResultatFiscal => {
    const nbEnfants = nbMineurs + nbMajeurs;
    const revenuNet = calculateNetIncome(baseRevenuInput);
    const revenuBrut = baseRevenuInput;

    const resultFed = calculerTotalDeductions(revenuNet, revenuBrut, deductionsFed, paliersFed, statut, nbMineurs, nbMajeurs, 0);
    const resultCant = calculerTotalDeductions(revenuNet, revenuBrut, deductionsCant, paliersCant, statut, nbMineurs, nbMajeurs, commune.canton_id);

    const totalDeductionsFed = resultFed.total;
    const totalDeductionsCant = resultCant.total;

    const revenuImposableFederal = Math.max(0, Math.round(revenuNet - totalDeductionsFed));
    const revenuImposableCantonal = Math.max(0, Math.round(revenuNet - totalDeductionsCant));

    const rules = CANTON_RULES[commune.canton_id] || {};
    const fallback = CANTON_FALLBACK[commune.canton_id] || {};

    let diviseur = 1;
    
    // 1. Couples mariés : Splitting normal
    if (statut === 'marie' && CANTON_DIVISEURS[commune.canton_id]) {
      diviseur = CANTON_DIVISEURS[commune.canton_id];
      // VAUD SPÉCIAL : 1.8 + 0.5 par enfant
      if (commune.canton_id === 22) {
        diviseur = 1.8 + (0.5 * nbEnfants);
      }
    } 
    // 2. Parents seuls (Célibataires avec enfants) : Splitting fédéral LHID
    else if (statut === 'celibataire' && nbEnfants > 0) {
      diviseur = CANTON_DIVISEURS[commune.canton_id] || 2;
      // VAUD SPÉCIAL : 1.3 + 0.5 par enfant
      if (commune.canton_id === 22) {
        diviseur = 1.3 + (0.5 * nbEnfants);
      }
    }
    
    const revPourCalculCantonal = revenuImposableCantonal / diviseur;
    
    // On utilise statutBareme pour choisir le bon barème (Marié si parent seul)
    const effectiveBaremeCantonal = fallback.hardcodedBareme ? fallback.hardcodedBareme[statutBareme] : baremeCantonal;
    const impotCantonalBaseBrut = rules.useProportionalTax ? calculateTaxProportional(revPourCalculCantonal, effectiveBaremeCantonal) : calculateTax(revPourCalculCantonal, effectiveBaremeCantonal);
    // On multiplie par le diviseur pour revenir à l'impôt réel
    let impotCantonalBase = impotCantonalBaseBrut * diviseur;

    let basePourCantonal = fallback.reductionImpotBase ? impotCantonalBase * fallback.reductionImpotBase : impotCantonalBase;
    
    const effectiveBaremeCommunal = (fallback.hardcodedBaremeCommunal && statutBareme === 'marie') ? fallback.hardcodedBaremeCommunal[statutBareme] : effectiveBaremeCantonal;
    const impotCommunalBaseBrut = rules.useProportionalTax ? calculateTaxProportional(revPourCalculCantonal, effectiveBaremeCommunal) : calculateTax(revPourCalculCantonal, effectiveBaremeCommunal);
    let basePourCommunal = impotCommunalBaseBrut * diviseur;

    if (commune.canton_id === 23 && statut === 'marie') {
      const reduction = Math.min(4900, Math.max(680, basePourCommunal * 0.35));
      basePourCommunal -= reduction;
    }
    
    const effectiveCoeffCantonal = fallback.coeffCantonOverride ?? commune.coeff_revenu_canton;
    let impotCantonal = Math.round(basePourCantonal * (effectiveCoeffCantonal / 100));
    
    // Rabais d'impôt pour enfants à Neuchâtel (Art. 40c LCdir) - 200 CHF par enfant
    if (commune.canton_id === 24 && nbEnfants > 0) {
      impotCantonal = Math.max(0, impotCantonal - (nbEnfants * 200));
    }
    
    // Crédit d'impôt pour enfants à Schaffhausen (Art. 192a StG) - 320 CHF par enfant
    if (commune.canton_id === 14 && nbEnfants > 0) {
      impotCantonal = Math.max(0, impotCantonal - (nbEnfants * 320));
    }
    
    // Crédit d'impôt pour enfants à Thurgau (§ 188a StG) - 100 CHF par enfant mineur
    if (commune.canton_id === 20 && nbMineurs > 0) {
      impotCantonal = Math.max(0, impotCantonal - (nbMineurs * 100));
    }

   // Crédit d'impôt pour enfants à Valais (Art. 31a LF) - 300 CHF par enfant
    if (commune.canton_id === 23 && nbEnfants > 0) {
      impotCantonal = Math.max(0, impotCantonal - (nbEnfants * 300));
    }

    let effectiveCoeffCommunal = commune.coeff_revenu_commune;
    if (commune.canton_id === 3 && commune.commune === 'Luzern') { effectiveCoeffCommunal = 145; }
    const impotCommunal = Math.round(basePourCommunal * (effectiveCoeffCommunal / 100));

    let impotParoissial = 0;
    if (religion === 'reforme') impotParoissial = Math.round(basePourCommunal * (commune.coeff_revenu_eglise_reforme / 100));
    if (religion === 'catholique') impotParoissial = Math.round(basePourCommunal * (commune.coeff_revenu_eglise_catholique / 100));

    let impotFederal = Math.round(calculateTax(revenuImposableFederal, baremeFederal));
    if (nbEnfants > 0) {
      impotFederal = Math.max(0, impotFederal - (nbEnfants * 255));
    }
    
    const impotICC = impotCantonal + impotCommunal + impotParoissial;

    return {
      revenuNet, 
      totalDeductionsFed: Math.round(totalDeductionsFed), 
      totalDeductionsCant: Math.round(totalDeductionsCant),
      detailsDeductionsFed: resultFed.details,
      detailsDeductionsCant: resultCant.details,
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
      // Si parent seul, on charge les statuts "célibataire" ET "marié" pour trouver la déduction famille monoparentale
      const statutFilter = (statutCivil === 'celibataire' && nombreEnfants > 0) 
        ? `statut.eq.tous,statut.eq.celibataire,statut.eq.marie` 
        : `statut.eq.tous,statut.eq.${statutCivil}`;
      const statutBaremeFederal = (statutCivil === 'celibataire' && nombreEnfants > 0) ? 'marie' : statutCivil;
      const statutBaremeCantonal = (statutCivil === 'celibataire' && nombreEnfants > 0) ? 'marie' : statutCivil; // NOUVEAU

      const depData = await Promise.all([
        supabase.from('baremes').select('montant_tranche, taux, montant_base').eq('canton_id', communeDepart.canton_id).eq('statut', statutBaremeCantonal).eq('autorite_fiscale', 'Canton').order('montant_tranche', { ascending: true }),
        supabase.from('baremes').select('montant_tranche, taux, montant_base').eq('canton_id', 0).eq('statut', statutBaremeFederal).eq('autorite_fiscale', 'Confédération').order('montant_tranche', { ascending: true }),
        supabase.from('deductions').select('nom_deduction, categorie, montant, pourcent, minimum, maximum, statut, type_impot').eq('canton_id', 0).or(statutFilter),
        supabase.from('deductions').select('nom_deduction, categorie, montant, pourcent, minimum, maximum, statut, type_impot').eq('canton_id', communeDepart.canton_id).or(statutFilter),
        supabase.from('deductions_paliers').select('nom_deduction, categorie, revenu_seuil, deduction_montant, statut, type_impot').eq('canton_id', 0).or(statutFilter),
        supabase.from('deductions_paliers').select('nom_deduction, categorie, revenu_seuil, deduction_montant, statut, type_impot').eq('canton_id', communeDepart.canton_id).or(statutFilter)
      ]);

      const resDep = calculerImpotPrecis(input, depData[0].data as BaremeTranche[], depData[1].data as BaremeTranche[], communeDepart, depData[2].data as DeductionRow[], depData[3].data as DeductionRow[], depData[4].data as DeductionPalier[], depData[5].data as DeductionPalier[], statutCivil, statutBaremeCantonal, enfantsMineurs, enfantsMajeurs);
      setResultatDepart(resDep);

      if (mode === 'comparaison' && communeArrivee) {
        const arrData = await Promise.all([
          supabase.from('baremes').select('montant_tranche, taux, montant_base').eq('canton_id', communeArrivee.canton_id).eq('statut', statutCivil).eq('autorite_fiscale', 'Canton').order('montant_tranche', { ascending: true }),
          supabase.from('deductions').select('nom_deduction, categorie, montant, pourcent, minimum, maximum, statut, type_impot').eq('canton_id', communeArrivee.canton_id).or(statutFilter),
          supabase.from('deductions_paliers').select('nom_deduction, categorie, revenu_seuil, deduction_montant, statut, type_impot').eq('canton_id', communeArrivee.canton_id).or(statutFilter)
        ]);

        const resArr = calculerImpotPrecis(input, arrData[0].data as BaremeTranche[], depData[1].data as BaremeTranche[], communeArrivee, depData[2].data as DeductionRow[], arrData[1].data as DeductionRow[], depData[4].data as DeductionPalier[], arrData[2].data as DeductionPalier[], statutCivil, statutBaremeCantonal,enfantsMineurs, enfantsMajeurs);
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
              <option value="65-70-actif">{t('radar.age_65_70_actif', '65 à 70 ans (Actif)')}</option>
              <option value="65-retraite">{t('radar.age_65_retraite', 'Plus de 65 ans (Retraité AVS/AI)')}</option>
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
                  <option value="65-70-actif">{t('radar.age_65_70_actif', '65 à 70 ans (Actif)')}</option>
                  <option value="65-retraite">{t('radar.age_65_retraite', 'Plus de 65 ans (Retraité AVS/AI)')}</option>
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
        </div>

        {/* MENU DÉROULANT POUR LES ENFANTS (PLACÉ AVANT LES OPTIONS AVANCÉES) */}
               <button type="button" className="advanced-toggle" onClick={() => setShowEnfantOptions(!showEnfantOptions)}>
          {showEnfantOptions ? t('radar.hide_enfants') : t('radar.show_enfants')}
        </button>
        {showEnfantOptions && (
          <div className="advanced-options">
            <div className="radar-filters base-filters">
              <div className="filter-group">
                <label>{t('radar.enfants_mineurs')}</label>
                <input type="number" min="0" value={enfantsMineurs} onChange={(e) => setEnfantsMineurs(parseInt(e.target.value) || 0)} className="form-input" />
                <small className="filter-hint">{t('radar.enfants_hint')}</small>
              </div>
              
              <div className="filter-group">
                <label>{t('radar.enfants_majeurs')}</label>
                <input type="number" min="0" value={enfantsMajeurs} onChange={(e) => setEnfantsMajeurs(parseInt(e.target.value) || 0)} className="form-input" />
                <small className="filter-hint">{t('radar.etudes_hint')}</small>
              </div>

              {enfantsMineurs > 0 && (
                <div className="filter-group">
                  <label>{t('radar.garde_label')}</label>
                  <input type="number" min="0" value={fraisGarde} onChange={(e) => setFraisGarde(e.target.value)} className="form-input" />
                  <small className="filter-hint">{t('radar.garde_hint')}</small>
                </div>
              )}
            </div>
          </div>
        )}

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

            <div className="result-spacing-wrapper">
              <div className="result-row">
                  <div className="result-col">
                    <p className="result-commune-name">{communeDepart?.commune}</p>
                    <p className="result-small-text">{t('radar.revenu_net')} : {formatCHF(resultatDepart.revenuNet)} CHF</p>
                    <p className="result-small-text">{t('radar.deductions_cant')} : - {formatCHF(resultatDepart.totalDeductionsCant)} CHF</p>
                    {resultatDepart.detailsDeductionsCant.map((d, i) => (
                      <div key={`dc-${i}`} className="result-deduction-detail">
                        <span>{d.nom}</span> : - {formatCHF(d.montant)} CHF
                      </div>
                    ))}
                    <p className="result-small-text">{t('radar.revenu_imposable_cant')} : {formatCHF(resultatDepart.revenuImposableCantonal)} CHF</p>
                    <p className="result-small-text">{t('radar.deductions_fed')} : - {formatCHF(resultatDepart.totalDeductionsFed)} CHF</p>
                    {resultatDepart.detailsDeductionsFed.map((d, i) => (
                      <div key={`df-${i}`} className="result-deduction-detail secondary">
                        <span>{d.nom}</span> : - {formatCHF(d.montant)} CHF
                      </div>
                    ))}
                    <p className="result-small-text">{t('radar.revenu_imposable_fed')} : {formatCHF(resultatDepart.revenuImposableFederal)} CHF</p>
                    <p className="result-small-text">{t('radar.impot_cantonal')} {formatCHF(resultatDepart.impotCantonal)} CHF</p>
                    <p className="result-small-text">{t('radar.impot_communal')} {formatCHF(resultatDepart.impotCommunal)} CHF</p>
                    {resultatDepart.impotParoissial > 0 && <p className="result-small-text">{t('radar.impot_paroissial')} {formatCHF(resultatDepart.impotParoissial)} CHF</p>}
                    <p className="result-small-text">{t('radar.impot_federal')} {formatCHF(resultatDepart.impotFederal)} CHF</p>
                    <h3 className="result-h3">{formatCHF(resultatDepart.impotTotal)} CHF<span className="result-period">{t('radar.periode_an')}</span></h3>
                  </div>

                <div className="result-vs">VS</div>

                  <div className="result-col">
                    <p className="result-commune-name">{communeArrivee?.commune}</p>
                    <p className="result-small-text">{t('radar.revenu_net')} : {formatCHF(resultatArrivee.revenuNet)} CHF</p>
                    <p className="result-small-text">{t('radar.deductions_cant')} : - {formatCHF(resultatArrivee.totalDeductionsCant)} CHF</p>
                    {resultatArrivee.detailsDeductionsCant.map((d, i) => (
                      <div key={`dc2-${i}`} className="result-deduction-detail">
                        <span>{d.nom}</span> : - {formatCHF(d.montant)} CHF
                      </div>
                    ))}
                    <p className="result-small-text">{t('radar.revenu_imposable_cant')} : {formatCHF(resultatArrivee.revenuImposableCantonal)} CHF</p>
                    <p className="result-small-text">{t('radar.deductions_fed')} : - {formatCHF(resultatArrivee.totalDeductionsFed)} CHF</p>
                    {resultatArrivee.detailsDeductionsFed.map((d, i) => (
                      <div key={`df2-${i}`} className="result-deduction-detail secondary">
                        <span>{d.nom}</span> : - {formatCHF(d.montant)} CHF
                      </div>
                    ))}
                    <p className="result-small-text">{t('radar.revenu_imposable_fed')} : {formatCHF(resultatArrivee.revenuImposableFederal)} CHF</p>
                    <p className="result-small-text">{t('radar.impot_cantonal')} {formatCHF(resultatArrivee.impotCantonal)} CHF</p>
                    <p className="result-small-text">{t('radar.impot_communal')} {formatCHF(resultatArrivee.impotCommunal)} CHF</p>
                    {resultatArrivee.impotParoissial > 0 && <p className="result-small-text">{t('radar.impot_paroissial')} {formatCHF(resultatArrivee.impotParoissial)} CHF</p>}
                    <p className="result-small-text">{t('radar.impot_federal')} {formatCHF(resultatArrivee.impotFederal)} CHF</p>
                    <h3 className="result-h3">{formatCHF(resultatArrivee.impotTotal)} CHF<span className="result-period">{t('radar.periode_an')}</span></h3>
                  </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="result-container simple-result">
            <div className="simple-center">
              <p className="simple-location-text">{t('radar.result_commune')}</p>
              <h2 className="simple-location-name">{communeDepart?.commune} ({communeDepart?.canton})</h2>
              <div className="simple-box light"><span className="simple-box-label">{t('radar.revenu_net')}</span><h3 className="simple-box-value">{formatCHF(resultatDepart.revenuNet)} CHF</h3></div>
              <div className="simple-box light"><span className="simple-box-label">{t('radar.deductions_cant')}</span><h3 className="simple-box-value">- {formatCHF(resultatDepart.totalDeductionsCant)} CHF</h3></div>
              {resultatDepart.detailsDeductionsCant.map((d, i) => (
                <div key={`dc-${i}`} className="deduction-detail">
                  <span className="deduction-detail-nom">{d.nom}</span>
                  <span className="deduction-detail-montant">- {formatCHF(d.montant)} CHF</span>
                </div>
              ))}
              <div className="simple-box light"><span className="simple-box-label">{t('radar.revenu_imposable_cant')}</span><h3 className="simple-box-value">{formatCHF(resultatDepart.revenuImposableCantonal)} CHF</h3></div>
              <div className="simple-box light secondary"><span className="simple-box-label">{t('radar.deductions_fed')}</span><h3 className="simple-box-value">- {formatCHF(resultatDepart.totalDeductionsFed)} CHF</h3></div>
              {resultatDepart.detailsDeductionsFed.map((d, i) => (
                <div key={`df-${i}`} className="deduction-detail secondary">
                  <span className="deduction-detail-nom">{d.nom}</span>
                  <span className="deduction-detail-montant">- {formatCHF(d.montant)} CHF</span>
                </div>
              ))}
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

      {mode === 'comparaison' && onNextStep && (
        <div className="hub-navigation hub-nav-spacing">
          <button className="btn-hub-next" onClick={onNextStep}>
            {t('radar.next_step')}
          </button>
        </div>
      )}
      
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />

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