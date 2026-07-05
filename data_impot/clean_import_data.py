
import os
import io
import re
import unicodedata
import pandas as pd
import numpy as np
from supabase import create_client



# --- FONCTIONS DE NETTOYAGE ---
def remove_accents(text):
    if pd.isna(text): return ''
    nfkd_form = unicodedata.normalize('NFKD', str(text))
    return "".join([c for c in nfkd_form if not unicodedata.combining(c)]).lower()

def clean_number(val):
    if pd.isna(val): return 0.0
    if isinstance(val, (int, float)): return float(val)
    val_str = str(val).replace("'", "").replace(" ", "").strip()
    if val_str == '' or val_str == '-': return 0.0
    if '|' in val_str:
        parts = val_str.split('|')
        val_str = parts[0] + '.' + parts[1]
    if ',' in val_str:
        parts = val_str.split(',')
        if len(parts[-1]) == 3: val_str = val_str.replace(',', '')
        else: val_str = val_str.replace(',', '.')
    try: return float(val_str)
    except ValueError: return 0.0

def get_statut(text):
    clean_text = remove_accents(text)
    if not clean_text: return 'tous'
    if 'marie' in clean_text or 'epoux' in clean_text or 'famille' in clean_text or 'couple' in clean_text: return 'marie'
    if 'celibataire' in clean_text or 'seule' in clean_text or 'isole' in clean_text: return 'celibataire'
    return 'tous'

def get_autorite(text):
    if pd.isna(text): return 'Canton'
    if 'fédéral' in str(text).lower() or 'confédération' in str(text).lower(): return 'Confédération'
    return 'Canton'

def get_categorie(nom):
    nom_lower = str(nom).lower()
    if any(x in nom_lower for x in ['valeur locative', 'entretien', 'immobilier', 'réparations', 'frais de gestion', 'loyer', 'fortune']): return 'non_calculable'
    if any(x in nom_lower for x in ['modeste', 'rentier', 'avs', 'ai ']): return 'palier_social_a_ignorer'
    if 'pilier 3a' in nom_lower and 'maximale' in nom_lower: return 'pilier_3a_max_sans' if 'sans' in nom_lower else 'pilier_3a_max_avec'
    if any(x in nom_lower for x in ['frais de déplacement', 'activité lucrative', 'frais professionnels', 'dépenses professionnelles', 'repas']): return 'frais_professionnels'
    if any(x in nom_lower for x in ['assurance', 'maladie', 'épargne', 'interet', 'prime']):
        if 'enfant' in nom_lower and 'garde' not in nom_lower: return 'assurance_enfant'
        if 'sans pilier' in nom_lower or 'sans cotisation' in nom_lower: return 'assurance_adulte_sans_pilier'
        if 'marié' in nom_lower or 'celibataire' in nom_lower or 'personne' in nom_lower: return 'assurance_adulte_avec_pilier'
    if 'garde' in nom_lower and 'enfant' in nom_lower: return 'frais_garde'
    if 'couple à deux revenus' in nom_lower or 'deux revenus' in nom_lower: return 'couple_2_revenus'
    if ('enfant' in nom_lower or 'enfants' in nom_lower) and 'garde' not in nom_lower and 'formation' not in nom_lower and 'assurance' not in nom_lower: return 'deduction_enfant'
    if any(x in nom_lower for x in ['marié', 'marie', 'célibataire', 'celibataire', 'seul', 'isolé', 'isole', 'famille', 'monoparentale', 'social']): return 'deduction_statut'
    return 'autre'

# ==========================================
# 0. NETTOYAGE TOTAL
# ==========================================
def clean_database():
    print("🧹 NETTOYAGE COMPLET DES TABLES...")
    try:
        supabase.table('baremes').delete().gte('id', 0).execute()
        supabase.table('deductions_paliers').delete().gte('id', 0).execute()
        supabase.table('deductions').delete().gte('id', 0).execute()
        supabase.table('communes').delete().gte('id', 0).execute()
        print("✅ Base de données vidée avec succès !\n")
    except Exception as e:
        print(f"❌ Erreur pendant le nettoyage : {e}")

