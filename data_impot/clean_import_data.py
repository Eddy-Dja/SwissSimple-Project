import os
import re
import io
import sys
import unicodedata
import pandas as pd
import numpy as np
from supabase import create_client

# ================================ CONFIG ================================
SUPABASE_URL = "https://TON-PROJET.supabase.co"
SUPABASE_KEY = "TA-CLE-service_role"     # Settings > API > service_role (les mêmes que ton script impôts)

TABLE_PRIMES = "primes_lamal"
TABLE_TARIFS = "tarifs_lamal"

GESCHAEFTSJAHR = 2027    # année de validité des tarifs/primes  <- à changer chaque année
ERHEBUNGSJAHR = 2026     # année de collecte de la statistique  <- idem

IMPORTER_VRAIMENT   = False  # False = simulation (nettoie + rapport + CSV propres, rien en base)
FORCER_IMPORT       = False  # True = importer même s'il y a des anomalies de franchise
VIDER_TOUTES_ANNEES = False  # False = seule l'année GESCHAEFTSJAHR est remplacée (2026 intacte)
TAILLE_LOT = 500

# primes_lamal (schéma confirmé)
CIBLES_PRIMES = ["Versicherer","Kanton","Hoheitsgebiet","Geschäftsjahr","Erhebungsjahr","Region",
                 "Altersklasse","Unfalleinschluss","Tarif","Tariftyp","Altersuntergruppe",
                 "Franchisestufe","Franchise","Prämie","isBaseF","isBaseP","Tarifbezeichnung"]

# tarifs_lamal (schéma confirmé : Versicherer = n° BAG, sans Kanton ni Region)
CIBLES_TARIFS = ["Versicherer","Geschäftsjahr","Erhebungsjahr","Kategorie",
                 "Tarif","Tariftyp","Sort.-Nr.","Name_DE","Name_FR","Name_IT"]
TARIFS_VERSICHERER_INT = True    # False si la colonne Versicherer de tarifs_lamal est du texte
INT_COLS        = {"Franchise", "Geschäftsjahr", "Erhebungsjahr"}
INT_COLS_TARIFS = {"Geschäftsjahr", "Erhebungsjahr", "Sort.-Nr."} | ({"Versicherer"} if TARIFS_VERSICHERER_INT else set())
FLOAT_COLS      = {"Prämie"}
BOOL_COLS       = {"isBaseF", "isBaseP"}

MONTANTS = {  # barème officiel : (Altersklasse, Stufe) -> franchise CHF — c'est lui qui fait foi
    ("AKL-KIN","FRAST0"):0, ("AKL-KIN","FRAST1"):100, ("AKL-KIN","FRAST2"):200, ("AKL-KIN","FRAST3"):300,
    ("AKL-KIN","FRAST4"):400, ("AKL-KIN","FRAST5"):500, ("AKL-KIN","FRAST6"):600,
    ("AKL-JUG","FRAST0"):0, ("AKL-JUG","FRAST1"):100, ("AKL-JUG","FRAST2"):200, ("AKL-JUG","FRAST3"):300,
    ("AKL-JUG","FRAST4"):400, ("AKL-JUG","FRAST5"):500, ("AKL-JUG","FRAST6"):600,
    ("AKL-ERW","FRAST0"):0, ("AKL-ERW","FRAST1"):300, ("AKL-ERW","FRAST2"):500, ("AKL-ERW","FRAST3"):1000,
    ("AKL-ERW","FRAST4"):1500, ("AKL-ERW","FRAST5"):2000, ("AKL-ERW","FRAST6"):2500,
}
INVERSE = {}
for (ak, st), m in MONTANTS.items(): INVERSE.setdefault(ak, {})[m] = st

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# --- FONCTIONS DE NETTOYAGE ---
def remove_accents(text):
    if pd.isna(text): return ''
    nfkd_form = unicodedata.normalize('NFKD', str(text))
    return "".join([c for c in nfkd_form if not unicodedata.combining(c)]).lower()

def norm_key(s):
    return re.sub(r'[^a-z0-9]', '', remove_accents(s))

