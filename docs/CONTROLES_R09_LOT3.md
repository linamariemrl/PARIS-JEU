# R09 lot 3 — Contrôles qualité de l'inventaire POP

État : **branche de développement uniquement** (PR #14). Version publique inchangée : 0.26.4.

Commande : `python scripts/audit_pop_inventory.py [--liens]` → `data/heritage/controles-pop-paris.json`.
Règle : **signalement, jamais de correction silencieuse**. Liens vérifiés le 2026-11-10T02:06:51+00:00.

| Contrôle | Nombre | Traitement |
|---|---|---|
| Point POP invalide (`[0,0]`, latitude 43,8° au lieu de 48,8°, coordonnées inversées, hors Paris) | 109 | point écarté à la source ; la notice reste localisée par sa commune POP |
| Arrondissement de la commune POP ≠ arrondissement du point POP | 22 | signalé (souvent limite d'arrondissement : places, colonnes, stations) |
| Arrondissement de l'index du jeu ≠ arrondissement POP | 22 | signalé |
| Point du jeu à plus de 150 m du point POP | 0 | — |
| Noms multiples (appellations officielles) | 77 | ajoutés aux repères de la fiche et à la recherche du catalogue |
| Sites détruits, vestiges, fragments (champ ÉTAT) | 37 | indiqués dans la fiche et dans le catalogue |
| Notice MH (PA) sans protection renseignée | 14 | signalé |
| Nature d'acte (« arrêté », « liste », « décret ») affichée comme protection | 2270 | **corrigé** : libellé « Nature de l'acte de protection (POP) » ; le niveau classé/inscrit figure dans la fiche Histoire |
| Doublons potentiels (même titre, même arrondissement) | 72 | signalés, non fusionnés (souvent des parties distinctes d'un même ensemble, chacune protégée séparément) |
| Points POP quasi confondus (< 3 m) | 10 | signalés |
| Lieux prioritaires sans référence POP | 55 | listés |
| Liens externes des notices | 128 vérifiés, 5 en erreur | listés (404 ou accès refusé) |

## Liens en erreur

- JAR0000551 : https://www.mnhn.fr → HTTP 403
- JAR0000551 : https://www.mnhn.fr/fr/grandes-serres-du-jardin-des-plantes → HTTP 403
- PA00086061 : http://www.culture.gouv.fr/Wave/image/merimee/PDF/PA00086061_IMH_1975 → HTTP 404
- PA75100009 : https://www.shap.fr/bulletins/256-2013-3eme-livraison → HTTP 404
- PA75100009 : https://www.franceculture.fr/emissions/une-histoire-particuliere-un-recit-documentaire-en-deux-parties/ → HTTP 404