# ==========================================
# 1. BARÈMES (AVEC EXTRACTION DYNAMIQUE DU DIVISEUR CORRIGÉE)
# ==========================================
def import_baremes(file_path):
    print(f"📁 Lecture des barèmes : {file_path}")
    with open(file_path, 'r', encoding='utf-8-sig') as f:
        lines = f.readlines()

    data_blocks, current_lines, in_table = [], [], False
    current_diviseur = 1.0
    block_diviseur = 1.0  # Variable pour figer le diviseur du bloc en cours

    for raw_line in lines:
        line = re.sub(r'^\s*\d+\s*\|\s*', '', raw_line).strip()
        if 'montant du diviseur' in line.lower():
            parts = line.split(';;')
            if len(parts) > 1:
                val = parts[1].split(';')[0].strip()
                current_diviseur = clean_number(val)
            continue
        if line.startswith('Barèmes') or re.match(r'^\d{4};', line): continue
        
        if line.lower().startswith('canton-id'):
            if current_lines: data_blocks.append((current_lines, block_diviseur))
            current_lines = [line]; in_table = True
            block_diviseur = current_diviseur  # On fige le diviseur pour ce bloc
        elif in_table and (line.startswith('-;') or re.match(r'^\d+;', line)):
            current_lines.append(line)
        else:
            if in_table and current_lines:
                data_blocks.append((current_lines, block_diviseur))
                current_lines = []; in_table = False
    if current_lines: data_blocks.append((current_lines, block_diviseur))

    dfs = []
    for block_lines, diviseur in data_blocks:
        try:
            df = pd.read_csv(io.StringIO('\n'.join(block_lines)), sep=';', encoding='utf-8-sig')
            df.columns = [str(c).lower().strip() for c in df.columns]
            df = df.rename(columns={
                'canton-id': 'canton_id', 'sujet fiscal': 'statut_raw', 'autorité fiscale': 'autorite_raw', 
                'pour les prochains chf': 'delta_tranche', 'en plus %': 'taux',
                'revenu imposable confédération': 'montant_tranche', 'montant de base chf': 'montant_base',
                'taux d\'imposition': 'taux_unique'
            })
            if 'canton_id' in df.columns:
                df['canton_id'] = df['canton_id'].replace('-', 0)
                df['canton_id'] = pd.to_numeric(df['canton_id'], errors='coerce').dropna().astype(int)
                df = df[df['canton_id'].isin(range(0, 27))]
                df = df[df['canton_id'] != 13] # Exclusion BL
            else: continue
            df['statut'] = df['statut_raw'].apply(get_statut) if 'statut_raw' in df.columns else 'tous'
            df['autorite_fiscale'] = df['autorite_raw'].apply(get_autorite) if 'autorite_raw' in df.columns else 'Canton'
            df['diviseur'] = diviseur
            for col in ['montant_tranche', 'delta_tranche', 'taux', 'montant_base', 'taux_unique']:
                if col in df.columns: df[col] = df[col].apply(clean_number)
            dfs.append(df)
        except: pass

    if not dfs: return
    df = pd.concat(dfs, ignore_index=True)
    final_records = []
    grouped = df.groupby(['canton_id', 'statut_raw', 'autorite_fiscale', 'diviseur'])
    
    print("🔄 Normalisation des tranches...")
    for (canton_id, statut_raw, autorite, diviseur), group in grouped:
        statut = get_statut(statut_raw)
        group = group.reset_index(drop=True)
        
        if 'taux_unique' in group.columns and group['taux_unique'].sum() > 0:
            taux_unique = group['taux_unique'].iloc[0]
            final_records.append({'canton_id': canton_id, 'statut': statut, 'autorite_fiscale': autorite, 'montant_tranche': 0.0, 'taux': taux_unique, 'montant_base': 0.0, 'diviseur': diviseur})
            
        elif 'delta_tranche' in group.columns and group['delta_tranche'].sum() > 0:
            cumul_tranche, cumul_impot = 0.0, 0.0
            for _, row in group.iterrows():
                delta, taux = row['delta_tranche'], row['taux'] / 100
                impot_delta = delta * taux if delta < 999_999_999 else 0.0
                final_records.append({'canton_id': canton_id, 'statut': statut, 'autorite_fiscale': autorite, 'montant_tranche': cumul_tranche, 'taux': row['taux'], 'montant_base': round(cumul_impot, 2), 'diviseur': diviseur})
                if delta < 999_999_999: cumul_tranche += delta; cumul_impot += impot_delta
            
        elif 'montant_tranche' in group.columns:
            group = group.sort_values('montant_tranche').reset_index(drop=True)
            cumul_impot = 0.0
            
            # DÉTECTION DES BARÈMES À TAUX MOYEN (Seul Obwald 6 utilise un taux moyen. Fribourg est progressif)
            is_taux_moyen = (canton_id == 6)
            
            for idx, row in group.iterrows():
                mt, taux, mb = float(row.get('montant_tranche', 0) or 0), float(row.get('taux', 0) or 0), float(row.get('montant_base', 0) or 0)
                
                if is_taux_moyen:
                    base_finale = mt * (taux / 100) if mt > 0 else 0.0
                else:
                    base_finale = mb if mb > 0 else cumul_impot
            
                final_records.append({'canton_id': canton_id, 'statut': statut, 'autorite_fiscale': autorite, 'montant_tranche': mt, 'taux': taux, 'montant_base': round(base_finale, 2)})
                if idx < len(group) - 1:
                    largeur = float(group.iloc[idx + 1].get('montant_tranche', 0) or 0) - mt
                    if largeur > 0: cumul_impot += largeur * (taux / 100)

    df_export = pd.DataFrame(final_records)
    for col in ['montant_tranche', 'taux', 'montant_base']: df_export[col] = pd.to_numeric(df_export[col], errors='coerce').fillna(0.0)
    df_export['canton_id'] = df_export['canton_id'].astype(int)
    
    # SPLITTING : On duplique les barèmes "Tous" en "celibataire" et "marie"
    df_tous = df_export[df_export['statut'] == 'tous'].copy()
    if not df_tous.empty:
        df_celib = df_tous.copy()
        df_celib['statut'] = 'celibataire'
        
        df_marie = df_tous.copy()
        df_marie['statut'] = 'marie'
        # ON NE MULTIPLIE PAS LES TRANCHES ICI. React gérera le diviseur dynamiquement.
        
        df_export = pd.concat([df_export[df_export['statut'] != 'tous'], df_celib, df_marie], ignore_index=True)
    
    # On supprime la colonne diviseur avant d'envoyer à Supabase pour garder la BDD propre
    if 'diviseur' in df_export.columns:
        df_export = df_export.drop(columns=['diviseur'])
        
    records = df_export.drop_duplicates().sort_values(by=['canton_id', 'statut', 'autorite_fiscale', 'montant_tranche']).to_dict(orient='records')
    for i in range(0, len(records), 500): supabase.table('baremes').insert(records[i:i+500]).execute()
    print(f"✅ {len(records)} Barèmes importés !\n")

