# Songbook Resources

- [Audio tracks list](audio.md)

A repository for storing shared data common to all songbooks. Currently contains links to audio recordings. Future additions may include:
- video links
- photos of holy places and Vaishnavas
- articles on song topics

## Audio

### Data files

| File | Description |
|------|-------------|
| `audio.md` | Source file — manually edited, contains audio links |
| `resources.json` | Generated output — consumed by songbook apps |
| `persons.json` | List of known performers referenced in `audio.md` |

#### `audio.md` format

```
### Section Name

- **{song.title}**
  - https://kirtan.site/{slug}/{id}.html
  - {first_line}
    - **{audio.title}**
      - {embed_url}
```

The song id is extracted from the `.html` page URL. A single performer may have multiple links.

#### `resources.json` structure

Each key is a song id. The value is an object with an `audio` array where each item contains:

- `title` — performer name (must match an `id` in `persons.json`)
- `embed_url` — original SoundCloud link
- `iframe_url` — URL for embedding via the SoundCloud Widget API

### Scripts

| Script | Description |
|--------|-------------|
| `scripts/parse-audio-md.js` | Parses `audio.md` → writes `resources.json`. Exits with `1` on format errors |
| `scripts/test-resource-performers.js` | Validates all `audio[].title` values exist in `persons.json`. Exits with `1` on unknown performers |
| `scripts/build.js` | Runs both scripts above in sequence |

### Usage

```
npm run build
```

Also runs automatically on `npm install` (via the `postinstall` script).

## CI

The `.github/workflows/build.yml` workflow runs `npm run build` on every push, failing the check if `audio.md` has format errors or if any performer is missing from `persons.json`.