def clean_number(val):   # identique au script impôts
    if pd.isna(val): return 0.0
    if isinstance(val, (int, float)): return float(val)
    val_str = str(val).replace("'", "").replace("’", "").replace(" ", "").strip()
    if val_str == '' or val_str == '-': return 0.0
    if ',' in val_str:
        parts = val_str.split(',')
        if len(parts[-1]) == 3: val_str = val_str.replace(',', '')
        else: val_str = val_str.replace(',', '.')
    try: return float(val_str)
    except ValueError: return 0.0

def clean_alterklasse(v):
    k = norm_key(v)
    if 'kin' in k: return 'AKL-KIN'
    if 'jug' in k: return 'AKL-JUG'
    if 'erw' in k: return 'AKL-ERW'
    return str(v).strip()

def clean_unfall(v):
    k = norm_key(v)
    if k.startswith('mit'): return 'MIT-UNF'
    if 'ohn' in k: return 'OHN-UNF'
    return str(v).strip()

def clean_stufe(v):                      # FRASTU_04 -> FRAST4
    m = re.search(r'(\d+)', str(v))
    if not m: return ''
    n = int(m.group(1))
    return 'FRAST%d' % n if 0 <= n <= 6 else ''

def clean_region(v):                     # PR_REG_0 -> PR-REG CH0
    m = re.search(r'(\d+)\s*$', str(v).strip())
    return 'PR-REG CH%d' % int(m.group(1)) if m else str(v).strip().upper()

def clean_tariftyp(v):                   # P_OKPCH -> TAR-BASE, code Hausarzt -> TAR-HAM
    k = norm_key(v)
    if 'okp' in k: return 'TAR-BASE'
    if 'ham' in k or 'hmp' in k or 'hausarzt' in k: return 'TAR-HAM'
    if 'tel' in k: return 'TAR-TEL'
    if 'hmo' in k or 'grp' in k: return 'TAR-HMO'
    return str(v).strip().upper()

def clean_tarif(v):
    k = norm_key(v)
    if 'okp' in k or 'base' in k: return 'BASE'
    if 'ham' in k or 'hmp' in k or 'hausarzt' in k: return 'HAM'
    return str(v).strip().upper()

def extraire_montant(v):                 # 'FR_01_E_0300' -> 300, '300' -> 300, '' -> None
    s = str(v).replace("'", "").replace("’", "").replace(" ", "").strip()
    if s == '' or s == '-': return None
    try: return int(float(s))
    except ValueError: pass
    chiffres = re.findall(r'\d+', s)
    return int(chiffres[-1]) if chiffres else None

def trouver_colonne(cols, cible, exclusions=()):
    nc, nex = norm_key(cible), {norm_key(e) for e in exclusions}
    for c in cols:
        if norm_key(c) == nc and norm_key(c) not in nex: return c
    for c in cols:
        if nc in norm_key(c) and norm_key(c) not in nex: return c
    return None

# ==========================================
# 1. LECTURE ROBUSTE DU CSV
# ==========================================
def lire_csv_bag(file_path, mots_entete=('versicherer',)):
    print(f"📁 Lecture : {file_path}")
    with open(file_path, 'r', encoding='utf-8-sig', errors='replace') as f:
        lignes = f.readlines()
    idx = None
    for mots in (mots_entete, mots_entete[:1]):        # 1er essai strict, puis 1er mot seul
        for i, l in enumerate(lignes[:30]):            # l'en-tête peut être précédé de titres
            if all(m in remove_accents(l) for m in mots):
                idx = i; break
        if idx is not None: break
    if idx is None:
        print(f"❌ En-tête introuvable dans {file_path} — colle-moi les 3 premières lignes du fichier.")
        return None
    premiere = lignes[idx]
    sep = ';' if premiere.count(';') >= premiere.count(',') else ('\t' if '\t' in premiere else ',')
    df = pd.read_csv(io.StringIO(''.join(lignes[idx:])), sep=sep, dtype=str, keep_default_na=False)
    print(f"   {len(df)} lignes lues (séparateur '{sep}')")
    return df

