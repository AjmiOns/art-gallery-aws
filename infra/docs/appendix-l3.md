# Appendix: L3 baseline

> Moved out of the infra README. Back to the [README](../README.md).

## Appendix: L3 baseline (29 resources)

The first verified deployment (VPC, NAT, bastion, one test backend on port 3000). It was applied, tested through the bastion, and destroyed cleanly (29 created, 29 destroyed). The screenshots are kept as history; the v2 verification above replaces them.

<details>
<summary>Show the L3 screenshots</summary>

![terraform init](../images/screenshots/02-terraform-init.webp)

![terraform plan, summary](../images/screenshots/05-terraform-plan-summary.webp)

![terraform apply, complete and outputs](../images/screenshots/08-apply-complete.webp)

![VPC resource map](../images/screenshots/09-console-vpc-resource-map.webp)

![NAT Gateway](../images/screenshots/13-console-nat-gateway.webp)

![Security groups](../images/screenshots/15-console-security-groups.webp)

![SSH through the bastion and tests on the backend](../images/screenshots/17-ssh-backend-test.webp)

![Destroy and leftover check](../images/screenshots/18-destroy.webp)

</details>
