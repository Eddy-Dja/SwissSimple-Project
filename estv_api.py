import requests
import json

def calculer_impot_estv(revenu_brut, tax_location_id, annee_fiscale, statut_civil=1, religion=5, age=35):
    """
    Calcule l'impôt en interrogeant directement le moteur officiel de l'ESTV.
    
    Paramètres :
    - revenu_brut (int): Revenu brut en CHF (ex: 100000)
    - tax_location_id (int): ID de la commune utilisée par l'ESTV (ex: 170000000 pour Fribourg)
    - annee_fiscale (int): Année fiscale (ex: 2025)
    - statut_civil (int): 1 = Célibataire, 2 = Marié (défaut: 1)
    - religion (int): 5 = Aucune, 1 = Catholique, 2 = Réformé (défaut: 5)
    - age (int): Âge du contribuable (défaut: 35)
    """
    
    # L'URL exacte que vous avez trouvée dans les headers
    url_api = "https://swisstaxcalculator.estv.admin.ch/delegate/ost-integration/v1/lg-proxy/operation/c3b67379_ESTV/API_calculateDetailedTaxes"
    url_accueil = "https://swisstaxcalculator.estv.admin.ch/"
    
    # On utilise une Session pour gérer automatiquement les cookies (tokens CSRF de sécurité)
    session = requests.Session()
    
    # Headers pour imiter parfaitement le navigateur de l'utilisateur
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Content-Type': 'application/json',
        'Origin': 'https://swisstaxcalculator.estv.admin.ch',
        'Referer': 'https://swisstaxcalculator.estv.admin.ch/'
    }
    session.headers.update(headers)
    
    try:
        # ÉTAPE 1 : On visite l'accueil pour initialiser les cookies de sécurité
        # C'est INDISPENSABLE, sinon l'API bloque la requête (Erreur 403)
        session.get(url_accueil, timeout=10)
        
        # ÉTAPE 2 : On construit le Payload exact que vous avez trouvé
        payload = {
            "SimKey": None,
            "TaxYear": annee_fiscale,
            "TaxLocationID": tax_location_id,
            "Relationship": statut_civil,
            "Confession1": religion,
            "Confession2": 0,
            "Age1": age,
            "Age2": 0,
            "Revenue1": revenu_brut,
            "Revenue2": 0,
            "RevenueType1": 1, # 1 = Revenu salarié
            "RevenueType2": 0,
            "Fortune": 0,
            "Budget": [],
            "Children": []
        }
        
        # ÉTAPE 3 : Envoi de la requête POST
        response = session.post(url_api, json=payload, timeout=10)
        response.raise_for_status() # Lève une erreur si le serveur répond par 4xx ou 5xx
        
        # ÉTAPE 4 : Lecture de la réponse JSON
        data = response.json().get("response", {})
        
        # ÉTAPE 5 : Extraction formatée des résultats
        resultats = {
            "impot_total": data.get("TotalTax", 0),
            "impot_federal": data.get("IncomeTaxFed", 0),
            "impot_cantonal": data.get("IncomeTaxCanton", 0),
            "impot_communal": data.get("IncomeTaxCity", 0),
            "impot_religion": data.get("IncomeTaxChurch", 0),
            "revenu_imposable_federal": data.get("TaxableIncomeFed", 0),
            "revenu_imposable_cantonal": data.get("TaxableIncomeCanton", 0),
            "taux_marginal": data.get("MarginalTaxRate", 0),
            # Détails des déductions calculées par l'ESTV
            "deductions_detail": {
                "frais_professionnels": data.get("InfoCanton", [{}])[1].get("Value", 0) if len(data.get("InfoCanton", [])) > 1 else 0,
                "assurances_maladie_canton": data.get("InfoCanton", [{}])[2].get("Value", 0) if len(data.get("InfoCanton", [])) > 2 else 0,
            },
            "commune_info": data.get("Location", {})
        }
        
        return resultats

    except requests.exceptions.HTTPError as e:
        return {"erreur": f"Erreur HTTP de l'API ESTV : {e} - Détails : {response.text}"}
    except requests.exceptions.RequestException as e:
        return {"erreur": f"Impossible de joindre l'API ESTV : {e}"}
    except Exception as e:
        return {"erreur": f"Erreur inattendue lors du parsing : {e}"}


# ==========================================
# TEST DU FICHIER AVEC VOS DONNÉES
# ==========================================
if __name__ == "__main__":
    print("🧮 Calcul en cours via le moteur officiel de l'ESTV...\n")
    
    resultat = calculer_impot_estv(
        revenu_brut=100000,
        tax_location_id=170000000, # ID spécifique pour la ville de Fribourg
        annee_fiscale=2025,
        statut_civil=1,           # 1 = Célibataire
        religion=5,               # 5 = Sans religion
        age=35
    )
    
    if "erreur" in resultat:
        print("❌ Erreur :", resultat["erreur"])
    else:
        print("✅ Calcul officiel réussi !")
        print("-" * 40)
        print(f"Revenu Brut déclaré     : 100 000 CHF")
        print(f"Revenu Imposable (Fed)  : {resultat['revenu_imposable_federal']:,} CHF")
        print(f"Revenu Imposable (Cant) : {resultat['revenu_imposable_cantonal']:,} CHF")
        print("-" * 40)
        print(f"Impôt Fédéral           : {resultat['impot_federal']:,} CHF")
        print(f"Impôt Cantonal          : {resultat['impot_cantonal']:,} CHF")
        print(f"Impôt Communal          : {resultat['impot_communal']:,} CHF")
        print(f"Impôt Religion          : {resultat['impot_religion']:,} CHF")
        print("=" * 40)
        print(f"TOTAL DES IMPÔTS        : {resultat['impot_total']:,} CHF")
        print(f"Taux Marginal           : {resultat['taux_marginal']}%")