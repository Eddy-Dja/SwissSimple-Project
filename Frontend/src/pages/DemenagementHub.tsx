import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import RadarFiscal from '../modules/fiscal/RadarFiscal';
import Assurance, { getRegionLabel } from '../modules/assurance_maladie/Assurance'; // <-- Import ajouté ici
import EmailGate from '../components/EmailGate';
import AuthModal from '../components/AuthModal';
import { useAuth } from '../context/AuthContext';
import { generateDemenagementPDF } from '../utils/pdfGenerator';
import { useLocalStorageState } from '../hooks/useLocalStorageState';
import './DemenagementHub.css';
import { Helmet } from 'react-helmet-async';

// ============================================================
// PARTAGE : encodage de la synthèse dans le lien (#s=...)
// Ne transporte QUE le contenu visible sans compte (communes,
// régions, montants). Jamais la session, jamais l'analyse
// détaillée ni le PDF — qui restent derrière le compte.
// ============================================================
export interface SharedDemenagementData {
  v: number;
  dep?: string;
  arr?: string;
  tax?: number | null;
  ins?: {
    depCanton?: string; depRegion?: string;
    arrCanton?: string; arrRegion?: string;
    avgA?: number; avgB?: number; diff?: number | null;
  };
  tot?: number;
}

const encodeShareData = (data: SharedDemenagementData): string => {
  const json = JSON.stringify(data);
  const bytes = new TextEncoder().encode(json);
  let bin = '';
  bytes.forEach(b => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const decodeShareData = (hash: string): SharedDemenagementData | null => {
  const m = hash.match(/#s=([A-Za-z0-9\-_]+)/);
  if (!m) return null;
  try {
    let b64 = m[1].replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) { b64 += '='; }
    const bin = atob(b64);
    const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes)) as SharedDemenagementData;
  } catch {
    return null;
  }
};

const buildDemenagementShareLink = (data: SharedDemenagementData): string => {
  const base = `${window.location.origin}${window.location.pathname}`;
  return `${base}?src=share#s=${encodeShareData(data)}`;
};

