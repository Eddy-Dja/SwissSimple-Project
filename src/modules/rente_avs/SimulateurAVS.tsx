import React, { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocalStorageState } from '../../hooks/useLocalStorageState';
import './SimulateurAVS.css';
import { Helmet } from 'react-helmet-async';

const AVS_CONSTANTS = {
  RENTE_MIN_MENSUELLE: 1260,
  RENTE_MAX_MENSUELLE: 2520,
  REVENU_MIN_COTISANT: 15120, 
  REVENU_MAX_COTISANT: 90720, 
  ANNEES_COTISATION_MAX: 44,
};

interface ResultatAVS {
  ageReference: number; anneeRetraiteUser: number; isSplitting: boolean; hasPhase1User: boolean;
  renteMensuelleProvisoire: number; ramUser: number; anneesValidesUser: number; tauxReduction: number;
  renteMensuelleDefinitive: number; renteAnnuelleDefinitive: number; supplementVeuf: number; isPlafondCouple: boolean;
  anneeRetraiteConjoint: number; ramConjoint: number; tauxReductionConjoint: number; renteMensuelleConjoint: number;
  renteAnnuelleConjoint: number; anneesValidesConjoint: number; hasPhase1Conjoint: boolean; renteMensuelleProvisoireConjoint: number;
}

type EtatCivil = 'celibataire' | 'marie' | 'divorce' | 'veuf';

interface SimulateurAVSProps {
  onResultChange?: (data: { rente: number } | null) => void;
  hideWarning?: boolean;
}

