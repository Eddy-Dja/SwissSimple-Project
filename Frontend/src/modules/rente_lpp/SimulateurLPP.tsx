import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocalStorageState } from '../../hooks/useLocalStorageState';
import './SimulateurLPP.css';
import { Helmet } from 'react-helmet-async';

const LPP_CONSTANTS = {
  DEDUCTION_COORDINATION: 26460,
  SALAIRE_COORDONNE_MAX: 90720,
  SALAIRE_COORDONNE_MIN: 3780,
  TAUX_INTERET_MOYEN: 1.5,
};

const TAUX_CONVERSION: Record<number, number> = {
  63: 5.5, 64: 6.2, 65: 6.8, 66: 7.2, 67: 7.6, 68: 8.0, 69: 8.4, 70: 8.8
};

const getCotisationInfo = (age: number): { taux: number; tranche: string } => {
  if (age < 25) return { taux: 0, tranche: "Moins de 25 ans" };
  if (age < 35) return { taux: 0.07, tranche: "25 à 34 ans" };
  if (age < 45) return { taux: 0.10, tranche: "35 à 44 ans" };
  if (age < 55) return { taux: 0.15, tranche: "45 à 54 ans" };
  return { taux: 0.18, tranche: "55 ans et plus" };
};

/* ============================================================
   PARTAGE : payload du lien #s=... + encodage/décodage
   ============================================================ */
interface SharedLppData {
  v: number;        // version du format
  m: 'lpp';         // marqueur du module (reconnaissance du payload)
  an: string;       // année de naissance
  sal: string;      // salaire brut
  cap: string;      // capital actuel
  rac: string;      // rachat annuel
  ar: number;       // âge de retraite
  ti: string;       // taux d'intérêt
}

const encodeLppData = (data: SharedLppData): string => {
  try {
    return btoa(unescape(encodeURIComponent(JSON.stringify(data))))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  } catch { return ''; }
};

const decodeLppData = (raw: string): SharedLppData | null => {
  try {
    const b64 = raw.replace(/-/g, '+').replace(/_/g, '/');
    const d = JSON.parse(decodeURIComponent(escape(atob(b64))));
    if (
      d && d.v === 1 && d.m === 'lpp' &&
      typeof d.an === 'string' && typeof d.sal === 'string' &&
      typeof d.ar === 'number'
    ) {
      return d as SharedLppData;
    }
    return null;
  } catch { return null; }
};

const getShareHash = (): string | null => {
  try {
    const h = window.location.hash || '';
    return h.startsWith('#s=') ? h.substring(3) : null;
  } catch { return null; }
};

const buildLppShareLink = (data: SharedLppData): string =>
  `${window.location.origin}${window.location.pathname}?src=share#s=${encodeLppData(data)}`;

interface SimulateurLPPProps {
  onResultChange?: (data: { rente: number, capital: number, salaire: number, moisRestants: number, params: { anneeNaissance: number, salaire: number, capitalActuel: number, rachatAnnuel: number, ageRetraite: number, tauxInteret: number } } | null) => void;
  hideWarning?: boolean;
}

