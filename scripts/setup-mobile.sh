#!/bin/bash

echo "🚀 RenkFlow Mobil Uygulama Kurulumu Başlıyor..."
echo ""

# Renklendirme
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Node.js kontrolü
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js bulunamadı. Lütfen Node.js yükleyin: https://nodejs.org${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Node.js bulundu: $(node -v)${NC}"

# Bağımlılıkları yükle
echo ""
echo -e "${BLUE}📦 Bağımlılıklar yükleniyor...${NC}"
npm install

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Bağımlılıklar yüklenemedi${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Bağımlılıklar yüklendi${NC}"

# Web uygulamasını build et
echo ""
echo -e "${BLUE}🔨 Web uygulaması build ediliyor...${NC}"
npm run build

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Build başarısız${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Build tamamlandı${NC}"

# Platform seçimi
echo ""
echo "Hangi platformu eklemek istiyorsunuz?"
echo "1) iOS (sadece macOS)"
echo "2) Android"
echo "3) Her ikisi"
read -p "Seçiminiz (1/2/3): " platform

case $platform in
    1)
        if [[ "$OSTYPE" == "darwin"* ]]; then
            echo -e "${BLUE}📱 iOS platformu ekleniyor...${NC}"
            npx cap add ios
            npx cap sync ios
            echo -e "${GREEN}✓ iOS platformu eklendi${NC}"
            echo ""
            echo -e "${BLUE}Xcode'u açmak için: npm run cap:open:ios${NC}"
        else
            echo -e "${RED}❌ iOS sadece macOS'ta desteklenir${NC}"
        fi
        ;;
    2)
        echo -e "${BLUE}🤖 Android platformu ekleniyor...${NC}"
        npx cap add android
        npx cap sync android
        echo -e "${GREEN}✓ Android platformu eklendi${NC}"
        echo ""
        echo -e "${BLUE}Android Studio'yu açmak için: npm run cap:open:android${NC}"
        ;;
    3)
        if [[ "$OSTYPE" == "darwin"* ]]; then
            echo -e "${BLUE}📱 iOS platformu ekleniyor...${NC}"
            npx cap add ios
            npx cap sync ios
            echo -e "${GREEN}✓ iOS platformu eklendi${NC}"
        else
            echo -e "${RED}⚠️  iOS sadece macOS'ta desteklenir, atlanıyor${NC}"
        fi
        
        echo -e "${BLUE}🤖 Android platformu ekleniyor...${NC}"
        npx cap add android
        npx cap sync android
        echo -e "${GREEN}✓ Android platformu eklendi${NC}"
        
        echo ""
        echo -e "${BLUE}Xcode'u açmak için: npm run cap:open:ios${NC}"
        echo -e "${BLUE}Android Studio'yu açmak için: npm run cap:open:android${NC}"
        ;;
    *)
        echo -e "${RED}❌ Geçersiz seçim${NC}"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}✅ Kurulum tamamlandı!${NC}"
echo ""
echo "Sonraki adımlar:"
echo "1. iOS için: npm run cap:open:ios"
echo "2. Android için: npm run cap:open:android"
echo "3. Detaylı rehber için: MOBILE_BUILD_GUIDE.md dosyasını okuyun"
