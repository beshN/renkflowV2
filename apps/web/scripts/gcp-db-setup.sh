#!/bin/bash

# ==========================================
# Google Cloud SQL Setup Script
# ==========================================

# AYARLAR
PROJECT_ID="dauntless-host-486823-j3" # JSON dosyasından alındı
REGION="europe-west3" # Frankfurt
INSTANCE_NAME="renkflow-db-prod"
DB_NAME="renkflow_db"
DB_USER="renkflow_user"

# Key dosyasının yolu
KEY_FILE="service-account-key.json"

echo "🔑 Google Cloud'a Giriş Yapılıyor..."
gcloud auth activate-service-account --key-file="$KEY_FILE"
gcloud config set project "$PROJECT_ID"

# Rastgele güçlü şifre oluştur
DB_PASS=$(openssl rand -base64 16)

echo "🚀 Cloud SQL Kurulumu Başlıyor..."
echo "📍 Bölge: $REGION"
echo "📦 Instance: $INSTANCE_NAME"

# 1. Instance Oluştur (Micro instance - maliyet dostu)
echo "⏳ Instance oluşturuluyor (Bu işlem 5-10 dakika sürebilir)..."
gcloud sql instances create $INSTANCE_NAME \
    --project=$PROJECT_ID \
    --database-version=POSTGRES_15 \
    --tier=db-f1-micro \
    --region=$REGION \
    --storage-type=SSD \
    --storage-size=10GB \
    --root-password=$DB_PASS \
    --availability-type=ZONAL # Tek bölge (daha ucuz)

# 2. Veritabanı Oluştur
echo "🗄️ Veritabanı oluşturuluyor..."
gcloud sql databases create $DB_NAME --instance=$INSTANCE_NAME --project=$PROJECT_ID

# 3. Kullanıcı Oluştur
echo "👤 Kullanıcı oluşturuluyor..."
gcloud sql users create $DB_USER \
    --instance=$INSTANCE_NAME \
    --project=$PROJECT_ID \
    --password=$DB_PASS

# 4. Bağlantı Bilgilerini Al
INSTANCE_CONNECTION_NAME=$(gcloud sql instances describe $INSTANCE_NAME --project=$PROJECT_ID --format="value(connectionName)")

echo ""
echo "✅ VERİTABANI HAZIR!"
echo "------------------------------------------------"
echo "Instance Connection Name: $INSTANCE_CONNECTION_NAME"
echo "Database: $DB_NAME"
echo "User: $DB_USER"
echo "Password: $DB_PASS"
echo "------------------------------------------------"
echo "🌍 DATABASE_URL (GitHub Secret için):"
echo "postgresql://$DB_USER:$DB_PASS@localhost/$DB_NAME?host=/cloudsql/$INSTANCE_CONNECTION_NAME"
echo "------------------------------------------------"
echo "⚠️ NOT: Bu şifreyi saklayın! Ekranı kapatınca kaybolur."