# ==========================================
# 2. COMMUNES
# ==========================================
def import_coefficients(file_path):
    print(f"📁 Lecture de {file_path}...")
    df = pd.read_csv(file_path, sep=';', encoding='utf-8-sig', header=1)
    nouveaux_noms = ['canton_id', 'canton', 'ofs_id', 'commune', 'coeff_revenu_canton', 'coeff_revenu_commune', 'coeff_revenu_eglise_reforme', 'coeff_revenu_eglise_catholique', 'coeff_revenu_eglise_chretienne', 'coeff_fortune_canton', 'coeff_fortune_commune', 'coeff_fortune_eglise_reforme', 'coeff_fortune_eglise_catholique', 'coeff_fortune_eglise_chretienne', 'coeff_benefice_canton', 'coeff_benefice_commune', 'coeff_benefice_eglise', 'coeff_capital_canton', 'coeff_capital_commune', 'coeff_capital_eglise']
    if len(df.columns) >= len(nouveaux_noms):
        df = df.iloc[:, 0:len(nouveaux_noms)]; df.columns = nouveaux_noms
    else: return
    df['canton_id'] = pd.to_numeric(df['canton_id'], errors='coerce')
    df = df.dropna(subset=['canton_id', 'commune']); df['canton_id'] = df['canton_id'].astype(int)
    for col in nouveaux_noms[4:]: df[col] = df[col].apply(clean_number)
    df = df.replace({np.nan: None})
    records = df.to_dict(orient='records')
    for i in range(0, len(records), 500): supabase.table('communes').insert(records[i:i+500]).execute()
    print(f"✅ {len(records)} Communes importées !\n")

