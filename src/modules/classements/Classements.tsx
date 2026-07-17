import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useTranslation } from 'react-i18next';
import { calculerImpotPrecis, calculateCotisationsSociales } from '../fiscal/RadarFiscal';
import type { UserProfile, Commune, BaremeTranche, DeductionRow, DeductionPalier } from '../fiscal/RadarFiscal';
import './Classements.css';

const CHEFS_LIEUX = [
  { canton_id: 1, nomRecherche: 'Zürich', key: 'zurich', abreviation: 'ZH' },
  { canton_id: 2, nomRecherche: 'Bern', key: 'berne', abreviation: 'BE' },
  { canton_id: 3, nomRecherche: 'Luzern', key: 'lucerne', abreviation: 'LU' },
  { canton_id: 4, nomRecherche: 'Altdorf (UR)', key: 'altdorf', abreviation: 'UR' },
  { canton_id: 5, nomRecherche: 'Schwyz', key: 'schwyz', abreviation: 'SZ' },
  { canton_id: 6, nomRecherche: 'Sarnen', key: 'sarnen', abreviation: 'OW' },
  { canton_id: 7, nomRecherche: 'Stans', key: 'stans', abreviation: 'NW' },
  { canton_id: 8, nomRecherche: 'Glarus', key: 'glaris', abreviation: 'GL' },
  { canton_id: 9, nomRecherche: 'Zug', key: 'zoug', abreviation: 'ZG' },
  { canton_id: 10, nomRecherche: 'Fribourg', key: 'fribourg', abreviation: 'FR' },
  { canton_id: 11, nomRecherche: 'Solothurn', key: 'soleure', abreviation: 'SO' },
  { canton_id: 12, nomRecherche: 'Basel', key: 'bale', abreviation: 'BS' },
  { canton_id: 14, nomRecherche: 'Schaffhausen', key: 'schaffhouse', abreviation: 'SH' },
  { canton_id: 15, nomRecherche: 'Herisau', key: 'herisau', abreviation: 'AR' },
  { canton_id: 16, nomRecherche: 'Appenzell', key: 'appenzell', abreviation: 'AI' },
  { canton_id: 17, nomRecherche: 'St. Gallen', key: 'saintgall', abreviation: 'SG' },
  { canton_id: 18, nomRecherche: 'Chur', key: 'coire', abreviation: 'GR' },
  { canton_id: 19, nomRecherche: 'Aarau', key: 'aarau', abreviation: 'AG' },
  { canton_id: 20, nomRecherche: 'Frauenfeld', key: 'frauenfeld', abreviation: 'TG' },
  { canton_id: 21, nomRecherche: 'Bellinzona', key: 'bellinzona', abreviation: 'TI' },
  { canton_id: 22, nomRecherche: 'Lausanne', key: 'lausanne', abreviation: 'VD' },
  { canton_id: 23, nomRecherche: 'Sion', key: 'sion', abreviation: 'VS' },
  { canton_id: 24, nomRecherche: 'Neuchâtel', key: 'neuchatel', abreviation: 'NE' },
  { canton_id: 25, nomRecherche: 'Genève', key: 'geneve', abreviation: 'GE' },
  { canton_id: 26, nomRecherche: 'Delémont', key: 'delemont', abreviation: 'JU' }
];

