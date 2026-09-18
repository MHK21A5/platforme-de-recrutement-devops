# Diagrammes UML — Plateforme de recrutement

Ce dossier contient le code source **PlantUML** (`.puml`) de tous les diagrammes du
rapport, pour pouvoir les régénérer et les modifier facilement.

## Comment régénérer les images

### Option 1 — En ligne (le plus simple)
1. Ouvrir <https://www.plantuml.com/plantuml/uml/>
2. Coller le contenu d'un fichier `.puml`
3. Télécharger en PNG ou SVG

### Option 2 — Extension VS Code
1. Installer l'extension **PlantUML** (jebbs.plantuml)
2. Ouvrir un fichier `.puml`
3. `Alt+D` pour la prévisualisation, clic droit → *Export Current Diagram* pour exporter

### Option 3 — Ligne de commande (nécessite Java)
```bash
# PNG
java -jar plantuml.jar docs/diagrams/*.puml
# SVG (vectoriel, recommandé pour un rapport LaTeX)
java -jar plantuml.jar -tsvg docs/diagrams/*.puml
```

## Contenu

| Fichier | Diagramme |
|---|---|
| `diagramme_cas_utilisation.puml` | Cas d'utilisation global (avec quiz IA + notifications) |
| `diagramme_classes.puml` | Diagramme de classes (modèles de données) |
| `seq1_authentification.puml` | Séquence — Inscription / Connexion |
| `seq2_offres_et_candidature.puml` | Séquence — Publier une offre & postuler |
| `seq3_traiter_candidature.puml` | Séquence — Traiter une candidature (ATS) |
| `seq4_entretien_en_ligne.puml` | Séquence — Entretien en ligne (chat + WebRTC) |
| `seq5_quiz_ia.puml` | Séquence — Génération & passage du quiz IA (Ollama) |
| `seq6_notifications.puml` | Séquence — Notifications temps réel |
| `backlog_et_user_stories.md` | Backlog produit, sprints & user stories (IA + notifications) |

> Les libellés sont en français pour correspondre au rapport. Les noms techniques
> (endpoints REST, événements Socket.IO) reflètent le code réel de l'application.
