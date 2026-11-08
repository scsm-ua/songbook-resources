const fs = require('node:fs/promises');
const path = require('node:path');

function slugify(value) {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

async function main() {
    const personsPath = path.join(__dirname, '..', 'persons.json');
    const persons = JSON.parse(await fs.readFile(personsPath, 'utf8'));

    const updatedPersons = persons.map(({ id, slug, ...attributes }) => ({
        id,
        slug: slug === undefined ? slugify(id) : slug,
        ...attributes,
    }));

    await fs.writeFile(personsPath, `${JSON.stringify(updatedPersons, null, 2)}\n`);
    console.log(`Updated slugs for ${persons.length} persons.`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
