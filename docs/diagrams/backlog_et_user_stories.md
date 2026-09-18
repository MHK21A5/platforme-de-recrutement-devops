# Backlog produit, planification des sprints & user stories

> Version mise à jour du chapitre « Planification et analyse du projet ».
> Le développement a évolué : ajout de **l'évaluation par quiz IA (Ollama)**, du
> **système de notifications temps réel**, des **notifications email**, de la
> **recherche dynamique d'offres** et des **tableaux de bord / rapports**.
> Un **4ᵉ sprint** est donc ajouté.

---

## 1. Backlog du produit (Tab. 2.1)

| # | En tant que | Je veux | Priorité |
|---|-------------|---------|----------|
| 1 | Candidat | m'inscrire et me connecter à la plateforme | Haute |
| 2 | Utilisateur | gérer mon profil (photo, informations) | Moyenne |
| 3 | Candidat | téléverser mon CV et le faire analyser (ATS) | Haute |
| 4 | Recruteur | publier et gérer des offres d'emploi | Haute |
| 5 | Candidat | consulter et rechercher les offres, puis postuler | Haute |
| 6 | Recruteur | consulter les candidatures avec le score de matching | Haute |
| 7 | Recruteur | accepter ou refuser une candidature | Haute |
| 8 | Recruteur | planifier un entretien et notifier le candidat | Haute |
| 9 | Recruteur / Candidat | mener un entretien en ligne (chat + visio WebRTC) | Haute |
| 10 | Recruteur | générer un quiz d'évaluation par IA adapté à l'offre | Haute |
| 11 | Candidat | passer le quiz chronométré et consulter mon rapport | Haute |
| 12 | Candidat | obtenir des conseils de préparation générés par IA | Moyenne |
| 13 | Utilisateur | être notifié en temps réel des événements importants | Haute |
| 14 | Administrateur | gérer les utilisateurs, offres et entretiens | Moyenne |

---

## 2. Planification des sprints (Tab. 2.2)

| Sprint | Objectif principal | Fonctionnalités concernées |
|--------|--------------------|-----------------------------|
| **Sprint 1** | Gestion des utilisateurs, authentification et profils | Inscription, connexion, gestion des rôles, gestion du profil utilisateur, téléversement du CV, ajout des formations, expériences et compétences. |
| **Sprint 2** | Gestion des offres d'emploi et des candidatures | Publication des offres, consultation et recherche des offres, postulation, consultation des candidatures reçues, analyse du CV (ATS) et score de matching, acceptation ou refus d'une candidature. |
| **Sprint 3** | Planification et déroulement des entretiens en ligne | Planification des entretiens, invitation par email, accès à la salle d'entretien, chat temps réel, visioconférence WebRTC, surveillance d'onglet, mise à jour du statut de l'entretien. |
| **Sprint 4** | Évaluation par IA et notifications temps réel | Génération de quiz par IA (Ollama), passage du quiz chronométré, rapport de quiz avec analyse IA, conseils de préparation par IA, système de notifications temps réel (cloche + toasts), notifications email, tableaux de bord et historique des rapports. |

---

## 3. Détail des sprints

### Sprint 1 — Gestion des utilisateurs, authentification et profils
Le premier sprint constitue la base fonctionnelle du système. Il concerne la
gestion des comptes utilisateurs et l'accès sécurisé à la plateforme (JWT,
hachage bcrypt, rôles admin/recruteur/candidat). Il permet également au candidat
de renseigner les informations nécessaires à son profil et à son CV.

### Sprint 2 — Gestion des offres d'emploi et des candidatures
Ce sprint couvre le cycle de vie d'une offre et d'une candidature : publication
et gestion des offres par le recruteur, consultation et **recherche dynamique**
côté candidat, postulation, puis traitement des candidatures. Le CV téléversé est
**analysé automatiquement (ATS)** et confronté à l'offre via un **score de
matching** (compétences 50 % + expérience 30 % + formation 20 %).

### Sprint 3 — Planification et déroulement des entretiens en ligne
Ce sprint met en place l'entretien en temps réel : planification (avec
**invitation email**), salle d'entretien, **chat instantané** et
**visioconférence pair-à-pair (WebRTC)** via signalisation Socket.IO, mise à jour
automatique du statut de l'entretien lorsque les deux participants sont présents.

### Sprint 4 — Évaluation par IA et notifications temps réel *(nouveau)*
Ce sprint enrichit la plateforme avec l'**intelligence artificielle** et la
**réactivité temps réel** :
- **Quiz généré par IA** : à partir de l'offre, le modèle *qwen2.5:1.5b* (via
  Ollama) génère un QCM technique ; une **banque de questions de secours** garantit
  la disponibilité en cas d'indisponibilité de l'IA.
- **Passage chronométré** (30 s/question, auto-soumission) et **rapport** avec
  graphiques et **analyse textuelle générée**.
- **Conseils de préparation** générés par IA pour le candidat.
- **Notifications temps réel** (cloche persistante + compteur de non-lus + toasts)
  et **notifications email**.

---

## 4. User stories — Fonctionnalités IA

