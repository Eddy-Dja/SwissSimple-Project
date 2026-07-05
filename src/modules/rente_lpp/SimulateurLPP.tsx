import React, { useState, useMemo } from 'react';
//import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import './SimulateurLPP.css';

// ============================================================
// CONSTANTES OFFICIELLES LPP (2025) - Conformes à l'Art. 8
// ============================================================
const LPP_CONSTANTS = {
  DEDUCTION_COORDINATION: 26460,
  SALAIRE_COORDONNE_MAX: 90720,
  SALAIRE_COORDONNE_MIN: 3780,
  TAUX_INTERET_MOYEN: 1.5,
};

const TAUX_CONVERSION: Record<number, number> = {
  63: 5.5,
  64: 6.2,
  65: 6.8,
  66: 7.2,
  67: 7.6,
  68: 8.0,
  69: 8.4,
  70: 8.8
};

const getCotisationInfo = (age: number): { taux: number; tranche: string } => {
  if (age < 25) return { taux: 0, tranche: "Moins de 25 ans" };
  if (age < 35) return { taux: 0.07, tranche: "25 à 34 ans" };
  if (age < 45) return { taux: 0.10, tranche: "35 à 44 ans" };
  if (age < 55) return { taux: 0.15, tranche: "45 à 54 ans" };
  return { taux: 0.18, tranche: "55 ans et plus" };
};

interface SimulateurLPPProps {
  onResultChange?: (data: { rente: number, capital: number, salaire: number, moisRestants: number } | null) => void;
  hideWarning?: boolean;
}

