# Majestic Rent Bot

Telegram бот для отслеживания аренды транспорта в GTA RP (Majestic).

## Получение токенов

### Telegram API (MTProto)

1. Перейти на https://my.telegram.org
2. Войти с номером телефона
3. Выбрать "API development tools"
4. Создать приложение (название любое)
5. Скопировать `api_id` и `api_hash`

### Bot Token

1. Открыть @BotFather в Telegram
2. Отправить `/newbot`
3. Придумать имя и username для бота
4. Скопировать токен вида `123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11`

### Encryption Key

```bash
openssl rand -hex 32
# или
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Локальный запуск (разработка)

```bash
cp .env.example .env
# Заполнить .env (см. ниже)

npm install
npm run build:shared
npm run dev
```

## Деплой на VPS (Docker + Caddy)

### 1. Установить Docker и Caddy

```bash
# Docker
curl -fsSL https://get.docker.com | sh

# Caddy (авто-SSL)
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install -y caddy
```

### 2. Настроить Caddy (HTTPS reverse proxy)

```bash
sudo tee /etc/caddy/Caddyfile << 'EOF'
your-domain.com {
    reverse_proxy localhost:8080
}
EOF

sudo systemctl restart caddy
```

Caddy автоматически получит SSL-сертификат от Let's Encrypt.

### 3. Открыть порты

```bash
sudo ufw allow 80
sudo ufw allow 443
```

Порт 8080 НЕ нужно открывать наружу — Caddy проксирует на него внутри.

### 4. Клонировать и настроить проект

```bash
git clone <repo-url> majestic-rent-bot
cd majestic-rent-bot
cp .env.example .env
nano .env
```

### 5. Заполнить .env

```
TELEGRAM_API_ID=12345678
TELEGRAM_API_HASH=abcdef1234567890abcdef1234567890
BOT_TOKEN=123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11
SESSION_ENCRYPTION_KEY=<64 hex символа>
WEB_APP_URL=https://your-domain.com
API_PORT=3000
MAJESTIC_BOT_USERNAME=MajesticRolePlayBot
```

### 6. Запустить

```bash
docker compose up -d --build
```

Проверить логи:
```bash
docker compose logs -f
```

### 7. Настроить бота в @BotFather

1. `/mybots` → выбрать бота
2. **Bot Settings → Menu Button** → URL: `https://your-domain.com`

## Схема портов

```
Telegram → HTTPS (443) → Caddy → HTTP (8080) → nginx (web)
                                                  ├─ /         → SPA (фронтенд)
                                                  ├─ /api/*    → backend (3000)
                                                  └─ /cars/*   → backend (3000)
```

- `443` — Caddy (HTTPS, наружу)
- `8080` — nginx в Docker (только localhost)
- `3000` — бэкенд в Docker (только внутри Docker network)

## Нет домена?

Используй бесплатный DuckDNS:

1. Зайти на https://www.duckdns.org → залогиниться
2. Создать поддомен → указать IP VPS
3. В Caddyfile и .env использовать `your-name.duckdns.org`

## Полезные команды

```bash
# Пересобрать после изменений
docker compose up -d --build

# Посмотреть логи
docker compose logs -f backend
docker compose logs -f web

# Остановить
docker compose down

# База данных хранится в ./data/majestic.db (вне Docker)
```

## Проверка

1. `https://your-domain.com` — web app
2. `https://your-domain.com/api/health` — `{"status":"ok"}`
3. Telegram: открыть бота → `/start` → "Подключить аккаунт"
4. После подключения: автоматический импорт истории аренд
5. Ручной импорт: `/scan`
