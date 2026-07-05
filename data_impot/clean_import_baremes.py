import os
import io
import re
import unicodedata # <-- L'import manquant est ici !
import pandas as pd
from supabase import create_client

# ==========================================
# CONFIGURATION SUPABASE
# ==========================================


# --- FONCTIONS DE NETTOYAGE ---
def remove_accents(text):
    if pd.isna(text): return ''
    nfkd_form = unicodedata.normalize('NFKD', str(text))
    return "".join([c for c in nfkd_form if not unicodedata.combining(c)]).lower()

def clean_number(val):
    if pd.isna(val): return 0.0
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
    
    # 1. Priorité au mariage (gère "mariée" et "pas en concubinage")
    if 'marie' in clean_text or 'epoux' in clean_text or 'famille' in clean_text or 'couple' in clean_text: 
        return 'marie'
        
    # 2. Si pas marié, on cherche célibataire / vivant seule (gère le concubinage)
    if 'celibataire' in clean_text or 'seule' in clean_text or 'isole' in clean_text: 
        return 'celibataire'
        
    return 'tous'

def get_autorite(text):
    if pd.isna(text): return 'Canton'
    text = str(text).lower()
    if 'fédéral' in text or 'confédération' in text: return 'Confédération'
    return 'Canton'

# ==========================================
# FONCTION PRINCIPALE D'IMPORT DES BARÈMES
# ==========================================
def process_file(file_path):
    print(f"📁 Lecture du fichier : {file_path}")
    with open(file_path, 'r', encoding='utf-8-sig') as f:
        lines = f.readlines()

    data_blocks = []
    current_lines = []
    in_table = False

    for raw_line in lines:
        line = re.sub(r'^\s*\d+\s*\|\s*', '', raw_line).strip()
        if 'montant du diviseur' in line.lower() or line.startswith('Barèmes') or re.match(r'^\d{4};', line):
            continue
        if line.lower().startswith('canton-id'):
            if current_lines: data_blocks.append(current_lines)
            current_lines = [line]
            in_table = True
        elif in_table and (line.startswith('-;') or re.match(r'^\d+;', line)):
            current_lines.append(line)
        else:
            if in_table and current_lines:
                data_blocks.append(current_lines)
                current_lines = []
                in_table = False
    if current_lines: data_blocks.append(current_lines)

    print(f"✅ {len(data_blocks)} blocs de barèmes trouvés.")
    dfs = []
    for block_lines in data_blocks:
        csv_text = '\n'.join(block_lines)
        try:
            df = pd.read_csv(io.StringIO(csv_text), sep=';', encoding='utf-8-sig')
            df.columns = [str(c).lower().strip() for c in df.columns]
            rename_map = {
                'canton-id': 'canton_id', 'sujet fiscal': 'statut_raw', 'autorité fiscale': 'autorite_raw',
                'pour les prochains chf': 'delta_tranche', 'en plus %': 'taux',
                'revenu imposable confédération': 'montant_tranche', 'montant de base chf': 'montant_base'
            }
            df = df.rename(columns=rename_map)
            if 'canton_id' in df.columns:
                df['canton_id'] = df['canton_id'].replace('-', 0)
                df['canton_id'] = pd.to_numeric(df['canton_id'], errors='coerce').dropna().astype(int)
                df = df[df['canton_id'].isin(range(0, 27))]
                
                # Exclusion de BL (13) car il utilise des formules logarithmiques non gérées par React
                df = df[df['canton_id'] != 13]
            else: continue
            
            if 'statut_raw' in df.columns: df['statut'] = df['statut_raw'].apply(get_statut)
            else: df['statut'] = 'tous'
            if 'autorite_raw' in df.columns: df['autorite_fiscale'] = df['autorite_raw'].apply(get_autorite)
            else: df['autorite_fiscale'] = 'Canton'
                
            for col in ['montant_tranche', 'delta_tranche', 'taux', 'montant_base']:
                if col in df.columns: df[col] = df[col].apply(clean_number)
            dfs.append(df)
        except Exception as e:
            print(f"⚠️ Erreur parsing bloc: {e}")

    if not dfs: return
    df = pd.concat(dfs, ignore_index=True)
    final_records = []
    grouped = df.groupby(['canton_id', 'statut_raw', 'autorite_fiscale'])
    
    print("🔄 Normalisation des tranches...")
    for (canton_id, statut_raw, autorite), group in grouped:
        statut = get_statut(statut_raw)
        group = group.reset_index(drop=True)
        if 'delta_tranche' in group.columns and group['delta_tranche'].sum() > 0:
            cumul_tranche, cumul_impot = 0.0, 0.0
            for _, row in group.iterrows():
                delta, taux = row['delta_tranche'], row['taux'] / 100
                impot_delta = delta * taux if delta < 999_999_999 else 0.0
                final_records.append({
                    'canton_id': canton_id, 'statut': statut, 'autorite_fiscale': autorite, 
                    'montant_tranche': cumul_tranche, 'taux': row['taux'], 'montant_base': round(cumul_impot, 2)
                })
                if delta < 999_999_999: cumul_tranche += delta; cumul_impot += impot_delta
        elif 'montant_tranche' in group.columns:
            group = group.sort_values('montant_tranche').reset_index(drop=True); cumul_impot = 0.0
            for idx, row in group.iterrows():
                montant_tranche = float(row.get('montant_tranche', 0) or 0)
                taux = float(row.get('taux', 0) or 0)
                montant_base_officiel = float(row.get('montant_base', 0) or 0)
                base_finale = montant_base_officiel if montant_base_officiel > 0 else round(cumul_impot, 2)
                final_records.append({
                    'canton_id': canton_id, 'statut': statut, 'autorite_fiscale': autorite, 
                    'montant_tranche': montant_tranche, 'taux': taux, 'montant_base': base_finale
                })
                if idx < len(group) - 1:
                    largeur = float(group.iloc[idx + 1].get('montant_tranche', 0) or 0) - montant_tranche
                    if largeur > 0: cumul_impot += largeur * (taux / 100)

    df_export = pd.DataFrame(final_records)
    df_export = df_export[['canton_id', 'statut', 'autorite_fiscale', 'montant_tranche', 'taux', 'montant_base']]
    for col in ['montant_tranche', 'taux', 'montant_base']: 
        df_export[col] = pd.to_numeric(df_export[col], errors='coerce').fillna(0.0)
    df_export['canton_id'] = df_export['canton_id'].astype(int)
    
    # GÉNIAL : Élargissement mathématique du barème "Tous" pour les Mariés (Splitting)
    df_tous = df_export[df_export['statut'] == 'tous'].copy()
    if not df_tous.empty:
        df_celib = df_tous.copy()
        df_celib['statut'] = 'celibataire'
        
        df_marie = df_tous.copy()
        df_marie['statut'] = 'marie'
        # On multiplie les tranches et les montants par 1.9 (Diviseur de splitting moyen)
        df_marie['montant_tranche'] = (df_marie['montant_tranche'] * 1.9).round(2)
        df_marie['montant_base'] = (df_marie['montant_base'] * 1.9).round(2)
        
        df_export = pd.concat([df_export[df_export['statut'] != 'tous'], df_celib, df_marie], ignore_index=True)
    
    df_export = df_export.drop_duplicates().sort_values(by=['canton_id', 'statut', 'autorite_fiscale', 'montant_tranche'])
    
    print(f"\n📤 Envoi de {len(df_export)} lignes vers Supabase...")
    records = df_export.to_dict(orient='records')
    try:
        supabase.table('baremes').delete().gte('id', 0).execute()
        for i in range(0, len(records), 500):
            supabase.table('baremes').insert(records[i:i+500]).execute()
        print(f"\n✅ IMPORT TERMINÉ AVEC SUCCÈS ! 🚀")
    except Exception as e:
        print(f"❌ Erreur Supabase : {e}")

if __name__ == "__main__":
    all_files = [f for f in os.listdir('.') if f.endswith('.csv')]
    bareme_file = None
    for f in all_files:
        if "bareme" in f.lower() or "barem" in f.lower(): bareme_file = f; break
    if bareme_file: process_file(bareme_file)
    else: print("❌ Aucun fichier CSV contenant 'bareme' trouvé.")