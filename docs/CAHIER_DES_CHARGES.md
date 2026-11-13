**ÉCOLE SUPÉRIEURE PRIVÉE DES TECHNOLOGIES ET D'INGÉNIERIE **

**PROJET DE SEMESTRE**** ING-4-CIM**

**DÉPLOIEMENT D'UNE INFRASTRUCTURE 3-TIERS SUR AWS**

| **Lire avant de choisir un sujet**** :** Le thème applicatif est choisi librement par le groupe, puis validé au Livrable 1. La liste fermée de services AWS autorisés (section 4), le socle d'infrastructure (section 5), la séquence de livrables (section 8). Le périmètre technique a été volontairement restreint aux services vus en cours et compatibles avec les limites d'un compte AWS gratuit. |
| --- |

| **Paramètre** | **Valeur** |
| --- | --- |
| Module | Projet de Déploiement d'infrastructure |
| Durée | 14 semaines |
| Taille des groupes | 3 à 5 étudiants |
| Environnement cible | Compte AWS gratuit — Free Tier / AWS Academy (voir section 3) |
| Région imposée | us-east-1 |
| Livrables | 7 livrables notés, échelonnés sur le semestre |
| Enseignant responsable | Hala Kamoun, Hamdi Chebbi |

**1. Cadre général et objet évalué**

Ce projet est un projet de semestre réalisé en groupe sur les 14 semaines. Chaque livrable est noté ; il n'y a pas de remise unique en fin de semestre. La note finale tient compte de la progression réelle d'une séance à l'autre, et pas seulement du rendu final.

L'objet évalué est une infrastructure, pas une application. L'application déployée sert de charge de travail : elle doit fonctionner, mais sa richesse fonctionnelle n'est pas notée. Un groupe livrant une application riche sur une infrastructure construite manuellement dans la console obtiendra une note faible. Un groupe livrant une application simple sur une infrastructure décrite en code, reproductible, résiliente, supervisée et maîtrisée en coût obtiendra une note élevée.

| **Critère discriminant du projet** Après destruction complète de toutes les ressources, une seule commande documentée doit reconstruire l'intégralité de l'infrastructure et rendre l'application de nouveau accessible. Une infrastructure cliquée dans la console n'est pas un livrable acceptable, quelle que soit sa complexité apparente. Cette exigence n'est pas seulement pédagogique : c'est aussi le seul moyen de tenir le budget d'un compte gratuit (voir section 6). |
| --- |

**2. Ce que le groupe choisit, ce qui est imposé**

| **Élément** | **Choisi par le groupe** | **Imposé** |
| --- | --- | --- |
| Domaine métier / thème | Oui — totalement libre | — |
| Application déployée | Oui : développée, reprise d'un autre module, ou open source | Doit être multi-composants (§5.1) |
| Langage / framework | Oui — libre | — |
| Outil d'IaC | Terraform, OpenTofu ou CloudFormation | L'usage d'un outil d'IaC est obligatoire |
| Services AWS | Non | Liste fermée imposée (§4) |
| Topologie, sécurité, supervision, sauvegarde | Détails de mise en œuvre | Exigences imposées (§5) |

*Règle de validation du sujet : un sujet est accepté s'il permet d'exercer l'intégralité du socle de la section 5 en n'utilisant que les services de la section 4. Un sujet attractif mais incompatible avec ce périmètre sera refusé, y compris tardivement.*

**3. Environnement AWS et contraintes de compte**

Le projet s'exécute exclusivement sur AWS Academy Learner Lab, avec un crédit de 50 USD par étudiant pour la totalité du semestre.

| Aspect | Contrainte | Conséquence pour le projet |
| --- | --- | --- |
| Budget | 50$ par étudiant, le laboratoire se ferme définitivement à épuisement. | Une semaine d'oubli en fonctionnement continu consomme environ 20 % du crédit. La destruction en fin de séance est une condition de survie du projet. |
| Rôles IAM | Création de rôles et de politiques IAM personnalisés impossible. **LabRole** et **LabInstanceProfile** sont imposés. | Concevoir l'architecture autour de LabRole. Le moindre privilège est évalué au niveau réseau et applicatif, pas au niveau IAM. |
| Durée de session | Session limitée dans le temps et devant être relancée. Les ressources de calcul peuvent être arrêtées entre deux sessions. | L'infrastructure doit être jetable et reconstructible. Aucune donnée de travail ne réside uniquement sur une instance. |
| Identifiants | Clé, secret et jeton de session renouvelés à chaque démarrage de session. | Documenter une procédure de rechargement des identifiants pour l'outil d'IaC. Ne jamais les committer. |
| Catalogue de services | Sous-ensemble restreint ; certaines opérations bloquées même au sein des services autorisés. | Vérifier chaque service dans la console dès le Livrable 2 avant de l'inscrire dans l'architecture finale. |
| Région | Accès limité à un petit nombre de régions. | Région imposée : us-east-1. |
| Risque principal | Perte définitive de l'environnement en cours de semestre si le crédit est épuisé. | Aucun rattrapage possible. Un crédit épuisé n'est pas un motif recevable de retard de livrable. |

