/*
Load file `./audio.md`.

Use `./resources.json` as output structure example/reference.

Convert input md file to `./resources.json`.

Sort output by each object parent key.

Markdown format (per render-md-audio.js spec):
- **{song.title}**
  - https://kirtan.site/{slug}/{id}.html
  - {first_line}
    - **{audio.title}**
      - {embed_url}
*/

const fs = require('node:fs/promises');
const path = require('node:path');

function buildIframeUrl(embedUrl) {
    return `https://w.soundcloud.com/player/?url=${encodeURIComponent(embedUrl)}`;
}

function parseAudioMarkdown(markdownContent) {
    const lines = markdownContent.split(/\r?\n/);
    const output = {};
    const errors = [];

    let currentSongId = null;
    let pendingSongTitle = null;
    let pendingAudioTitle = null;
    let pendingAudioTitleHasUrl = false;
    let lineNum = 0;

    for (const line of lines) {
        lineNum++;

        // Song line: - **title**
        const songLineMatch = line.match(/^- \*\*(.+)\*\*$/);
        if (songLineMatch) {
            if (pendingAudioTitle && !pendingAudioTitleHasUrl) {
                errors.push(`Line ${lineNum}: audio title "${pendingAudioTitle}" has no embed URL`);
            }
            pendingSongTitle = songLineMatch[1];
            currentSongId = null;
            pendingAudioTitle = null;
            pendingAudioTitleHasUrl = false;
            continue;
        }

        // Level-2 bullet (2 spaces): site URL or first_line
        const level2Match = line.match(/^  - (.+)$/);
        if (level2Match) {
            const value = level2Match[1];

            // Kirtan.site URL → extract song ID
            const kirtanMatch = value.match(/^https?:\/\/kirtan\.site\/[^/]+\/([^/?#]+)\.html/);
            if (kirtanMatch) {
                if (pendingAudioTitle && !pendingAudioTitleHasUrl) {
                    errors.push(`Line ${lineNum}: audio title "${pendingAudioTitle}" has no embed URL`);
                }
                currentSongId = kirtanMatch[1];
                pendingAudioTitle = null;
                pendingAudioTitleHasUrl = false;
                if (!output[currentSongId]) {
                    output[currentSongId] = {};
                }
            }
            // Plain text → first_line, skip
            continue;
        }

        // Level-4 bullet (4 spaces): audio title **bold**
        const audioTitleMatch = line.match(/^    - \*\*(.+)\*\*$/);
        if (audioTitleMatch) {
            if (pendingAudioTitle && !pendingAudioTitleHasUrl) {
                errors.push(`Line ${lineNum}: audio title "${pendingAudioTitle}" has no embed URL`);
            }
            if (!currentSongId) {
                errors.push(`Line ${lineNum}: audio title "${audioTitleMatch[1]}" found but no song ID yet (missing kirtan.site URL?)`);
                continue;
            }
            pendingAudioTitle = audioTitleMatch[1];
            pendingAudioTitleHasUrl = false;
            continue;
        }

        // Level-6 bullet (6 spaces): embed URL
        const embedMatch = line.match(/^      - (https?:\/\/\S+)$/);
        if (embedMatch) {
            const embedUrl = embedMatch[1];
            if (!pendingAudioTitle) {
                errors.push(`Line ${lineNum}: embed URL found but no preceding audio title`);
                continue;
            }
            if (!currentSongId) {
                errors.push(`Line ${lineNum}: embed URL found but no song ID`);
                continue;
            }
            if (!output[currentSongId].audio) {
                output[currentSongId].audio = [];
            }
            output[currentSongId].audio.push({
                title: pendingAudioTitle,
                embed_url: embedUrl,
                iframe_url: buildIframeUrl(embedUrl)
            });
            pendingAudioTitleHasUrl = true;
            // do NOT reset pendingAudioTitle — multiple URLs may follow same title
            continue;
        }

        // Non-indented or shallow line resets audio title context
        if (line && !line.startsWith('#') && !line.startsWith('    ')) {
            pendingAudioTitle = null;
            pendingAudioTitleHasUrl = false;
        }
    }

    if (pendingAudioTitle && !pendingAudioTitleHasUrl) {
        errors.push(`End of file: audio title "${pendingAudioTitle}" has no embed URL`);
    }

    return { output, errors };
}

async function main() {
    const projectRoot = process.cwd();
    const inputPath = path.join(projectRoot, 'audio.md');
    const outputPath = path.join(projectRoot, 'resources.json');

    const markdownContent = await fs.readFile(inputPath, 'utf8');
    const { output: parsedOutput, errors } = parseAudioMarkdown(markdownContent);

    if (errors.length > 0) {
        for (const err of errors) {
            console.error(`[format error] ${err}`);
        }
        process.exit(1);
    }

    const sortedKeys = Object.keys(parsedOutput).sort();
    const sortedOutput = {};
    for (const key of sortedKeys) sortedOutput[key] = parsedOutput[key];

    await fs.writeFile(outputPath, `${JSON.stringify(sortedOutput, null, 2)}\n`, 'utf8');

    console.log(`Created ${outputPath}`);
}

module.exports = { main };

if (require.main === module) {
    main().catch((error) => {
        console.error(error.message);
        process.exitCode = 1;
    });
}
