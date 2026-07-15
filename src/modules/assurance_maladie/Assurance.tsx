import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabaseClient';
import './Assurance.css';
import { useLocalStorageState } from '../../hooks/useLocalStorageState';

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

const AGE_CONFIG: Record<string, { klasse: string; untergruppe: string; label: string }> = {
  'KIN-K1': { klasse: 'AKL-KIN', untergruppe: 'K1', label: 'Enfant (0-11 ans)' },
  'KIN-K2': { klasse: 'AKL-KIN', untergruppe: 'K2', label: 'Adolescent (12-18 ans)' },
  'JUG': { klasse: 'AKL-JUG', untergruppe: '', label: 'Jeune (19-25 ans)' },
  'ERW': { klasse: 'AKL-ERW', untergruppe: '', label: 'Adulte (26+ ans)' }
};
const AGE_KEYS = Object.keys(AGE_CONFIG);

const FRACT_ERW = [300, 500, 1000, 1500, 2000, 2500];
const FRACT_KIN = [0, 100, 200, 300, 400, 500, 600];

const CANTONS = ['AG','AI','AR','BE','BL','BS','FR','GE','GL','GR','JU','LU','NE','NW','OW','SG','SH','SO','SZ','TG','TI','UR','VD','VS','ZG','ZH'];

