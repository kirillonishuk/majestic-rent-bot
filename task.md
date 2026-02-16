# Majestic Rent Bot

Telegram бот для отслеживания аренды транспорта в GTA RP (Majestic).

## Быстрый старт

1. Скопируйте `.env.example` в `.env` и заполните:
   - `TELEGRAM_API_ID` и `TELEGRAM_API_HASH` — с https://my.telegram.org
   - `BOT_TOKEN` — от @BotFather
   - `SESSION_ENCRYPTION_KEY` — сгенерируйте: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

2. Установите зависимости и запустите:
   ```bash
   npm install
   npm run build:shared
   npm run dev
   ```

3. Или через Docker:
   ```bash
   docker compose up --build
   ```

## Подробное ТЗ

См. полное техническое задание в `.claude/plans/glittery-jingling-pizza.md`
