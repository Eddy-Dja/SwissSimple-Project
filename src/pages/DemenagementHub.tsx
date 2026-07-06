import React, { useState, useEffect } from 'react';
//import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import RadarFiscal from '../modules/fiscal/RadarFiscal';
import Assurance from '../modules/assurance_maladie/Assurance';
import EmailGate from '../components/EmailGate';
import AuthModal from '../components/AuthModal';
import { useAuth } from '../context/AuthContext';
import { generateDemenagementPDF } from '../utils/pdfGenerator';
import './DemenagementHub.css';

const DemenagementHub: React.FC = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'impots' | 'assurance' | 'synthese'>('impots');
  
  const [taxDiff, setTaxDiff] = useState<number | null>(null);
  const [insuranceDiff, setInsuranceDiff] = useState<number | null>(null);

  const [fraisUniquesInput, setFraisUniquesInput] = useState('');
  const [ancienLoyerInput, setAncienLoyerInput] = useState('');
  const [nouveauLoyerInput, setNouveauLoyerInput] = useState('');
  const [ancienTransportInput, setAncienTransportInput] = useState('');
  const [nouveauTransportInput, setNouveauTransportInput] = useState('');
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

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [activeTab]);

  return (
    <div className="hub-container">
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
            hideWarning // <-- ASSUREZ-VOUS QUE C'EST LÀ
            initialMode="comparaison" 
            onPrevStep={() => setActiveTab('impots')} 
            onNextStep={() => setActiveTab('synthese')}
            onResultChange={(diff, details) => { 
              setInsuranceDiff(diff); 
              if(details) { setInsuranceAvgA(details.avgA); setInsuranceAvgB(details.avgB); }
            }}
          />
        </div>

        {/* --- ÉTAPE 3 : SYNTHÈSE FINALE --- */}
        <div className={`hub-step ${activeTab === 'synthese' ? 'visible' : 'hidden'}`}>
          <div className="synthese-container">
            <h2>{t('hub.synthese_title_move')}</h2>
            <p>{t('hub.synthese_intro_move')}</p>
            
            {!isDataReady && (
              <p className="hub-warning-message">
                {t('hub.waiting_message')}
              </p>
            )}
            
            <div className="synthese-recap">
              <div className="recap-item">
                <span className="recap-title">{t('hub.recap_impots')}</span>
                <p className={`recap-value ${taxDiff !== null && taxDiff >= 0 ? 'benefice' : 'perte'}`}>
                  {taxDiff !== null ? `${taxDiff >= 0 ? t('hub.economy') : t('hub.surcout')}${formatCHF(Math.abs(taxDiff))} CHF / an` : t('hub.waiting_calc')}
                </p>
              </div>
              <div className="recap-item">
                <span className="recap-title">{t('hub.recap_assurance')}</span>
                <p className={`recap-value ${insuranceDiff !== null && insuranceDiff >= 0 ? 'benefice' : 'perte'}`}>
                  {insuranceDiff !== null ? `${insuranceDiff >= 0 ? t('hub.economy') : t('hub.surcout')}${formatCHF(Math.abs(insuranceDiff))} CHF / an` : t('hub.waiting_calc')}
                </p>
              </div>
              <div className="recap-total">
                <span>{t('hub.recap_total_move')}</span>
                <h3 className={totalDiff >= 0 ? 'benefice' : 'perte'}>
                  {isDataReady ? `${totalDiff >= 0 ? '+' : '-'}${formatCHF(Math.abs(totalDiff))} CHF / an` : t('hub.waiting_calc')}
                </h3>
              </div>
            </div>

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

            {/* LA MAGIE EST ICI : ON SORT LES BOUTONS DU BLOC ISUNLOCKED */}
            {/* LES BOUTONS SONT TOUJOURS AFFICHÉS EN BAS DE LA SYNTHÈSE */}
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

      {/* AVERTISSEMENT TRADUIT AJOUTÉ EN BAS DE PAGE POUR LE MODULE DÉMÉNAGEMENT */}
      <div className="avertissement-legal">
        <span className="titre-avertissement">⚖️ {t('hub.warning_title')}</span>
        <span className="texte-avertissement">{t('hub.warning_move')}</span>
      </div>

      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
    </div>
  );
};

export default DemenagementHub;