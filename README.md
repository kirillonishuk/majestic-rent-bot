# Majestic Rent Bot

Telegram-бот для автоматического отслеживания аренды транспорта в GTA RP (Majestic RP). Парсит уведомления от @MajesticRolePlayBot, ведёт статистику доходов и отправляет напоминания об истечении аренды.

## Возможности

- **Автоматический парсинг** — перехватывает сообщения от @MajesticRolePlayBot через MTProto
- **Импорт истории** — сканирует всю историю переписки для загрузки прошлых аренд
- **Уведомления** — напоминает когда аренда истекает
- **Повторная аренда** — при повторной сдаче того же транспорта автоматически закрывает предыдущую аренду
- **Web App (Mini App)** — Telegram Mini App со статистикой, графиками доходов и историей аренд
- **Тёмная тема** — адаптируется к теме Telegram
- **Картинки транспорта** — автоматическое сопоставление 1000+ моделей GTA с изображениями

## Архитектура

```
majestic-rent-bot/
├── packages/
│   ├── shared/          # Общие типы, парсер сообщений, маппинг картинок
│   ├── backend/         # Grammy бот + GramJS + Fastify API + Drizzle ORM
│   └── web/             # React + Vite + Tailwind (Telegram Mini App)
├── cars/                # 1000+ PNG изображений транспорта
├── docker-compose.yml
├── Dockerfile.backend
├── Dockerfile.web
└── nginx.conf
```

### Стек технологий

| Компонент | Технология |
|-----------|------------|
| Монорепо | npm workspaces |
| Бот | [grammY](https://grammy.dev/) (Bot API) |
| MTProto клиент | [GramJS](https://github.com/nicedayzhu/gramjs) |
| API сервер | [Fastify](https://fastify.dev/) |
| БД | SQLite ([better-sqlite3](https://github.com/WiseLibs/better-sqlite3)) |
| ORM | [Drizzle ORM](https://orm.drizzle.team/) |
| Фронтенд | React 19 + [Vite](https://vite.dev/) + [Tailwind CSS](https://tailwindcss.com/) |
| Графики | [Recharts](https://recharts.org/) |
| Деплой | Docker Compose + nginx + Caddy (SSL) |

## Команды бота

| Команда | Описание |
|---------|----------|
| `/start` | Главное меню с кнопками навигации |
| `/connect` | Подключить Telegram-аккаунт (авторизация через MTProto) |
| `/disconnect` | Отключить аккаунт (с подтверждением) |
| `/scan` | Импорт истории аренд из переписки с @MajesticRolePlayBot |
| `/status` | Статус подключения, количество аренд, общий доход |
| `/help` | Список команд |

## Как это работает

1. Пользователь подключает свой Telegram-аккаунт через `/connect`
2. Бот авторизуется через MTProto (GramJS) и начинает слушать сообщения от @MajesticRolePlayBot
3. Каждое сообщение о сдаче транспорта в аренду автоматически парсится:
   ```
   Транспорт сдан в аренду!
   Сервер: Atlanta
   Персонаж: Kirill Toretto #143891
   Транспорт: [RL] Grotti Timucua
   Номер транспорта: 9GUV701
   Цена: $24 000
   Длительность: 2 часов
   Арендатор: Dania Psychos
   ```
4. Данные сохраняются в SQLite с дедупликацией по `(userId, telegramMessageId)`
5. При истечении аренды бот отправляет уведомление
6. Статистика доступна через Telegram Mini App (Web App)

### Схема портов

```
Telegram --> HTTPS (443) --> Caddy --> HTTP (8080) --> nginx (Docker)
                                                       ├─ /         --> React SPA
                                                       ├─ /api/*    --> Fastify (3000)
                                                       └─ /cars/*   --> Fastify (3000)
```

## Установка

### Получение токенов

#### Telegram API (MTProto)

1. Перейти на https://my.telegram.org
2. Войти с номером телефона
3. Выбрать "API development tools"
4. Создать приложение
5. Скопировать `api_id` и `api_hash`

#### Bot Token

1. Открыть @BotFather в Telegram
2. `/newbot` -> придумать имя и username
3. Скопировать токен

#### Encryption Key

```bash
openssl rand -hex 32
```

### Переменные окружения

```bash
cp .env.example .env
```

| Переменная | Описание |
|------------|----------|
| `TELEGRAM_API_ID` | API ID из my.telegram.org |
| `TELEGRAM_API_HASH` | API Hash из my.telegram.org |
| `BOT_TOKEN` | Токен бота от @BotFather |
| `SESSION_ENCRYPTION_KEY` | 64 hex-символа для шифрования MTProto-сессий (AES-256-GCM) |
| `WEB_APP_URL` | URL фронтенда (HTTPS обязателен) |
| `API_PORT` | Порт API-сервера (по умолчанию 3000) |
| `MAJESTIC_BOT_USERNAME` | Username бота Majestic RP (по умолчанию `MajesticRolePlayBot`) |
| `DATABASE_PATH` | Путь к SQLite БД (по умолчанию `./data/majestic.db`) |

### Локальная разработка

```bash
npm install
npm run build:shared
npm run dev        # backend (tsx watch)
npm run dev:web    # frontend (Vite dev server) — в отдельном терминале
```

### Деплой (Docker + Caddy)

#### 1. Установить Docker и Caddy

```bash
curl -fsSL https://get.docker.com | sh

sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy
```

#### 2. Настроить Caddy

```bash
sudo tee /etc/caddy/Caddyfile << 'EOF'
your-domain.com {
    reverse_proxy localhost:8080
}
EOF

sudo systemctl restart caddy
```

Caddy автоматически получит SSL-сертификат от Let's Encrypt.

#### 3. Открыть порты

```bash
sudo ufw allow 80
sudo ufw allow 443
```

#### 4. Клонировать и настроить

```bash
git clone <repo-url> majestic-rent-bot
cd majestic-rent-bot
cp .env.example .env
nano .env  # заполнить переменные
```

#### 5. Запустить

```bash
docker compose up -d --build
```

#### 6. Настроить бота в @BotFather

1. `/mybots` -> выбрать бота
2. **Bot Settings -> Menu Button** -> URL: `https://your-domain.com`

### Нет домена?

Используй бесплатный [DuckDNS](https://www.duckdns.org):

1. Залогиниться -> создать поддомен -> указать IP VPS
2. В Caddyfile и `.env` использовать `your-name.duckdns.org`

## База данных

SQLite с 4 таблицами (Drizzle ORM):

| Таблица | Назначение | Уникальность |
|---------|------------|--------------|
| `users` | Telegram-аккаунты, зашифрованные MTProto-сессии | `telegram_id` |
| `vehicles` | Транспорт пользователей, изображения | `(user_id, name)` |
| `rentals` | История аренд с ценами, сроками, арендаторами | `(user_id, telegram_message_id)` |
| `notification_log` | Лог отправленных уведомлений | — |

### Миграции

```bash
npm run db:generate -w packages/backend   # сгенерировать миграцию
npm run db:migrate -w packages/backend    # применить миграцию
```

Миграции применяются автоматически при старте бэкенда.

## Полезные команды

```bash
docker compose up -d --build      # пересобрать и запустить
docker compose logs -f backend    # логи бэкенда
docker compose logs -f web        # логи фронтенда
docker compose down               # остановить
```

## Проверка работоспособности

1. `https://your-domain.com` — Web App
2. `https://your-domain.com/api/health` — `{"status":"ok"}`
3. Telegram: `/start` -> "Подключить аккаунт"
4. После подключения: автоматический импорт истории
5. Ручной импорт: `/scan`
