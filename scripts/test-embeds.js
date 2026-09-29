/*

Read `resources.json`, iterate over every `<key>.audio[].embed_url` and verify
that the audio embed is still available.

For SoundCloud URLs the availability is checked via the public oEmbed endpoint
(`https://soundcloud.com/oembed?format=json&url=<embed_url>`), which returns
200 when the track exists and 4xx when it was removed or made private.

Output is formatted for GitHub Actions:
  - progress lines go to stdout,
  - broken embeds are reported through the `::error::` workflow command so they
    appear as annotations on the run,
  - grouped logs use `::group::` / `::endgroup::`,
  - a summary is appended to `$GITHUB_STEP_SUMMARY` when the file is defined.

Exit code is `1` if any embed is unreachable.

Usage:
    node scripts/test-embeds.js

Environment overrides:
    EMBED_CHECK_CONCURRENCY  parallel request count (default 8)
    EMBED_CHECK_TIMEOUT_MS   per-request timeout in ms (default 15000)
    EMBED_CHECK_RETRIES      retry count for network errors / 5xx (default 2)

*/

const path = require('path');
const fs = require('fs');

const { ghaError, ghaGroupStart, ghaGroupEnd, appendStepSummary } = require('./gha');

function readIntEnv(name, defaultValue, min) {
    const raw = process.env[name];
    if (raw === undefined || raw === '') return defaultValue;
    const n = Number(raw);
    if (!Number.isFinite(n)) return defaultValue;
    return Math.max(min, Math.trunc(n));
}

const CONCURRENCY = readIntEnv('EMBED_CHECK_CONCURRENCY', 8, 1);
const TIMEOUT_MS = readIntEnv('EMBED_CHECK_TIMEOUT_MS', 15000, 1000);
const RETRIES = readIntEnv('EMBED_CHECK_RETRIES', 2, 0);

function describeFailure(result) {
    if (result.error) return result.error;
    if (result.status) return `HTTP ${result.status}`;
    return 'no response';
}

/**
 * Build a HEAD/GET check URL for a given embed URL.
 * Currently supports SoundCloud through oEmbed. Unknown providers fall back
 * to a direct HEAD request to the embed URL itself.
 */
function buildCheckRequest(embedUrl) {
    let host;
    try {
        host = new URL(embedUrl).hostname.toLowerCase();
    } catch {
        return null;
    }

    if (host === 'soundcloud.com' || host.endsWith('.soundcloud.com')) {
        return {
            provider: 'soundcloud',
            method: 'GET',
            url: `https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(embedUrl)}`
        };
    }

    return {
        provider: host,
        method: 'HEAD',
        url: embedUrl
    };
}

async function fetchOnce(req) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
        const res = await fetch(req.url, {
            method: req.method,
            redirect: 'follow',
            signal: controller.signal,
            headers: { 'user-agent': 'songbook-resources-embed-check/1.0' }
        });
        return { ok: res.ok, status: res.status };
    } catch (err) {
        return { ok: false, status: 0, error: err.name === 'AbortError' ? `timeout after ${TIMEOUT_MS}ms` : err.message };
    } finally {
        clearTimeout(timer);
    }
}

async function checkEmbed(embedUrl) {
    const req = buildCheckRequest(embedUrl);
    if (!req) return { ok: false, status: 0, error: 'invalid URL' };

    let last = null;
    for (let attempt = 0; attempt <= RETRIES; attempt++) {
        last = await fetchOnce(req);
        // Retry only on network failure or 5xx / 429.
        const retryable = !last.ok && (last.status === 0 || last.status >= 500 || last.status === 429);
        if (!retryable) return { ...last, provider: req.provider };
        if (attempt < RETRIES) {
            const delay = 500 * Math.pow(2, attempt);
            await new Promise((r) => setTimeout(r, delay));
        }
    }
    return { ...last, provider: req.provider };
}

function collectEmbeds(resources) {
    const items = [];
    for (const [songId, data] of Object.entries(resources)) {
        if (!data || !Array.isArray(data.audio)) continue;
        data.audio.forEach((audio, index) => {
            if (!audio || !audio.embed_url) return;
            items.push({
                songId,
                index,
                title: audio.title,
                embedUrl: audio.embed_url
            });
        });
    }
    return items;
}

async function runWithConcurrency(items, worker) {
    const results = new Array(items.length);
    let cursor = 0;
    let done = 0;
    const total = items.length;

    async function next() {
        while (true) {
            const i = cursor++;
            if (i >= items.length) return;
            results[i] = await worker(items[i], i);
            done++;
            if (done % 25 === 0 || done === total) {
                console.log(`... checked ${done}/${total}`);
            }
        }
    }

    const runners = Array.from({ length: Math.min(CONCURRENCY, items.length) }, next);
    await Promise.all(runners);
    return results;
}

async function main() {
    const resourcesPath = path.join(__dirname, '..', 'resources.json');
    const resources = JSON.parse(fs.readFileSync(resourcesPath, 'utf-8'));
    const items = collectEmbeds(resources);

    console.log(`Checking ${items.length} embed URL(s) with concurrency=${CONCURRENCY}, timeout=${TIMEOUT_MS}ms, retries=${RETRIES}`);

    const results = await runWithConcurrency(items, async (item) => {
        const result = await checkEmbed(item.embedUrl);
        return { item, result };
    });

    const failures = results.filter(({ result }) => !result.ok);
    const successes = results.length - failures.length;

    ghaGroupStart('Embed check details');
    for (const { item, result } of results) {
        const status = result.ok ? 'OK ' : 'FAIL';
        const code = result.status || '---';
        console.log(`  [${status}] ${code} ${item.songId} :: ${item.title} -> ${item.embedUrl}`);
    }
    ghaGroupEnd();

    if (failures.length > 0) {
        ghaGroupStart(`Broken embeds (${failures.length})`);
        for (const { item, result } of failures) {
            const detail = describeFailure(result);
            const message = `Unreachable embed for "${item.songId}" [${item.title}] (${detail}): ${item.embedUrl}`;
            ghaError(message, {
                file: 'resources.json',
                title: `Broken embed: ${item.songId}`
            });
        }
        ghaGroupEnd();
    }

    const summary = [
        `# Embed availability check`,
        ``,
        `- Checked: **${results.length}**`,
        `- OK: **${successes}**`,
        `- Failed: **${failures.length}**`,
        ``
    ];
    if (failures.length > 0) {
        summary.push(`## Failures`, ``, `| Song | Performer | Status | URL |`, `| --- | --- | --- | --- |`);
        for (const { item, result } of failures) {
            const status = describeFailure(result);
            summary.push(`| \`${item.songId}\` | ${item.title} | ${status} | ${item.embedUrl} |`);
        }
        summary.push('');
    }
    appendStepSummary(summary.join('\n'));

    console.log(`\nDone. OK: ${successes}, Failed: ${failures.length}, Total: ${results.length}`);

    if (failures.length > 0) {
        process.exit(1);
    }
}

module.exports = { main };

if (require.main === module) {
    main().catch((error) => {
        ghaError(`Unexpected error: ${error.stack || error.message}`);
        process.exitCode = 1;
    });
}
