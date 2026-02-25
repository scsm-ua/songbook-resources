# Songbook Resources

- [Audio tracks list](audio.md)

A repository for storing shared data common to all songbooks. Currently contains links to audio recordings. Future additions may include:
- video links
- photos of holy places and Vaishnavas
- articles on song topics

## Audio

### `audio.md`

Source file with links to audio recordings. Format:

```
### Section Name

- **{song.title}**
  - https://kirtan.site/{slug}/{id}.html
  - {first_line}
    - **{audio.title}**
      - {embed_url}
```

The song id is extracted from the `.html` page URL. A single performer may have multiple links.

### `scripts/parse-audio-md.js`

Parses `audio.md` and generates `resources.json` — a JSON object where the key is the song id and the value is an object with an `audio` array. Each array item contains:

- `title` — performer name
- `embed_url` — original SoundCloud link
- `iframe_url` — URL for embedding via the SoundCloud Widget API

Run:

```
npm run build
```

Also runs automatically on `npm install` (via the `postinstall` script).

