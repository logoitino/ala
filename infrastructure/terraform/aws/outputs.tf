# Operator-facing identifiers contain no credentials; S3 IAM reader still needs its separate age identity.
output "backup_uri" { value = "s3://${aws_s3_bucket.backups.id}/backups/" }
output "backup_kms_key_arn" { value = aws_kms_key.backups.arn }
output "backup_writer_role_arn" { value = aws_iam_role.writer.arn }
output "backup_reader_role_arn" { value = aws_iam_role.recovery.arn }
output "app_public_ipv4" { value = var.enable_vm ? aws_eip.app[0].public_ip : null }
output "app_instance_id" { value = var.enable_vm ? aws_instance.app[0].id : null }
