// zip.mjs
import archiver from 'archiver';
import fs from 'fs';
import path from 'path';

const PLUGIN_SLUG = 'mosaic-product-layouts-for-elementor';
const ROOT = path.resolve('.');
const OUT = path.resolve('..', `${PLUGIN_SLUG}.zip`);

// Files/dirs to exclude from the zip
const EXCLUDE = [
	'.git',
	'.github',
	'.agents',
	'.claude',
	'.clinde',
	'.continue',
	'.cursor',
	'.windsurf',
	'node_modules',
	'node_modules/**',
	'src',
	'src/**',
	'.eslintrc.json',
	'.gitignore',
	'.prettierignore',
	'.prettierrc',
	'vite.config.js',
	'package.json',
	'package-lock.json',
	'docker-compose.yml',
	'zip.mjs',
	'**/*.map',
	'**/*.md'
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