**3.1 ****Règles**** imposées**

- Région unique : us-east-1, déclarée comme variable dans le code d'infrastructure. Aucune ressource dans une autre région.

- Destruction en fin de séance : toute ressource facturée à l'heure instances EC2, répartiteur de charge, base de données RDS est détruite en fin de séance, par script ou par l'outil d'IaC, jamais à la main.

- Nommage et étiquetage : toutes les ressources portent un préfixe de groupe et un jeu d'étiquettes normalisé, afin de permettre un nettoyage scripté fiable.

- Suivi de consommation : le crédit restant est relevé et consigné dans le dépôt à la fin de chaque séance.

- Compte porteur : le groupe désigne au Livrable 1 le compte sur lequel l'infrastructure est déployée, et déclare l'ordre de bascule vers les comptes des autres membres en cas d'épuisement.

- Aucun identifiant en clair dans le dépôt Git, à aucun moment de l'historique, y compris les jetons de session temporaires.

- État de l'IaC partagé au sein du groupe et survivant à la fermeture de session. Un état stocké localement sur le poste d'un seul étudiant est une cause classique d'échec de projet.

- Posture face aux limitations : l'indisponibilité d'un service n'est jamais un motif d'abandon d'une exigence. Elle donne lieu à une solution de repli documentée et techniquement justifiée.

**4.1 Services autorisés et obligatoires**

| **Service** | **Usage dans le projet** | **Limite gratuite / coût** |
| --- | --- | --- |
| IAM | Utilisateurs, rôles, politiques, moindre privilège (selon configuration §3) | Gratuit |
| VPC, sous-réseaux, tables de routage, IGW | Topologie réseau du projet, segmentation public/privé | Gratuit |
| Security Groups / NACL | Filtrage réseau, segmentation entre couches | Gratuit |
| EC2 (t2.micro / t3.micro) | Exécution de l'application, instances applicatives | Plafond mensuel d'heures ; environ 0,01 USD/h au-delà |
| EBS gp3 | Volumes racine et données des instances | Plafond de stockage mensuel ; environ 0,08 USD/Go-mois |
| Snapshots EBS | Sauvegarde et restauration de volumes | Facturé au Go stocké |
| ALB (Application Load Balancer) | Répartition de charge, contrôles de santé, point d'entrée unique | Plafond mensuel d'heures ; environ 0,0225 USD/h au-delà |
| Auto Scaling Group + Launch Template | Élasticité, remplacement automatique d'instance défaillante | Le service est gratuit ; seules les instances sont facturées |
| RDS (db.t3.micro ou db.t4g.micro) | Persistance relationnelle managée, sauvegardes automatisées | Plafond mensuel d'heures ; le Multi-AZ double la consommation |
| S3 | Artefacts, sauvegardes, contenus statiques, journaux exportés | Plafond de stockage mensuel |
| CloudWatch (métriques, logs, alarmes) | Supervision, journalisation centralisée, alertes | Quota gratuit d'alarmes, de métriques et de logs |

**4.2 Services autorisés mais optionnels**

| **Service** | **Usage possible** | **Réserve** |
| --- | --- | --- |
| EFS | Stockage partagé entre plusieurs instances (fichiers communs, médias) | Facturé au Go ; à privilégier seulement si le sujet le justifie réellement |
| CloudFront | Diffusion de contenu statique depuis S3 | Quota gratuit confortable, mais séance 9 : à traiter en fin de projet |
| Route 53 | Nom de domaine, routage de basculement, health checks | La zone hébergée est facturée mensuellement, même inutilisée |
| SNS / SQS | Découplage, notifications d'alarme | Séance 11 : trop tardif pour être exigible, accepté en bonus |
| Lambda | Automatisation ponctuelle (nettoyage, rapport, réaction à une alarme) | Séance 12 : non exigible, accepté en bonus uniquement |
| Boto3 (SDK Python) | Audit de conformité, nettoyage, générateur de charge, rapport de coût | Optionnel — voir §9.1 |

