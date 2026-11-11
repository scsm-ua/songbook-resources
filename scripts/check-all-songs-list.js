/*

Compare slugs in `scripts/fixtures/all-songs.json` with keys of `resources.json`
and print items missing on either side, formatted as `audio.md` items.

Usage:
    node scripts/check-all-songs-list.js

*/

const path = require('path');
const fs = require('fs');

const root = path.join(__dirname, '..');
const resources = JSON.parse(fs.readFileSync(path.join(root, 'resources.json'), 'utf8'));
const allSongs = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'all-songs.json'), 'utf8'));

// `images` is a non-song section of resources.json.
delete resources.images;

const resourceKeys = new Set(Object.keys(resources));
const songKeys = new Set(Object.keys(allSongs));

const missingInResources = [...songKeys].filter((k) => !resourceKeys.has(k)).sort();
const missingInAllSongs = [...resourceKeys].filter((k) => !songKeys.has(k)).sort();

const formatItem = (slug, title, firstLine) =>
    `- **${title}**\n  - https://kirtan.site/en/${slug}/` + (firstLine ? `\n  - ${firstLine}` : '');

console.log(`all-songs.json: ${songKeys.size} items, resources.json: ${resourceKeys.size} items\n`);

console.log(`In all-songs.json but not in resources.json (${missingInResources.length}):\n`);
for (const k of missingInResources) console.log(formatItem(k, allSongs[k].title, allSongs[k].first_line));

console.log(`\nIn resources.json but not in all-songs.json (${missingInAllSongs.length}):\n`);
for (const k of missingInAllSongs) console.log(formatItem(k, k));
