const { main: parseAudioMd } = require('./parse-audio-md');
const { main: testResourcePerformers } = require('./test-resource-performers');

async function main() {
    await parseAudioMd();
    testResourcePerformers();
}

module.exports = { main };

if (require.main === module) {
    main().catch((error) => {
        console.error(error.message);
        process.exitCode = 1;
    });
}
