/*

Small helpers for emitting GitHub Actions workflow commands (annotations,
groups, step summary). Falls back to plain console output when not running
inside GitHub Actions.

See https://docs.github.com/en/actions/using-workflow-and-actions/workflow-commands-for-github-actions

*/

const fs = require('fs');

const IS_GHA = process.env.GITHUB_ACTIONS === 'true';

function ghaEscape(value) {
    return String(value)
        .replace(/%/g, '%25')
        .replace(/\r/g, '%0D')
        .replace(/\n/g, '%0A');
}

function formatProps(props) {
    return Object.entries(props)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => `${k}=${ghaEscape(v)}`)
        .join(',');
}

function ghaError(message, props = {}) {
    if (!IS_GHA) {
        console.error(message);
        return;
    }
    const parts = formatProps(props);
    const prefix = parts ? `::error ${parts}::` : '::error::';
    console.error(`${prefix}${ghaEscape(message)}`);
}

function ghaWarning(message, props = {}) {
    if (!IS_GHA) {
        console.warn(message);
        return;
    }
    const parts = formatProps(props);
    const prefix = parts ? `::warning ${parts}::` : '::warning::';
    console.warn(`${prefix}${ghaEscape(message)}`);
}

function ghaGroupStart(title) {
    if (IS_GHA) console.log(`::group::${ghaEscape(title)}`);
    else console.log(`\n=== ${title} ===`);
}

function ghaGroupEnd() {
    if (IS_GHA) console.log('::endgroup::');
}

function appendStepSummary(md) {
    const file = process.env.GITHUB_STEP_SUMMARY;
    if (!file) return;
    try {
        fs.appendFileSync(file, md);
    } catch (err) {
        console.error(`Failed to write GITHUB_STEP_SUMMARY: ${err.message}`);
    }
}

module.exports = {
    IS_GHA,
    ghaEscape,
    ghaError,
    ghaWarning,
    ghaGroupStart,
    ghaGroupEnd,
    appendStepSummary
};
