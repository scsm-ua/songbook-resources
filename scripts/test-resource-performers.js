/*

Read `resources.json`, `<key>.audio[].title` values. That is audio performers.

Read `persons.json`, `[].id` values. That is available audio performers name.

This script will word in github action to test data. So if `resources.json` contains non existing person in `persons.json`, there should be error to fail test action check.

*/

const path = require('path');
const fs = require('fs');

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
                errors.push(`Unknown performer "${audio.title}" in resource "${key}"`);
            }
        }
    }

    if (errors.length > 0) {
        errors.forEach(e => console.error(e));
        process.exit(1);
    } else {
        console.log('All audio performers are valid.');
    }
}

module.exports = { main };

if (require.main === module) {
    main();
}
