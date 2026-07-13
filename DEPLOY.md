# GiftGraph Web deploy

## Вариант 1: домен через InfinityFree

Данные:

- Domain Name: `giftgraph-deruko.gamer.gd`
- IP Address: `185.27.134.176`
- Account: `if0_42151347`
- Web directory: `htdocs`

Проект `server.py` - это Flask/Python. Для обычного `htdocs` на shared-хостинге подготовлена отдельная PHP-версия в папке:

```text
giftgraph-web/htdocs
```

Загрузить нужно содержимое этой папки в `htdocs` аккаунта, а не саму папку `htdocs` внутрь `htdocs`.

После загрузки должны открываться:

```text
https://giftgraph-deruko.gamer.gd/
https://giftgraph-deruko.gamer.gd/health
https://giftgraph-deruko.gamer.gd/view/de0aaa223972
```

Проверка 2026-07-06 показала, что сейчас домен отдает InfinityFree browser validation page с `__test` cookie. Обычный браузер ее проходит, но API-клиент бота может получить HTML вместо JSON. Поэтому для живой автоматической загрузки графов надежнее использовать вариант с ПК/VPS и `GIFTGRAPH_WEB_API_URL=http://127.0.0.1:5100`, либо другой хостинг без такой проверки на API.

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
GIFTGRAPH_WEB_URL=https://giftgraph-deruko.gamer.gd
GIFTGRAPH_WEB_API_URL=https://giftgraph-deruko.gamer.gd
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

IP `185.27.134.176` ведет на shared-хостинг. Чтобы сайт физически работал с домашнего ПК, домен должен указывать на публичный IP твоего ПК или на туннель.

Минимальная схема:

1. Запустить Flask-сервер из `giftgraph-web`:

```powershell
.\manage.ps1 start
```

2. На роутере пробросить внешний порт `80` или `443` на ПК и порт `5100`, либо поставить reverse proxy.
3. В DNS домена заменить A-запись на публичный IP ПК, а не на `185.27.134.176`.
4. Для HTTPS поставить сертификат через reverse proxy или использовать туннель.
5. В `tg_gift_bot/.env` оставить:

```env
GIFTGRAPH_WEB_URL=https://giftgraph-deruko.gamer.gd
GIFTGRAPH_WEB_API_URL=http://127.0.0.1:5100
```

Так бот сохраняет графы через локальный Flask API, но пользователю отправляет публичную ссылку на домене.

Важно для бота: окружение `tg_gift_bot/.venv` лучше создавать на Python 3.12 или 3.13. На Python 3.14 текущие версии `aiogram`, `aiohttp` и `pydantic-core` могут пытаться собираться из исходников и падать без Visual C++ Build Tools/Rust-совместимости.

Если у провайдера CG-NAT, прямой проброс портов не заработает; тогда нужен туннель.
