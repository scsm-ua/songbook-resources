/*
Load file `./images.md`.

Return a map of `<id>: image_path` for build.js to merge into resources.json.

Markdown format:
- **{person.title}**
  - https://kirtan.site/{slug}/{id}
    - ![]({image_path})
*/

const fs = require('node:fs/promises');
const path = require('node:path');

function parseImagesMarkdown(markdownContent) {
    const lines = markdownContent.split(/\r?\n/);
    const output = {};
    const errors = [];

    let currentId = null;
    let pendingTitle = null;
    let lineNum = 0;

    for (const line of lines) {
        lineNum++;

        // Title line: - **title**
        const titleMatch = line.match(/^- \*\*(.+)\*\*$/);
        if (titleMatch) {
            pendingTitle = titleMatch[1];
            currentId = null;
            continue;
        }

        // Level-2 bullet (2 spaces): kirtan.site URL → extract ID
        const level2Match = line.match(/^  - (.+)$/);
        if (level2Match) {
            const value = level2Match[1];
            const kirtanMatch = value.match(/^https?:\/\/kirtan\.site\/[^/]+\/([^/?#]+?)(?:\.html)?$/);
            if (kirtanMatch) {
                currentId = kirtanMatch[1];
            } else {
                errors.push(`Line ${lineNum}: expected kirtan.site URL but got "${value}"`);
            }
            continue;
        }

        // Level-4 bullet (4 spaces): image ![](path)
        const imageMatch = line.match(/^    - !\[\]\((.+)\)$/);
        if (imageMatch) {
            const imagePath = imageMatch[1];
            if (!currentId) {
                errors.push(`Line ${lineNum}: image "${imagePath}" found but no song ID yet (missing kirtan.site URL?)`);
                continue;
            }
            if (output[currentId]) {
                errors.push(`Line ${lineNum}: duplicate image for ID "${currentId}"`);
                continue;
            }
            output[currentId] = imagePath;
            continue;
        }
    }

    void pendingTitle;

    return { output, errors };
}

async function build() {
    const inputPath = path.join(process.cwd(), 'images.md');
    const markdownContent = await fs.readFile(inputPath, 'utf8');
    const { output, errors } = parseImagesMarkdown(markdownContent);

    if (errors.length > 0) {
        for (const err of errors) {
            console.error(`[format error] ${err}`);
        }
        throw new Error(`images.md: ${errors.length} format error(s)`);
    }

    return output;
}

module.exports = { build, parseImagesMarkdown };

if (require.main === module) {
    build()
        .then((output) => console.log(JSON.stringify(output, null, 2)))
        .catch((error) => {
            console.error(error.message);
            process.exitCode = 1;
        });
}
