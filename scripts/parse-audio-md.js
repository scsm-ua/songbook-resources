/*
Load file `./audio.md`.

Use `./resources.json` as output structure example/reference.

Convert input md file to `./resources-parsed-from-md.json`.

Sort output by each object parent key.
*/

const fs = require('node:fs/promises');
const path = require('node:path');

function getSongIdFromSongLine(line) {
	const match = line.match(/^- \[[^\]]*\]\([^)]*\/([^/?#)]+)\.html\)/);
	return match ? match[1] : null;
}

function buildIframeUrl(embedUrl) {
	return `https://w.soundcloud.com/player/?url=${encodeURIComponent(embedUrl)}`;
}

function parseAudioMarkdown(markdownContent) {
	const lines = markdownContent.split(/\r?\n/);
	const output = {};

	let currentSongId = null;
	let pendingAudioTitle = null;

	for (const line of lines) {
		const songId = getSongIdFromSongLine(line);
		if (songId) {
			currentSongId = songId;
			pendingAudioTitle = null;

			if (!output[currentSongId]) {
				output[currentSongId] = {};
			}

			continue;
		}

		if (!currentSongId) {
			continue;
		}

		const audioTitleMatch = line.match(/^  - (.+)$/);
		if (audioTitleMatch) {
			pendingAudioTitle = audioTitleMatch[1].trim();
			continue;
		}

		const audioUrlMatch = line.match(/^    - (https?:\/\/\S+)$/);
		if (audioUrlMatch && pendingAudioTitle) {
			const embedUrl = audioUrlMatch[1].trim();

			if (!output[currentSongId].audio) {
				output[currentSongId].audio = [];
			}

			output[currentSongId].audio.push({
				title: pendingAudioTitle,
				embed_url: embedUrl,
				iframe_url: buildIframeUrl(embedUrl)
			});

			continue;
		}

		if (!line.startsWith('    ')) {
			pendingAudioTitle = null;
		}
	}

	return output;
}

async function main() {
	const projectRoot = process.cwd();
	const inputPath = path.join(projectRoot, 'audio.md');
	const outputPath = path.join(projectRoot, 'resources-parsed-from-md.json');

	const markdownContent = await fs.readFile(inputPath, 'utf8');
	const parsedOutput = parseAudioMarkdown(markdownContent);
	const sortedKeys = Object.keys(parsedOutput).sort();
	const sortedOutput = {};
	for (const key of sortedKeys) sortedOutput[key] = parsedOutput[key];

	await fs.writeFile(outputPath, `${JSON.stringify(sortedOutput, null, 2)}\n`, 'utf8');

	console.log(`Created ${outputPath}`);
}

main().catch((error) => {
	console.error(error.message);
	process.exitCode = 1;
});