# ==========================================
# 2. NETTOYAGE PRIMES (décodage complet BAG -> conventions de l'app)
# ==========================================
def nettoyer_primes(file_path):
    print(f"\n🔄 Nettoyage primes : {file_path}")
    df = lire_csv_bag(file_path, mots_entete=('versicherer', 'pramie'))
    if df is None: return None, 0
    cols = list(df.columns)
    c_vers  = trouver_colonne(cols, 'Versicherer')
    c_kt    = trouver_colonne(cols, 'Kanton')
    c_hg    = trouver_colonne(cols, 'Hoheitsgebiet')
    c_reg   = trouver_colonne(cols, 'Region')
    c_ak    = trouver_colonne(cols, 'Altersklasse', exclusions=('Altersuntergruppe',))
    c_unf   = trouver_colonne(cols, 'Unfalleinschluss')
    c_ttyp  = trouver_colonne(cols, 'Tariftyp')
    c_tbez  = trouver_colonne(cols, 'Tarifbezeichnung')
    c_tsub  = trouver_colonne(cols, 'Altersuntergruppe')
    c_prae  = trouver_colonne(cols, 'Prämie')
    c_gj    = trouver_colonne(cols, 'Geschäftsjahr')
    c_ej    = trouver_colonne(cols, 'Erhebungsjahr')
    c_stufe = next((c for c in cols if 'franchise' in norm_key(c) and 'stufe' in norm_key(c)), None)
    cols_franchise = [c for c in cols if 'franchise' in norm_key(c) and 'stufe' not in norm_key(c)]
    pris = {c for c in (c_ttyp, c_tbez) if c}
    c_tarif = next((c for c in cols if 'tarif' in norm_key(c) and c not in pris), None)

    print("   Mapping :")
    for nom, c in [('Versicherer',c_vers),('Kanton',c_kt),('Hoheitsgebiet',c_hg),('Region',c_reg),
                   ('Altersklasse',c_ak),('Unfalleinschluss',c_unf),('Tarif',c_tarif),('Tariftyp',c_ttyp),
                   ('Altersuntergruppe',c_tsub),('Franchisestufe',c_stufe),('Prämie',c_prae),('Tarifbezeichnung',c_tbez)]:
        print(f"      {nom:18} <- {c if c else '(absent)'}")
    print(f"      {'Franchise':18} <- {cols_franchise}")

    manquantes = [nom for nom, c in [('Versicherer',c_vers),('Kanton',c_kt),('Altersklasse',c_ak),('Prämie',c_prae)] if not c]
    if not cols_franchise and not c_stufe: manquantes.append('Franchise/Franchisestufe')
    if manquantes:
        print(f"❌ Colonnes introuvables : {manquantes}")
        print(f"   En-têtes du fichier : {cols}")
        print("   -> colle-moi cette ligne, je te donne la correction.")
        return None, 0
    if not c_tarif and not c_ttyp:
        print("⚠️ Ni Tarif ni Tariftyp dans le fichier : isBaseP sera faux partout.")

    for c, nom, attendu in [(c_gj,'Geschäftsjahr',GESCHAEFTSJAHR),(c_ej,'Erhebungsjahr',ERHEBUNGSJAHR)]:
        if c:
            annees = {int(x) for x in re.findall(r'\d{4}', ' '.join(df[c].unique()[:20]))}
            if annees and annees != {attendu}:
                print(f"⚠️ {nom} du fichier = {sorted(annees)} -> la config écrase avec {attendu}")

    # --- Altersklasse : on jette les lignes non décodables ---
    ak = df[c_ak].map(clean_alterklasse)
    ak_ok = ak.isin(['AKL-KIN','AKL-JUG','AKL-ERW'])
    if int((~ak_ok).sum()): print(f"   ⚠️ {int((~ak_ok).sum())} lignes ignorées (Altersklasse inconnue)")
    df = df.loc[ak_ok].reset_index(drop=True)
    ak = ak[ak_ok].reset_index(drop=True)
    if df.empty: print("❌ Aucune ligne valide."); return None, 0

    out = pd.DataFrame(index=df.index)
    out['Versicherer'] = df[c_vers].str.strip()
    out['Kanton'] = df[c_kt].str.strip()
    out['Hoheitsgebiet'] = df[c_hg].str.strip() if c_hg else ''
    out['Region'] = df[c_reg].map(clean_region) if c_reg else ''
    out['Altersklasse'] = ak
    out['Unfalleinschluss'] = df[c_unf].map(clean_unfall) if c_unf else ''
    if c_tarif:
        out['Tarif'] = df[c_tarif].map(clean_tarif)
    elif c_ttyp:
        out['Tarif'] = df[c_ttyp].map(clean_tariftyp).map(lambda t: t[4:] if isinstance(t, str) and t.startswith('TAR-') else t)
    else:
        out['Tarif'] = ''
    out['Tariftyp'] = df[c_ttyp].map(clean_tariftyp) if c_ttyp else (
        out['Tarif'].map(lambda t: 'TAR-' + t if t in ('BASE','HAM','TEL','HMO') else t))
    out['Altersuntergruppe'] = df[c_tsub].str.strip() if c_tsub else ''
    out['Prämie'] = df[c_prae].map(clean_number)
    out['Tarifbezeichnung'] = df[c_tbez].str.strip() if c_tbez else ''

    # --- Franchise : le barème officiel fait foi, le fichier sert de contrôle ---
    stufe = df[c_stufe].map(clean_stufe) if c_stufe else pd.Series([''] * len(df), index=df.index)
    montant = pd.Series(np.nan, index=df.index)
    for c in cols_franchise:            # 2 colonnes Franchise ? la 1re qui donne un nombre gagne
        montant = montant.fillna(pd.to_numeric(df[c].map(extraire_montant), errors='coerce'))
    stufe_ok = stufe.isin(['FRAST%d' % i for i in range(7)])
    attendu = pd.Series([MONTANTS.get((a, s)) for a, s in zip(out['Altersklasse'], stufe)], index=df.index, dtype=object)
    inv = pd.Series([INVERSE.get(a, {}).get(m) for a, m in zip(out['Altersklasse'], montant)], index=df.index, dtype=object)
    maskA = stufe_ok & attendu.notna()          # stufe lisible -> montant du barème
    maskB = (~stufe_ok) & inv.notna()           # stufe illisible -> stufe déduite du montant
    ko = ~(maskA | maskB)
    out['Franchisestufe'] = ''
    out['Franchise'] = np.nan
    out.loc[maskA, 'Franchisestufe'] = stufe[maskA]
    out.loc[maskA, 'Franchise'] = attendu[maskA].astype(float)
    out.loc[maskB, 'Franchisestufe'] = inv[maskB]
    out.loc[maskB, 'Franchise'] = montant[maskB]
    anomalies = int((maskA & montant.notna() & (montant != attendu.astype(float))).sum())
    if anomalies: print(f"   ⚠️ {anomalies} lignes avec franchise ≠ barème -> montant du barème retenu")

    # --- filtres finaux ---
    prime_ko = out['Prämie'] <= 0
    vers_ko = out['Versicherer'] == ''
    for nom, m in [('franchise indéterminable', ko), ('prime vide/nulle', prime_ko), ('assureur vide', vers_ko)]:
        if int(m.sum()): print(f"   ⚠️ {int(m.sum())} lignes ignorées ({nom})")
    out = out.loc[~(ko | prime_ko | vers_ko)].reset_index(drop=True)
    if out.empty: print("❌ Aucune ligne exploitable."); return None, anomalies

    out['Franchise'] = out['Franchise'].astype(int)
    out['Geschäftsjahr'] = GESCHAEFTSJAHR
    out['Erhebungsjahr'] = ERHEBUNGSJAHR
    out['isBaseF'] = out['Franchisestufe'].eq('FRAST1')
    out['isBaseP'] = out['Tarif'].eq('BASE') | out['Tariftyp'].eq('TAR-BASE')
    out = out[CIBLES_PRIMES].drop_duplicates().reset_index(drop=True)
    print(f"   ✅ {len(out)} lignes propres")
    return out, anomalies

