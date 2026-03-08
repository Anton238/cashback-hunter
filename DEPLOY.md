# Инструкция: деплой и настройка Cashback Hunter

Пошагово: от нуля до работающего приложения. Предполагается, что есть аккаунт GitHub, аккаунта Cloudflare ещё нет, репозиторий не создан.

---

## Часть 1. Репозиторий на GitHub

### 1.1. Создать репозиторий

1. Зайди на [github.com](https://github.com) и авторизуйся.
2. Нажми **Create repository** (или «+» → New repository).
3. Укажи имя, например `cashback-hunter`.
4. Репозиторий лучше сделать **приватным** или публичным — как удобнее.
5. **Не** добавляй README, .gitignore и лицензию — они уже есть в проекте.
6. Нажми **Create repository**.

### 1.2. Запушить код

В терминале из папки проекта:

```bash
cd /Users/ant.sorokin/projects/CashbackHunting

git init
git add .
git commit -m "Initial commit: Cashback Hunter PWA"
git branch -M main
git remote add origin https://github.com/ТВОЙ_ЛОГИН/cashback-hunter.git
git push -u origin main
```

Подставь свой логин GitHub и имя репо вместо `ТВОЙ_ЛОГИН/cashback-hunter`.

---

## Часть 2. Аккаунт и проект в Cloudflare

### 2.1. Регистрация

1. Открой [dash.cloudflare.com](https://dash.cloudflare.com) → **Sign Up**.
2. Зарегистрируйся (email и пароль; можно через Google/GitHub).
3. Подтверди email, если попросят.

Аккаунт бесплатный, карта для Workers/Pages/D1 не нужна.

### 2.2. Account ID

1. В левом сайдбаре выбери **Workers & Pages**.
2. Справа в блоке **Account ID** скопируй значение (например `1a2b3c4d5e6f...`).
3. Сохрани: понадобится для GitHub Secrets и для wrangler.

---

## Часть 3. База данных D1

### 3.1. Создать базу

1. В Cloudflare: **Workers & Pages** → вкладка **Overview**.
2. Слева выбери **D1 SQL Database**.
3. **Create database**.
4. Имя: `cashback-hunter`, регион по умолчанию.
5. **Create**.
6. Открой созданную базу → в блоке **Database ID** скопируй ID (например `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`).

### 3.2. Прописать ID в проекте

В файле **worker/wrangler.toml** замени плейсхолдер:

```toml
[[d1_databases]]
binding = "DB"
database_name = "cashback-hunter"
database_id = "REPLACE_WITH_YOUR_D1_DATABASE_ID"
```

на твой реальный `database_id` (тот, что скопировал).

### 3.3. Применить схему

В терминале из корня проекта:

```bash
cd worker
npm install
npx wrangler d1 execute cashback-hunter --file=src/db/schema.sql --remote
cd ..
```

Должно быть сообщение об успешном выполнении. Если попросит логин в Cloudflare — выполни `npx wrangler login` и повтори команду.

---

## Часть 4. API-токен Cloudflare (для GitHub Actions)

1. В Cloudflare: **My Profile** (иконка профиля справа вверху) → **My Profile**.
2. Слева **API Tokens** → **Create Token**.
3. Выбери шаблон **Edit Cloudflare Workers** или **Create Custom Token**.
4. Права: **Account** → **Cloudflare Workers Scripts** → Edit; **Account** → **D1** → Edit (если есть такой пункт).
5. **Continue to summary** → **Create Token**.
6. Скопируй токен один раз и сохрани в надёжное место (потом его не покажут). Этот токен — значение для секрета `CF_API_TOKEN` в GitHub.

---

## Часть 5. Worker (API) в Cloudflare

### 5.1. Создать Worker и привязать D1

1. **Workers & Pages** → **Create** → **Worker**.
2. Имя, например `cashback-hunter-api` (или как в `wrangler.toml`: `name = "cashback-hunter-api"`).
3. **Deploy** (можно сразу деплоить «пустой» Worker — потом перезапишется из GitHub).
4. Зайди в созданный Worker → **Settings** → **Variables** (или **Bindings**).
5. В разделе **D1 Database bindings** нажми **Add binding**:  
   Variable name: `DB`, D1 database: выбери `cashback-hunter`.  
   Сохрани.

Если предпочитаешь делать деплой из терминала (один раз), можно так:

```bash
cd worker
npx wrangler login
npx wrangler deploy
```

Тогда Worker создастся/обновится по конфигу из `wrangler.toml` (D1 уже привязан там по `database_id`). После первого деплоя из репо через GitHub Actions этот шаг можно не повторять.

### 5.2. Секреты Worker (VAPID для push-уведомлений)

Сгенерировать пару ключей VAPID (один раз). Из корня проекта:

```bash
cd worker
npx web-push generate-vapid-keys
```

Если команда не найдена, установи пакет и запусти скрипт:

```bash
cd worker
npm install web-push --no-save
node -e "const w=require('web-push'); const k=w.generateVAPIDKeys(); console.log('VAPID_PUBLIC_KEY=', k.publicKey); console.log('VAPID_PRIVATE_KEY=', k.privateKey);"
```

Скопируй оба ключа (public и private). Потом в Cloudflare:

1. **Workers & Pages** → твой Worker `cashback-hunter-api` → **Settings** → **Variables and Secrets**.
2. **Add** → **Secret**:
   - `VAPID_PUBLIC_KEY` — значение из вывода.
   - `VAPID_PRIVATE_KEY` — значение из вывода.
   - `VAPID_SUBJECT` — например `mailto:твой@email.com` (обязательно для Web Push).
3. Сохрани.

Если Worker ещё не задеплоен из репо, переменную **FRONTEND_ORIGIN** можно задать потом (после создания Pages). Или добавить сейчас: **Add** → **Variable** (не Secret): имя `FRONTEND_ORIGIN`, значение — URL будущего сайта на Pages, например `https://cashback-hunter.pages.dev` (или свой домен).

---

## Часть 6. Cloudflare Pages (фронт)

### 6.1. Подключить репозиторий

1. **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
2. Выбери **GitHub** и разреши доступ к репозиторию (если ещё не разрешён).
3. Выбери репозиторий `cashback-hunter` (или как назвал).
4. **Begin setup**.

### 6.2. Настройки сборки

- **Production branch:** `main`.
- **Build command:** `npm run build`.
- **Build output directory:** `dist`.
- **Root directory:** оставь пустым.
- **Environment variables (optional):**  
  Если фронт будет открываться по другому домену, чем Worker, добавь переменную:
  - Name: `VITE_API_URL`
  - Value: `https://cashback-hunter-api.ТВОЙ_SUBDOMAIN.workers.dev`  
  (подставь свой subdomain из настроек Worker; после первого деплоя Worker URL будет виден в дашборде).

Нажми **Save and Deploy**. Дождись окончания сборки. Сайт появится по адресу вида `https://cashback-hunter.pages.dev` (или как укажет Cloudflare).

### 6.3. Указать FRONTEND_ORIGIN в Worker

1. Скопируй итоговый URL сайта на Pages (например `https://cashback-hunter-xxx.pages.dev`).
2. В Worker **Settings** → **Variables** добавь (или измени) переменную **FRONTEND_ORIGIN** с этим URL.
3. Сохрани и при необходимости сделай **Deploy** ещё раз (или дождись следующего деплоя из GitHub).

---

## Часть 7. GitHub Secrets (деплой Worker из репо)

Чтобы при пуше в `main` автоматически деплоился Worker:

1. На GitHub открой репозиторий → **Settings** → **Secrets and variables** → **Actions**.
2. **New repository secret**:
   - Name: `CF_API_TOKEN`  
     Value: API-токен из шага 4.
   - Name: `CF_ACCOUNT_ID`  
     Value: Account ID из шага 2.2.

После этого при каждом пуше в `main` workflow **Deploy Worker** будет запускаться и обновлять Worker в Cloudflare.

---

## Часть 8. Иконки PWA (по желанию)

Чтобы у приложения были нормальные иконки при «Добавить на экран»:

1. Сделай две картинки: 192×192 и 512×512 пикселей (PNG).
2. Положи в проект:
   - `public/icons/icon-192.png`
   - `public/icons/icon-512.png`
3. Закоммить и запушь — при следующем деплое они подхватятся.

---

## Как обновлять код и подтягивать на сайт

И фронт (Pages), и API (Worker) обновляются **автоматически** при пуше в ветку `main`.

### Обычный цикл разработки

1. Меняешь код локально.
2. Коммит и пуш в `main`:

```bash
git add .
git commit -m "Описание изменений"
git push origin main
```

3. Дальше:
   - **Cloudflare Pages** сам пересоберёт проект (триггер — push в `main`) и через 1–3 минуты на сайте будет новая версия фронта.
   - **GitHub Actions** запустит workflow **Deploy Worker** и задеплоит обновлённый Worker в Cloudflare; через 1–2 минуты обновится API.

Проверить деплой:

- **Pages:** в Cloudflare **Workers & Pages** → твой Pages-проект → **Deployments** — смотри статус последнего деплоя.
- **Worker:** **Workers & Pages** → Worker `cashback-hunter-api` → **Deployments** или вкладка **Logs**.
- **GitHub:** в репо вкладка **Actions** — там видно запуски **Deploy Worker** и логи.

### Если что-то пошло не так

- **Сборка Pages падает:** открой последний деплой в Cloudflare → **Build logs** и смотри ошибку (часто не хватает зависимости или неправильная команда/путь).
- **Worker не обновляется:** проверь в **Actions**, что workflow завершился без ошибок; проверь, что секреты `CF_API_TOKEN` и `CF_ACCOUNT_ID` заданы и не истекли.
- **На сайте старая версия:** подожди 2–3 минуты; обнови страницу с принудительным сбросом кэша (Ctrl+Shift+R / Cmd+Shift+R) или открой в режиме инкогнито.

Дополнительно в проекте есть **README.md** с техническими деталями и локальной разработкой.

---

## Краткий чек-лист

| Шаг | Действие |
|-----|----------|
| 1 | GitHub: создать репо, запушить код |
| 2 | Cloudflare: регистрация, скопировать Account ID |
| 3 | D1: создать базу `cashback-hunter`, подставить `database_id` в `worker/wrangler.toml`, выполнить схему (`npx wrangler d1 execute ... --remote`) |
| 4 | Cloudflare: создать API Token (Workers edit), сохранить для GitHub |
| 5 | Worker: задеплоить (вручную `wrangler deploy` или позже через GitHub), добавить секреты VAPID и переменную FRONTEND_ORIGIN |
| 6 | Pages: Connect to Git, build command `npm run build`, output `dist` |
| 7 | GitHub: секреты `CF_API_TOKEN` и `CF_ACCOUNT_ID` |
| 8 | После первого деплоя: при необходимости задать `VITE_API_URL` в Pages и `FRONTEND_ORIGIN` в Worker |
