# Terraform/providers resolve on the operator machine; commit their reviewed generated lock before apply.
terraform {
  required_version = ">= 1.6.0, < 2.0.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
}
provider "aws" {
  region = var.region
  default_tags {
    tags = { Project = "tapuai", Environment = var.environment, ManagedBy = "terraform" }
  }
}
