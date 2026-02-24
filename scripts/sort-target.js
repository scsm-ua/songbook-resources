/*

Read `./resources.json` sort keys and write to `./resources-sorted.json`.

*/

const fs = require('node:fs/promises');
const path = require('node:path');

async function main() {
	const root = process.cwd();
	const inputPath = path.join(root, 'resources.json');
	const outputPath = path.join(root, 'resources-sorted.json');

	const data = JSON.parse(await fs.readFile(inputPath, 'utf8'));
	const sorted = {};
	for (const key of Object.keys(data).sort()) sorted[key] = data[key];

	await fs.writeFile(outputPath, `${JSON.stringify(sorted, null, 2)}\n`, 'utf8');
	console.log(`Created ${outputPath}`);
}

main().catch((error) => {
	console.error(error.message);
	process.exitCode = 1;
});
