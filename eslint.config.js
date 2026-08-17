/**
 * ESLint flat config (ESLint 9+).
 *
 * Applies the official WordPress JavaScript coding standard via
 * @wordpress/eslint-plugin, layered with this project's React/Elementor
 * specifics. Formatting is delegated to Prettier (see .prettierrc).
 */
import wordpress from '@wordpress/eslint-plugin';
import globals from 'globals';

export default [
	// Never lint dependencies, build output or generated assets.
	// `vendor/` matters as much as `node_modules/`: Composer installs PHPCS,
	// whose test suite ships deliberately-invalid .js fixtures that otherwise
	// produce thousands of errors and bury real ones.
	// `.kilo/` holds agent tooling plus a git worktree containing a full second
	// checkout of this repo, which would otherwise be linted as duplicates.
	{
		ignores: ['node_modules/', 'vendor/', 'assets/', 'build/', '.kilo/', '**/*.min.js'],
	},

	// Official WordPress standard (already flat-config arrays).
	...wordpress.configs.recommended,

	// Project-wide adjustments.
	{
		languageOptions: {
			globals: {
				...globals.browser,
				elementor: 'readonly',
				elementorFrontend: 'readonly',
				jQuery: 'readonly',
				wp: 'readonly',
				// Build-time constant injected by vite.config.js `define`.
				// True in the editor entries, false in main-frontend, which lets
				// Rollup fold away editor-only branches in the frontend bundle.
				__MC4E_EDITOR__: 'readonly',
			},
		},
		settings: {
			react: { version: 'detect' },
		},
		rules: {
			// Formatting is owned by standalone Prettier (.prettierrc + `npm run format`),
			// not ESLint. Enforcing it here too is redundant and conflicts with the
			// project's Prettier settings, so keep ESLint focused on code quality.
			'prettier/prettier': 'off',
			// React 17+ automatic runtime; PropTypes not used in this codebase.
			'react/react-in-jsx-scope': 'off',
			'react/prop-types': 'off',
			// Allow intentional error logging; stray console.log stays flagged.
			'no-console': ['error', { allow: ['warn', 'error'] }],
			// Enforce strict comparisons but allow the `== null` (null|undefined) idiom.
			eqeqeq: ['error', 'always', { null: 'ignore' }],
			// Enforce the plugin's own text domain on i18n calls.
			'@wordpress/i18n-text-domain': [
				'error',
				{ allowedTextDomain: ['mosaic-contents-for-elementor'] },
			],
		},
	},

	// Node context for build/config scripts. These are CLI tools whose entire
	// output is stdout, so `no-console` does not apply to them.
	{
		files: ['*.config.js', '*.config.mjs', '*.mjs', 'vite.config.js', 'zip.mjs', 'scripts/**/*.mjs'],
		languageOptions: {
			globals: { ...globals.node },
		},
		rules: {
			'no-console': 'off',
		},
	},
];