# ==========================================
# 3. DÉDUCTIONS SIMPLES
# ==========================================
def import_deductions(file_path):
    print(f"📁 Lecture de {file_path}...")
    df = pd.read_csv(file_path, sep=';', encoding='utf-8-sig')
    expected_cols = ['canton_id', 'canton', 'type_impot', 'nom_deduction', 'montant', 'pourcent', 'minimum', 'maximum']
    if len(df.columns) >= len(expected_cols):
        df = df.iloc[:, :len(expected_cols)]; df.columns = expected_cols
    else: return
    df['statut'] = df['nom_deduction'].apply(get_statut)
    df['categorie'] = df['nom_deduction'].apply(get_categorie)
    df['canton_id'] = pd.to_numeric(df['canton_id'], errors='coerce')
    df = df.dropna(subset=['canton_id', 'nom_deduction']); df['canton_id'] = df['canton_id'].astype(int)
    for col in ['montant', 'pourcent', 'minimum', 'maximum']: df[col] = df[col].apply(clean_number)
    
    # --- CORRECTION DES ERREURS DE L'AFC DANS LE CSV ---
    # Genève (25) : L'AFC a oublié de mettre la déduction pour primes d'assurance maladie (Art. 32 LIPP).
    # Le simulateur de l'AFC utilise 4560 CHF pour un célibataire et 9120 CHF pour un couple.
    # On injecte cette ligne manquante pour que React puisse la lire dynamiquement.
    
    # Suppression des mauvaises lignes de stats de l'AFC pour Genève
    df = df[~((df['canton_id'] == 25) & (df['nom_deduction'].str.contains('Caisse maladie Prime moyenne', case=False, na=False)))]

    # Ajout de la vraie déduction Maladie pour Genève (2026)
    new_rows_ge = [
        {'canton_id': 25, 'canton': 'GE', 'type_impot': 'Revenu', 'nom_deduction': 'Déduction des primes d\'assurance maladie | célibataires', 'montant': 4560.0, 'pourcent': 0.0, 'minimum': 0.0, 'maximum': 0.0, 'statut': 'celibataire', 'categorie': 'assurance_adulte_avec_pilier'},
        {'canton_id': 25, 'canton': 'GE', 'type_impot': 'Revenu', 'nom_deduction': 'Déduction des primes d\'assurance maladie | mariés', 'montant': 9120.0, 'pourcent': 0.0, 'minimum': 0.0, 'maximum': 0.0, 'statut': 'marie', 'categorie': 'assurance_adulte_avec_pilier'}
    ]
    df = pd.concat([df, pd.DataFrame(new_rows_ge)], ignore_index=True)
    # ----------------------------------------------------

    df = df.replace({np.nan: None})
    records = df.to_dict(orient='records')
    for i in range(0, len(records), 500): supabase.table('deductions').insert(records[i:i+500]).execute()
    print(f"✅ {len(records)} Déductions simples importées !\n")

# ==========================================
# 4. DÉDUCTIONS PALIERS
# ==========================================
def import_other_deductions(file_path):
    print(f"📁 Lecture de {file_path}...")
    df = pd.read_csv(file_path, sep=';', encoding='utf-8-sig')
    expected_cols = ['canton_id', 'canton', 'type_impot', 'nom_deduction', 'autorite_fiscale', 'revenu_seuil', 'deduction_montant']
    if len(df.columns) >= len(expected_cols):
        df = df.iloc[:, :len(expected_cols)]; df.columns = expected_cols
    else: return
    df['statut'] = df['nom_deduction'].apply(get_statut)
    df['categorie'] = df['nom_deduction'].apply(get_categorie)
    df['canton_id'] = pd.to_numeric(df['canton_id'], errors='coerce')
    df = df.dropna(subset=['canton_id', 'nom_deduction']); df['canton_id'] = df['canton_id'].astype(int)
    for col in ['revenu_seuil', 'deduction_montant']: df[col] = df[col].apply(clean_number)
    df = df.replace({np.nan: None})
    records = df.to_dict(orient='records')
    for i in range(0, len(records), 500): supabase.table('deductions_paliers').insert(records[i:i+500]).execute()
    print(f"✅ {len(records)} Déductions à paliers importées !\n")

# ==========================================
# EXECUTION
# ==========================================
if __name__ == "__main__":
    try:
        all_files = [f for f in os.listdir('.') if f.endswith('.csv')]
        print(f"📂 Fichiers CSV détectés : {all_files}\n")
        
        clean_database()

        for f in all_files:
            f_lower = f.lower()
            if "bareme" in f_lower or "barem" in f_lower: import_baremes(f)
            elif "coefficien" in f_lower: import_coefficients(f)
            elif "autre" in f_lower and ("déduction" in f_lower or "deduction" in f_lower): import_other_deductions(f)
            elif ("déduction" in f_lower or "deduction" in f_lower) and "autre" not in f_lower: import_deductions(f)
            else: print(f"⏭️ Fichier ignoré (non reconnu) : {f}")

        print("🚀 IMPORT TOTAL TERMINÉ AVEC SUCCÈS ! 🚀")
    except Exception as e:
        print(f"❌ Erreur globale : {e}")