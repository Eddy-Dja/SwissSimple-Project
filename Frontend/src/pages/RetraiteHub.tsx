import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import SimulateurAVS from '../modules/rente_avs/SimulateurAVS';
import SimulateurLPP from '../modules/rente_lpp/SimulateurLPP';
import EmailGate from '../components/EmailGate';
import AuthModal from '../components/AuthModal';
import { useAuth } from '../context/AuthContext';
import { generateRetraitePDF } from '../utils/pdfGenerator';
import { useLocalStorageState } from '../hooks/useLocalStorageState';
import './RetraiteHub.css';
import SEO from '../components/SEO';

// ============================================================
// PARTAGE : encodage de la synthèse dans le lien (#s=...)
// Ne transporte QUE le contenu visible sans compte (paramètres
// et rentes du récap). Jamais la session, jamais l'analyse
// détaillée ni le PDF — qui restent derrière le compte.
// ============================================================
export interface SharedRetraiteData {
  v: number;
  avs?: {
    rente?: number;
    p?: {
      etatCivil?: string; sexe?: string;
      anneeNaissance?: number; salaire?: number;
      anneesCotisation?: number; anneesRachetees?: number;
      nombreEnfants?: number; ageRetraite?: number;
    };
  };
  lpp?: {
    renteFinale?: number;
    adjusted?: boolean;
    p?: {
      anneeNaissance?: number; salaire?: number;
      capitalActuel?: number; rachatAnnuel?: number;
      ageRetraite?: number; tauxInteret?: number;
    };
  };
  total?: number;
}

const encodeRetraiteShareData = (data: SharedRetraiteData): string => {
  const json = JSON.stringify(data);
  const bytes = new TextEncoder().encode(json);
  let bin = '';
  bytes.forEach(b => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const decodeRetraiteShareData = (hash: string): SharedRetraiteData | null => {
  const m = hash.match(/#s=([A-Za-z0-9\-_]+)/);
  if (!m) return null;
  try {
    let b64 = m[1].replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) { b64 += '='; }
    const bin = atob(b64);
    const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes)) as SharedRetraiteData;
  } catch {
    return null;
  }
};

const buildRetraiteShareLink = (data: SharedRetraiteData): string => {
  const base = `${window.location.origin}${window.location.pathname}`;
  return `${base}?src=share#s=${encodeRetraiteShareData(data)}`;
};

