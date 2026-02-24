# Songbook Resources

Репозиторий для хранения общих данных, неизменных для всех песенников. В настоящее время это ссылки на аудио-файлы. В будущем также возможно будут:
 - ссылки на видео
 - фото святых мест и вайшнавов
 - статьи по тематике песен

## Аудио

### `audio.md`

Исходный файл со ссылками на аудио-записи. Структура:

```
### Section Name

- [Song Title](https://kirtan.site/.../song-id.html) - [transliteration](...)
  - Performer Name
    - https://soundcloud.com/...
```

Каждая запись привязана к идентификатору песни (slug из URL `.html`-страницы). У одного исполнителя может быть несколько ссылок.

### `scripts/parse-audio-md.js`

Парсит `audio.md` и генерирует `resources-parsed-from-md.json` — JSON-объект, где ключ — slug песни, значение — объект с массивом `audio`. Каждый элемент массива содержит:

- `title` — имя исполнителя
- `embed_url` — оригинальная ссылка на SoundCloud
- `iframe_url` — URL для встраивания через SoundCloud Widget API

Запуск:

```
node scripts/parse-audio-md.js
```

Также запускается автоматически при `npm install` (скрипт `postinstall`).
