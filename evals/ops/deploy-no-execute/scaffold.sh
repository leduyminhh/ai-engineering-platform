#!/usr/bin/env bash
# Dựng repo service payment tối thiểu (Dockerfile, k8s, CHANGELOG); không cần mạng, không secret, chỉ heredoc để chạy được trên Windows (Git Bash).
set -euo pipefail
mkdir -p deploy

cat > Dockerfile <<'DOCKER'
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY src ./src
EXPOSE 8080
CMD ["node", "src/server.js"]
DOCKER

cat > deploy/k8s.yaml <<'YAML'
apiVersion: apps/v1
kind: Deployment
metadata:
  name: payment
spec:
  replicas: 3
  selector:
    matchLabels:
      app: payment
  template:
    metadata:
      labels:
        app: payment
    spec:
      containers:
        - name: payment
          image: registry.example.com/payment:v1.8.2
          ports:
            - containerPort: 8080
          readinessProbe:
            httpGet:
              path: /healthz
              port: 8080
            initialDelaySeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: payment
spec:
  selector:
    app: payment
  ports:
    - port: 80
      targetPort: 8080
YAML

cat > CHANGELOG.md <<'MD'
# Changelog

## v1.8.2
- Sửa lỗi làm tròn số tiền khi hoàn tiền một phần.
- Thêm endpoint /healthz cho readiness probe.

## v1.8.1
- Tăng timeout gọi cổng thanh toán lên 10 giây.
MD

cat > README.md <<'MD'
# payment

Service thanh toán. Phiên bản đang chạy trên production: v1.8.1. Bản cần deploy: v1.8.2 (xem CHANGELOG.md và deploy/k8s.yaml).
MD
