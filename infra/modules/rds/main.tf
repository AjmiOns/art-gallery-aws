# ---------------------------------------------------------------------------
# PostgreSQL on RDS, in the private DB subnets, reachable only from app-sg
# (the db-sg rule lives in modules/security). Not publicly accessible.
# ---------------------------------------------------------------------------
resource "aws_db_parameter_group" "this" {
  name_prefix = "${var.name}-pg-"
  family      = var.parameter_group_family
  description = "art-gallery PostgreSQL parameters"

  parameter {
    name         = "rds.force_ssl"
    value        = var.force_ssl ? "1" : "0"
    apply_method = "pending-reboot"
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_db_instance" "this" {
  identifier     = "${var.name}-db"
  engine         = "postgres"
  engine_version = var.engine_version
  instance_class = var.instance_class

  allocated_storage = var.allocated_storage
  storage_encrypted = true # encryption at rest (cahier §5.3)

  # When restoring from a snapshot, the name and master user come from the
  # snapshot and must not be set again.
  db_name  = var.snapshot_identifier == null ? var.db_name : null
  username = var.snapshot_identifier == null ? var.db_username : null
  password = var.db_password

  snapshot_identifier = var.snapshot_identifier

  db_subnet_group_name   = var.db_subnet_group_name
  vpc_security_group_ids = [var.db_sg_id]
  parameter_group_name   = aws_db_parameter_group.this.name
  publicly_accessible    = false
  multi_az               = var.multi_az

  # Automated backups + point-in-time recovery (cahier: backups on, restore demonstrated).
  backup_retention_period = var.backup_retention_days
  copy_tags_to_snapshot   = true

  auto_minor_version_upgrade = true
  apply_immediately          = true

  # The database is destroyed at the end of every session (billed by the hour).
  # No final snapshot, otherwise every destroy would leave a snapshot behind.
  # To keep data between sessions, take a manual snapshot BEFORE destroy and
  # restore it with var.snapshot_identifier (see README).
  skip_final_snapshot = true
  deletion_protection = false

  tags = { Name = "${var.name}-db" }
}
