# AWS / Azure provisioning templates

Each provider directory creates an **independent encrypted backup destination** with
versioning, retention lifecycle, private access, named upload/recovery identities and
accidental-destruction protection. `enable_vm=false` by default; turning it on adds one
dedicated Ubuntu Linux host for the containers/self-hosted Supabase stack. It is not HA.
Choose one cloud, or use the other cloud for recovery if the primary app resides on one.
Verify region, residency, actual prices, quotas and accepted retention before applying.

Terraform and Docker were unavailable in this implementation session; these HCL templates
require formatting, initialization, provider validation and a reviewed plan on the operator
machine. Providers use constrained major versions; generate and retain a reviewed
`.terraform.lock.hcl` before any apply. Do not treat source review as a validated cloud plan.
AWS selects a current Canonical Ubuntu 24.04 AMI and Azure uses its current Canonical image;
freeze the reviewed AMI/image version in the approved production plan for reproducibility.

## Review without provisioning

Create a protected operator directory for state/var files (never in the source checkout).
For example, from a private working directory:

```sh
mkdir -p /opt/tapuai/terraform/aws
cp infrastructure/terraform/aws/*.tf /opt/tapuai/terraform/aws/
cp infrastructure/terraform/cloud-init.yml /opt/tapuai/terraform/cloud-init.yml
terraform -chdir=/opt/tapuai/terraform/aws init
terraform -chdir=/opt/tapuai/terraform/aws fmt -check
terraform -chdir=/opt/tapuai/terraform/aws validate
terraform -chdir=/opt/tapuai/terraform/aws plan -var-file=/etc/tapuai/aws.tfvars -out=/etc/tapuai/aws.plan
```

Use `azure/` and an external `azure.tfvars` for Azure. Terraform plan/state can contain
private values; protect mode 0600 and use a reviewed encrypted remote backend with locking
for a team. Bootstrap that backend independently rather than put state in the application
VM or rely on the bucket being provisioned by this same configuration. Running `plan` makes
cloud reads but no resource creation; applying a reviewed plan requires the owner's cloud
and spending approval. No cloud reads/plans/applies were run by this implementation.

## AWS

Supply a globally unique backup bucket, the named writer's IAM principal and a **different**
recovery reader's principal. Assume the output writer role for uploads and the reader role
for downloads. The writer has no S3 read/delete permission. S3 multipart encryption requires
scoped KMS decrypt in addition to GenerateDataKey; it cannot fetch objects through S3.
TLS and explicit SSE-KMS headers with the exact key ARN are required; public access is
blocked; key rotation and bucket versioning are enabled. Upload every artifact/sidecar under
`backups/` using `aws s3 cp FILE s3://BUCKET/backups/NAME --sse aws:kms
--sse-kms-key-id KEY_ARN`; omitting those headers or using AES256/a different key is denied.
Objects under `backups/` expire after reviewed `retention_days` (90 default), older versions
after twice that, and abandoned multipart uploads after seven days. This is versioning and
role separation, **not Object Lock**; an account administrator can still change policies.

The optional VM requires IMDSv2, encrypted persistent root disk, HTTPS-only ingress by
default and SSM role. Confirm the AMI's SSM agent runs before relying on Session Manager.
SSH is optional via an existing key and explicit operator IPv4 CIDRs; wildcard SSH is refused.
Backups and their KMS key cannot be accidentally destroyed by an ordinary Terraform destroy;
intentional retirement needs a reviewed lifecycle change and retained independent copy.

## Azure

Supply subscription/object IDs, unique account name and named operator firewall IPs.
Backup-only provisioning refuses an empty IP list. Storage firewall denies by default,
container and nested objects are private, Shared Key authentication is disabled, OAuth/RBAC
is required, and platform plus infrastructure encryption is enabled. GRS is the default;
select LRS/ZRS/GRS/GZRS only after checking region capability, prices and recovery needs.
Use `az storage blob upload --auth-mode login --overwrite false` for immutable named backups
with the assigned writer identity; the custom writer cannot read/delete blobs. A separate
Blob Data Reader identity downloads for verification/restoration. The operator applying
Terraform also requires management and Blob data permissions on the account, including
firewall access; assigned writer/reader roles do not grant operator provisioning access.

The optional VM subnet uses a Storage service endpoint and is allowed by the account
firewall. Azure Run Command uses its installed management agent; no default network SSH
rule exists. An admin public SSH key is still required by VM creation. Explicit NSG denial
prevents Azure's default VNet inbound rule exposing other services to later network peers.
Versioning/30-day soft-delete and reviewed lifecycle retention protect mistakes; immutable
WORM retention, private endpoint-only networking and customer-managed KMS are separate
production choices. An independent age-encrypted object still requires its age identity.

`cloud-init.yml` installs Docker Compose, age, PostgreSQL tools and Python. Install/review
AWS CLI or Azure CLI through that provider's official instructions for off-host copy; it
does not deploy containers, set runtime secrets or enable a backup timer.
