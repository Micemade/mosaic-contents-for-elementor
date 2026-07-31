// zip.mjs
import archiver from 'archiver';
import fs from 'fs';
import path from 'path';

const PLUGIN_SLUG = 'mosaic-contents-for-elementor';
const ROOT = path.resolve('.');
const OUT = path.resolve('..', `${PLUGIN_SLUG}.zip`);

// Files/dirs to exclude from the zip
const EXCLUDE = [
	'.agents',
	'.claude',
	'.cline',
	'.continue',
	'.cursor',
	'.github',
	'.windsurf',
	'.vscode',
	'.wordpress-org',
	'.git',
	'marketing',
	'marketing/**',
	'node_modules',
	'node_modules/**',
	'scripts',
	'scripts/**',
	'vendor',
	'vendor/**',
	'src',
	'src/**',
	'phpcs.xml.dist',
	'.eslintrc.json',
	'eslint.config.js',
	'.gitignore',
	'.pressshipignore',
	'.prettierignore',
	'.prettierrc',
	'vite.config.js',
	'docker-compose.yml',
	'zip.mjs',
	// '**/*.map',
	'**/*.md',
	'**/*.lock',
	'**/*-lock.*'
];

const output = fs.createWriteStream(OUT);
const archive = archiver('zip', { zlib: { level: 9 } });

archive.pipe(output);

archive.glob('**/*', {
	cwd: ROOT,
	ignore: EXCLUDE,
	dot: false,
}, { prefix: PLUGIN_SLUG });

archive.finalize();
output.on('close', () => console.log(`Created ${OUT} (${archive.pointer()} bytes)`));
