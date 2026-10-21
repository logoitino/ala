# Optional dedicated Ubuntu VM: only HTTP/HTTPS by default; Run Command management uses the Azure agent.
resource "azurerm_resource_group" "app" {
  count    = var.enable_vm ? 1 : 0
  name     = "${var.name}-app"
  location = var.location
  tags     = local.tags
}
resource "azurerm_virtual_network" "app" {
  count               = var.enable_vm ? 1 : 0
  name                = "${var.name}-app"
  resource_group_name = azurerm_resource_group.app[0].name
  location            = var.location
  address_space       = ["10.73.0.0/16"]
}
resource "azurerm_subnet" "app" {
  count                = var.enable_vm ? 1 : 0
  name                 = "app"
  resource_group_name  = azurerm_resource_group.app[0].name
  virtual_network_name = azurerm_virtual_network.app[0].name
  address_prefixes     = ["10.73.1.0/24"]
  service_endpoints    = ["Microsoft.Storage"]
}
resource "azurerm_public_ip" "app" {
  count               = var.enable_vm ? 1 : 0
  name                = "${var.name}-app"
  resource_group_name = azurerm_resource_group.app[0].name
  location            = var.location
  allocation_method   = "Static"
  sku                 = "Standard"
}
resource "azurerm_network_security_group" "app" {
  count               = var.enable_vm ? 1 : 0
  name                = "${var.name}-app"
  resource_group_name = azurerm_resource_group.app[0].name
  location            = var.location
  security_rule {
    name                       = "public-https"
    priority                   = 100
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_ranges    = ["80", "443"]
    source_address_prefix      = "Internet"
    destination_address_prefix = "*"
  }
  dynamic "security_rule" {
    for_each = length(var.admin_ipv4_cidrs) > 0 ? [1] : []
    content {
      name                       = "named-operator-ssh"
      priority                   = 200
      direction                  = "Inbound"
      access                     = "Allow"
      protocol                   = "Tcp"
      source_port_range          = "*"
      destination_port_range     = "22"
      source_address_prefixes    = var.admin_ipv4_cidrs
      destination_address_prefix = "*"
    }
  }
  # Azure's implicit AllowVnetInBound would expose SQL to later VNet peers unless explicitly denied.
  security_rule {
    name                       = "deny-other-inbound"
    priority                   = 4096
    direction                  = "Inbound"
    access                     = "Deny"
    protocol                   = "*"
    source_port_range          = "*"
    destination_port_range     = "*"
    source_address_prefix      = "*"
    destination_address_prefix = "*"
  }
}
resource "azurerm_network_interface" "app" {
  count               = var.enable_vm ? 1 : 0
  name                = "${var.name}-app"
  resource_group_name = azurerm_resource_group.app[0].name
  location            = var.location
  ip_configuration {
    name                          = "primary"
    subnet_id                     = azurerm_subnet.app[0].id
    private_ip_address_allocation = "Dynamic"
    public_ip_address_id          = azurerm_public_ip.app[0].id
  }
}
resource "azurerm_network_interface_security_group_association" "app" {
  count                     = var.enable_vm ? 1 : 0
  network_interface_id       = azurerm_network_interface.app[0].id
  network_security_group_id  = azurerm_network_security_group.app[0].id
}
resource "azurerm_linux_virtual_machine" "app" {
  count                           = var.enable_vm ? 1 : 0
  name                            = "${var.name}-app"
  resource_group_name             = azurerm_resource_group.app[0].name
  location                        = var.location
  size                            = var.vm_size
  admin_username                  = "tapuaiops"
  disable_password_authentication = true
  network_interface_ids           = [azurerm_network_interface.app[0].id]
  custom_data                     = base64encode(file("${path.module}/../cloud-init.yml"))
  identity { type = "SystemAssigned" }
  admin_ssh_key {
    username   = "tapuaiops"
    public_key = var.ssh_public_key
  }
  os_disk {
    caching              = "ReadWrite"
    storage_account_type = "Premium_LRS"
    disk_size_gb         = 128
  }
  source_image_reference {
    publisher = "Canonical"
    offer     = "ubuntu-24_04-lts"
    sku       = "server"
    version   = "latest"
  }
  boot_diagnostics {}
  lifecycle {
    prevent_destroy = true
    precondition {
      condition     = length(var.ssh_public_key) > 40
      error_message = "Optional VM requires a reviewed public SSH key even when network SSH is disabled."
    }
  }
}
