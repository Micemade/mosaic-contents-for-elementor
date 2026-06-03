import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Base configuration shared between builds
const baseConfig = {
	plugins: [react()],
	resolve: {
		alias: {
			'@': path.resolve(__dirname, 'src'),
		},
	},
};

// Get the entry from environment variable or default to 'main'
const entry = process.env.BUILD_ENTRY || 'main';

// Check if --watch flag is present (used by npm run watch)
const isWatch = process.argv.includes('--watch');

// Check if sourcemaps should be generated (default: true, set SOURCEMAP=false to disable)
const generateSourcemap = process.env.SOURCEMAP !== 'false';

// Entry configurations
const entries = {
	// Frontend-only entry (lightweight, for published pages)
	'main-frontend': {
		input: path.resolve(__dirname, 'src/main-frontend.jsx'),
		outDir: 'assets',
	},
	// Editor entry (full functionality, for Elementor editor preview)
	'main-editor': {
		input: path.resolve(__dirname, 'src/main-editor.jsx'),
		outDir: 'assets/admin',
	},
	// Focal point control (editor panel only)
	'focal-point-control': {
		input: path.resolve(__dirname, 'src/controls/focal-point-control.jsx'),
		outDir: 'assets/admin',
	},
	// Saved setups control (editor panel only)
	'saved-setups-control': {
		input: path.resolve(__dirname, 'src/controls/saved-setups-control.jsx'),
		outDir: 'assets/admin',
	},
	// Post type select control (editor panel only)
	'PostTypeSelectControl': {
		input: path.resolve(__dirname, 'src/controls/PostTypeSelectControl.jsx'),
		outDir: 'assets/admin',
	},
};

const currentEntry = entries[entry];

export default defineConfig({
	...baseConfig,
	build: {
		watch: isWatch ? {
			include: ['src/**/*.{js,ts,jsx,tsx,scss}'],
		} : undefined,
		rollupOptions: {
			input: currentEntry.input,
			// Externalize React, ReactDOM, and WP globals used by controls
			external: ['react', 'react-dom', '@wordpress/api-fetch', '@wordpress/i18n'],
			output: {
				format: 'iife',
				entryFileNames: `js/${entry}.js`,
				chunkFileNames: 'js/[name].js',
				assetFileNames: (assetInfo) => {
					if (assetInfo.name.endsWith('.css')) {
						return `css/${entry === 'main' ? 'style' : entry}.css`;
					}
					// Images go to images directory
					if (/\.(png|jpe?g|svg|gif|webp|ico)$/i.test(assetInfo.name)) {
						return 'images/[name][extname]';
					}
					return 'assets/[name][extname]';
				},
				// Map externalized modules to WordPress globals
				globals: {
					react: 'React',
					'react-dom': 'ReactDOM',
					'@wordpress/api-fetch': 'wp.apiFetch',
					'@wordpress/i18n': 'wp.i18n',
				},
			},
		},
		sourcemap: generateSourcemap,
		outDir: currentEntry.outDir,
		emptyOutDir: false, // Never empty - prevents deleting other entry's output
		cssCodeSplit: false,
	},
});
