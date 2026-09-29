const { main: parseAudioMd } = require('./parse-audio-md');

async function main() {
    await parseAudioMd();
}

module.exports = { main };

if (require.main === module) {
    main().catch((error) => {
        console.error(error.message);
        process.exitCode = 1;
    });
}