| # | User story | Critères d'acceptation |
|---|-----------|------------------------|
| IA-1 | **En tant que** recruteur, **je veux** générer automatiquement un quiz technique adapté à l'offre grâce à l'IA, **afin d'**évaluer objectivement les compétences du candidat sans rédiger les questions. | Le quiz contient des QCM cohérents avec les compétences de l'offre ; génération déclenchée depuis la salle d'entretien. |
| IA-2 | **En tant que** recruteur, **je veux** que le système bascule sur une banque de questions de secours si l'IA est indisponible, **afin de** garantir la disponibilité du quiz. | Si l'appel à Ollama échoue ou renvoie un JSON invalide, un quiz de secours pertinent est fourni. |
| IA-3 | **En tant que** candidat, **je veux** passer le quiz question par question avec une minuterie, **afin d'**être évalué dans des conditions équitables et chronométrées. | 30 s par question ; soumission automatique à l'expiration ; progression visible. |
| IA-4 | **En tant que** recruteur, **je veux** consulter un rapport de quiz avec une analyse générée par IA, **afin d'**identifier rapidement les forces et faiblesses du candidat. | Rapport avec score, graphiques (donut/barres), correction question par question et synthèse textuelle. |
| IA-5 | **En tant que** candidat, **je veux** recevoir des conseils de préparation personnalisés générés par IA à partir de l'offre, **afin de** mieux me préparer à l'entretien. | Liste de conseils générée à la demande à partir du titre, des compétences et du niveau de l'offre. |
| IA-6 | **En tant que** recruteur, **je veux** que le CV du candidat soit analysé automatiquement (ATS) et scoré par rapport à l'offre, **afin de** prioriser les candidatures pertinentes. | Score 0–100 avec répartition compétences/expérience/formation, calculé à l'ouverture du profil candidat. |

---

## 5. User stories — Notifications

| # | User story | Critères d'acceptation |
|---|-----------|------------------------|
| NOT-1 | **En tant que** recruteur, **je veux** être notifié en temps réel lorsqu'un candidat postule à l'une de mes offres, **afin de** traiter la candidature sans rafraîchir la page. | Notification + toast instantanés ; la liste des candidatures se met à jour automatiquement. |
| NOT-2 | **En tant que** candidat, **je veux** être notifié lorsqu'un entretien est planifié avec moi, **afin de** m'y préparer à l'avance. | Notification temps réel + email d'invitation ; lien direct vers la salle d'entretien. |
| NOT-3 | **En tant que** candidat, **je veux** être notifié lorsque mon quiz est finalisé et noté, **afin de** consulter mon résultat. | Notification « quiz terminé » avec lien vers l'entretien/rapport. |
| NOT-4 | **En tant qu'**utilisateur, **je veux** consulter l'historique de mes notifications via une cloche avec compteur de non-lus, **afin de** ne rien manquer. | Cloche dans la barre supérieure, badge de non-lus, liste des 50 dernières. |
| NOT-5 | **En tant qu'**utilisateur, **je veux** marquer mes notifications comme lues (individuellement ou toutes), **afin de** gérer ma liste. | Clic sur une notification = lue + navigation ; bouton « Tout marquer comme lu ». |
| NOT-6 | **En tant qu'**utilisateur, **je veux** un retour visuel (toast) après chaque action, **afin d'**avoir une confirmation immédiate du succès ou de l'échec. | Toasts de succès/erreur pour créer/modifier/supprimer offres, entretiens, candidatures. |

---

## 6. Snippets LaTeX (à coller dans le rapport)

### Tab. 2.2 — Planification des sprints (mise à jour)

```latex
\begin{table}[H]
\centering
\begin{tabular}{|p{1.6cm}|p{4.5cm}|p{7cm}|}
\hline
\textbf{Sprint} & \textbf{Objectif principal} & \textbf{Fonctionnalités concernées} \\
\hline
Sprint 1 & Gestion des utilisateurs, authentification et profils &
Inscription, connexion, gestion des rôles, gestion du profil utilisateur,
téléversement du CV, ajout des formations, expériences et compétences. \\
\hline
Sprint 2 & Gestion des offres d'emploi et des candidatures &
Publication des offres, consultation et recherche des offres, postulation,
consultation des candidatures reçues, analyse du CV (ATS) et score de matching,
acceptation ou refus d'une candidature. \\
\hline
Sprint 3 & Planification et déroulement des entretiens en ligne &
Planification des entretiens, invitation par email, accès à la salle d'entretien,
chat temps réel, visioconférence WebRTC, mise à jour du statut de l'entretien. \\
\hline
Sprint 4 & Évaluation par IA et notifications temps réel &
Génération de quiz par IA (Ollama), passage du quiz chronométré, rapport de quiz
avec analyse IA, conseils de préparation par IA, système de notifications temps
réel (cloche + toasts), notifications email, tableaux de bord et historique des
rapports. \\
\hline
\end{tabular}
\caption{Planification des sprints}
\label{tab:sprints}
\end{table}
```

### Exemple — table de user stories IA

```latex
\begin{table}[H]
\centering
\begin{tabular}{|c|p{11cm}|}
\hline
\textbf{Réf.} & \textbf{User story} \\
\hline
IA-1 & En tant que recruteur, je veux générer automatiquement un quiz technique
adapté à l'offre grâce à l'IA, afin d'évaluer objectivement les compétences du
candidat. \\
\hline
IA-3 & En tant que candidat, je veux passer le quiz question par question avec une
minuterie, afin d'être évalué dans des conditions équitables et chronométrées. \\
\hline
IA-5 & En tant que candidat, je veux recevoir des conseils de préparation générés
par IA, afin de mieux me préparer à l'entretien. \\
\hline
\end{tabular}
\caption{User stories des fonctionnalités IA}
\label{tab:us-ia}
\end{table}
```