const SimulateurLPP: React.FC<SimulateurLPPProps> = ({ onResultChange, hideWarning }) => {
  const { t } = useTranslation();

  const [anneeNaissance, setAnneeNaissance] = useState('1985');
  const [salaireBrut, setSalaireBrut] = useState('90000');
  const [capitalActuel, setCapitalActuel] = useState('80000');
  const [rachatAnnuel, setRachatAnnuel] = useState('0');
  const [ageRetraite, setAgeRetraite] = useState<number>(65);
  const [tauxInteret, setTauxInteret] = useState('1.5');
  
  const [resultat, setResultat] = useState<NonNullable<typeof calculerLPPMemo> | null>(null);

  const currentYear = new Date().getFullYear();
  const ageUser = currentYear - (parseInt(anneeNaissance) || 1990);

  const calculerLPPMemo = useMemo(() => {
    const salaire = parseFloat(salaireBrut) || 0;
    const capital = parseFloat(capitalActuel) || 0;
    const rachats = parseFloat(rachatAnnuel) || 0;
    const interet = (parseFloat(tauxInteret) || 1.5) / 100;
    const naissance = parseInt(anneeNaissance) || 1990;
    
    const ageActuel = currentYear - naissance;
    const anneesRestantes = ageRetraite - ageActuel;

    let salaireAssure = Math.max(0, salaire - LPP_CONSTANTS.DEDUCTION_COORDINATION);
    salaireAssure = Math.min(salaireAssure, LPP_CONSTANTS.SALAIRE_COORDONNE_MAX);
    if (salaireAssure > 0 && salaireAssure < LPP_CONSTANTS.SALAIRE_COORDONNE_MIN) {
      salaireAssure = LPP_CONSTANTS.SALAIRE_COORDONNE_MIN;
    }

    const { taux: tauxCotisationTotal, tranche: trancheAge } = getCotisationInfo(ageActuel);

    if (anneesRestantes <= 0) {
      const tauxConv = TAUX_CONVERSION[ageRetraite] || 6.8;
      const renteAnnuelle = (capital) * (tauxConv / 100);
      return {
        capitalFinal: Math.round(capital),
        salaireAssure: Math.round(salaireAssure),
        cotisationAnnuelleActuelle: salaireAssure * tauxCotisationTotal,
        tauxCotisation: tauxCotisationTotal * 100,
        trancheAge: trancheAge,
        anneesRestantes: 0,
        tauxConversion: tauxConv,
        renteAnnuelle: Math.round(renteAnnuelle),
        renteMensuelle: Math.round(renteAnnuelle / 12)
      };
    }

    const cotisationAnnuelleActuelle = salaireAssure * tauxCotisationTotal;
    const totalCotisationsAnnuelles = cotisationAnnuelleActuelle + rachats;
    
    const capitalFuturInteret = capital * Math.pow(1 + interet, anneesRestantes);
    const cotisationsFuturesValue = totalCotisationsAnnuelles * ((Math.pow(1 + interet, anneesRestantes) - 1) / interet);
    
    const capitalFinal = capitalFuturInteret + cotisationsFuturesValue;

    const tauxConv = TAUX_CONVERSION[ageRetraite] || 6.8;
    const renteAnnuelle = capitalFinal * (tauxConv / 100);

    return {
      capitalFinal: Math.round(capitalFinal),
      salaireAssure: Math.round(salaireAssure),
      cotisationAnnuelleActuelle: Math.round(cotisationAnnuelleActuelle),
      tauxCotisation: tauxCotisationTotal * 100,
      trancheAge: trancheAge,
      anneesRestantes: anneesRestantes,
      tauxConversion: tauxConv,
      renteAnnuelle: Math.round(renteAnnuelle),
      renteMensuelle: Math.round(renteAnnuelle / 12)
    };
  }, [anneeNaissance, salaireBrut, capitalActuel, rachatAnnuel, ageRetraite, tauxInteret, currentYear]);

  const handleCalcul = (e: React.FormEvent) => {
    e.preventDefault();
    setResultat(calculerLPPMemo);
    
    if (calculerLPPMemo && onResultChange) {
      const ageActuel = currentYear - (parseInt(anneeNaissance) || 1990);
      const anneesRestantes = ageRetraite - ageActuel;
      onResultChange({
        rente: calculerLPPMemo.renteMensuelle,
        capital: calculerLPPMemo.capitalFinal,
        salaire: parseFloat(salaireBrut) || 0,
        moisRestants: anneesRestantes > 0 ? anneesRestantes * 12 : 0
      });
    }
  };

  const formatCHF = (amount: number | null | undefined) => !amount ? '0' : amount.toLocaleString('fr-CH');

  return (
    <div className="lpp-container">

      <div className="lpp-title-container">
        <h1 className="lpp-title">{t('lpp.title')}</h1>
        <p className="lpp-subtitle">{t('lpp.subtitle')}</p>
      </div>

      <form onSubmit={handleCalcul} className="lpp-form">
        <div className="lpp-form-row">
          <div className="filter-group">
            <label>{t('lpp.annee_naissance')}</label>
            <input type="number" min="1940" max="2010" value={anneeNaissance} onChange={(e) => setAnneeNaissance(e.target.value)} className="form-input" />
            <small className="filter-hint">{t('lpp.age_hint', { age: ageUser, year: currentYear })}</small>
          </div>
          
          <div className="filter-group">
            <label>{t('lpp.salaire')}</label>
            <input type="number" placeholder="Ex: 90000" value={salaireBrut} onChange={(e) => setSalaireBrut(e.target.value)} className="form-input" />
            <small className="filter-hint">{t('lpp.salaire_hint')}</small>
          </div>
        </div>

        <div className="lpp-form-row">
          <div className="filter-group">
            <label>{t('lpp.capital')}</label>
            <input type="number" placeholder="Ex: 80000" value={capitalActuel} onChange={(e) => setCapitalActuel(e.target.value)} className="form-input" />
            <small className="filter-hint">{t('lpp.capital_hint')}</small>
          </div>
          
          <div className="filter-group">
            <label>{t('lpp.rachat')}</label>
            <input type="number" min="0" placeholder="0" value={rachatAnnuel} onChange={(e) => setRachatAnnuel(e.target.value)} className="form-input" />
            <small className="filter-hint">{t('lpp.rachat_hint')}</small>
          </div>
        </div>

        <div className="lpp-form-row">
          <div className="filter-group">
            <label>{t('lpp.age_retraite')}</label>
            <select value={ageRetraite} onChange={(e) => setAgeRetraite(parseInt(e.target.value))} className="form-input">
              {[63, 64, 65, 66, 67, 68, 69, 70].map(age => (
                <option key={age} value={age}>
                  {age} ans {age === 65 ? t('lpp.age_ordinaire') : age < 65 ? t('lpp.age_anticip') : t('lpp.age_ajourne')}
                </option>
              ))}
            </select>
            <small className="filter-hint">{t('lpp.age_hint')}</small>
          </div>
          
          <div className="filter-group">
            <label>{t('lpp.taux_interet')}</label>
            <input type="number" min="0" max="5" step="0.1" value={tauxInteret} onChange={(e) => setTauxInteret(e.target.value)} className="form-input" />
            <small className="filter-hint">{t('lpp.taux_interet_hint')}</small>
          </div>
        </div>

        <button className="btn-primary" type="submit" style={{ marginTop: '20px' }}>{t('lpp.calc_btn')}</button>
      </form>

      {resultat && (
        <div className="lpp-result-container">
          <h2 className="lpp-result-title">{t('lpp.result_title')}</h2>
          
          <div className="lpp-panels-wrapper">
            
            <div className="lpp-panel lpp-panel-blue">
              <h3 className="lpp-panel-header">{t('lpp.epargne')}</h3>
              
              <div className="simple-box light">
                <span className="simple-box-label">{t('lpp.salaire_assure')}</span>
                <h3 className="simple-box-value">{formatCHF(resultat.salaireAssure)} CHF</h3>
              </div>
              
              <div className="simple-box light">
                <span className="simple-box-label">{t('lpp.tranche_age')}</span>
                <h3 className="simple-box-value">{resultat.trancheAge} ({resultat.tauxCotisation.toFixed(0)}%)</h3>
              </div>

              <div className="simple-box light">
                <span className="simple-box-label">{t('lpp.cotisations')}</span>
                <h3 className="simple-box-value">{formatCHF(resultat.cotisationAnnuelleActuelle)} CHF</h3>
              </div>
              
              <div className="lpp-push-bottom">
                <div className="simple-box dark">
                  <span className="simple-box-label-dark">{t('lpp.capital_projete', { age: ageRetraite })}</span>
                  <h3 className="simple-box-value-dark">{formatCHF(resultat.capitalFinal)} CHF</h3>
                </div>
                <div className="lpp-info-box">
                  {t('lpp.projection_info', { years: resultat.anneesRestantes, rate: tauxInteret })}
                </div>
              </div>
            </div>

            <div className="lpp-panel lpp-panel-green">
              <h3 className="lpp-panel-header">{t('lpp.rente_title')}</h3>
              
              <div className="simple-box light">
                <span className="simple-box-label">{t('lpp.taux_conversion')}</span>
                <h3 className="simple-box-value">{resultat.tauxConversion.toFixed(1)} %</h3>
              </div>
              <div className="simple-box light">
                <span className="simple-box-label">{t('lpp.age_retraite')}</span>
                <h3 className="simple-box-value">{ageRetraite} ans</h3>
              </div>

              <div className="lpp-push-bottom">
                <div className="simple-box dark">
                  <span className="simple-box-label-dark">{t('lpp.rente_mensuelle')}</span>
                  <h3 className="simple-box-value-dark">{formatCHF(resultat.renteMensuelle)} CHF</h3>
                </div>
                <div className="simple-box total-box">
                  <span className="simple-box-label-dark">{t('lpp.rente_annuelle')}</span>
                  <h2 className="simple-box-value-dark">{formatCHF(resultat.renteAnnuelle)} CHF</h2>
                </div>
              </div>
            </div>

          </div>
          
          <div className="lpp-recap-box">
            <p>
              <strong>{t('lpp.recap_title', { age: ageRetraite })}</strong>
              <br/> - {t('lpp.recap_avs')}
              <br/> - {t('lpp.recap_lpp', { amount: formatCHF(resultat.renteMensuelle) })}
              <br/> - {t('lpp.recap_3a')}
            </p>
          </div>
        </div>
      )}

      {/* L'avertissement s'affiche uniquement si hideWarning n'est pas vrai (pour le fonctionnement indépendant) */}
      {!hideWarning && (
        <div className="avertissement-legal">
          <span className="titre-avertissement">⚖️ Avertissement</span>
          <span className="texte-avertissement">Ce simulateur est basé sur le taux de conversion minimum légal (OPB) de 6.8% à 65 ans et sur les barèmes de cotisation légaux (Art. 16). L'employeur et l'employé se partagent les cotisations, mais c'est le total (ex: 10% à 40 ans) qui est crédité sur le compte. Les intérêts composés sont calculés de manière linéaire selon le taux que vous avez saisi. Ce résultat est indicatif et ne remplace pas votre certificat de prévoyance officiel.</span>
        </div>
      )}
    </div>
  );
};

export default SimulateurLPP;