const DemenagementHub: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [activeTab, setActiveTab] = useLocalStorageState<'impots' | 'assurance' | 'synthese'>('dem_activeTab', 'impots');
  
  const [taxDiff, setTaxDiff] = useState<number | null>(null);
  const [insuranceDiff, setInsuranceDiff] = useState<number | null>(null);

  // Variables pour les codes bruts des régions d'assurance
  const [insuranceDepCanton, setInsuranceDepCanton] = useState<string>('');
  const [insuranceDepRegion, setInsuranceDepRegion] = useState<string>('');
  const [insuranceArrCanton, setInsuranceArrCanton] = useState<string>('');
  const [insuranceArrRegion, setInsuranceArrRegion] = useState<string>('');

  const [fraisUniquesInput, setFraisUniquesInput] = useLocalStorageState('dem_fraisUniques', '');
  const [ancienLoyerInput, setAncienLoyerInput] = useLocalStorageState('dem_ancienLoyer', '');
  const [nouveauLoyerInput, setNouveauLoyerInput] = useLocalStorageState('dem_nouveauLoyer', '');
  const [ancienTransportInput, setAncienTransportInput] = useLocalStorageState('dem_ancienTransport', '');
  const [nouveauTransportInput, setNouveauTransportInput] = useLocalStorageState('dem_nouveauTransport', '');
  
  const [pointMortMois, setPointMortMois] = useState<number | null>(null);
  const [analyseDetails, setAnalyseDetails] = useState<{loyer: number, transport: number, economiesReelles: number} | null>(null);

  const [taxDetails, setTaxDetails] = useState<any>(null);
  const [insuranceAvgA, setInsuranceAvgA] = useState<number>(0);
  const [insuranceAvgB, setInsuranceAvgB] = useState<number>(0);

  const { user } = useAuth();
  const isUnlocked = !!user;
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const totalDiff = (taxDiff || 0) + (insuranceDiff || 0);
  const isDataReady = taxDiff !== null && insuranceDiff !== null;

  const formatCHF = (amount: number) => Math.round(amount).toLocaleString('de-CH');
  const formatCHFPrecis = (amount: number) => amount.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  
    // --- VUE PARTAGÉE : si le lien ouvert contient #s=..., le destinataire
  // voit la synthèse partagée (lecture seule) au lieu d'un formulaire vide ---
  const [sharedView, setSharedView] = useState<SharedDemenagementData | null>(() =>
    typeof window !== 'undefined' ? decodeShareData(window.location.hash) : null
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
    // retire le #s=... de l'URL sans recharger la page
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    setActiveTab('impots');
    window.scrollTo(0, 0);
  };

  // Valeurs affichées : celles du partage s'il est actif, sinon les siennes
  const vTax = sharedView ? (sharedView.tax ?? null) : taxDiff;
  const vIns = sharedView ? (sharedView.ins?.diff ?? null) : insuranceDiff;
  const vTot = sharedView
    ? (sharedView.tot ?? ((sharedView.tax ?? 0) + (sharedView.ins?.diff ?? 0)))
    : totalDiff;
  const recapReady = sharedView !== null || isDataReady;
  const dispTaxDepName = sharedView ? sharedView.dep : taxDetails?.depName;
  const dispTaxArrName = sharedView ? sharedView.arr : taxDetails?.arrName;
  const dispInsDepCanton = sharedView ? (sharedView.ins?.depCanton ?? '') : insuranceDepCanton;
  const dispInsDepRegion = sharedView ? (sharedView.ins?.depRegion ?? '') : insuranceDepRegion;
  const dispInsArrCanton = sharedView ? (sharedView.ins?.arrCanton ?? '') : insuranceArrCanton;
  const dispInsArrRegion = sharedView ? (sharedView.ins?.arrRegion ?? '') : insuranceArrRegion;

  const calculateBreakEven = () => {
    let fraisUniques = parseFloat(fraisUniquesInput) || 0;
    let ancienLoyer = parseFloat(ancienLoyerInput) || 0;
    let nouveauLoyer = parseFloat(nouveauLoyerInput) || 0;
    let ancienT = parseFloat(ancienTransportInput) || 0;
    let nouveauT = parseFloat(nouveauTransportInput) || 0;
    
    if (fraisUniques < 0) fraisUniques = 0;
    if (ancienLoyer < 0) ancienLoyer = 0;
    if (nouveauLoyer < 0) nouveauLoyer = 0;
    if (ancienT < 0) ancienT = 0;
    if (nouveauT < 0) nouveauT = 0;

    const diffLoyerAnnuel = (ancienLoyer - nouveauLoyer) * 12;
    const diffTransportAnnuel = ancienT - nouveauT;
    const economiesReelles = totalDiff + diffLoyerAnnuel + diffTransportAnnuel;

    setAnalyseDetails({ loyer: diffLoyerAnnuel, transport: diffTransportAnnuel, economiesReelles });

    if (economiesReelles <= 0) {
      setPointMortMois(-1);
      return;
    }
    if (fraisUniques > 0) {
      const mois = Math.ceil(fraisUniques / (economiesReelles / 12));
      setPointMortMois(mois);
    } else {
      setPointMortMois(null);
    }
  };

  // --- FONCTION DE PARTAGE MULTILINGUE (lien avec la synthèse embarquée) ---
  const handleShare = async () => {
    const communeDep = taxDetails?.depName || t('share.default_city');
    const communeArr = taxDetails?.arrName || t('share.default_city');

    const impactText = totalDiff >= 0
      ? t('share.dem_saving', { amount: formatCHF(Math.abs(totalDiff)) })
      : t('share.dem_cost', { amount: formatCHF(Math.abs(totalDiff)) });

    const shareText = t('share.dem_text', { from: communeDep, to: communeArr, impact: impactText });

    // NOUVEAU : le lien transporte la synthèse (contenu visible sans compte)
    const shareUrl = buildDemenagementShareLink({
      v: 1,
      dep: communeDep,
      arr: communeArr,
      tax: taxDiff,
      ins: {
        depCanton: insuranceDepCanton,
        depRegion: insuranceDepRegion,
        arrCanton: insuranceArrCanton,
        arrRegion: insuranceArrRegion,
        avgA: insuranceAvgA,
        avgB: insuranceAvgB,
        diff: insuranceDiff,
      },
      tot: totalDiff,
    });

    const fullMessage = `${shareText} ${t('share.test_here')} : ${shareUrl}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'SwissSimple - Déménagement',
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

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [activeTab]);

  return (
    <div className="hub-container">
      <Helmet>
        <title>Simulateur Déménagement Suisse | Impôts & Assurances comparés</title>
        <meta name="description" content="Calculez le vrai coût d'un déménagement en Suisse. Comparez impôts, primes d'assurance maladie et loyers pour choisir la meilleure commune pour votre budget." />
      </Helmet>

      <div className="hub-header">
        <h1 className="radar-title">{t('hub.demenagement_title')}</h1>
        <p>{t('hub.demenagement_subtitle')}</p>
        
        <div className="hub-tabs">
          <button className={activeTab === 'impots' ? 'active' : ''} onClick={() => setActiveTab('impots')}>
            {t('hub.tab1_impots')}
          </button>
          <button className={activeTab === 'assurance' ? 'active' : ''} onClick={() => setActiveTab('assurance')}>
            {t('hub.tab2_assurance')}
          </button>
          <button className={activeTab === 'synthese' ? 'active' : ''} onClick={() => setActiveTab('synthese')}>
            {t('hub.tab3_synthese')}
          </button>
        </div>
      </div>

      <div className="hub-content">
        {/* --- ÉTAPE 1 : IMPÔTS --- */}
        <div className={`hub-step ${activeTab === 'impots' ? 'visible' : 'hidden'}`}>
          <RadarFiscal 
            hideWarning
            initialMode="comparaison" 
            onNextStep={() => setActiveTab('assurance')}
            onResultChange={(diff, details) => { setTaxDiff(diff); setTaxDetails(details); }}
          />
        </div>

        {/* --- ÉTAPE 2 : ASSURANCE --- */}
        <div className={`hub-step ${activeTab === 'assurance' ? 'visible' : 'hidden'}`}>
          <Assurance 
            hideWarning
            initialMode="comparaison" 
            onPrevStep={() => setActiveTab('impots')} 
            onNextStep={() => setActiveTab('synthese')}
            onResultChange={(diff, details) => { 
              setInsuranceDiff(diff); 
              if(details) { 
                setInsuranceAvgA(details.avgA); 
                setInsuranceAvgB(details.avgB);
                setInsuranceDepCanton(details.depCanton);
                setInsuranceDepRegion(details.depRegion);
                setInsuranceArrCanton(details.arrCanton);
                setInsuranceArrRegion(details.arrRegion);
              }
            }}
          />
        </div>

        {/* --- ÉTAPE 3 : SYNTHÈSE FINALE --- */}
        <div className={`hub-step ${activeTab === 'synthese' ? 'visible' : 'hidden'}`}>
          <div className="synthese-container">
            <h2>{t('hub.synthese_title_move')}</h2>
            <p>{t('hub.synthese_intro_move')}</p>
            
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
              {/* 1. MODULE IMPÔTS */}
              <div className="recap-item">
                <div className="recap-line">
                  <span className="recap-title">{t('hub.recap_impots')}</span>
                  <p className={`recap-value ${vTax !== null && vTax >= 0 ? 'benefice' : 'perte'}`}>
                    {vTax !== null ? `${vTax >= 0 ? t('hub.economy') : t('hub.surcout')}${formatCHF(Math.abs(vTax))} CHF / an` : t('hub.waiting_calc')}
                  </p>
                </div>
                {(dispTaxDepName || dispTaxArrName) && (
                  <div className="recap-module-detail">
                    {t('hub.recap_move_details', { from: dispTaxDepName, to: dispTaxArrName })}
                  </div>
                )}
              </div>

              {/* 2. MODULE ASSURANCE */}
              <div className="recap-item">
                <div className="recap-line">
                  <span className="recap-title">{t('hub.recap_assurance')}</span>
                  <p className={`recap-value ${vIns !== null && vIns >= 0 ? 'benefice' : 'perte'}`}>
                    {vIns !== null ? `${vIns >= 0 ? t('hub.economy') : t('hub.surcout')}${formatCHF(Math.abs(vIns))} CHF / an` : t('hub.waiting_calc')}
                  </p>
                </div>
                {(dispInsDepCanton || dispInsArrCanton) && (
                  <div className="recap-module-detail">
                    {t('hub.recap_move_details', {
                      from: `${dispInsDepCanton} - ${getRegionLabel(dispInsDepCanton, dispInsDepRegion, i18n.language)}`,
                      to: `${dispInsArrCanton} - ${getRegionLabel(dispInsArrCanton, dispInsArrRegion, i18n.language)}`
                    })}
                  </div>
                )}
              </div>

              {/* 3. TOTAL DÉMÉNAGEMENT */}
              <div className="recap-total">
                <span>{t('hub.recap_total_move')}</span>
                <h3 className={vTot >= 0 ? 'benefice' : 'perte'}>
                  {recapReady ? `${vTot >= 0 ? '+' : '-'}${formatCHF(Math.abs(vTot))} CHF / an` : t('hub.waiting_calc')}
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

            {!isUnlocked ? (
              <EmailGate 
                title={t('hub.gate_title')}
                description={t('hub.gate_desc_move')}
                onUnlock={() => setIsAuthModalOpen(true)}
              />
            ) : (
              <div className="unlocked-results">
                <h3>{t('hub.unlocked')}</h3>
                <p>{t('hub.unlocked_desc_move')}</p>

                <div className="analysis-card">
                  <h4>{t('hub.roi_title')}</h4>
                  <p className="analysis-desc">{t('hub.roi_desc')}</p>
                  
                  <div className="roi-section">
                    <h5>{t('hub.roi_unique')}</h5>
                    <div className="break-even-grid">
                      <div className="break-even-item">
                        <label>{t('hub.roi_unique_label')}</label>
                        <div className="input-wrapper">
                          <span className="input-currency">CHF</span>
                          <input type="number" min="0" step="0.01" placeholder="Ex: 3000.00" value={fraisUniquesInput} onChange={(e) => setFraisUniquesInput(e.target.value)} className="break-even-input" />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="roi-section">
                    <h5>{t('hub.roi_monthly')}</h5>
                    <div className="break-even-grid">
                      <div className="break-even-item">
                        <label>{t('hub.roi_old_rent')}</label>
                        <div className="input-wrapper">
                          <span className="input-currency">CHF</span>
                          <input type="number" min="0" step="0.01" placeholder="Ex: 1800.00" value={ancienLoyerInput} onChange={(e) => setAncienLoyerInput(e.target.value)} className="break-even-input" />
                        </div>
                      </div>
                      <div className="break-even-item">
                        <label>{t('hub.roi_new_rent')}</label>
                        <div className="input-wrapper">
                          <span className="input-currency">CHF</span>
                          <input type="number" min="0" step="0.01" placeholder="Ex: 1600.00" value={nouveauLoyerInput} onChange={(e) => setNouveauLoyerInput(e.target.value)} className="break-even-input" />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="roi-section">
                    <h5>{t('hub.roi_transport')}</h5>
                    <div className="break-even-grid">
                      <div className="break-even-item">
                        <label>{t('hub.roi_old_transport')}</label>
                        <div className="input-wrapper">
                          <span className="input-currency">CHF</span>
                          <input type="number" min="0" step="0.01" placeholder="Ex: 800.00" value={ancienTransportInput} onChange={(e) => setAncienTransportInput(e.target.value)} className="break-even-input" />
                        </div>
                      </div>
                      <div className="break-even-item">
                        <label>{t('hub.roi_new_transport')}</label>
                        <div className="input-wrapper">
                          <span className="input-currency">CHF</span>
                          <input type="number" min="0" step="0.01" placeholder="Ex: 1500.00" value={nouveauTransportInput} onChange={(e) => setNouveauTransportInput(e.target.value)} className="break-even-input" />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="roi-calc-container">
                    <button className="btn-calc-blue w-100" onClick={calculateBreakEven}>{t('hub.roi_calc_btn')}</button>
                  </div>
                  
                  {pointMortMois !== null && analyseDetails && (
                    <div className={`break-even-result ${pointMortMois === -1 ? 'perte' : 'benefice'}`}>
                      {pointMortMois === -1 ? (
                        <p dangerouslySetInnerHTML={{ __html: t('hub.roi_not_profitable', {
                          totalDiff: formatCHFPrecis(totalDiff),
                          loyer: analyseDetails.loyer >= 0 ? `+ ${formatCHFPrecis(analyseDetails.loyer)}` : `- ${formatCHFPrecis(Math.abs(analyseDetails.loyer))}`,
                          transport: analyseDetails.transport >= 0 ? `+ ${formatCHFPrecis(analyseDetails.transport)}` : `- ${formatCHFPrecis(Math.abs(analyseDetails.transport))}`,
                          loss: formatCHFPrecis(Math.abs(analyseDetails.economiesReelles))
                        }) }} />
                      ) : pointMortMois === 0 ? (
                        <p>{t('hub.roi_profitable_0')}</p>
                      ) : (
                        <p dangerouslySetInnerHTML={{ __html: t('hub.roi_profitable', {
                          realEco: formatCHFPrecis(analyseDetails.economiesReelles),
                          tax: formatCHFPrecis(totalDiff),
                          rent: `${analyseDetails.loyer >= 0 ? '+' : '-'}${formatCHFPrecis(Math.abs(analyseDetails.loyer))}`,
                          transport: `${analyseDetails.transport >= 0 ? '+' : '-'}${formatCHFPrecis(Math.abs(analyseDetails.transport))}`,
                          fees: formatCHFPrecis(parseFloat(fraisUniquesInput) || 0),
                          months: pointMortMois,
                          year: Math.floor(pointMortMois / 12) + 1
                        }) }} />
                      )}
                    </div>
                  )}
                </div>
                
                <div className="analysis-card">
                  <h4>{t('hub.pdf_title')}</h4>
                  <p className="analysis-desc">{t('hub.pdf_desc_move')}</p>
                  <div className="hub-navigation pdf-btn-container">
                    <button 
                      className="btn-hub-blue" 
                      onClick={() => generateDemenagementPDF({
                        taxDiff, 
                        taxDep: taxDetails?.dep,
                        taxArr: taxDetails?.arr,
                        depName: taxDetails?.depName,
                        arrName: taxDetails?.arrName,
                        insuranceDiff,
                        insuranceAvgA,
                        insuranceAvgB,
                        insuranceDepName: `${insuranceDepCanton} - ${getRegionLabel(insuranceDepCanton, insuranceDepRegion, i18n.language)}`,
                        insuranceArrName: `${insuranceArrCanton} - ${getRegionLabel(insuranceArrCanton, insuranceArrRegion, i18n.language)}`,
                        totalDiff,
                        fraisUniques: parseFloat(fraisUniquesInput) || 0,
                        ancienLoyer: parseFloat(ancienLoyerInput) || 0,
                        nouveauLoyer: parseFloat(nouveauLoyerInput) || 0,
                        ancienTransport: parseFloat(ancienTransportInput) || 0,
                        nouveauTransport: parseFloat(nouveauTransportInput) || 0,
                        realEco: analyseDetails?.economiesReelles || 0,
                        pointMortMois
                      }, t)}
                    >
                      {t('hub.pdf_btn_move')}
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="hub-navigation">
              <button className="btn-hub-next" onClick={() => setActiveTab('impots')}>
                {t('hub.back_impots', '← Détails Impôts')}
              </button>
              <button className="btn-hub-next" onClick={() => setActiveTab('assurance')}> 
                {t('hub.back_assurance', '← Détails Assurance')}
              </button>
            </div>

          </div>
        </div>
      </div>

      <div className="avertissement-legal">
        <span className="titre-avertissement">⚖️ {t('hub.warning_title')}</span>
        <span className="texte-avertissement">{t('hub.warning_move')}</span>
      </div>

      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
    </div>
  );
};

export default DemenagementHub;