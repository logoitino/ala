# Optional single Ubuntu host: public HTTPS, private containers, SSM management and no default SSH ingress.
data "aws_ami" "ubuntu" {
  count       = var.enable_vm ? 1 : 0
  most_recent = true
  owners      = ["099720109477"]
  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*"]
  }
  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}
resource "aws_vpc" "app" {
  count                = var.enable_vm ? 1 : 0
  cidr_block           = "10.72.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true
}
resource "aws_subnet" "app" {
  count                   = var.enable_vm ? 1 : 0
  vpc_id                  = aws_vpc.app[0].id
  cidr_block              = "10.72.1.0/24"
  map_public_ip_on_launch = true
}
resource "aws_internet_gateway" "app" {
  count  = var.enable_vm ? 1 : 0
  vpc_id = aws_vpc.app[0].id
}
resource "aws_route_table" "app" {
  count  = var.enable_vm ? 1 : 0
  vpc_id = aws_vpc.app[0].id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.app[0].id
  }
}
resource "aws_route_table_association" "app" {
  count          = var.enable_vm ? 1 : 0
  subnet_id      = aws_subnet.app[0].id
  route_table_id = aws_route_table.app[0].id
}
resource "aws_security_group" "app" {
  count  = var.enable_vm ? 1 : 0
  name   = "${var.name}-app"
  vpc_id = aws_vpc.app[0].id
  dynamic "ingress" {
    for_each = [80, 443]
    content {
      from_port   = ingress.value
      to_port     = ingress.value
      protocol    = "tcp"
      cidr_blocks = ["0.0.0.0/0"]
    }
  }
  dynamic "ingress" {
    for_each = length(var.admin_ipv4_cidrs) > 0 ? [1] : []
    content {
      from_port   = 22
      to_port     = 22
      protocol    = "tcp"
      cidr_blocks = var.admin_ipv4_cidrs
    }
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}
data "aws_iam_policy_document" "ssm_trust" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}
resource "aws_iam_role" "app" {
  count              = var.enable_vm ? 1 : 0
  name               = "${var.name}-app-ssm"
  assume_role_policy = data.aws_iam_policy_document.ssm_trust.json
}
resource "aws_iam_role_policy_attachment" "ssm" {
  count      = var.enable_vm ? 1 : 0
  role       = aws_iam_role.app[0].name
  policy_arn = "arn:${data.aws_partition.current.partition}:iam::aws:policy/AmazonSSMManagedInstanceCore"
}
resource "aws_iam_instance_profile" "app" {
  count = var.enable_vm ? 1 : 0
  name  = "${var.name}-app"
  role  = aws_iam_role.app[0].name
}
resource "aws_instance" "app" {
  count                       = var.enable_vm ? 1 : 0
  ami                         = data.aws_ami.ubuntu[0].id
  instance_type               = var.instance_type
  subnet_id                   = aws_subnet.app[0].id
  vpc_security_group_ids      = [aws_security_group.app[0].id]
  iam_instance_profile        = aws_iam_instance_profile.app[0].name
  key_name                    = var.ssh_key_name
  user_data                   = file("${path.module}/../cloud-init.yml")
  user_data_replace_on_change = false
  metadata_options {
    http_tokens   = "required"
    http_endpoint = "enabled"
  }
  root_block_device {
    volume_type           = "gp3"
    volume_size           = 128
    encrypted             = true
    delete_on_termination = false
  }
  lifecycle { prevent_destroy = true }
}
resource "aws_eip" "app" {
  count    = var.enable_vm ? 1 : 0
  domain   = "vpc"
  instance = aws_instance.app[0].id
}
