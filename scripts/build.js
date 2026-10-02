const fs = require('node:fs/promises');
const path = require('node:path');
const { imageSize } = require('image-size');
const { build: buildAudio } = require('./parse-audio-md');
const { build: buildImages } = require('./parse-images-md');

const MIME_BY_TYPE = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    bmp: 'image/bmp',
    tif: 'image/tiff',
    tiff: 'image/tiff',
    avif: 'image/avif'
};

const IMAGES_DIR = 'images';
const IMAGE_EXTS = new Set(Object.keys(MIME_BY_TYPE).map((ext) => `.${ext}`));

async function buildImageObject(imagePath) {
    const buffer = await fs.readFile(path.join(process.cwd(), imagePath));
    const { width, height, type } = imageSize(buffer);
    return {
        href: imagePath,
        type: MIME_BY_TYPE[type] || `image/${type}`,
        width,
        height,
        length: buffer.length
    };
}

async function collectImageFiles(dir) {
    const absDir = path.join(process.cwd(), dir);
    let entries;
    try {
        entries = await fs.readdir(absDir, { recursive: true, withFileTypes: true });
    } catch {
        return [];
    }
    const files = [];
    for (const entry of entries) {
        if (!entry.isFile()) continue;
        if (!IMAGE_EXTS.has(path.extname(entry.name).toLowerCase())) continue;
        const parent = entry.parentPath || entry.path || absDir;
        const rel = path.relative(process.cwd(), path.join(parent, entry.name));
        files.push(rel.split(path.sep).join('/'));
    }
    return files.sort();
}

async function main() {
    const outputPath = path.join(process.cwd(), 'resources.json');

    const resources = await buildAudio();
    const images = await buildImages();

    const referenced = new Set();
    for (const [id, imagePath] of Object.entries(images)) {
        const existing = resources[id] || {};
        resources[id] = { image: await buildImageObject(imagePath), ...existing };
        referenced.add(imagePath.split(path.sep).join('/'));
    }

    const sortedKeys = Object.keys(resources).sort();
    const sortedResources = {};
    for (const key of sortedKeys) sortedResources[key] = resources[key];

    const unusedImages = [];
    for (const file of await collectImageFiles(IMAGES_DIR)) {
        if (referenced.has(file)) continue;
        unusedImages.push(await buildImageObject(file));
    }
    sortedResources.images = unusedImages;

    await fs.writeFile(outputPath, `${JSON.stringify(sortedResources, null, 2)}\n`, 'utf8');

    console.log(`Created ${outputPath}`);
}

module.exports = { main };

if (require.main === module) {
    main().catch((error) => {
        console.error(error.message);
        process.exitCode = 1;
    });
}
