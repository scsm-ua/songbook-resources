/*

Read `resources.json`, `<key>.audio[].title` values. That is audio performers.

Read `persons.json`, `[].id` values. That is available audio performers name.

This script will word in github action to test data. So if `resources.json` contains non existing person in `persons.json`, there should be error to fail test action check.

Output is formatted for GitHub Actions:
  - unknown performers are reported through the `::error::` workflow command so
    they appear as annotations on the run,
  - a summary is appended to `$GITHUB_STEP_SUMMARY` when the file is defined.

Exit code is `1` when any resource references an unknown performer.

*/

const path = require('path');
const fs = require('fs');

const { ghaError, appendStepSummary } = require('./gha');

function main() {
    const resourcesPath = path.join(__dirname, '..', 'resources.json');
    const personsPath = path.join(__dirname, '..', 'persons.json');

    const resources = JSON.parse(fs.readFileSync(resourcesPath, 'utf-8'));
    const persons = JSON.parse(fs.readFileSync(personsPath, 'utf-8'));

    const personIds = new Set(persons.map(p => p.id));

    const errors = [];

    for (const [key, value] of Object.entries(resources)) {
        if (!value.audio) continue;
        for (const audio of value.audio) {
            if (!personIds.has(audio.title)) {
                errors.push({ songId: key, title: audio.title, embedUrl: audio.embed_url });
            }
        }
    }

    if (errors.length > 0) {
        for (const e of errors) {
            ghaError(
                `Unknown performer "${e.title}" in resource "${e.songId}"`,
                { file: 'resources.json', title: `Unknown performer: ${e.title}` }
            );
        }

        const summary = [
            `# Resource performers check`,
            ``,
            `- Unknown performers: **${errors.length}**`,
            ``,
            `## Failures`,
            ``,
            `| Song | Performer | URL |`,
            `| --- | --- | --- |`,
            ...errors.map(e => `| \`${e.songId}\` | ${e.title} | ${e.embedUrl || ''} |`),
            ``
        ].join('\n');
        appendStepSummary(summary);

        console.error(`\n${errors.length} unknown performer reference(s) found.`);
        process.exit(1);
    } else {
        console.log('All audio performers are valid.');
    }
}

module.exports = { main };

if (require.main === module) {
    main();
}
