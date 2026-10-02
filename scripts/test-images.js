/*

Validate images for the songbook:

1) Every image file in the `images/` directory must have metadata in
   `resources.json` (produced by `npm run build`) and stay within the allowed
   size and dimension limits. A non-image file, or an image missing metadata,
   is reported as an error.
2) Every `<key>.image` referenced in `resources.json` must exist in `images/`.
3) Images not referenced by a song are recorded under the `images` root key of
   `resources.json` and logged as info only (not an error).

Output is formatted for GitHub Actions:
  - progress lines go to stdout,
  - invalid or missing images are reported through the `::error::` workflow
    command so they appear as annotations on the run,
  - grouped logs use `::group::` / `::endgroup::`,
  - a summary is appended to `$GITHUB_STEP_SUMMARY` when the file is defined.

Exit code is `1` if any image is invalid or any reference is missing.
Unreferenced (orphan) files do not affect the exit code.

Usage:
    node scripts/test-images.js

*/

const path = require('path');
const fs = require('fs');

const { ghaError, ghaGroupStart, ghaGroupEnd, appendStepSummary } = require('./gha');

const PROJECT_ROOT = path.join(__dirname, '..');

const MIN_SIZE = 100;
const MAX_SIZE = 2000;
const MAX_BYTES = 4 * 1024 * 1024;
const IMAGES_DIR = 'images';
const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.tif', '.tiff', '.avif']);

function normalize(p) {
    return p.split(path.sep).join('/');
}

function collectImages(resources) {
    const items = [];
    for (const [songId, data] of Object.entries(resources)) {
        if (songId === 'images') continue;
        const image = data && typeof data.image === 'object' ? data.image : null;
        if (!image || typeof image.href !== 'string' || image.href === '') continue;
        items.push({ songId, ...image });
    }
    return items;
}

function walkFiles(dir) {
    const found = [];
    const absDir = path.join(PROJECT_ROOT, dir);
    if (!fs.existsSync(absDir)) return found;
    for (const entry of fs.readdirSync(absDir, { withFileTypes: true })) {
        const rel = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            found.push(...walkFiles(rel));
        } else if (entry.isFile()) {
            found.push(rel);
        }
    }
    return found;
}

function isImageFile(file) {
    return IMAGE_EXTS.has(path.extname(file).toLowerCase());
}

function validateMeta(meta) {
    if (!meta) {
        return { ok: false, error: 'no metadata in resources.json (run npm run build)' };
    }
    const { type, width, height, length } = meta;
    if (typeof length === 'number' && length > MAX_BYTES) {
        return { ok: false, type, width, height, error: `file size ${(length / 1024 / 1024).toFixed(2)}MB exceeds ${MAX_BYTES / 1024 / 1024}MB` };
    }
    if (!width || !height) {
        return { ok: false, type, error: 'invalid dimensions' };
    }
    if (width < MIN_SIZE || width > MAX_SIZE || height < MIN_SIZE || height > MAX_SIZE) {
        return { ok: false, type, width, height, error: `dimensions ${width}x${height} out of range (${MIN_SIZE}-${MAX_SIZE}px)` };
    }
    return { ok: true, type, width, height };
}