# ==========================================
# 3. NETTOYAGE TARIFS (tarifs_lamal : Versicherer = n° BAG, Kategorie ALT/MOD)
# ==========================================
def nettoyer_tarifs_fichier(file_path):
    print(f"\n🔄 Nettoyage tarifs : {file_path}")
    df = lire_csv_bag(file_path, mots_entete=('versicherer', 'tarif'))
    if df is None: return None
    ids = [c for c in df.columns if norm_key(c) == 'id']
    if ids: df = df.drop(columns=ids)          # export de la table -> id auto-généré, on l'ignore
    cols = list(df.columns)
    c_vers  = trouver_colonne(cols, 'Versicherer')
    c_kat   = trouver_colonne(cols, 'Kategorie')
    c_tarif = trouver_colonne(cols, 'Tarif', exclusions=('Tariftyp', 'Tarifbezeichnung'))
    c_ttyp  = trouver_colonne(cols, 'Tariftyp')
    c_sort  = next((c for c in cols if 'sort' in norm_key(c)), None)
    c_nde   = trouver_colonne(cols, 'Name_DE')
    c_nfr   = trouver_colonne(cols, 'Name_FR')
    c_nit   = trouver_colonne(cols, 'Name_IT')
    c_gj    = trouver_colonne(cols, 'Geschäftsjahr')
    c_ej    = trouver_colonne(cols, 'Erhebungsjahr')
    print("   Mapping :")
    for nom, c in [('Versicherer',c_vers),('Kategorie',c_kat),('Tarif',c_tarif),('Tariftyp',c_ttyp),
                   ('Sort.-Nr.',c_sort),('Name_DE',c_nde),('Name_FR',c_nfr),('Name_IT',c_nit)]:
        print(f"      {nom:12} <- {c if c else '(absent)'}")
    if not c_vers or not c_tarif:
        print(f"❌ Colonnes Versicherer/Tarif introuvables — en-têtes : {cols}")
        return None

    for c, nom, attendu in [(c_gj,'Geschäftsjahr',GESCHAEFTSJAHR),(c_ej,'Erhebungsjahr',ERHEBUNGSJAHR)]:
        if c:
            annees = {int(x) for x in re.findall(r'\d{4}', ' '.join(df[c].unique()[:20]))}
            if annees and annees != {attendu}:
                print(f"⚠️ {nom} du fichier = {sorted(annees)} -> remplacé par {attendu}")

    vide = pd.Series([''] * len(df), index=df.index)
    vers_brut = df[c_vers].str.strip()
    tarif     = df[c_tarif].str.strip()
    kat_src   = df[c_kat].str.strip() if c_kat else vide
    ttyp_src  = df[c_ttyp].str.strip() if c_ttyp else vide
    sort_src  = df[c_sort].str.strip() if c_sort else vide
    nde = df[c_nde].str.strip() if c_nde else vide
    nfr = df[c_nfr].str.strip() if c_nfr else vide
    nit = df[c_nit].str.strip() if c_nit else vide

    out = pd.DataFrame(index=df.index)
    out['Versicherer'] = vers_brut.map(clean_number).astype(int) if TARIFS_VERSICHERER_INT else vers_brut
    out['Tarif'] = tarif

    def clean_kategorie(v, t):
        k = norm_key(v)
        if 'mod' in k: return 'MOD'
        if 'alt' in k: return 'ALT'
        return 'ALT' if t[:1].upper() in ('E', 'J', 'K') else 'MOD'
    out['Kategorie'] = [clean_kategorie(v, t) for v, t in zip(kat_src, tarif)]

    def clean_ttyp_tarifs(v, kat, t):
        if v:
            k = norm_key(v)
            if 'okp' in k: return 'BASE'
            if 'ham' in k or 'hmp' in k: return 'HAM'
            if 'hmo' in k: return 'HMO'
            if 'div' in k: return 'DIV'
            return v.upper()
        if kat == 'ALT': return t[:1].upper() if t[:1].upper() in ('E', 'J', 'K') else ''
        kt = norm_key(t)
        if 'base' in kt or 'okp' in kt: return 'BASE'
        if 'ham' in kt or 'hmp' in kt: return 'HAM'
        if 'hmo' in kt: return 'HMO'
        return 'DIV'
    out['Tariftyp'] = [clean_ttyp_tarifs(v, k, t) for v, k, t in zip(ttyp_src, out['Kategorie'], tarif)]

    out['Sort.-Nr.'] = sort_src.map(clean_number).astype(int)
    out['Name_DE'] = nde.where(nde != '', tarif)          # fallback : le code Tarif
    out['Name_FR'] = nfr.where(nfr != '', out['Name_DE']) # fallback : l'allemand
    out['Name_IT'] = nit.where(nit != '', out['Name_DE'])
    out['Geschäftsjahr'] = GESCHAEFTSJAHR
    out['Erhebungsjahr'] = ERHEBUNGSJAHR

    out = out.loc[(vers_brut != '') & (tarif != '')]
    out = out[CIBLES_TARIFS].drop_duplicates().reset_index(drop=True)
    if out.empty:
        print("❌ Aucun tarif exploitable."); return None
    print(f"   ✅ {len(out)} tarifs propres | ALT : {(out['Kategorie']=='ALT').sum()} | MOD : {(out['Kategorie']=='MOD').sum()}")
    return out

