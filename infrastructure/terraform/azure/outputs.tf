# Account URL and principal identifiers are public configuration, never access keys.
output "backup_blob_url" { value = "${azurerm_storage_account.backup.primary_blob_endpoint}backups" }
output "backup_storage_account" { value = azurerm_storage_account.backup.name }
output "backup_container" { value = azurerm_storage_container.backups.name }
output "app_public_ipv4" { value = var.enable_vm ? azurerm_public_ip.app[0].ip_address : null }
output "app_resource_id" { value = var.enable_vm ? azurerm_linux_virtual_machine.app[0].id : null }
output "app_identity_principal_id" { value = var.enable_vm ? azurerm_linux_virtual_machine.app[0].identity[0].principal_id : null }
