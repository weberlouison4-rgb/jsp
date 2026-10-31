# ⚖️ JurisRévise

Appli de révision de jurisprudence pour les TD de **droit administratif** et de **droit des obligations**.

## Lancer l'app

Aucune installation nécessaire : ouvre simplement `index.html` dans ton navigateur
(ou sers le dossier avec n'importe quel serveur statique, ex. `python3 -m http.server`).

## Fonctionnement

1. **Choix de la matière** : droit administratif ou droit des obligations.
2. **Choix du mode de jeu** :
   - **QCM** — quel arrêt correspond à ce principe ?
   - **Flashcards** — principe affiché, retourne la carte pour révéler l'arrêt, auto-évalue-toi. **En flashcards, tu balaies tous les arrêts de la matière** (pas de limite de 8 cartes).
   - **Vrai ou Faux** — ce principe appartient-il bien à cet arrêt ?
   - **Chronologie** — remettre 5 arrêts dans le bon ordre chronologique.
   - **Associer** — relier chaque arrêt à son année ou sa juridiction.
   - **Arrêt mystère** — deviner le nom de l'arrêt à partir d'indices (juridiction, date, principe).
3. **Score et progression** : chaque session est enregistrée dans le `localStorage` du navigateur
   (meilleur score, précision globale par matière affichée sur l'accueil).

## Contenu

`data.js` contient **84 arrêts incontournables de TD** (53 droit administratif, 31 droit des obligations : Blanco, Cadot, Dame Lamotte, Kirkwood, Ingénieurs-conseils, Nicolo, Alitalia, Sarran, Koné, Ternon, KPMG, Tropic, Czabaj, Danthony, Tarn-et-Garonne… / Teffaine, Jand'heur, Franck, Mercier, Vabre, Desmares, Costedoat, Chronopost, Manoukian, Perruche, Baby Loup…) avec pour chacun :
juridiction, date exacte, nom, principe et « ce qu'il faut retenir ».

## Structure

```
index.html   — écrans (accueil / modes / jeu / fin)
style.css    — thème sombre responsive
app.js       — moteur des 6 jeux + progression locale
data.js      — base d'arrêts
```

Pour ajouter des arrêts : il suffit d'ajouter un objet dans le tableau `ARRETS` de `data.js`.
