/**
 * Bundle guard.
 *
 * Two checks, both run against the built output in assets/:
 *
 *   1. Size budgets  - gzipped byte ceilings per entry. Prevents silent growth.
 *   2. Composition   - fails if the frontend bundle contains editor-only code.
 *
 * Check 2 exists because the frontend bundle spent a long time carrying all 30
 * layout presets from assets/presets/layouts.json (~47 KB) plus the editor's
 * layout-mutation paths, and nothing noticed. It is the guard for the
 * __MC4E_EDITOR__ dead-code elimination: if a refactor re-links editor code into
 * the frontend module graph, the marker reappears and this fails.
 *
 * Usage:  node scripts/check-bundles.mjs [--update]
 *         --update rewrites the budgets below to current sizes (use when a
 *         reduction lands, never to paper over growth).
 */

import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const KB = 1024;

/**
 * Gzipped size ceilings, in KB.
 *
 * Ratchet these DOWN as optimisations land. Raising one is a deliberate act
 * that should be explained in the commit message.
 */
const BUDGETS = [
	// Frontend target once the rest of Tier 1 lands (static grid renderer,
	// native ResizeObserver) is ~25 KB. Ratchet this down as those land.
	{ file: 'assets/js/main-frontend.js', maxKB: 58 },
	{ file: 'assets/admin/js/main-editor.js', maxKB: 75 },
	{ file: 'assets/admin/js/focal-point-control.js', maxKB: 3 },
	{ file: 'assets/admin/js/saved-setups-control.js', maxKB: 4 },
	{ file: 'assets/css/main-frontend.css', maxKB: 7 },
	{ file: 'assets/admin/css/main-editor.css', maxKB: 7 },
];

/**
 * Strings that must NOT appear in the frontend bundle.
 *
 * Each is a marker for code that only ever runs inside the Elementor editor.
 * `probe` is looked up literally; minification preserves string literals and
 * property names, so these survive even though function names do not.
 */
const FRONTEND_FORBIDDEN = [
	{
		probe: 'MosaicContentsReact',
		why: 'editor-only global bridge (updateElementorSetting) reachable from the frontend graph',
	},
	{
		probe: 'mosaic:addItem',
		why: 'editor-only channel event; indicates layoutEditing/addItem is linked in',
	},
];

/**
 * Layout preset ids are read from the catalog itself rather than hardcoded, so
 * the check keeps working when presets are added.
 */
const readPresetIds = () => {
	const presetPath = path.join(ROOT, 'assets/presets/layouts.json');
	if (!fs.existsSync(presetPath)) {
		return [];
	}
	try {
		const presets = JSON.parse(fs.readFileSync(presetPath, 'utf8'));
		return Array.isArray(presets) ? presets.map((p) => p?.id).filter(Boolean) : [];
	} catch {
		return [];
	}
};

const gzipKB = (absPath) =>
	zlib.gzipSync(fs.readFileSync(absPath), { level: 9 }).length / KB;

const rawKB = (absPath) => fs.statSync(absPath).size / KB;

const fmt = (n) => `${n.toFixed(1)} KB`;

const failures = [];
const rows = [];

// ── 1. Size budgets ────────────────────────────────────────────────────────
for (const { file, maxKB } of BUDGETS) {
	const abs = path.join(ROOT, file);

	if (!fs.existsSync(abs)) {
		failures.push(`missing build artifact: ${file} (run \`npm run build:prod\` first)`);
		continue;
	}

	const gz = gzipKB(abs);
	const over = gz > maxKB;
	rows.push({
		file,
		raw: fmt(rawKB(abs)),
		gz: fmt(gz),
		budget: `${maxKB} KB`,
		status: over ? 'OVER' : 'ok',
	});

	if (over) {
		failures.push(
			`${file} is ${fmt(gz)} gzipped, over its ${maxKB} KB budget by ${fmt(gz - maxKB)}`
		);
	}
}

// ── 2. Frontend composition ────────────────────────────────────────────────
const frontendPath = path.join(ROOT, 'assets/js/main-frontend.js');

if (fs.existsSync(frontendPath)) {
	const frontend = fs.readFileSync(frontendPath, 'utf8');

	for (const { probe, why } of FRONTEND_FORBIDDEN) {
		if (frontend.includes(probe)) {
			failures.push(`main-frontend.js contains "${probe}" — ${why}`);
		}
	}

	const presetIds = readPresetIds();
	const leaked = presetIds.filter((id) => frontend.includes(`"${id}"`));

	// 'default' is too generic a string to attribute to the preset catalog, so
	// only flag when several ids are present together.
	const meaningful = leaked.filter((id) => id !== 'default');
	if (meaningful.length > 2) {
		failures.push(
			`main-frontend.js contains ${meaningful.length}/${presetIds.length} layout preset ids ` +
				`(${meaningful.slice(0, 3).join(', ')}…) — the preset catalog is being inlined; ` +
				`the frontend should read the PHP-resolved mc4e_resolved_layout instead`
		);
	}
}

// ── Report ─────────────────────────────────────────────────────────────────
if (rows.length) {
	console.table(rows);
}

if (process.argv.includes('--update')) {
	console.log('\n--update: suggested budgets (round up ~10%):');
	for (const { file } of BUDGETS) {
		const abs = path.join(ROOT, file);
		if (fs.existsSync(abs)) {
			console.log(`  { file: '${file}', maxKB: ${Math.ceil(gzipKB(abs) * 1.1)} },`);
		}
	}
	process.exit(0);
}

if (failures.length) {
	console.error('\nBundle check FAILED:\n');
	failures.forEach((f) => console.error(`  ✗ ${f}`));
	console.error('');
	process.exit(1);
}

console.log('\nBundle check passed.\n');