**5. Socle d'infrastructure imposé**

L'absence d'un des éléments suivants dans la solution finale entraîne une pénalité directe sur la note d'architecture, quel que soit le sujet retenu.

**5.1 Nature de l'application déployée**

- L'application comporte au minimum trois composants séparés qui communiquent entre eux, dont une couche de persistance relationnelle.

- Un site statique seul, une page unique sans back-end, ou un binaire monolithique sans état ne constituent pas une charge de travail acceptable.

- Le code applicatif peut être simple. La complexité attendue porte sur l'infrastructure, pas sur les fonctionnalités.

- La réutilisation d'une application d'un autre module ou d'une application open source est autorisée, à condition d'être déclarée au Livrable 1.

**5.2 Architecture cible imposée**

Tous les groupes déploient la même forme d'architecture « une architecture web 3-tiers » résiliente, et la différencient par le sujet, le dimensionnement et les objectifs non fonctionnels qu'ils se fixent.

| **Couche** | **Exigence minimale** |
| --- | --- |
| Réseau | VPC dédié au projet, sous-réseaux publics et privés répartis sur au moins deux zones de disponibilité, tables de routage explicites, passerelle Internet. |
| Entrée | ALB en sous-réseaux publics, contrôle de santé configuré, retrait automatique d'une cible défaillante. Seul l'ALB expose le service sur Internet. |
| Applicatif | Groupe Auto Scaling d'instances EC2 réparties sur deux zones de disponibilité, en sous-réseaux privés, capacité minimale de deux instances. Provisionnement par Launch Template et données utilisateur, jamais par configuration manuelle post-démarrage. |
| Données | Instance RDS en sous-réseau privé, joignable uniquement depuis le groupe de sécurité applicatif. Sauvegardes automatisées activées et restauration démontrée. |
| Stockage objet | Compartiment S3 utilisé pour au moins un usage réel du projet : artefacts de déploiement, sauvegardes, contenus statiques ou journaux exportés. Accès public bloqué. |
| Supervision | Journalisation centralisée dans CloudWatch Logs, tableau de bord de métriques d'infrastructure et d'application, et au moins deux alarmes fonctionnelles déclenchables en démonstration. |
| Infrastructure as Code | Totalité de l'infrastructure décrite en code versionné, structuré en modules réutilisables, variables d'environnement séparées du code. |
| Secrets | Aucun secret en clair dans le dépôt ni dans les données utilisateur. Mécanisme de passage de secret documenté et justifié. |
| Déploiement applicatif | Procédure scriptée et reproductible de mise en service d'une nouvelle version, sans interruption totale du service. |
| Documentation | Dossier d'architecture, schéma, décisions d'architecture justifiées, limitations connues, procédure d'exploitation. |

**5.3 ****Exigences non fonctionnelles**

- **Reproductibilité — **l'infrastructure se reconstruit intégralement depuis le dépôt, sans étape manuelle non documentée.

- **Résilience — **la perte d'une instance applicative ne rend pas l'application inaccessible. Ce comportement est démontré en séance, pas seulement affirmé.

- **Sécurité — **aucune base de données joignable depuis Internet, aucun accès administratif ouvert sur 0.0.0.0/0, chiffrement au repos activé là où le service le permet.

- **Observabilité — **toute panne injectée en soutenance doit être diagnosticable à partir des tableaux de bord et journaux du groupe, sans lecture du code source.

- **Maîtrise du coût — **consommation suivie, estimation documentée, et au moins une optimisation effectivement appliquée et chiffrée.

- **Traçabilité — **historique Git lisible, contributions réparties, aucun dépôt constitué d'un unique commit final.

**7. Alignement avec le module Architectures AWS**

Le calendrier des livrables a été construit pour qu'aucune exigence ne précède l'enseignement correspondant. Un retard éventuel du module Architectures AWS a été absorbé par une marge de sécurité : chaque livrable s'appuie sur des séances théoriquement traitées plusieurs semaines auparavant.

