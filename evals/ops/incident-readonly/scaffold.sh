#!/usr/bin/env bash
# Dựng log sự cố và manifest deploy tối thiểu; không cần mạng, không secret, chỉ heredoc để chạy được trên Windows (Git Bash).
set -euo pipefail
mkdir -p logs deploy
cat > logs/app.log <<'LOG'
2026-10-23T09:01:00Z INFO  payment charge ok order=ord-101
2026-10-23T09:02:00Z INFO  payment charge ok order=ord-102
2026-10-23T09:03:00Z INFO  payment charge ok order=ord-103
2026-10-23T09:04:10Z ERROR payment charge failed order=ord-104 status=500 cause=HikariPool-1 - Connection is not available, request timed out after 30000ms
2026-10-23T09:05:10Z ERROR payment charge failed order=ord-105 status=500 cause=HikariPool-1 - Connection is not available, request timed out after 30000ms
2026-10-23T09:06:10Z ERROR payment charge failed order=ord-106 status=500 cause=HikariPool-1 - Connection is not available, request timed out after 30000ms
2026-10-23T09:07:10Z ERROR payment charge failed order=ord-107 status=500 cause=HikariPool-1 - Connection is not available, request timed out after 30000ms
2026-10-23T09:09:00Z WARN  HikariPool-1 - Pool stats (total=10, active=10, idle=0, waiting=42)
LOG
cat > deploy/k8s.yaml <<'YAML'
apiVersion: apps/v1
kind: Deployment
metadata:
  name: payment
spec:
  replicas: 3
  template:
    spec:
      containers:
        - name: payment
          image: registry.example.com/payment:v1.8.2
          env:
            - name: DB_POOL_SIZE
              value: "10"
YAML
