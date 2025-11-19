# Nouvelle configuration du dépôt GitHub

Ce projet local existe déjà avec un historique (`main`). Si `git push` échoue et tu veux repartir sur un **nouveau dépôt GitHub**, suis l'une des deux options.

## Option A: Nouveau dépôt (garder l'historique)
1. Va sur https://github.com/new (connecté à ton compte).
2. Nom du dépôt: par ex. `EgoBH2` (sans README initial, sans .gitignore, sans licence pour éviter les conflits).
3. Clique "Create repository".
4. Dans PowerShell:
```powershell
cd f:\DEV\carottesv2\EgoBH
# Renommer l'ancien remote pour référence (facultatif)
git remote rename origin old-origin
# Ajouter le nouveau remote (remplace EgoBH2 si autre nom)
git remote add origin https://github.com/Anistaar/EgoBH2.git
# Vérifier
git remote -v
# Pousser l'historique
git push -u origin main
```

Si authentification demandée: utilise un **Personal Access Token (classic)** comme mot de passe (crée-le ici: https://github.com/settings/tokens > "Generate new token" > scopes: `repo`).

## Option B: Réinitialiser l'historique (repartir de zéro)
Efface l'historique local et crée un commit initial.
```powershell
cd f:\DEV\carottesv2\EgoBH
Remove-Item -Recurse -Force .git
git init
git add .
git commit -m "Initial import"
git branch -M main
# Crée d'abord le dépôt vide sur GitHub (ex: EgoBH2), puis:
git remote add origin https://github.com/Anistaar/EgoBH2.git
git push -u origin main
```

## Problèmes de push fréquents
| Cause | Symptôme | Solution |
|-------|----------|----------|
| Auth token manquant | Demande user/pass, rejet | Créer token et réessayer |
| Repo distant supprimé | 404 ou not found | Créer nouveau repo + changer remote |
| Divergence historique | "non-fast-forward" | `git pull --rebase origin main` puis `git push` |
| Fichiers >100MB | Rejet GitHub | Retirer fichiers, recommit |
| Branche protégée | Push refusé | Créer PR via nouvelle branche |

## Vérification après création
```powershell
git remote -v
git push -u origin main
git status
```
Tu dois voir la branche `main` suivie de `origin/main` sans erreurs.

## Ajouter une autre branche et faire une PR
```powershell
git checkout -b feature/intro
# modifications...
git add .
git commit -m "Add intro feature"
git push -u origin feature/intro
```
Ensuite ouvre le dépôt sur GitHub et crée une Pull Request.

## Mise à jour origine si tu changes encore
```powershell
git remote set-url origin https://github.com/Anistaar/NouveauNom.git
```

---
Fichier généré automatiquement pour t'aider à reconstruire le dépôt GitHub.