function main() {
    const resourcesPath = path.join(PROJECT_ROOT, 'resources.json');
    const resources = JSON.parse(fs.readFileSync(resourcesPath, 'utf-8'));
    const referenced = collectImages(resources);
    const unused = Array.isArray(resources.images) ? resources.images : [];

    const metaByHref = new Map();
    for (const item of [...referenced, ...unused]) {
        if (item && typeof item.href === 'string') metaByHref.set(normalize(item.href), item);
    }

    const allFiles = walkFiles(IMAGES_DIR).map((f) => normalize(f));
    const files = allFiles.filter(isImageFile);
    const nonImages = allFiles.filter((file) => !isImageFile(file));
    const fileSet = new Set(files);
    const referencedSet = new Set(referenced.map((item) => normalize(item.href)));

    // 1) Validate every image file in images/ against its metadata in resources.json.
    console.log(`Validating ${files.length} file(s) in ${IMAGES_DIR}/`);
    const fileResults = files.map((file) => ({
        file,
        result: validateMeta(metaByHref.get(file))
    }));
    const invalid = fileResults.filter(({ result }) => !result.ok);

    // 2) Every referenced image must exist in images/.
    const missing = referenced.filter((item) => !fileSet.has(normalize(item.href)));

    // 3) Files not referenced by a song (informational only).
    const orphans = files.filter((file) => !referencedSet.has(file));

    ghaGroupStart('Image validation');
    for (const { file, result } of fileResults) {
        if (result.ok) {
            console.log(`  [OK  ] ${file} (${result.type} ${result.width}x${result.height})`);
        } else {
            console.log(`  [FAIL] ${file} (${result.error})`);
        }
    }
    for (const file of nonImages) {
        console.log(`  [FAIL] ${file} (not an image file)`);
    }
    ghaGroupEnd();

    if (invalid.length > 0) {
        ghaGroupStart(`Invalid images (${invalid.length})`);
        for (const { file, result } of invalid) {
            ghaError(`Invalid image (${result.error}): ${file}`, {
                file,
                title: `Invalid image: ${file}`
            });
        }
        ghaGroupEnd();
    }

    if (nonImages.length > 0) {
        ghaGroupStart(`Non-image files (${nonImages.length})`);
        for (const file of nonImages) {
            ghaError(`File in ${IMAGES_DIR}/ is not an image: ${file}`, {
                file,
                title: `Not an image: ${file}`
            });
        }
        ghaGroupEnd();
    }

    if (missing.length > 0) {
        ghaGroupStart(`Missing referenced images (${missing.length})`);
        for (const item of missing) {
            ghaError(`Referenced image not found in ${IMAGES_DIR}/ for "${item.songId}": ${item.href}`, {
                file: 'resources.json',
                title: `Missing image: ${item.songId}`
            });
        }
        ghaGroupEnd();
    }

    if (orphans.length > 0) {
        ghaGroupStart(`Unreferenced images (${orphans.length})`);
        for (const file of orphans) {
            console.log(`  [INFO] not referenced in resources.json: ${file}`);
        }
        ghaGroupEnd();
    }

    const summary = [
        `# Image validation`,
        ``,
        `- Files in ${IMAGES_DIR}/: **${allFiles.length}**`,
        `- Invalid: **${invalid.length}**`,
        `- Non-image: **${nonImages.length}**`,
        `- Missing references: **${missing.length}**`,
        `- Unreferenced (info): **${orphans.length}**`,
        ``
    ];
    if (invalid.length > 0) {
        summary.push(`## Invalid`, ``, `| Image | Reason |`, `| --- | --- |`);
        for (const { file, result } of invalid) {
            summary.push(`| ${file} | ${result.error} |`);
        }
        summary.push('');
    }
    if (nonImages.length > 0) {
        summary.push(`## Non-image files`, ``, `| File |`, `| --- |`);
        for (const file of nonImages) {
            summary.push(`| ${file} |`);
        }
        summary.push('');
    }
    if (missing.length > 0) {
        summary.push(`## Missing references`, ``, `| Song | Image |`, `| --- | --- |`);
        for (const item of missing) {
            summary.push(`| \`${item.songId}\` | ${item.href} |`);
        }
        summary.push('');
    }
    if (orphans.length > 0) {
        summary.push(`## Unreferenced (info)`, ``, `| Image |`, `| --- |`);
        for (const file of orphans) {
            summary.push(`| ${file} |`);
        }
        summary.push('');
    }
    appendStepSummary(summary.join('\n'));

    console.log(`\nDone. Files: ${allFiles.length}, Invalid: ${invalid.length}, Non-image: ${nonImages.length}, Missing: ${missing.length}, Unreferenced: ${orphans.length}`);

    if (invalid.length > 0 || nonImages.length > 0 || missing.length > 0) {
        process.exit(1);
    }
}

module.exports = { main };

if (require.main === module) {
    try {
        main();
    } catch (error) {
        console.error(error.message);
        process.exitCode = 1;
    }
}