export default function Classements() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'impots' | 'assurance'>('impots');
  const [loading, setLoading] = useState(true);
  
  const [dataImpots, setDataImpots] = useState<any[]>([]);
  const [dataAssurance, setDataAssurance] = useState<any[]>([]);

  const getCantonFullName = (abreviation: string) => {
    return t(`cantons.${abreviation}`, abreviation);
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      await calculerImpots();
      await calculerAssurance();
      setLoading(false);
    };
    fetchData();
  }, []);

  const calculerImpots = async () => {
    const nomsRecherches = CHEFS_LIEUX.map(c => c.nomRecherche);
    const { data: communes } = await supabase.from('communes').select('*').in('commune', nomsRecherches);
    if (!communes) return;

    const result = [];
    
    const baseUser: UserProfile = {
      revenuBrut: 100000,
      cotisationsSociales: 0,
      typeRevenu: 'brut',
      religion: 'aucune',
      pilier3a: '0',
      pilier3aConjoint: '0',
      fraisGarde: '0',
      classeAge: '35-44',
      classeAgeConjoint: '35-44',
      statutCivil: 'celibataire',
      revenuConjoint: 0
    };

    for (const chef of CHEFS_LIEUX) {
      const communeTrouvee = communes.find((c: any) => c.commune === chef.nomRecherche) as Commune;
      if (communeTrouvee) {
        
        const [baremeCant, baremeFed, dedFed, dedCant, paliersFed, paliersCant] = await Promise.all([
          supabase.from('baremes').select('*').eq('canton_id', communeTrouvee.canton_id).eq('statut', 'celibataire').eq('autorite_fiscale', 'Canton'),
          supabase.from('baremes').select('*').eq('canton_id', 0).eq('statut', 'celibataire').eq('autorite_fiscale', 'Confédération'),
          supabase.from('deductions').select('*').eq('canton_id', 0).or('statut.eq.tous,statut.eq.celibataire'),
          supabase.from('deductions').select('*').eq('canton_id', communeTrouvee.canton_id).or('statut.eq.tous,statut.eq.celibataire'),
          supabase.from('deductions_paliers').select('*').eq('canton_id', 0).or('statut.eq.tous,statut.eq.celibataire'),
          supabase.from('deductions_paliers').select('*').eq('canton_id', communeTrouvee.canton_id).or('statut.eq.tous,statut.eq.celibataire')
        ]);

        const userCelib: UserProfile = { ...baseUser, statutCivil: 'celibataire', revenuConjoint: 0 };
        userCelib.cotisationsSociales = calculateCotisationsSociales(userCelib);
        
        const resCelib = calculerImpotPrecis(userCelib, 100000, baremeCant.data as BaremeTranche[], baremeFed.data as BaremeTranche[], communeTrouvee, dedFed.data as DeductionRow[], dedCant.data as DeductionRow[], paliersFed.data as DeductionPalier[], paliersCant.data as DeductionPalier[], 'celibataire', 'celibataire', 0, 0);

        const [baremeCantM, baremeFedM, dedFedM, dedCantM, paliersFedM, paliersCantM] = await Promise.all([
          supabase.from('baremes').select('*').eq('canton_id', communeTrouvee.canton_id).eq('statut', 'marie').eq('autorite_fiscale', 'Canton'),
          supabase.from('baremes').select('*').eq('canton_id', 0).eq('statut', 'marie').eq('autorite_fiscale', 'Confédération'),
          supabase.from('deductions').select('*').eq('canton_id', 0).or('statut.eq.tous,statut.eq.marie'),
          supabase.from('deductions').select('*').eq('canton_id', communeTrouvee.canton_id).or('statut.eq.tous,statut.eq.marie'),
          supabase.from('deductions_paliers').select('*').eq('canton_id', 0).or('statut.eq.tous,statut.eq.marie'),
          supabase.from('deductions_paliers').select('*').eq('canton_id', communeTrouvee.canton_id).or('statut.eq.tous,statut.eq.marie')
        ]);

        const userMarie: UserProfile = { ...baseUser, statutCivil: 'marie', revenuConjoint: 0 };
        userMarie.cotisationsSociales = calculateCotisationsSociales(userMarie);

        const resMarie = calculerImpotPrecis(userMarie, 100000, baremeCantM.data as BaremeTranche[], baremeFedM.data as BaremeTranche[], communeTrouvee, dedFedM.data as DeductionRow[], dedCantM.data as DeductionRow[], paliersFedM.data as DeductionPalier[], paliersCantM.data as DeductionPalier[], 'marie', 'marie', 2, 0);

        result.push({ 
          key: chef.key, 
          abreviation: chef.abreviation, 
          celib: resCelib.impotTotal, 
          marie: resMarie.impotTotal 
        });
      }
    }
    
    result.sort((a, b) => a.celib - b.celib);
    setDataImpots(result);
  };

  const calculerAssurance = async () => {
    const { data, error } = await supabase
      .from('primes_lamal')
      .select('Kanton, Prämie')
      .eq('Geschäftsjahr', 2026)
      .eq('Altersklasse', 'AKL-ERW')
      .eq('Franchise', 300)
      .eq('Unfalleinschluss', 'MIT-UNF');

    if (!data) return;

    const grouped: { [key: string]: number[] } = {};
    data.forEach(p => {
      const cantonKey = (p.Kanton === 'ZR' || p.Kanton === 'ZE') ? 'ZH' : p.Kanton;
      if (!grouped[cantonKey]) grouped[cantonKey] = [];
      grouped[cantonKey].push(p.Prämie);
    });

    const result = Object.keys(grouped).map(kanton => {
      const primes = grouped[kanton];
      const min = Math.min(...primes);
      const moyenne = primes.reduce((a, b) => a + b, 0) / primes.length;
      return { canton: kanton, min: Math.round(min), moyenne: Math.round(moyenne) };
    }).sort((a, b) => a.moyenne - b.moyenne);

    setDataAssurance(result);
  };

  const maxImpot = dataImpots.length > 0 ? Math.max(...dataImpots.map(d => d.celib)) : 1;
  const maxPrime = dataAssurance.length > 0 ? Math.max(...dataAssurance.map(d => d.moyenne)) : 1;

  return (
    <div className="classements-container">
      <h1>{t('classements.title', 'Atlas Suisse 2026 📊')}</h1>
      <p>{t('classements.subtitle', 'Comparatif des cantons pour un revenu de référence de 100\'000 CHF.')}</p>
      
      <p className="classements-disclaimer">
        {t('classements.bl_disclaimer')}
      </p>

      <div className="classements-tabs">
        <button className={activeTab === 'impots' ? 'active' : ''} onClick={() => setActiveTab('impots')}>
          🏛️ {t('classements.tab_impots', 'Impôts (Célibataire vs Marié)')}
        </button>
        <button className={activeTab === 'assurance' ? 'active' : ''} onClick={() => setActiveTab('assurance')}>
          🏥 {t('classements.tab_assurance', 'Assurance Maladie')}
        </button>
      </div>

      <div className="classements-content">
        {loading ? (
          <p>{t('classements.loading', 'Calcul des indicateurs en cours...')}</p>
        ) : activeTab === 'impots' ? (
          <div className="ranking-list">
            {dataImpots.map((item, i) => (
              <div key={i} className="ranking-row">
                <div className="ranking-label">
                  {i + 1}. {t(`capitaux.${item.key}`, item.key)} ({item.abreviation})
                </div>
                
                <div className="bar-label-line">
                  <span className="bar-legend celib">{t('classements.legend_celib')}</span>
                  <span className="ranking-value">{item.celib} CHF</span>
                </div>
                <div className="bar-container">
                  <div className="bar-celib" style={{ width: `${(item.celib / maxImpot) * 100}%` }}></div>
                </div>

                <div className="bar-label-line" style={{ marginTop: '8px' }}>
                  <span className="bar-legend marie">{t('classements.legend_marie')}</span>
                  <span className="ranking-value">{item.marie} CHF</span>
                </div>
                <div className="bar-container">
                  <div className="bar-marie" style={{ width: `${(item.marie / maxImpot) * 100}%` }}></div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="ranking-list">
            <p className="classements-disclaimer">
              {t('classements.assurance_disclaimer')}
            </p>
            
            {dataAssurance.map((item, i) => (
              <div key={i} className="ranking-row">
                <div className="ranking-label">
                  {i + 1}. {getCantonFullName(item.canton)}
                </div>
                
                <div className="bar-label-line">
                  <span className="bar-legend min">{t('classements.legend_min')}</span>
                  <span className="ranking-value">{item.min} CHF</span>
                </div>
                <div className="bar-container">
                  <div className="bar-min" style={{ width: `${(item.min / maxPrime) * 100}%` }}></div>
                </div>

                <div className="bar-label-line" style={{ marginTop: '8px' }}>
                  <span className="bar-legend moyenne">{t('classements.legend_moy')}</span>
                  <span className="ranking-value">{item.moyenne} CHF</span>
                </div>
                <div className="bar-container">
                  <div className="bar-moyenne" style={{ width: `${(item.moyenne / maxPrime) * 100}%` }}></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}