| **Livrable** | **Semaines** | **Séances AWS mobilisées** | **Marge** |
| --- | --- | --- | --- |
| L1 Sujet et exigences | 1–2 | Séance 1 (Préparation des groupes, état de l’art sur les services outils sujet d’application) | Aucun prérequis technique lourd |
| L2 Architecture et budget | 3–4 | Séances 1–2 (EC2, réseau, tarification) | Conception sur papier : réalisable même avec retard |
| L3 Réseau et socle de calcul | 5–6 | Séances 2–3 (EC2, SG, EBS, EFS) | Séance 3 déjà traitée |
| L4 Haute disponibilité | 7–8 | Séance 4 (ALB, ASG) | Environ 2 semaines de marge |
| L5 Données et sauvegarde | 9–10 | Séances 5 et 8 (RDS, S3) | Environ 2 semaines de marge |
| L6 Supervision et sécurité | 11–12 | Séances 7 et 9, CloudWatch transversal | Environ 2 semaines de marge |
| L7 Exploitation et soutenance | 13–14 | Consolidation, rapport (latex) et une présentation avec un invité |  |

*Les séances 10 à 13 du module Architectures AWS (Storage Gateway, Snow Family, SQS/SNS/Kinesis/EventBridge, conteneurs, serverless, DynamoDB et analytique) ne conditionnent aucun livrable. Les notions correspondantes peuvent être valorisées en bonus si un groupe les mobilise de sa propre initiative, mais leur absence n'est jamais pénalisée.*

**8. Livrables et calendrier**

| **Livrable** | **Sem.** | **Contenu attendu** |
| --- | --- | --- |
| L1 — Sujet et exigences | 1–2 | Fiche de la section 10 complétée : sujet, application retenue, acteurs, objectifs non fonctionnels chiffrés, schéma d'architecture de haut niveau. Validation écrite obligatoire avant de poursuivre. |
| L2 — Dossier d'architecture et budget | 3–4 | Schéma détaillé de l'architecture cible, justification de chaque service au regard de la liste §4, décisions d'architecture, estimation de coût issue du calculateur AWS, alarme de budget configurée. |
| L3 — Réseau et socle de calcul | 5–6 | VPC, sous-réseaux multi-AZ, routage, groupes de sécurité et première instance applicative déployés intégralement par IaC. Solution d'accès sortant choisie et justifiée (§5.3). Dépôt structuré en modules, stratégie d'état documentée, script de destruction opérationnel. |
| L4 — Haute disponibilité | 7–8 | ALB avec contrôles de santé, groupe Auto Scaling sur deux zones de disponibilité, application accessible de bout en bout. Démonstration live de la terminaison d'une instance et de son remplacement automatique sans interruption de service. |
| L5 — Données et sauvegarde | 9–10 | RDS en sous-réseau privé, segmentation réseau effective, sauvegardes automatisées, restauration démontrée à partir d'une sauvegarde ou d'un snapshot. Compartiment S3 intégré à un usage réel du projet. Démonstration d'une reconstruction complète depuis zéro. |
| L6 — Supervision, sécurité et coût | 11–12 | Journalisation centralisée, tableau de bord, au moins deux alarmes déclenchables, durcissement des groupes de sécurité, gestion des secrets, rapport de consommation et optimisation de coût appliquée et chiffrée. |
| L7 — Exploitation et soutenance | 13–14 | Test de charge, épreuve d'injection de panne (§8.1), rapport d'incident, documentation d'exploitation finalisée, soutenance avec destruction et reconstruction en direct. |

**8.1 Épreuve d'exploitation — semaine 13**

En semaine 13, l'enseignant injecte une panne non annoncée dans l'infrastructure du groupe : arrêt d'un composant, modification d'une règle de groupe de sécurité, saturation d'une ressource, altération d'un contrôle de santé ou d'un paramètre de connexion à la base. Le groupe dispose d'un temps limité pour détecter, diagnostiquer et corriger, puis rédige un rapport d'incident.

Cette épreuve évalue une capacité opérationnelle réelle et non un livrable fini. Elle constitue également le principal mécanisme de vérification de l'authenticité du travail : un groupe qui n'a pas construit son infrastructure lui-même ne sait pas la dépanner.

**9. Critères d'évaluation**

| **Critère** | **Pondération** |
| --- | --- |
| Architecture et respect de la liste de services autorisés | 20 % |
| Infrastructure as Code : reproductibilité, structuration, qualité | 20 % |
| Haute disponibilité : ALB, Auto Scaling, résilience démontrée | 15 % |
| Données : segmentation, sauvegarde et restauration démontrée | 10 % |
| Sécurité, supervision et gestion des secrets | 15 % |
| Épreuve d'exploitation : diagnostic, remédiation, rapport d'incident | 10 % |
| Maîtrise du coût : estimation, suivi, optimisation chiffrée | 5 % |
| Documentation, soutenance et défense des choix techniques | 3 % |
| Régularité de la progression et répartition du travail | 2 % |

