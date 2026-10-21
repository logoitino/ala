# Encrypted versioned Blob destination: deny anonymous access, default-deny firewall, distinct writer/recovery roles.
locals {
  tags = { Project = "tapuai", Environment = var.environment, ManagedBy = "terraform" }
}
resource "azurerm_resource_group" "backup" {
  name     = "${var.name}-backup"
  location = var.location
  tags     = local.tags
  lifecycle { prevent_destroy = true }
}
resource "azurerm_storage_account" "backup" {
  name                            = var.storage_account_name
  resource_group_name             = azurerm_resource_group.backup.name
  location                        = var.location
  account_tier                    = "Standard"
  account_replication_type        = var.replication_type
  min_tls_version                 = "TLS1_2"
  allow_nested_items_to_be_public  = false
  shared_access_key_enabled       = false
  default_to_oauth_authentication  = true
  infrastructure_encryption_enabled = true
  tags                            = local.tags
  blob_properties {
    versioning_enabled = true
    delete_retention_policy { days = 30 }
    container_delete_retention_policy { days = 30 }
  }
  network_rules {
    default_action             = "Deny"
    bypass                     = ["None"]
    ip_rules                   = var.backup_ipv4_ranges
    virtual_network_subnet_ids = var.enable_vm ? [azurerm_subnet.app[0].id] : []
  }
  lifecycle {
    prevent_destroy = true
    precondition {
      condition     = var.enable_vm || length(var.backup_ipv4_ranges) > 0
      error_message = "Backup-only provisioning requires reviewed operator IPv4 firewall access."
    }
  }
}
resource "azurerm_storage_container" "backups" {
  name                  = "backups"
  storage_account_id    = azurerm_storage_account.backup.id
  container_access_type = "private"
  lifecycle { prevent_destroy = true }
}
resource "azurerm_storage_management_policy" "backups" {
  storage_account_id = azurerm_storage_account.backup.id
  rule {
    name    = "reviewed-retention"
    enabled = true
    filters {
      prefix_match = ["backups/"]
      blob_types   = ["blockBlob"]
    }
    actions {
      base_blob { delete_after_days_since_modification_greater_than = var.retention_days }
      version { delete_after_days_since_creation_greater_than = var.retention_days * 2 }
      snapshot { delete_after_days_since_creation_greater_than = var.retention_days * 2 }
    }
  }
}
resource "azurerm_role_definition" "backup_writer" {
  name        = "${var.name}-backup-writer"
  scope       = azurerm_resource_group.backup.id
  description = "Upload encrypted recovery artifacts without blob read or delete permission"
  permissions {
    actions = ["Microsoft.Storage/storageAccounts/blobServices/containers/read"]
    data_actions = [
      "Microsoft.Storage/storageAccounts/blobServices/containers/blobs/write",
      "Microsoft.Storage/storageAccounts/blobServices/containers/blobs/add/action"
    ]
  }
  assignable_scopes = [azurerm_resource_group.backup.id]
}
resource "azurerm_role_assignment" "writer" {
  scope              = azurerm_storage_container.backups.resource_manager_id
  role_definition_id = azurerm_role_definition.backup_writer.role_definition_resource_id
  principal_id       = var.backup_writer_object_id
}
resource "azurerm_role_assignment" "reader" {
  scope                = azurerm_storage_container.backups.resource_manager_id
  role_definition_name = "Storage Blob Data Reader"
  principal_id         = var.recovery_reader_object_id
}
