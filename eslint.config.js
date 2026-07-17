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
	{
		ignores: ['node_modules/', 'assets/', 'build/', '**/*.min.js'],
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

	// Node context for build/config scripts.
	{
		files: ['*.config.js', '*.config.mjs', '*.mjs', 'vite.config.js', 'zip.mjs'],
		languageOptions: {
			globals: { ...globals.node },
		},
	},
];
