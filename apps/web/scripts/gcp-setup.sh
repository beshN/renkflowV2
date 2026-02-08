#!/bin/bash

# ==========================================
# Google Cloud Setup Script (GitHub Actions İçin)
# ==========================================

# 1. Değişkenleri Ayarla
export PROJECT_ID="renkflow-v2-prod"  # <-- BURAYA KENDİ PROJE ID'Nİ YAZ (Konsolun üstünde yazar)
export PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")
export SERVICE_ACCOUNT_ID="renkflow-deployer"
export POOL_NAME="github-pool"
export PROVIDER_NAME="github-provider"
export REPO="beshN/renkflowV2"  # <-- SENİN GITHUB REPO ADIN

echo "🚀 Başlıyoruz: $PROJECT_ID projesi için kurulum yapılıyor..."

# 2. Gerekli API'leri aç
echo "📡 API'ler açılıyor..."
gcloud services enable iam.googleapis.com \
    cloudresourcemanager.googleapis.com \
    iamcredentials.googleapis.com \
    artifactregistry.googleapis.com \
    run.googleapis.com \
    sqladmin.googleapis.com \
    storage.googleapis.com \
    secretmanager.googleapis.com \
    --project "${PROJECT_ID}"

# 3. Service Account Oluştur
echo "👤 Service Account oluşturuluyor..."
gcloud iam service-accounts create "${SERVICE_ACCOUNT_ID}" \
    --project "${PROJECT_ID}" \
    --display-name "GitHub Actions Deployer" || echo "Service account zaten var, devam ediliyor."

# 4. Yetkileri Ver (Owner - God Mode)
echo "👑 Yetkiler veriliyor..."
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
    --member "serviceAccount:${SERVICE_ACCOUNT_ID}@${PROJECT_ID}.iam.gserviceaccount.com" \
    --role "roles/editor"

gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
    --member "serviceAccount:${SERVICE_ACCOUNT_ID}@${PROJECT_ID}.iam.gserviceaccount.com" \
    --role "roles/cloudsql.admin"

gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
    --member "serviceAccount:${SERVICE_ACCOUNT_ID}@${PROJECT_ID}.iam.gserviceaccount.com" \
    --role "roles/storage.admin"

gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
    --member "serviceAccount:${SERVICE_ACCOUNT_ID}@${PROJECT_ID}.iam.gserviceaccount.com" \
    --role "roles/run.admin"

gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
    --member "serviceAccount:${SERVICE_ACCOUNT_ID}@${PROJECT_ID}.iam.gserviceaccount.com" \
    --role "roles/iam.serviceAccountUser"

# 5. Workload Identity Pool Oluştur
echo "🏊 Workload Identity Pool oluşturuluyor..."
gcloud iam workload-identity-pools create "${POOL_NAME}" \
    --project="${PROJECT_ID}" \
    --location="global" \
    --display-name="GitHub Actions Pool" || echo "Pool zaten var, devam ediliyor."

# 6. Provider Oluştur
echo "bridge Provider oluşturuluyor..."
gcloud iam workload-identity-pools providers create-oidc "${PROVIDER_NAME}" \
    --project="${PROJECT_ID}" \
    --location="global" \
    --workload-identity-pool="${POOL_NAME}" \
    --display-name="GitHub Actions Provider" \
    --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository" \
    --issuer-uri="https://token.actions.githubusercontent.com" || echo "Provider zaten var, devam ediliyor."

# 7. GitHub Reposuna Yetki Ver
echo "🔗 GitHub ile bağlanıyor..."
export WORKLOAD_IDENTITY_POOL_ID=$(gcloud iam workload-identity-pools describe "${POOL_NAME}" --project="${PROJECT_ID}" --location="global" --format="value(name)")

gcloud iam service-accounts add-iam-policy-binding "${SERVICE_ACCOUNT_ID}@${PROJECT_ID}.iam.gserviceaccount.com" \
    --project="${PROJECT_ID}" \
    --role="roles/iam.workloadIdentityUser" \
    --member="principalSet://iam.googleapis.com/${WORKLOAD_IDENTITY_POOL_ID}/attribute.repository/${REPO}"

# 8. Sonuçları Yazdır
echo ""
echo "✅✅✅ KURULUM BAŞARIYLA TAMAMLANDI! ✅✅✅"
echo ""
echo "Şimdi GitHub Repona git: Settings > Secrets and variables > Actions"
echo "Şu 3 Secret'ı ekle:"
echo "------------------------------------------------"
echo "GCP_PROJECT_ID: ${PROJECT_ID}"
echo "GCP_SA_EMAIL: ${SERVICE_ACCOUNT_ID}@${PROJECT_ID}.iam.gserviceaccount.com"
echo "GCP_WIF_PROVIDER: $(gcloud iam workload-identity-pools providers describe "${PROVIDER_NAME}" --project="${PROJECT_ID}" --location="global" --workload-identity-pool="${POOL_NAME}" --format="value(name)")"
echo "------------------------------------------------"
