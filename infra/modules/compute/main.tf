data "aws_ami" "al2023" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-2023.*-x86_64"]
  }
}

resource "aws_instance" "bastion" {
  ami                    = data.aws_ami.al2023.id
  instance_type          = var.instance_type
  subnet_id              = var.public_subnet_id
  vpc_security_group_ids = [var.bastion_sg_id]
  key_name               = var.key_name
  tags                   = { Name = "${var.name}-bastion" }
}

# First backend instance: private subnet. Installing Node.js through the NAT
# proves that the outbound access solution works.
resource "aws_instance" "backend" {
  ami                    = data.aws_ami.al2023.id
  instance_type          = var.instance_type
  subnet_id              = var.app_subnet_id
  vpc_security_group_ids = [var.app_sg_id]
  key_name               = var.key_name
  iam_instance_profile   = var.instance_profile

  user_data = <<-EOT
    #!/bin/bash
    dnf install -y nodejs
    mkdir -p /opt/app
    cat > /opt/app/server.js <<'JS'
    require('http').createServer((req, res) => {
      res.end('art-gallery backend OK\n');
    }).listen(${var.app_port});
    JS
    nohup node /opt/app/server.js > /var/log/app.log 2>&1 &
  EOT

  tags = { Name = "${var.name}-backend-1" }
}