# ==========================================
# 4. RAPPORT DE CONTRÔLE
# ==========================================
def controler(primes, tarifs, anomalies):
    print("\n📊 RAPPORT DE CONTRÔLE (compare avec tes données 2026) :")
    print(f"   PRIMES — {len(primes)} lignes | {primes['Versicherer'].nunique()} assureurs | cantons : {sorted(primes['Kanton'].unique())}")
    print(f"   Altersklasse : {primes['Altersklasse'].value_counts().to_dict()}")
    for col in ['Tarif', 'Tariftyp', 'Region', 'Unfalleinschluss']:
        print(f"   {col:16}: {sorted(primes[col].unique())}")
    combos = primes.drop_duplicates(['Altersklasse','Franchisestufe','Franchise'])[['Altersklasse','Franchisestufe','Franchise']].sort_values(['Altersklasse','Franchisestufe'])
    print("   Barème lu :")
    for _, r in combos.iterrows(): print(f"      {r['Altersklasse']} {r['Franchisestufe']} -> {int(r['Franchise'])} CHF")
    print(f"   Incohérences franchise : {anomalies} | Erreurs isBaseF : {int((primes['isBaseF'] & (primes['Franchisestufe'] != 'FRAST1')).sum())} (attendu 0)")
    if tarifs is not None:
        print(f"\n   TARIFS — {len(tarifs)} lignes | {tarifs['Versicherer'].nunique()} assureurs | "
              f"ALT : {(tarifs['Kategorie']=='ALT').sum()} / MOD : {(tarifs['Kategorie']=='MOD').sum()}")
        print(f"   Tariftyp : {sorted(tarifs['Tariftyp'].unique())}")

