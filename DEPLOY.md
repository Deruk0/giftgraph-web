# GiftGraph Web deploy

Текущее размещение — Vercel + закрытый Blob. Сайт работает без ПК и туннеля.
Актуальная инструкция: [CLOUD.md](CLOUD.md). Ниже сохранены прежние альтернативы.

## Вариант 1: домен через InfinityFree

Данные:

- Domain Name: `giftgraph.xo.je`
- IP Address: `185.27.134.125`
- Account: выбери аккаунт, к которому привязан `giftgraph.xo.je`
- Web directory: `htdocs`

Проект `server.py` - это Flask/Python. Для обычного `htdocs` на shared-хостинге подготовлена отдельная PHP-версия в папке:

```text
giftgraph-web/htdocs
```

Загрузить нужно содержимое этой папки в `htdocs` аккаунта, а не саму папку `htdocs` внутрь `htdocs`.

После загрузки должны открываться:

```text
https://giftgraph.xo.je/
https://giftgraph.xo.je/health
https://giftgraph.xo.je/view/de0aaa223972
```

Проверка 2026-10-06: DNS нового домена указывает на `185.27.134.125`, HTTPS отвечает. Запрос `/health` из Python возвращает HTML с проверкой браузера (`aes.js` / `__test`), а не JSON. InfinityFree блокирует прямые API-запросы бота. Изменение адреса и загрузка файлов сами по себе эту блокировку не устраняют.

### Загрузка подготовленного сайта

1. Открой аккаунт нового домена в панели InfinityFree и нажми **File Manager**.
2. Перейди в папку `htdocs`, указанную для этого домена.
3. На ПК распакуй `giftgraph-xo-je-upload.zip`. Загрузи все распакованные файлы и папки в `htdocs` через File Manager или FTP. Если файловый менеджер поддерживает распаковку ZIP, можно загрузить и распаковать архив непосредственно в `htdocs`.
4. Проверь, что `index.php`, `.htaccess` и `config.local.php` лежат прямо в `htdocs`, а рядом есть папки `api`, `assets` и `graphs`. Не создавай дополнительную вложенную папку `htdocs`.
5. Если в `htdocs` уже есть графы, сначала сохрани копию папки `graphs`: архив содержит собственный индекс и 16 локальных графов, его индекс нельзя вслепую заменять поверх других данных.
6. Открой `https://giftgraph.xo.je/` и `https://giftgraph.xo.je/health` в обычном браузере.

Архив включает PHP-сайт, согласованный с ботом секрет API и 16 сохраненных графов. Не публикуй архив в открытом доступе. Загружать `.env`, `userbot.session` и файлы бота на PHP-хостинг не нужно.

### Настройки бота после переноса

В `tg_gift_bot/.env` уже установлено:

```env
GIFTGRAPH_WEB_URL=https://giftgraph.xo.je
GIFTGRAPH_WEB_API_URL=https://giftgraph.xo.je
```

Текущий секрет сохранен и совпадает с `config.local.php` в архиве. После выбора рабочего способа публикации перезапусти процесс `main.py` из папки `tg_gift_bot`. На момент настройки запущенный процесс бота не обнаружен.

Для автоматической публикации нужны FTP-загрузка (требует реализации и данных FTP из панели) либо хостинг, разрешающий API. До этого новые графы через настроенный удаленный API не загрузятся. Локальный API `http://127.0.0.1:5100` хранит файлы только на ПК и сам по себе не переносит их на InfinityFree.

Для возврата прежних локальных настроек: `GIFTGRAPH_WEB_URL=https://giftgraph-deruko.gamer.gd`, `GIFTGRAPH_WEB_API_URL=http://127.0.0.1:5100`.

### Секрет API

Если `GIFTGRAPH_WEB_SECRET` в боте пустой, API будет открыт для записи и удаления графов. Для нормальной работы лучше включить секрет:

1. На хостинге скопировать `config.local.example.php` в `config.local.php`.
2. В `config.local.php` поставить свой секрет:

```php
<?php
$GIFTGRAPH_SECRET = 'long-random-secret';
```

3. В `tg_gift_bot/.env` поставить тот же секрет:

```env
GIFTGRAPH_WEB_URL=https://giftgraph.xo.je
GIFTGRAPH_WEB_API_URL=https://giftgraph.xo.je
GIFTGRAPH_WEB_SECRET=long-random-secret
```

4. Перезапустить бота.

API совместим с текущим ботом:

- `POST /api/graphs`
- `GET /api/graphs`
- `DELETE /api/graphs/<id>`
- `GET /view/<id>`
- `GET /graph/<id>`
- `GET /health`

## Вариант 2: реально хостить на своем ПК

IP `185.27.134.125` ведет на shared-хостинг. Чтобы сайт физически работал с домашнего ПК, домен должен указывать на публичный IP твоего ПК или на туннель.

Минимальная схема:

1. Запустить Flask-сервер из `giftgraph-web`:

```powershell
.\manage.ps1 start
```

2. На роутере пробросить внешний порт `80` или `443` на ПК и порт `5100`, либо поставить reverse proxy.
3. В DNS домена заменить A-запись на публичный IP ПК, а не на `185.27.134.125`.
4. Для HTTPS поставить сертификат через reverse proxy или использовать туннель.
5. В `tg_gift_bot/.env` оставить:

```env
GIFTGRAPH_WEB_URL=https://giftgraph.xo.je
GIFTGRAPH_WEB_API_URL=http://127.0.0.1:5100
```

Так бот сохраняет графы через локальный Flask API, но пользователю отправляет публичную ссылку на домене.

Важно для бота: окружение `tg_gift_bot/.venv` лучше создавать на Python 3.12 или 3.13. На Python 3.14 текущие версии `aiogram`, `aiohttp` и `pydantic-core` могут пытаться собираться из исходников и падать без Visual C++ Build Tools/Rust-совместимости.

Если у провайдера CG-NAT, прямой проброс портов не заработает; тогда нужен туннель.
