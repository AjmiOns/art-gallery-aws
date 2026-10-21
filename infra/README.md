# Livrable 3 : IaC

Un seul fichier : `main.tf`. Il cree le VPC, 2 AZ, les SG, une instance et le NAT

```
Hote  --SSH-->  bastion (public)  --SSH-->  instance-1 (privee) --> Internet via NAT (curl, yum)
```

## Commandes

Session **Learner Lab allumee**, AWS CLI configure (`aws sts get-caller-identity`).

```bash
cd infra
cp terraform.tfvars.example terraform.tfvars   # une seule fois
terraform init
terraform apply                                # taper yes
```

A la fin, `commande_ssh`. Copiez-la (depuis le dossier `infra/`).

Sur l'instance : `curl -I https://example.com` => preuve du NAT active.

**Avant d'eteindre le lab :**

```bash
./scripts/destroy-infra.sh
```