const SimulateurAVS: React.FC<SimulateurAVSProps> = ({ onResultChange, hideWarning }) => {
  const { t } = useTranslation();
  
  const [sexe, setSexe] = useLocalStorageState<'homme' | 'femme'>('avs_sexe', 'homme');
  const [anneeNaissance, setAnneeNaissance] = useLocalStorageState('avs_anneeNaissance', '1990');
  const [salaireAnnuel, setSalaireAnnuel] = useLocalStorageState('avs_salaireAnnuel', '50000');
  const [anneesCotisation, setAnneesCotisation] = useLocalStorageState('avs_anneesCotisation', '44');
  const [ageRetraite, setAgeRetraite] = useLocalStorageState<number>('avs_ageRetraite', 65);
  const [etatCivil, setEtatCivil] = useLocalStorageState<EtatCivil>('avs_etatCivil', 'celibataire');
  
  const [nombreEnfants, setNombreEnfants] = useLocalStorageState('avs_nombreEnfants', '0');
  const [anneesRachetees, setAnneesRachetees] = useLocalStorageState('avs_anneesRachetees', '0');
  const [anneesRacheteesConjoint, setAnneesRacheteesConjoint] = useLocalStorageState('avs_anneesRacheteesConjoint', '0');

  const [sexeConjoint, setSexeConjoint] = useLocalStorageState<'homme' | 'femme'>('avs_sexeConjoint', 'femme');
  const [anneeNaissanceConjoint, setAnneeNaissanceConjoint] = useLocalStorageState('avs_anneeNaissanceConjoint', '1992');
  const [salaireConjoint, setSalaireConjoint] = useLocalStorageState('avs_salaireConjoint', '0');
  
  const [anneeMariage, setAnneeMariage] = useLocalStorageState('avs_anneeMariage', '2020');
  const [anneesMariagePassees, setAnneesMariagePassees] = useLocalStorageState('avs_anneesMariagePassees', '0');
  
  const [anneesCotisationConjoint, setAnneesCotisationConjoint] = useLocalStorageState('avs_anneesCotisationConjoint', '44');
  const [ageRetraiteConjoint, setAgeRetraiteConjoint] = useLocalStorageState<number>('avs_ageRetraiteConjoint', 65);

  const [resultat, setResultat] = useState<ResultatAVS | null>(null);

  const calcAgeReference = (s: 'homme' | 'femme', annee: number) => {
    if (s === 'femme') {
      if (annee <= 1960) return 64;
      if (annee === 1961) return 64.25; 
      if (annee === 1962) return 64.5;  
      if (annee === 1963) return 64.75; 
      return 65; 
    }
    return 65; 
  };

  const ageReference = useMemo(() => calcAgeReference(sexe, parseInt(anneeNaissance) || 1990), [sexe, anneeNaissance]);
  const ageReferenceConjoint = useMemo(() => calcAgeReference(sexeConjoint, parseInt(anneeNaissanceConjoint) || 1990), [sexeConjoint, anneeNaissanceConjoint]);

  const isFemmeTransitoire = useMemo(() => sexe === 'femme' && parseInt(anneeNaissance) >= 1961 && parseInt(anneeNaissance) <= 1969, [sexe, anneeNaissance]);
  const isFemmeTransitoireConjoint = useMemo(() => sexeConjoint === 'femme' && parseInt(anneeNaissanceConjoint) >= 1961 && parseInt(anneeNaissanceConjoint) <= 1969, [sexeConjoint, anneeNaissanceConjoint]);

  const generateOptionsAge = (refAge: number, isTransitoire: boolean) => {
    const ages: number[] = [];
    const minAge = isTransitoire ? 62 : 63;
    for (let age = Math.floor(refAge); age >= minAge; age--) ages.push(age);
    return ages;
  };

  const optionsAgeRetraite = useMemo(() => generateOptionsAge(ageReference, isFemmeTransitoire), [ageReference, isFemmeTransitoire]);
  const optionsAgeRetraiteConjoint = useMemo(() => generateOptionsAge(ageReferenceConjoint, isFemmeTransitoireConjoint), [ageReferenceConjoint, isFemmeTransitoireConjoint]);

  useEffect(() => { if (!optionsAgeRetraite.includes(ageRetraite)) setAgeRetraite(optionsAgeRetraite[0]); }, [optionsAgeRetraite, ageRetraite, setAgeRetraite]);
  useEffect(() => { if (etatCivil === 'marie' && !optionsAgeRetraiteConjoint.includes(ageRetraiteConjoint)) setAgeRetraiteConjoint(optionsAgeRetraiteConjoint[0]); }, [optionsAgeRetraiteConjoint, ageRetraiteConjoint, etatCivil, setAgeRetraiteConjoint]);

  const minMariageYear = Math.max(parseInt(anneeNaissance) || 1950, parseInt(anneeNaissanceConjoint) || 1950) + 18;
  useEffect(() => {
    if (etatCivil === 'marie' && parseInt(anneeMariage) < minMariageYear) {
      setAnneeMariage(String(minMariageYear));
    }
  }, [minMariageYear, anneeMariage, etatCivil, setAnneeMariage]);

  const getTauxReduction = (yearsEarly: number, ram: number, isTransitoire: boolean): number => {
    if (yearsEarly <= 0) return 0;
    const limit4 = 4 * AVS_CONSTANTS.RENTE_MIN_MENSUELLE * 12; 
    const limit5 = 5 * AVS_CONSTANTS.RENTE_MIN_MENSUELLE * 12; 
    if (isTransitoire) {
      if (yearsEarly === 1) { if (ram <= limit4) return 0; if (ram <= limit5) return 2.5; return 3.5; }
      if (yearsEarly === 2) { if (ram <= limit4) return 2; if (ram <= limit5) return 4.5; return 6.5; }
      if (yearsEarly === 3) { if (ram <= limit4) return 3; if (ram <= limit5) return 6.5; return 10.5; }
    }
    return yearsEarly * 6.8;
  };

  const calculerRente = useMemo(() => {
    return (): ResultatAVS | null => {
      const salaire = parseFloat(salaireAnnuel) || 0;
      const anneesBaseInput = parseInt(anneesCotisation) || 0;
      const anneesBaseConjointInput = parseInt(anneesCotisationConjoint) || 0;
      const nbEnfants = parseInt(nombreEnfants) || 0;
      const rachats = Math.min(3, parseInt(anneesRachetees) || 0); 
      const rachatsConjoint = Math.min(3, parseInt(anneesRacheteesConjoint) || 0);

      if (salaire <= 0 || anneesBaseInput <= 0) return null;

      const isMarie = etatCivil === 'marie';
      const isDivorceVeuf = etatCivil === 'divorce' || etatCivil === 'veuf';
      const hasConjoint = isMarie || isDivorceVeuf;
      
      const anneeRetraiteUser = (parseInt(anneeNaissance) || 1990) + ageRetraite;
      const anneeRetraiteConjoint = (parseInt(anneeNaissanceConjoint) || 1990) + ageRetraiteConjoint;
      
      const hasPhase1User = isMarie && anneeRetraiteUser < anneeRetraiteConjoint;
      const hasPhase1Conjoint = isMarie && anneeRetraiteConjoint < anneeRetraiteUser;

      const anneesBase = Math.min(AVS_CONSTANTS.ANNEES_COTISATION_MAX, anneesBaseInput);
      const salaireValide = Math.max(AVS_CONSTANTS.REVENU_MIN_COTISANT, Math.min(salaire, AVS_CONSTANTS.REVENU_MAX_COTISANT));
      
      const facteurBonusEnfant = isMarie ? 1.5 : 3;
      const anneesBonusEnfants = nbEnfants * facteurBonusEnfant;
      const revenuBonusEnfants = facteurBonusEnfant * AVS_CONSTANTS.RENTE_MIN_MENSUELLE * 12 * nbEnfants;
      
      const anneesValides = Math.min(AVS_CONSTANTS.ANNEES_COTISATION_MAX, anneesBase + anneesBonusEnfants + rachats);
      const anneesValidesConjoint = Math.min(AVS_CONSTANTS.ANNEES_COTISATION_MAX, anneesBaseConjointInput + anneesBonusEnfants + rachatsConjoint);

      const totalRevenuIndiv = (salaireValide * anneesBase) + revenuBonusEnfants + (AVS_CONSTANTS.REVENU_MIN_COTISANT * rachats);
      let ramIndividuel = Math.min(AVS_CONSTANTS.REVENU_MAX_COTISANT, totalRevenuIndiv / anneesValides);

      const anneesBaseC = Math.min(AVS_CONSTANTS.ANNEES_COTISATION_MAX, anneesBaseConjointInput);
      const salaireC = parseFloat(salaireConjoint) || 0;
      const salaireConjointValide = Math.max(AVS_CONSTANTS.REVENU_MIN_COTISANT, Math.min(salaireC, AVS_CONSTANTS.REVENU_MAX_COTISANT));
      const totalRevenuIndivConjoint = (salaireConjointValide * anneesBaseC) + revenuBonusEnfants + (AVS_CONSTANTS.REVENU_MIN_COTISANT * rachatsConjoint);
      let ramIndividuelConjoint = Math.min(AVS_CONSTANTS.REVENU_MAX_COTISANT, totalRevenuIndivConjoint / anneesValidesConjoint);

      let isSplitting = false;
      let ramUser = ramIndividuel;
      let ramConjoint = ramIndividuelConjoint;

      if (hasConjoint) {
        let anneesSplitting = 0;
        if (isMarie) {
          const anneeDebutCotisation = Math.max(
            (parseInt(anneeNaissance) || 1990) + 20, 
            (parseInt(anneeNaissanceConjoint) || 1990) + 20
          );
          const anneeMariageValide = Math.max(parseInt(anneeMariage) || 2000, anneeDebutCotisation);
          const anneePremiereRetraite = Math.min(anneeRetraiteUser, anneeRetraiteConjoint);
          anneesSplitting = Math.max(0, Math.floor(anneePremiereRetraite) - 1 - anneeMariageValide);
        } else {
          anneesSplitting = parseInt(anneesMariagePassees) || 0;
        }
        anneesSplitting = Math.min(anneesSplitting, anneesBase, anneesBaseC);

        if (anneesSplitting > 0) {
          const revenuIndivUser = salaireValide * (anneesBase - anneesSplitting);
          const revenuIndivConjoint = salaireConjointValide * (anneesBaseC - anneesSplitting);
          const salaireMoyenSplitting = (salaireValide + salaireConjointValide) / 2;
          const revenuSplitting = salaireMoyenSplitting * anneesSplitting;
          
          const totalRevenuUser = revenuIndivUser + revenuSplitting + revenuBonusEnfants + (AVS_CONSTANTS.REVENU_MIN_COTISANT * rachats);
          const totalRevenuConjoint = revenuIndivConjoint + revenuSplitting + revenuBonusEnfants + (AVS_CONSTANTS.REVENU_MIN_COTISANT * rachatsConjoint); 
          
          ramUser = Math.min(AVS_CONSTANTS.REVENU_MAX_COTISANT, totalRevenuUser / anneesValides);
          ramConjoint = Math.min(AVS_CONSTANTS.REVENU_MAX_COTISANT, totalRevenuConjoint / anneesValidesConjoint);
          isSplitting = true;
        }
      }

      const calculerRenteComplete = (ram: number) => {
        const limiteTranche1 = 36 * AVS_CONSTANTS.RENTE_MIN_MENSUELLE;
        let rComplete = ram <= limiteTranche1 
          ? (AVS_CONSTANTS.RENTE_MIN_MENSUELLE * 0.74) + (ram * (13 / 600))
          : (AVS_CONSTANTS.RENTE_MIN_MENSUELLE * 1.04) + (ram * (8 / 600));
        rComplete = Math.min(AVS_CONSTANTS.RENTE_MAX_MENSUELLE, Math.max(AVS_CONSTANTS.RENTE_MIN_MENSUELLE, rComplete));
        return rComplete;
      };

      let renteMensuelleProvisoire = 0;
      if (hasPhase1User) {
        const rProvisoire = calculerRenteComplete(ramIndividuel);
        const tauxRed = getTauxReduction(Math.floor(ageReference) - ageRetraite, ramIndividuel, isFemmeTransitoire);
        renteMensuelleProvisoire = Math.round(rProvisoire * (anneesValides / 44) * (1 - (tauxRed / 100)));
      }

      let renteMensuelleProvisoireConjoint = 0;
      if (hasPhase1Conjoint) {
        const rProvisoireC = calculerRenteComplete(ramIndividuelConjoint);
        const tauxRedC = getTauxReduction(Math.floor(ageReferenceConjoint) - ageRetraiteConjoint, ramIndividuelConjoint, isFemmeTransitoireConjoint);
        renteMensuelleProvisoireConjoint = Math.round(rProvisoireC * (anneesValidesConjoint / 44) * (1 - (tauxRedC / 100)));
      }

      const renteCompleteDefinitive = calculerRenteComplete(ramUser);
      const renteBaseDefinitive = renteCompleteDefinitive * (anneesValides / 44);
      const tauxReduction = getTauxReduction(Math.floor(ageReference) - ageRetraite, ramUser, isFemmeTransitoire);
      let renteMensuelleDefinitive = Math.round(renteBaseDefinitive * (1 - (tauxReduction / 100)));

      let renteMensuelleConjoint = 0;
      let tauxReductionConjoint = 0;
      let isPlafondCouple = false;

      if (isMarie) {
        const rCompleteConjoint = calculerRenteComplete(ramConjoint);
        const rBaseConjoint = rCompleteConjoint * (anneesValidesConjoint / 44);
        tauxReductionConjoint = getTauxReduction(Math.floor(ageReferenceConjoint) - ageRetraiteConjoint, ramConjoint, isFemmeTransitoireConjoint);
        renteMensuelleConjoint = Math.round(rBaseConjoint * (1 - (tauxReductionConjoint / 100)));

        const maxSumCouple = AVS_CONSTANTS.RENTE_MAX_MENSUELLE * 1.5; 
        const sumPensions = renteMensuelleDefinitive + renteMensuelleConjoint;
        if (sumPensions > maxSumCouple) {
          isPlafondCouple = true;
          const reductionFactor = maxSumCouple / sumPensions;
          renteMensuelleDefinitive = Math.round(renteMensuelleDefinitive * reductionFactor);
          renteMensuelleConjoint = Math.round(renteMensuelleConjoint * reductionFactor);
        }
      }

      let supplementVeuf = 0;
      if (etatCivil === 'veuf') {
        const basePourSupp = renteMensuelleDefinitive;
        renteMensuelleDefinitive = Math.min(basePourSupp * 1.20, AVS_CONSTANTS.RENTE_MAX_MENSUELLE);
        supplementVeuf = renteMensuelleDefinitive - basePourSupp; 
      }

      return {
        ageReference: Math.floor(ageReference), 
        anneeRetraiteUser, isSplitting, hasPhase1User, renteMensuelleProvisoire,
        hasPhase1Conjoint, renteMensuelleProvisoireConjoint,
        ramUser: Math.round(ramUser), anneesValidesUser: anneesValides, tauxReduction, 
        renteMensuelleDefinitive, renteAnnuelleDefinitive: renteMensuelleDefinitive * 13, 
        supplementVeuf, isPlafondCouple, anneeRetraiteConjoint,
        ramConjoint: Math.round(ramConjoint), tauxReductionConjoint, 
        renteMensuelleConjoint, renteAnnuelleConjoint: renteMensuelleConjoint * 13, anneesValidesConjoint
      };
    };
  }, [salaireAnnuel, salaireConjoint, anneeMariage, anneesMariagePassees, anneesCotisation, anneesCotisationConjoint, ageRetraite, ageRetraiteConjoint, nombreEnfants, anneesRachetees, anneesRacheteesConjoint, etatCivil, sexe, anneeNaissance, sexeConjoint, anneeNaissanceConjoint, ageReference, ageReferenceConjoint, isFemmeTransitoire, isFemmeTransitoireConjoint]);
      
  const handleCalcul = (e: React.FormEvent) => {
    e.preventDefault();
    const res = calculerRente();
    setResultat(res);
    if (res && onResultChange) {
      onResultChange({ rente: res.renteMensuelleDefinitive });
    }
  };

  const formatCHF = (amount: number | null | undefined) => !amount ? '0' : amount.toLocaleString('fr-CH');
  const formClass = `radar-form avs-form-small ${etatCivil === 'marie' ? 'avs-form-wide' : ''}`;

  return (
    <div className="radar-container">

<Helmet>
  <title>Simulateur Rente AVS 2026 | Calculateur Retraite Suisse</title>
  <meta name="description" content="Calculez votre rente AVS (1er pilier) en fonction de votre âge, salaire et années de cotisation. Estimez votre retraite suisse anticipée ou ordinaire gratuitement." />
</Helmet>

      <div className="radar-title-container">
        <h1 className="radar-title">{t('avs.title')}</h1>
        <p className="radar-subtitle">{t('avs.subtitle')}</p>
      </div>

      <form onSubmit={handleCalcul} className={formClass}>
        <div className="filter-group avs-state-group">
          <label>{t('avs.etat_civil')}</label>
          <select value={etatCivil} onChange={(e) => setEtatCivil(e.target.value as EtatCivil)} className="form-input">
            <option value="celibataire">{t('avs.celibataire')}</option>
            <option value="marie">{t('avs.marie')}</option>
            <option value="divorce">{t('avs.divorce')}</option>
            <option value="veuf">{t('avs.veuf')}</option>
          </select>
          <small className="filter-hint">
            {etatCivil === 'marie' && t('avs.hint_marie')}
            {etatCivil === 'divorce' && t('avs.hint_divorce')}
            {etatCivil === 'veuf' && t('avs.hint_veuf')}
          </small>
        </div>

        <div className="avs-form-row">
          <div className="filter-group avs-form-col">
            <label>{t('avs.sexe')}</label>
            <select value={sexe} onChange={(e) => setSexe(e.target.value as 'homme' | 'femme')} className="form-input">
              <option value="homme">{t('avs.homme')}</option>
              <option value="femme">{t('avs.femme')}</option>
            </select>
          </div>
          {etatCivil === 'marie' && (
            <div className="filter-group avs-form-col">
              <label>{t('avs.sexe_conjoint')}</label>
              <select value={sexeConjoint} onChange={(e) => setSexeConjoint(e.target.value as 'homme' | 'femme')} className="form-input">
                <option value="homme">{t('avs.homme')}</option>
                <option value="femme">{t('avs.femme')}</option>
              </select>
            </div>
          )}
        </div>

        <div className="avs-form-row">
          <div className="filter-group avs-form-col">
            <label>{t('avs.annee_naissance')}</label>
            <input type="number" min="1900" max="2030" value={anneeNaissance} required onChange={(e) => setAnneeNaissance(e.target.value)} className="form-input" />
          </div>
          {etatCivil === 'marie' && (
            <div className="filter-group avs-form-col">
              <label>{t('avs.annee_naissance_conjoint')}</label>
              <input type="number" min="1900" max="2030" value={anneeNaissanceConjoint} required onChange={(e) => setAnneeNaissanceConjoint(e.target.value)} className="form-input" />
            </div>
          )}
        </div>

        <div className="avs-form-row">
          <div className="filter-group avs-form-col">
            <label>{t('avs.salaire')}</label>
            <input type="number" placeholder="Ex: 90000" value={salaireAnnuel} required onChange={(e) => setSalaireAnnuel(e.target.value)} className="form-input" />
          </div>
          {etatCivil !== 'celibataire' && (
            <div className="filter-group avs-form-col">
              <label>{t('avs.salaire_conjoint')}</label>
              <input type="number" placeholder="Ex: 90000" value={salaireConjoint} required onChange={(e) => setSalaireConjoint(e.target.value)} className="form-input" />
            </div>
          )}
        </div>

        <div className="avs-form-row">
          <div className="filter-group avs-form-col">
            <label>{t('avs.annees_cotisation')}</label>
            <input type="number" min="1" max="44" value={anneesCotisation} required onChange={(e) => setAnneesCotisation(e.target.value)} className="form-input" />
          </div>
          {etatCivil === 'marie' && (
            <div className="filter-group avs-form-col">
              <label>{t('avs.annees_cotisation_conjoint')}</label>
              <input type="number" min="1" max="44" value={anneesCotisationConjoint} required onChange={(e) => setAnneesCotisationConjoint(e.target.value)} className="form-input" />
            </div>
          )}
        </div>

        <div className="avs-form-row">
          <div className="filter-group avs-form-col">
            <label>{t('avs.annees_rachetees')}</label>
            <input type="number" min="0" max="3" value={anneesRachetees} onChange={(e) => setAnneesRachetees(e.target.value)} className="form-input" />
          </div>
          {etatCivil === 'marie' && (
            <div className="filter-group avs-form-col">
              <label>{t('avs.annees_rachetees_conjoint')}</label>
              <input type="number" min="0" max="3" value={anneesRacheteesConjoint} onChange={(e) => setAnneesRacheteesConjoint(e.target.value)} className="form-input" />
            </div>
          )}
        </div>

        <div className="avs-form-row">
          <div className="filter-group avs-form-col">
            <label>{t('avs.age_retraite')}</label>
            <select value={ageRetraite} onChange={(e) => setAgeRetraite(parseInt(e.target.value))} className="form-input">
              {optionsAgeRetraite.map(age => (
                <option key={age} value={age}>
                  {age} ans {age === Math.floor(ageReference) ? t('avs.age_reference') : t('avs.age_anticip')}
                </option>
              ))}
            </select>
            <small className="filter-hint">
              {isFemmeTransitoire ? t('avs.hint_femme_transitoire') : t('avs.hint_anticip')}
            </small>
          </div>
          {etatCivil === 'marie' && (
            <div className="filter-group avs-form-col">
              <label>{t('avs.age_retraite_conjoint')}</label>
              <select value={ageRetraiteConjoint} onChange={(e) => setAgeRetraiteConjoint(parseInt(e.target.value))} className="form-input">
                {optionsAgeRetraiteConjoint.map(age => (
                  <option key={age} value={age}>
                    {age} ans {age === Math.floor(ageReferenceConjoint) ? t('avs.age_reference') : t('avs.age_anticip')}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        
        <div className="avs-form-row">
          <div className="filter-group avs-form-col">
            <label>{t('avs.enfants')}</label>
            <input type="number" min="0" value={nombreEnfants} onChange={(e) => setNombreEnfants(e.target.value)} className="form-input" />
            <small className="filter-hint">{t('avs.hint_enfants')}</small>
          </div>
          {etatCivil !== 'celibataire' && (
            <div className="filter-group avs-form-col">
              {etatCivil === 'marie' ? (
                <>
                  <label>{t('avs.annee_mariage')}</label>
                  <input 
                    type="number" 
                    min={minMariageYear} 
                    max="2100" 
                    value={anneeMariage} 
                    required 
                    onChange={(e) => setAnneeMariage(e.target.value)} 
                    className="form-input" 
                  />
                  <small className="filter-hint">{t('avs.hint_mariage')}</small>
                </>
              ) : (
                <>
                  <label>{t('avs.annees_mariage')}</label>
                  <input 
                    type="number" 
                    min="0" 
                    max="44" 
                    value={anneesMariagePassees} 
                    required 
                    onChange={(e) => setAnneesMariagePassees(e.target.value)} 
                    className="form-input" 
                  />
                  <small className="filter-hint">{t('avs.hint_annees_mariage')}</small>
                </>
              )}
            </div>
          )}
        </div>

        <button className="btn-primary avs-mt-2" type="submit">{t('avs.calc_btn')}</button>
      </form>

      {resultat && (
        <div className="result-container simple-result avs-full-width">
          <div className="simple-center">
            <p className="simple-location-text avs-result-title">{t('avs.result_title')}</p>
            
            <div className="avs-panels-wrapper">
              <div className="avs-panel avs-panel-blue">
                <h3 className="avs-panel-header avs-header-blue">{t('avs.your_rent')}</h3>
                
                <div className="simple-box light">
                  <span className="simple-box-label">{t('avs.age_ref')}</span>
                  <h3 className="simple-box-value">{resultat.ageReference} ans</h3>
                </div>
                <div className="simple-box light">
                  <span className="simple-box-label">{t('avs.cotisations_valides')}</span>
                  <h3 className="simple-box-value">{resultat.anneesValidesUser} / 44 ans</h3>
                </div>
                <div className="simple-box light">
                  <span className="simple-box-label">{t('avs.ram', { split: resultat.isSplitting ? t('avs.ram_split') : '' })}</span>
                  <h3 className="simple-box-value">{formatCHF(resultat.ramUser)} CHF</h3>
                </div>

                {resultat.tauxReduction > 0 && (
                  <div className="simple-box light avs-warning-yellow">
                    <span className="simple-box-label">{t('avs.penalite')}</span>
                    <h3 className="simple-box-value avs-warning-text-yellow">- {resultat.tauxReduction} %</h3>
                  </div>
                )}

                {resultat.supplementVeuf > 0 && (
                  <div className="simple-box light avs-warning-green">
                    <span className="simple-box-label">{t('avs.supplement')}</span>
                    <h3 className="simple-box-value avs-warning-text-green">+ {formatCHF(resultat.supplementVeuf)} CHF</h3>
                  </div>
                )}

                {resultat.isPlafondCouple && (
                  <div className="avs-info-blue">{t('avs.plafond')}</div>
                )}

                {resultat.hasPhase1User && (
                  <div className="avs-phase-box avs-phase-blue">
                    <p className="avs-phase-text-blue">
                      {t('avs.phase1', { start: resultat.anneeRetraiteUser, end: resultat.anneeRetraiteConjoint })}
                    </p>
                    <div className="simple-box light avs-box-borderless">
                      <span className="simple-box-label">{t('avs.rente_prov')}</span>
                      <h3 className="simple-box-value">{formatCHF(resultat.renteMensuelleProvisoire)} CHF</h3>
                    </div>
                  </div>
                )}

                <div className="avs-push-bottom">
                  {resultat.hasPhase1User ? (
                    <p className="avs-phase-text-blue">{t('avs.phase2', { year: resultat.anneeRetraiteConjoint })}</p>
                  ) : (
                    <p className="avs-phase-text-blue">{t('avs.rente_def', { year: resultat.anneeRetraiteUser })}</p>
                  )}
                  <div className="simple-box dark avs-box-blue-dark">
                    <span className="simple-box-label-dark">{t('avs.rente_mensuelle')}</span>
                    <h3 className="simple-box-value-dark">{formatCHF(resultat.renteMensuelleDefinitive)} CHF</h3>
                  </div>
                  <div className="simple-box total-box avs-box-blue-total">
                    <span className="simple-box-label-dark">{t('avs.rente_annuelle')}</span>
                    <h2 className="simple-box-value-dark">{formatCHF(resultat.renteAnnuelleDefinitive)} CHF</h2>
                  </div>
                </div>
              </div>

              {etatCivil === 'marie' && (
                <div className="avs-panel avs-panel-red">
                  <h3 className="avs-panel-header avs-header-red">{t('avs.conjoint_rent')}</h3>
                  
                  <div className="simple-box light">
                    <span className="simple-box-label">{t('avs.age_ref')}</span>
                    <h3 className="simple-box-value">{Math.floor(ageReferenceConjoint)} ans</h3>
                  </div>
                  <div className="simple-box light">
                    <span className="simple-box-label">{t('avs.cotisations_valides')}</span>
                    <h3 className="simple-box-value">{resultat.anneesValidesConjoint} / 44 ans</h3>
                  </div>
                  <div className="simple-box light">
                    <span className="simple-box-label">{t('avs.ram', { split: resultat.isSplitting ? t('avs.ram_split') : '' })}</span>
                    <h3 className="simple-box-value">{formatCHF(resultat.ramConjoint)} CHF</h3>
                  </div>

                  {resultat.tauxReductionConjoint > 0 && (
                    <div className="simple-box light avs-warning-yellow">
                      <span className="simple-box-label">{t('avs.penalite')}</span>
                      <h3 className="simple-box-value avs-warning-text-yellow">- {resultat.tauxReductionConjoint} %</h3>
                    </div>
                  )}
                  
                  {resultat.hasPhase1Conjoint && (
                    <div className="avs-phase-box" style={{ borderColor: '#fca5a5' }}>
                      <p className="avs-phase-text-red">
                        {t('avs.phase1', { start: resultat.anneeRetraiteConjoint, end: resultat.anneeRetraiteUser })}
                      </p>
                      <div className="simple-box light avs-box-borderless">
                        <span className="simple-box-label">{t('avs.rente_prov')}</span>
                        <h3 className="simple-box-value">{formatCHF(resultat.renteMensuelleProvisoireConjoint)} CHF</h3>
                      </div>
                    </div>
                  )}

                  <div className="avs-push-bottom">
                    {resultat.hasPhase1Conjoint ? (
                      <p className="avs-phase-text-red">{t('avs.phase2', { year: resultat.anneeRetraiteUser })}</p>
                    ) : (
                      <p className="avs-phase-text-red">{t('avs.rente_def', { year: resultat.anneeRetraiteConjoint })}</p>
                    )}
                    <div className="simple-box dark avs-box-red-dark">
                      <span className="simple-box-label-dark">{t('avs.rente_mensuelle')}</span>
                      <h3 className="simple-box-value-dark">{formatCHF(resultat.renteMensuelleConjoint)} CHF</h3>
                    </div>
                    <div className="simple-box total-box avs-box-red-total">
                      <span className="simple-box-label-dark">{t('avs.rente_annuelle')}</span>
                      <h2 className="simple-box-value-dark">{formatCHF(resultat.renteAnnuelleConjoint)} CHF</h2>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            <div className="taux-effectif avs-mt-2">
              {t('avs.rappel')}
            </div>
          </div>
        </div>
      )}

      {!hideWarning && (
        <div className="avertissement-legal">
          <span className="titre-avertissement">⚖️ {t('hub.warning_title')}</span>
          <span className="texte-avertissement">{t('avs.warning')}</span>
        </div>
      )}
    </div>
  );
};

export default SimulateurAVS;