# ==========================================
# 5. NETTOYAGE DES TABLES PUIS IMPORT (tarifs d'abord, primes ensuite)
# ==========================================
def vider_table(table):
    if VIDER_TOUTES_ANNEES:
        supabase.table(table).delete().gte('id', 0).execute()
        print(f"🧹 {table} vidée (toutes années)")
    else:
        try:
            supabase.table(table).delete().eq('Geschäftsjahr', GESCHAEFTSJAHR).execute()
            print(f"🧹 {table} : lignes {GESCHAEFTSJAHR} supprimées (autres années intactes)")
        except Exception:
            supabase.table(table).delete().gte('id', 0).execute()
            print(f"🧹 {table} : pas de colonne Geschäftsjahr -> table vidée entièrement")

def inserer(table, df, cibles, int_cols=None):
    if int_cols is None: int_cols = INT_COLS
    for c in cibles:
        if c not in df.columns:
            df[c] = 0 if (c in int_cols or c in FLOAT_COLS) else (False if c in BOOL_COLS else '')
    nb = len(df)
    print(f"🚀 {table} : insertion de {nb} lignes par lots de {TAILLE_LOT}...")
    for i in range(0, nb, TAILLE_LOT):
        lot = df[cibles].iloc[i:i+TAILLE_LOT].to_dict('records')
        for r in lot:
            for c in cibles:
                if c in int_cols: r[c] = int(r[c])
                elif c in FLOAT_COLS: r[c] = float(r[c])
                elif c in BOOL_COLS: r[c] = bool(r[c])
        supabase.table(table).insert(lot).execute()
        if (i // TAILLE_LOT) % 20 == 0 or i + TAILLE_LOT >= nb:
            print(f"   ... {min(i + TAILLE_LOT, nb)}/{nb}")
    try:
        n = supabase.table(table).select('id', count='exact').eq('Geschäftsjahr', GESCHAEFTSJAHR).execute().count
    except Exception:
        n = supabase.table(table).select('id', count='exact').execute().count
    print(f"✅ {table} : {n} lignes en base (attendu {nb})")

# ==========================================
# EXECUTION
# ==========================================
if __name__ == "__main__":
    try:
        csvs = [f for f in os.listdir('.') if f.lower().endswith('.csv') and '_clean' not in f.lower()]
        noms = {f: remove_accents(f) for f in csvs}
        # tarifs d'abord : "tarifs_lamal.csv" contient aussi 'lamal', il ne doit pas partir dans primes
        fichiers_tarifs = [f for f in csvs if 'tarif' in noms[f]
                           and not any(m in noms[f] for m in ('prime', 'praem', 'pramien'))]
        fichiers_primes = [f for f in csvs if f not in fichiers_tarifs
                           and any(m in noms[f] for m in ('prime', 'praem', 'pramien', 'lamal'))]
        autres = [f for f in csvs if f not in fichiers_primes and f not in fichiers_tarifs]
        xlsx = [f for f in os.listdir('.') if f.lower().endswith(('.xlsx', '.xls'))]
        if xlsx: print(f"⚠️ Fichiers Excel ignorés (enregistrer en CSV d'abord) : {xlsx}")
        if autres: print(f"⏭️ Fichiers ignorés (non reconnus) : {autres}")
        print(f"📂 Fichiers primes : {fichiers_primes or '(aucun)'}")
        print(f"📂 Fichiers tarifs : {fichiers_tarifs or '(aucun)'}")
        if not fichiers_primes: sys.exit("❌ Aucun fichier primes CSV détecté dans ce dossier.")

        dfs, anomalies = [], 0
        for f in fichiers_primes:
            df, a = nettoyer_primes(f)
            if df is not None and len(df): dfs.append(df); anomalies += a
        if not dfs: sys.exit("❌ Rien à importer côté primes.")
        primes = pd.concat(dfs, ignore_index=True).drop_duplicates().reset_index(drop=True)

        tarifs = None
        for f in fichiers_tarifs:
            t = nettoyer_tarifs_fichier(f)
            if t is not None and len(t):
                tarifs = pd.concat([tarifs, t], ignore_index=True) if tarifs is not None else t
        if tarifs is not None:
            tarifs = tarifs.drop_duplicates().reset_index(drop=True)
        else:
            print("ℹ️ Aucun fichier tarifs -> tarifs_lamal ne sera ni vidée ni modifiée.")

        controler(primes, tarifs, anomalies)

        if not IMPORTER_VRAIMENT:
            primes.to_csv(f"primes_{GESCHAEFTSJAHR}_clean.csv", index=False, encoding='utf-8')
            if tarifs is not None:
                tarifs.to_csv(f"tarifs_{GESCHAEFTSJAHR}_clean.csv", index=False, encoding='utf-8')
                print(f"\n💾 CSV propres générés : primes_{GESCHAEFTSJAHR}_clean.csv + tarifs_{GESCHAEFTSJAHR}_clean.csv")
            else:
                print(f"\n💾 CSV propre généré : primes_{GESCHAEFTSJAHR}_clean.csv")
            print("🔍 Mode simulation : rien n'a été écrit en base. Vérifie le rapport, puis mets IMPORTER_VRAIMENT = True.")
        else:
            if anomalies > 0 and not FORCER_IMPORT:
                sys.exit("❌ Import annulé (anomalies de franchise). Vérifie le rapport, ou mets FORCER_IMPORT = True.")
            # 1) on vide sur place  2) on insère — tarifs uniquement si un fichier tarifs a été fourni
            if tarifs is not None:
                vider_table(TABLE_TARIFS)
                inserer(TABLE_TARIFS, tarifs, CIBLES_TARIFS, int_cols=INT_COLS_TARIFS)
            vider_table(TABLE_PRIMES)
            inserer(TABLE_PRIMES, primes, CIBLES_PRIMES)
            print("\n🚀 IMPORT TERMINÉ AVEC SUCCÈS ! 🚀")
    except SystemExit as e:
        if str(e): print(e)
    except Exception as e:
        print(f"❌ Erreur globale : {e}")