const TARIFTYP_LABELS: Record<string, string> = {
  '': '📋 Tous les modèles',
  'TAR-BASE': '🏥 Assurance de Base',
  'TAR-HAM': '👨‍⚕️ Médecin de famille',
  'TAR-HMO': '🏢 Réseau / HMO',
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

interface AssuranceProps {
  initialMode?: 'simple' | 'comparaison';
  onPrevStep?: () => void;
  onNextStep?: () => void;
  onResultChange?: (diff: number | null, details?: { avgA: number, avgB: number }) => void;
  hideWarning?: boolean;
}

export default function Assurance({ initialMode = 'simple', onPrevStep, onNextStep, onResultChange, hideWarning }: AssuranceProps) {
  const { t, i18n } = useTranslation();

  const mode = initialMode;
  
  const [activeTab, setActiveTab] = useLocalStorageState<'A' | 'B'>('ass_activeTab', 'A');

  const [selectedAge, setSelectedAge] = useLocalStorageState('ass_selectedAge', 'ERW'); 
  const [franchise, setFranchise] = useLocalStorageState('ass_franchise', 300);
  const [accident, setAccident] = useLocalStorageState('ass_accident', 'MIT-UNF');
  const [tariftyp, setTariftyp] = useLocalStorageState('ass_tariftyp', ''); 
  
  const [cantonA, setCantonA] = useLocalStorageState('ass_cantonA', 'VD');
  // availableRegionsA et selectedRegionA sont gérés dynamiquement par le fetch, on laisse en useState normal
  const [availableRegionsA, setAvailableRegionsA] = useState<RegionOption[]>([]);
  const [selectedRegionA, setSelectedRegionA] = useLocalStorageState('ass_selectedRegionA', '');

  const [cantonB, setCantonB] = useLocalStorageState('ass_cantonB', 'GE');
  const [availableRegionsB, setAvailableRegionsB] = useState<RegionOption[]>([]);
  const [selectedRegionB, setSelectedRegionB] = useLocalStorageState('ass_selectedRegionB', '');

  // Les résultats de recherche n'ont pas besoin d'être sauvegardés dans le localStorage
  const [resultsA, setResultsA] = useState<Prime[]>([]);
  const [resultsB, setResultsB] = useState<Prime[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const isChild = selectedAge === 'KIN-K1' || selectedAge === 'KIN-K2';
  const currentFractOptions = isChild ? FRACT_KIN : FRACT_ERW;

  useEffect(() => {
    if (isChild && !FRACT_KIN.includes(franchise)) setFranchise(0); 
    else if (!isChild && !FRACT_ERW.includes(franchise)) setFranchise(300); 
  }, [selectedAge, franchise, isChild]);

  // Fonction pour obtenir le nom de la région dans la bonne langue
  const getRegionLabel = (canton: string, reg: string) => {
    const isDe = i18n.language.startsWith('de');
    const dict = isDe ? REGION_NAMES_DE : REGION_NAMES;
    const defaultWord = isDe ? 'Region ' : 'Région ';
    return dict[canton]?.[reg] || reg.replace('PR-REG CH', defaultWord);
  };

  const fetchRegions = async (canton: string, setAvailableRegions: React.Dispatch<React.SetStateAction<RegionOption[]>>, setSelectedRegion: React.Dispatch<React.SetStateAction<string>>) => {
    const { data, error } = await supabase.from('primes_lamal').select('Region').eq('Kanton', canton).eq('Geschäftsjahr', 2026);
    if (error || !data) { setAvailableRegions([]); return; }
    const uniqueRegions = [...new Set(data.map((p: { Region: string }) => p.Region))];
    
    const options: RegionOption[] = uniqueRegions.map(reg => ({ 
      value: reg, 
      label: getRegionLabel(canton, reg)
    })).sort((a, b) => a.value.localeCompare(b.value));
    
    setAvailableRegions(options);
    if (options.length > 0) setSelectedRegion(options[0].value);
  };

  // Charger les régions quand le canton A change
  useEffect(() => {
    fetchRegions(cantonA, setAvailableRegionsA, setSelectedRegionA);
  }, [cantonA]);

  // Charger les régions quand le canton B change
  useEffect(() => {
    fetchRegions(cantonB, setAvailableRegionsB, setSelectedRegionB);
  }, [cantonB]);

  // Met à jour les textes des régions A quand la langue change
  useEffect(() => {
    setAvailableRegionsA(prev => prev.map(opt => ({ ...opt, label: getRegionLabel(cantonA, opt.value) })));
  }, [i18n.language, cantonA]);

  // Met à jour les textes des régions B quand la langue change
  useEffect(() => {
    setAvailableRegionsB(prev => prev.map(opt => ({ ...opt, label: getRegionLabel(cantonB, opt.value) })));
  }, [i18n.language, cantonB]);

  const getFilteredPrimes = async (targetCanton: string, targetRegion: string) => {
    const targetConfig = AGE_CONFIG[selectedAge];
    let query = supabase.from('primes_lamal').select('*').eq('Kanton', targetCanton).eq('Region', targetRegion).eq('Altersklasse', targetConfig.klasse).eq('Franchise', franchise).eq('Unfalleinschluss', accident).eq('Geschäftsjahr', 2026);
    if (tariftyp) query = query.eq('Tariftyp', tariftyp);
    const { data, error } = await query.order('Prämie', { ascending: true });
    if (error) throw error;
    const preFiltered = (data as Prime[]).filter(p => {
      if (targetConfig.untergruppe) return p.Altersuntergruppe === targetConfig.untergruppe;
      return p.Altersuntergruppe !== 'K1' && p.Altersuntergruppe !== 'K2';
    });
    return preFiltered.filter((p, index, self) => index === self.findIndex((t) => (t.Versicherer === p.Versicherer && t.Tarifbezeichnung === p.Tarifbezeichnung)));
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSearched(true);
    try {
      const primesA = await getFilteredPrimes(cantonA, selectedRegionA);
      setResultsA(primesA);
      
      if (mode === 'comparaison') {
        const primesB = await getFilteredPrimes(cantonB, selectedRegionB);
        setResultsB(primesB);
        
        const avgA = calculateAvgPrime(primesA);
        const avgB = calculateAvgPrime(primesB);
        const calculatedDiff = avgA.annuel - avgB.annuel;
        
        if (onResultChange) onResultChange(calculatedDiff, { avgA: avgA.annuel, avgB: avgB.annuel });
      } else {
        setResultsB([]);
        if (onResultChange) onResultChange(null);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erreur inconnue';
      alert('Erreur : ' + message);
    } finally { setLoading(false); }
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

  return (
    <div className="assurance-container">
      <div className="assurance-header">
        <h1 className="assurance-title">{t('assurance.title')}</h1>
        <p className="assurance-subtitle">
          {mode === 'comparaison' ? t('assurance.subtitle_compare') : t('assurance.subtitle_simple')}
        </p>
      </div>

      <form onSubmit={handleSearch} className="assurance-form">
        <div className="assurance-filters">
          <div className="locations-wrapper">
            <div className={`location-column ${mode === 'comparaison' ? 'bordered' : ''}`}>
              <div className="filter-group">
                <label>{mode === 'comparaison' ? t('assurance.canton_depart') : t('assurance.canton')}</label>
                <select value={cantonA} onChange={(e) => setCantonA(e.target.value)} className="form-input">
                  {CANTONS.map(c => <option key={c} value={c}>{c}</option>)}
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
                    {CANTONS.map(c => <option key={c} value={c}>{c}</option>)}
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
                {AGE_KEYS.map(key => {
                  const langKey = key === 'KIN-K1' ? 'age_k1' : key === 'KIN-K2' ? 'age_k2' : key === 'JUG' ? 'age_jug' : 'age_erw';
                  return <option key={key} value={key}>{t(`assurance.${langKey}`)}</option>
                })}
              </select>
            </div>
            <div className="filter-group">
              <label>{t('assurance.modele')}</label>
              <select value={tariftyp} onChange={(e) => setTariftyp(e.target.value)} className="form-input">
                {Object.entries(TARIFTYP_LABELS).map(([key]) => {
                  const langKey = key === '' ? 'model_all' : `model_${key.split('-')[1].toLowerCase()}`;
                  return <option key={key} value={key}>{t(`assurance.${langKey}`)}</option>
                })}
              </select>
            </div>
            <div className="filter-group">
              <label>{t('assurance.franchise')}</label>
              <select value={franchise} onChange={(e) => setFranchise(parseInt(e.target.value))} className="form-input">
                {currentFractOptions.map(f => <option key={f} value={f}>{f} CHF</option>)}
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