const SimulateurLPP: React.FC<SimulateurLPPProps> = ({ onResultChange, hideWarning }) => {
  const { t } = useTranslation();

  const [anneeNaissance, setAnneeNaissance] = useLocalStorageState('lpp_anneeNaissance', '1985');
  const [salaireBrut, setSalaireBrut] = useLocalStorageState('lpp_salaireBrut', '90000');
  const [capitalActuel, setCapitalActuel] = useLocalStorageState('lpp_capitalActuel', '80000');
  const [rachatAnnuel, setRachatAnnuel] = useLocalStorageState('lpp_rachatAnnuel', '0');
  const [ageRetraite, setAgeRetraite] = useLocalStorageState<number>('lpp_ageRetraite', 65);
  const [tauxInteret, setTauxInteret] = useLocalStorageState('lpp_tauxInteret', '1.5');
  
  const [resultat, setResultat] = useState<NonNullable<typeof calculerLPPMemo> | null>(null);

  /* ============================================================
     PARTAGE : vue destinataire (lien #s=...)
     ============================================================ */
  const [sharedView, setSharedView] = useState<SharedLppData | null>(() => {
    const raw = getShareHash();
    return raw ? decodeLppData(raw) : null;
  });
  const prefillApplied = useRef(false);
  const [autoCalcDone, setAutoCalcDone] = useState(false);

  // Pré-remplissage PENDANT le rendu (pattern React officiel)
  if (sharedView && !prefillApplied.current) {
    prefillApplied.current = true;
    if (typeof sharedView.an === 'string') setAnneeNaissance(sharedView.an);
    if (typeof sharedView.sal === 'string') setSalaireBrut(sharedView.sal);
    if (typeof sharedView.cap === 'string') setCapitalActuel(sharedView.cap);
    if (typeof sharedView.rac === 'string') setRachatAnnuel(sharedView.rac);
    if (typeof sharedView.ar === 'number') setAgeRetraite(sharedView.ar);
    if (typeof sharedView.ti === 'string') setTauxInteret(sharedView.ti);
  }

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

  /* ===== Calcul découpé : runCalcul (sans événement) = appelable par l'auto-calcul du partage ===== */
  const runCalcul = () => {
    setResultat(calculerLPPMemo);
    
    if (calculerLPPMemo && onResultChange) {
      const ageActuel = currentYear - (parseInt(anneeNaissance) || 1990);
      const anneesRestantes = ageRetraite - ageActuel;
      onResultChange({
        rente: calculerLPPMemo.renteMensuelle,
        capital: calculerLPPMemo.capitalFinal,
        salaire: parseFloat(salaireBrut) || 0,
        moisRestants: anneesRestantes > 0 ? anneesRestantes * 12 : 0,
        params: {
          anneeNaissance: parseInt(anneeNaissance) || 0,
          salaire: parseFloat(salaireBrut) || 0,
          capitalActuel: parseFloat(capitalActuel) || 0,
          rachatAnnuel: parseFloat(rachatAnnuel) || 0,
          ageRetraite,
          tauxInteret: parseFloat(tauxInteret) || 0
        }
      });
    }
  };

  const handleCalcul = (e: React.FormEvent) => {
    e.preventDefault();
    runCalcul();
  };

  const formatCHF = (amount: number | null | undefined) => !amount ? '0' : amount.toLocaleString('fr-CH');

  /* ===== PARTAGE : construction du lien + envoi ===== */
  const handleShare = async () => {
    if (!resultat) return;
    const data: SharedLppData = {
      v: 1, m: 'lpp',
      an: anneeNaissance, sal: salaireBrut, cap: capitalActuel,
      rac: rachatAnnuel, ar: ageRetraite, ti: tauxInteret,
    };
    const shareUrl = buildLppShareLink(data);
    const shareText = t('share.lpp_text', {
      capital: formatCHF(resultat.capitalFinal),
      rente: formatCHF(resultat.renteMensuelle),
      age: ageRetraite
    });
    const fullMessage = `${shareText}\n${t('share.test_here')} :\n${shareUrl}`;
    try {
      if (navigator.share) {
        await navigator.share({ text: fullMessage });
      } else {
        window.open(`https://wa.me/?text=${encodeURIComponent(fullMessage)}`, '_blank');
      }
    } catch {
      // Partage annulé par l'utilisateur : rien à faire
    }
  };

  /* ===== PARTAGE : le destinataire repart sur une simulation vierge ===== */
  const startOwnSimulation = () => {
    setAnneeNaissance('1985');
    setSalaireBrut('90000');
    setCapitalActuel('80000');
    setRachatAnnuel('0');
    setAgeRetraite(65);
    setTauxInteret('1.5');
    setResultat(null);
    setSharedView(null);
    try {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    } catch { /* ignore */ }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Auto-calcul du destinataire (une seule fois, après le pré-remplissage)
  useEffect(() => {
    if (sharedView && !autoCalcDone) {
      setAutoCalcDone(true);
      runCalcul();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sharedView, autoCalcDone]);

  return (
    <div className="lpp-container">

<Helmet>
  <title>Simulateur LPP 2026 | Calculateur 2ème Pilier & Capital Retraite</title>
  <meta name="description" content="Projetez votre capital de prévoyance professionnelle (LPP/2ème pilier) et estimez votre rente de retraite. Simulez l'impact de vos rachats 3a gratuitement." />
</Helmet>

      <div className="lpp-title-container">
        <h1 className="lpp-title">{t('lpp.title')}</h1>
        <p className="lpp-subtitle">{t('lpp.subtitle')}</p>
      </div>

      {sharedView && (
        <div className="share-banner">
          <span className="share-banner-text">{t('hub.shared_banner')}</span>
          <button type="button" className="btn-primary" onClick={startOwnSimulation}>
            {t('hub.shared_cta')}
          </button>
        </div>
      )}

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

      {resultat && !hideWarning && !onResultChange && (
        <>
          <p className="share-hint">{t('share.privacy_hint')}</p>
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
        </>
      )}

      {!hideWarning && (
        <div className="avertissement-legal">
          <span className="titre-avertissement">⚖️ {t('hub.warning_title')}</span>
          <span className="texte-avertissement">{t('lpp.warning')}</span>
        </div>
      )}
    </div>
  );
};

export default SimulateurLPP;