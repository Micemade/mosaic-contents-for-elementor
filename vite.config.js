import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(
	{
		plugins: [react()],
		build: {
			rollupOptions: {
				input: path.resolve( __dirname, 'src/main.jsx' ),
				// Externalize React and ReactDOM to use WordPress's versions
				external: ['react', 'react-dom'],
				output: {
					format: 'iife',
					entryFileNames: 'js/[name].js',
					chunkFileNames: 'js/[name].js',
					assetFileNames: (assetInfo) => {
						if (assetInfo.name.endsWith( '.css' )) {
							return 'css/[name][extname]';
						}
						// Images go to images directory
						if (/\.(png|jpe?g|svg|gif|webp|ico)$/i.test(assetInfo.name)) {
							return 'images/[name][extname]';
						}
						return 'assets/[name][extname]';
					},
					// Map externalized modules to WordPress globals
					globals: {
						'react': 'React',
						'react-dom': 'ReactDOM'
					},
				},
			},
			outDir: 'assets',
			cssCodeSplit: false,
		},
		resolve: {
			alias: {
				'@': path.resolve( __dirname, 'src' ),
			},
		},
	}
);