**9.1 Bonus — automatisation Python (Boto3)**

L'usage de Boto3 n'est pas obligatoire dans ce projet. Il constitue un bonus pouvant aller jusqu'à 5 % de la note finale, attribué si le groupe livre au moins un script Python réellement utile à l'exploitation du projet : audit de conformité des ressources, nettoyage automatisé en fin de séance, générateur de charge pour démontrer le passage à l'échelle, ou rapport de consommation. Un script décoratif, non intégré au cycle de vie réel du projet, ne donne lieu à aucun bonus.

*Cette pondération en bonus, et non en exigence, tient compte du fait que le module Boto3 n'atteindra pas nécessairement un niveau d'avancement suffisant pour être opposable aux étudiants dans le cadre du projet.*

**9.2 Individualisation**

La note n'est pas automatiquement collective. Une contribution individuelle manifestement insuffisante, établie à partir de l'historique **Git** et des soutenances intermédiaires, entraîne un ajustement individuel.

**10. Fiche de sujet à soumettre**** « ****Livrable 1**** »**

**10.1 Identification**

**Titre du projet :  **

**Membres du groupe :  ***( nom, prénom )*

**Dépôt Git :  ***( URL )*

**10.2 Description du sujet**

**Domaine métier et problème traité :  ***( 5 lignes maximum )*

**Application servant de charge de travail :  ***( développée / reprise / open source** :** préciser )*

**Composants applicatifs et rôle de chacun :  ***( front, back, base de données )*

**10.3 Objectifs non fonctionnels auto-imposés**

Le groupe fixe lui-même ses cibles, mais devra les tenir et les démontrer. Ces valeurs deviennent contractuelles dès la validation du Livrable 1 et servent de référentiel d'évaluation.

| **Objectif** | **Cible fixée par le groupe** | **Mode de démonstration** |
| --- | --- | --- |
| Tolérance à la perte d'une instance applicative | ………………… | ………………… |
| Charge nominale et charge de pointe visées | ………………… | ………………… |
| Temps de reconstruction complet de l'infrastructure | ………………… | ………………… |
| Perte de données maximale admissible | ………………… | ………………… |
| Budget total consommé sur le semestre | ………………… | ………………… |

**10.4 Faisabilité préliminaire**

**Services de la liste §4.1 mobilisés :  **

**Solution d'accès sortant envisagée (§5.3) :  **

**Points de risque identifiés :  **

**Annexe ****A :**** Structure de dépôt imposée**

Les noms exacts des répertoires peuvent être adaptés ; la séparation des responsabilités ne peut pas l'être.

| **Répertoire ou fichier** | **Contenu** |
| --- | --- |
| /infra | Code d'infrastructure organisé en modules réutilisables, avec les fichiers de variables par environnement. |
| /app | Code applicatif et fichiers de construction ou de conteneurisation. |
| /scripts | Scripts d'exploitation : destruction, nettoyage, génération de charge, rapport de coût. Boto3 si le groupe vise le bonus. |
| /docs | Dossier d'architecture, schémas, décisions d'architecture, procédure d'exploitation, rapports d'incident. |
| /docs/compte-aws.md | Section « Vérification du compte » maintenue à jour tout au long du projet. |
| /docs/journal-destructions.md | Horodatage des cycles destruction / reconstruction hebdomadaires. |
| README.md | Procédure complète de reconstruction depuis zéro, de rechargement des identifiants et de destruction. |
| .gitignore | Exclusion explicite des fichiers d'identifiants, d'état local et de variables sensibles. |

**Annexe C — Exemples de pannes utilisées en semaine 13**

Liste indicative communiquée à titre préventif. La panne réellement injectée n'est pas annoncée et peut différer de celles-ci.

- Terminaison manuelle d'une ou plusieurs instances du groupe Auto Scaling.

- Modification d'une règle de groupe de sécurité coupant l'accès de la couche applicative à la base de données.

- Altération du chemin de contrôle de santé de l'ALB, rendant toutes les cibles non saines.

- Modification d'un paramètre de connexion applicatif entraînant un échec silencieux côté base.

- Saturation d'un volume EBS par écriture de journaux non tournés.

- Suppression d'un objet nécessaire au démarrage dans le compartiment S3.

- Retrait manuel d'une instance de son groupe cible.