const RetraiteHub: React.FC = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useLocalStorageState<'avs' | 'lpp' | 'synthese'>('ret_activeTab', 'avs');
  
  const { user } = useAuth();
  const isUnlocked = !!user;
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // On inclut 'params' (de type any pour faire simple) dans les types
  const [avsData, setAvsData] = useState<{ rente: number, params: any } | null>(null);
  const [lppData, setLppData] = useState<{ rente: number, capital: number, salaire: number, moisRestants: number, params: any } | null>(null);

  const [retraitLPPInput, setRetraitLPPInput] = useLocalStorageState('ret_retraitLPP', '0');
  const [pourcentageCapital, setPourcentageCapital] = useLocalStorageState<number>('ret_pourcentageCapital', 0);
  const [revenuSouhaiteInput, setRevenuSouhaiteInput] = useLocalStorageState('ret_revenuSouhaite', '');

  const formatCHF = (amount: number) => Math.round(amount).toLocaleString('de-CH');
  const formatCHFPrecis = (amount: number) => amount.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const isDataReady = avsData !== null && lppData !== null;

  const renteAVSBase = avsData?.rente || 0;
  const renteLPPBase = lppData?.rente || 0;
  const capitalLPPBase = lppData?.capital || 0;
  const dernierSalaire = lppData?.salaire || 0;
  const moisRestants = lppData?.moisRestants || 0;

  const retraitLPP = parseFloat(retraitLPPInput) || 0;
  const perteRenteLPPRetrait = (retraitLPP * 0.068) / 12; 
  const renteLPPApresRetrait = Math.max(0, renteLPPBase - perteRenteLPPRetrait);

  const renteLPPFinale = renteLPPApresRetrait * (1 - pourcentageCapital / 100);
  const capitalCash = capitalLPPBase * (pourcentageCapital / 100);

  const totalRetraite = renteAVSBase + renteLPPFinale;
  
  // --- CORRECTION MATHÉMATIQUE ICI ---
  // On calcule le salaire mensuel pour comparer des pommes avec des pommes
  const salaireMensuel = dernierSalaire > 0 ? dernierSalaire / 12 : 0;
  const tauxRemplacement = salaireMensuel > 0 ? Math.round((totalRetraite / salaireMensuel) * 100) : 0;
  // -----------------------------------
  
  const tauxMarginalEstime = dernierSalaire > 200000 ? 0.30 : (dernierSalaire > 100000 ? 0.25 : 0.20);
  const estimatedTaxSaving = Math.round(7258 * tauxMarginalEstime);

  const revenuSouhaite = parseFloat(revenuSouhaiteInput) || 0;
  const trouMensuel = revenuSouhaite - totalRetraite;
  const capitalNecessaire = trouMensuel > 0 ? trouMensuel * 12 * 14.7 : 0; 
  const versementMensuel3a = capitalNecessaire > 0 && moisRestants > 0 ? capitalNecessaire / moisRestants : 0;

    // --- VUE PARTAGÉE : si le lien ouvert contient #s=..., le destinataire
  // voit la synthèse partagée (lecture seule) au lieu d'un formulaire vide ---
  const [sharedView, setSharedView] = useState<SharedRetraiteData | null>(() =>
    typeof window !== 'undefined' ? decodeRetraiteShareData(window.location.hash) : null
  );

  // À l'ouverture d'un lien partagé : aller directement sur la synthèse
  useEffect(() => {
    if (sharedView) {
      setActiveTab('synthese');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startOwnSimulation = () => {
    setSharedView(null);
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    setActiveTab('avs');
    window.scrollTo(0, 0);
  };

  // Valeurs affichées : celles du partage s'il est actif, sinon les siennes
  const vAvsRente = sharedView ? (sharedView.avs?.rente ?? null) : (avsData !== null ? renteAVSBase : null);
  const vAvsParams = sharedView ? sharedView.avs?.p : avsData?.params;
  const vLppRente = sharedView ? (sharedView.lpp?.renteFinale ?? null) : (lppData !== null ? renteLPPFinale : null);
  const vLppAdjusted = sharedView ? !!sharedView.lpp?.adjusted : (retraitLPP > 0 || pourcentageCapital > 0);
  const vLppParams = sharedView ? sharedView.lpp?.p : lppData?.params;
  const vTotal = sharedView
    ? (sharedView.total ?? ((sharedView.avs?.rente ?? 0) + (sharedView.lpp?.renteFinale ?? 0)))
    : totalRetraite;
  const recapReady = sharedView !== null || isDataReady;

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [activeTab]);

  // --- FONCTION DE PARTAGE MULTILINGUE POUR LA RETRAITE ---
  const handleShare = async () => {    
    const avsP = avsData?.params;
    const lppP = lppData?.params;
    
    // On inclut tous les paramètres dans le message de partage
    const avsText = t('share.ret_avs', { 
      state: t(`avs.${avsP?.etatCivil || 'celibataire'}`),
      gender: t(`avs.${avsP?.sexe || 'homme'}`),
      birthYear: avsP?.anneeNaissance || 0,
      salary: avsP?.salaire || 0,
      years: avsP?.anneesCotisation || 0,
      boughtYears: avsP?.anneesRachetees || 0,
      children: avsP?.nombreEnfants || 0,
      age: avsP?.ageRetraite || 65
    });
    
    const lppText = t('share.ret_lpp', { 
      birthYear: lppP?.anneeNaissance || 0,
      salary: lppP?.salaire || 0,
      capital: lppP?.capitalActuel || 0,
      buyback: lppP?.rachatAnnuel || 0,
      age: lppP?.ageRetraite || 65,
      rate: lppP?.tauxInteret || 0
    });
    
    const resultText = t('share.ret_result', { total: formatCHFPrecis(totalRetraite) });
    const callToAction = t('share.ret_call');
    
    const shareText = `${resultText}\n${avsText}\n${lppText}\n${callToAction}`;

       // NOUVEAU : le lien transporte la synthèse (contenu visible sans compte)
    const shareUrl = buildRetraiteShareLink({
      v: 1,
      avs: {
        rente: renteAVSBase,
        p: {
          etatCivil: avsP?.etatCivil,
          sexe: avsP?.sexe,
          anneeNaissance: avsP?.anneeNaissance,
          salaire: avsP?.salaire,
          anneesCotisation: avsP?.anneesCotisation,
          anneesRachetees: avsP?.anneesRachetees,
          nombreEnfants: avsP?.nombreEnfants,
          ageRetraite: avsP?.ageRetraite,
        },
      },
      lpp: {
        renteFinale: renteLPPFinale,
        adjusted: retraitLPP > 0 || pourcentageCapital > 0,
        p: {
          anneeNaissance: lppP?.anneeNaissance,
          salaire: lppP?.salaire,
          capitalActuel: lppP?.capitalActuel,
          rachatAnnuel: lppP?.rachatAnnuel,
          ageRetraite: lppP?.ageRetraite,
          tauxInteret: lppP?.tauxInteret,
        },
      },
      total: totalRetraite,
    });

    const fullMessage = `${shareText} ${t('share.test_here')} : ${shareUrl}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'SwissSimple - Retraite',
          text: shareText,
          url: shareUrl,
        });
      } catch (error) {
        console.log('Partage annulé');
      }
    } else {
      const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(fullMessage)}`;
      window.open(whatsappUrl, '_blank');
    }
  };

  return (
    <div className="hub-container">

<SEO title={t('seo.retraite_title')} description={t('seo.retraite_desc')} path="/retraite" />

      <div className="hub-header">
        <h1 className="radar-title">{t('hub.retraite_title')}</h1>
        <p>{t('hub.retraite_subtitle')}</p>
        
        <div className="hub-tabs">
          <button className={activeTab === 'avs' ? 'active' : ''} onClick={() => setActiveTab('avs')}>
            {t('hub.tab1_avs')}
          </button>
          <button className={activeTab === 'lpp' ? 'active' : ''} onClick={() => setActiveTab('lpp')}>
            {t('hub.tab2_lpp')}
          </button>
          <button className={activeTab === 'synthese' ? 'active' : ''} onClick={() => setActiveTab('synthese')}>
            {t('hub.tab3_synthese')}
          </button>
        </div>
      </div>

      <div className="hub-content">
        {/* --- ÉTAPE 1 : AVS --- */}
        <div className={`hub-step ${activeTab === 'avs' ? 'visible' : 'hidden'}`}>
          <SimulateurAVS 
            hideWarning
            onResultChange={(data) => setAvsData(data)}
          />
          <div className="hub-navigation">
            <button className="btn-hub-next" onClick={() => setActiveTab('lpp')}>
              {t('hub.tab2_lpp')} →
            </button>
          </div>
        </div>

        {/* --- ÉTAPE 2 : LPP --- */}
        <div className={`hub-step ${activeTab === 'lpp' ? 'visible' : 'hidden'}`}>
          <SimulateurLPP 
            hideWarning
            onResultChange={(data) => setLppData(data)}
          />
          <div className="hub-navigation">
            <button className="btn-hub-prev" onClick={() => setActiveTab('avs')}>
              ← {t('hub.back_avs', 'Retour à la rente AVS')}
            </button>
            <button className="btn-hub-next" onClick={() => setActiveTab('synthese')}>
              {t('hub.next_step_synthese', 'Passer à la synthèse financière')} → 📊
            </button>
          </div>
        </div>

        {/* --- ÉTAPE 3 : SYNTHÈSE FINALE --- */}
        <div className={`hub-step ${activeTab === 'synthese' ? 'visible' : 'hidden'}`}>
          <div className="synthese-container">
            <h2>{t('hub.synthese_title_ret')}</h2>
            <p>{t('hub.synthese_intro_ret')}</p>
            
          {/* Bandeau "simulation partagée" — visible si le lien contient des données */}
            {sharedView && (
              <div className="hub-warning-message" style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center', textAlign: 'center' }}>
                <span>🔗 {t('hub.shared_banner')}</span>
                <button className="btn-hub-blue" onClick={startOwnSimulation}>
                  {t('hub.shared_cta')}
                </button>
              </div>
            )}

            {!recapReady && (
              <p className="hub-warning-message">
                {t('hub.waiting_message')}
              </p>
            )}

            <div className="synthese-recap">
              {/* 1. MODULE AVS */}
              <div className="recap-item">
                <div className="recap-line">
                  <span className="recap-title">{t('hub.recap_avs')}</span>
                  <p className="recap-value benefice">
                    {vAvsRente !== null ? `${formatCHFPrecis(vAvsRente)} CHF / mois` : t('hub.waiting_calc')}
                  </p>
                </div>
                {vAvsParams && (
                  <div className="recap-module-detail">
                    {t('hub.recap_avs_details', {
                      state: t(`avs.${vAvsParams.etatCivil}`),
                      gender: t(`avs.${vAvsParams.sexe}`),
                      birthYear: vAvsParams.anneeNaissance,
                      salary: formatCHF(vAvsParams.salaire),
                      years: vAvsParams.anneesCotisation,
                      boughtYears: vAvsParams.anneesRachetees,
                      children: vAvsParams.nombreEnfants,
                      age: vAvsParams.ageRetraite
                    })}
                  </div>
                )}
              </div>

              {/* 2. MODULE LPP */}
              <div className="recap-item">
                <div className="recap-line">
                  <span className="recap-title">{t('hub.recap_lpp')}</span>
                  <p className="recap-value benefice">
                    {vLppRente !== null ? (
                      <>
                        {formatCHFPrecis(vLppRente)} CHF / mois
                        {vLppAdjusted && <small className="hub-adjusted-small">{t('hub.adjusted')}</small>}
                      </>
                    ) : t('hub.waiting_calc')}
                  </p>
                </div>
                {vLppParams && (
                  <div className="recap-module-detail">
                    {t('hub.recap_lpp_details', {
                      birthYear: vLppParams.anneeNaissance,
                      salary: formatCHF(vLppParams.salaire),
                      capital: formatCHF(vLppParams.capitalActuel),
                      buyback: formatCHF(vLppParams.rachatAnnuel),
                      age: vLppParams.ageRetraite,
                      rate: vLppParams.tauxInteret
                    })}
                  </div>
                )}
              </div>

              {/* 3. TOTAL RETRAITE */}
              <div className="recap-total">
                <span>{t('hub.recap_total_ret')}</span>
                <h3 className="benefice">
                  {recapReady ? `${formatCHFPrecis(vTotal)} CHF / mois` : t('hub.waiting_calc')}
                </h3>
              </div>
            </div>

            {/* --- BOUTON DE PARTAGE --- */}
            {isDataReady && (
              <div className="share-btn-container">
                <button className="btn-hub-blue" onClick={handleShare}>
                  {t('hub.share_result_btn')}
                </button>
              </div>
            )}
            {/* ------------------------- */}

            {!isUnlocked ? (
              <EmailGate 
                title={t('hub.gate_title')}
                description={t('hub.gate_desc_ret')}
                onUnlock={() => setIsAuthModalOpen(true)}
              />
            ) : (
              <div className="unlocked-results">
                <h3>{t('hub.unlocked')}</h3>
                <p>{t('hub.unlocked_desc_ret')}</p>

                <div className="analysis-card">
                  <h4>{t('hub.rate_title')}</h4>
                  <p className="analysis-desc">
                    {t('hub.rate_desc', { salary: formatCHFPrecis(dernierSalaire) })}
                  </p>
                  <div className="replacement-gauge">
                    <div className="gauge-bar" style={{ width: `${Math.min(tauxRemplacement, 100)}%` }}></div>
                    <span className="gauge-text">{tauxRemplacement}%</span>
                  </div>
                  {dernierSalaire > 0 && tauxRemplacement < 70 ? (
                    <p className="break-even-result perte mt-15" dangerouslySetInnerHTML={{ __html: t('hub.rate_warning', { missing: formatCHFPrecis((salaireMensuel * 0.7) - totalRetraite) }) }} />
                  ) : dernierSalaire > 0 ? (
                    <p className="break-even-result benefice mt-15">
                      {t('hub.rate_success')}
                    </p>
                  ) : null}
                </div>

                <div className="analysis-card">
                  <h4>{t('hub.goal_title')}</h4>
                  <p className="analysis-desc">{t('hub.goal_desc')}</p>
                  
                  <div className="break-even-grid">
                    <div className="break-even-item">
                      <label>{t('hub.goal_label')}</label>
                      <div className="input-wrapper">
                        <span className="input-currency">CHF</span>
                        <input 
                          type="number" min="0" step="0.01"
                          placeholder="Ex: 6000.00" 
                          className="break-even-input"
                          value={revenuSouhaiteInput}
                          onChange={(e) => setRevenuSouhaiteInput(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  {revenuSouhaite > 0 && (
                    <div className={`break-even-result ${trouMensuel > 0 ? 'perte' : 'benefice'}`}>
                      {trouMensuel > 0 ? (
                        <p dangerouslySetInnerHTML={{ __html: t('hub.goal_warning', {
                          target: formatCHFPrecis(revenuSouhaite),
                          missing: formatCHFPrecis(trouMensuel),
                          capital: formatCHFPrecis(capitalNecessaire),
                          monthly: formatCHFPrecis(versementMensuel3a)
                        }) }} />
                      ) : (
                        <p dangerouslySetInnerHTML={{ __html: t('hub.goal_success', {
                          target: formatCHFPrecis(revenuSouhaite),
                          surplus: formatCHFPrecis(Math.abs(trouMensuel))
                        }) }} />
                      )}
                    </div>
                  )}
                </div>

                <div className="analysis-card">
                  <h4>{t('hub.lpp_impact_title')}</h4>
                  <p className="analysis-desc">{t('hub.lpp_impact_desc')}</p>
                  
                  <div className="break-even-grid">
                    <div className="break-even-item">
                      <label>{t('hub.lpp_impact_label')}</label>
                      <div className="input-wrapper">
                        <span className="input-currency">CHF</span>
                        <input 
                          type="number" min="0" step="0.01"
                          placeholder="Ex: 50000.00" 
                          className="break-even-input"
                          value={retraitLPPInput}
                          onChange={(e) => setRetraitLPPInput(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  {retraitLPP > 0 && (
                    <div className="break-even-result perte">
                      <p dangerouslySetInnerHTML={{ __html: t('hub.lpp_impact_warning', {
                        amount: formatCHFPrecis(retraitLPP),
                        loss: formatCHFPrecis(perteRenteLPPRetrait),
                        totalLoss: formatCHFPrecis(perteRenteLPPRetrait * 12 * 20)
                      }) }} />
                    </div>
                  )}
                </div>

                <div className="analysis-card">
                  <h4>{t('hub.capital_title')}</h4>
                  <p className="analysis-desc">{t('hub.capital_desc')}</p>
                  
                  <div className="slider-container">
                    <div className="slider-row">
                      <span>{t('hub.capital_0')}</span>
                      <strong className="text-blue">{pourcentageCapital}%</strong>
                    </div>
                    <input 
                      type="range" min="0" max="100" step="5"
                      value={pourcentageCapital}
                      onChange={(e) => setPourcentageCapital(parseInt(e.target.value))}
                      className="range-slider"
                    />
                  </div>

                  {pourcentageCapital > 0 && (
                    <div className="reco-3a mt-20">
                      <div className="reco-item">
                        <span>{t('hub.capital_cash')}</span>
                        <strong className="benefice">+ {formatCHFPrecis(capitalCash)} CHF</strong>
                      </div>
                      <div className="reco-item">
                        <span>{t('hub.capital_rent')}</span>
                        <strong className="perte">{formatCHFPrecis(renteLPPFinale)} CHF / mois</strong>
                      </div>
                    </div>
                  )}
                </div>

                <div className="analysis-card">
                  <h4>{t('hub.reco_title')}</h4>
                  <p className="analysis-desc">
                    {t('hub.reco_desc')}
                  </p>

                  <div className="reco-3a">
                    <div className="reco-item">
                      <span>{t('hub.reco_max')}</span>
                      <strong>7'258 CHF / an</strong>
                    </div>
                    <div className="reco-item">
                      <span>{t('hub.reco_tax')}</span>
                      <strong className="benefice">~ {formatCHF(estimatedTaxSaving)} CHF / an</strong>
                    </div>
                  </div>

                  <div className="hub-navigation pdf-btn-container">
                    <button className="btn-hub-blue btn-disabled" disabled>
                      {t('hub.reco_btn')} {t('hub.coming_soon')}
                    </button>
                  </div>
                </div>

                <div className="analysis-card">
                  <h4>{t('hub.pdf_title')}</h4>
                  <p className="analysis-desc">{t('hub.pdf_desc_ret')}</p>
                   <div className="hub-navigation pdf-btn-container">
                    <button 
                      className="btn-hub-blue" 
                      onClick={() => generateRetraitePDF({
                        renteAVS: renteAVSBase,
                        renteLPP: renteLPPFinale,
                        totalRetraite,
                        dernierSalaire,
                        tauxRemplacement,
                        estimatedTaxSaving,
                        retraitLPP,
                        perteRenteLPPRetrait,
                        pourcentageCapital,
                        capitalCash,
                        revenuSouhaite,
                        trouMensuel,
                        capitalNecessaire,
                        versementMensuel3a,
                        avsParams: avsData?.params, 
                        lppParams: lppData?.params  
                      }, t)}
                    >
                      {t('hub.pdf_btn_ret')}
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="hub-navigation">
              <button className="btn-hub-next" onClick={() => setActiveTab('avs')}>
                {t('hub.back_avs', '← Retour à la rente AVS')}
              </button>
              <button className="btn-hub-next" onClick={() => setActiveTab('lpp')}>
                {t('hub.back_lpp', '← Retour à la rente LPP')}
              </button>
            </div>

          </div>
        </div>
      </div>

      <div className="avertissement-legal">
        <span className="titre-avertissement">⚖️ {t('hub.warning_title')}</span>
        <span className="texte-avertissement">{t('hub.warning_ret')}</span>
      </div>

      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
    </div>
  );
};

export default RetraiteHub;