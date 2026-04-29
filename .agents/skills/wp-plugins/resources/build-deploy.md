# Build & Deploy

## Composer for Dependencies

```bash
# Production install (no dev dependencies).
composer install --no-dev --optimize-autoloader
```

## JavaScript / CSS Build

```bash
# Build with @wordpress/scripts.
npx wp-scripts build

# Development watch mode.
npx wp-scripts start
```

## .distignore

Exclude dev files: `/.git`, `/.github`, `/node_modules`, `/tests`, `/.distignore`,
`/.editorconfig`, `/.gitignore`, `/phpcs.xml`, `/phpstan.neon`,
`/phpstan-baseline.neon`, `/phpunit.xml`, `/composer.json`, `/composer.lock`,
`/package.json`, `/package-lock.json`, `/webpack.config.js`.

## Version Bumping

Update in: plugin header (`Version:`), plugin constant (`MAP_VERSION`),
`readme.txt` (`Stable tag:`), and `package.json`.

## WordPress.org SVN Deployment

```bash
svn checkout https://plugins.svn.wordpress.org/my-awesome-plugin svn-repo
rsync -av --delete --exclude-from=.distignore ./ svn-repo/trunk/
cd svn-repo && svn add --force trunk/ && svn cp trunk tags/1.0.0
svn ci -m "Release 1.0.0"
```

## GitHub Auto-Updates (Plugin Update Checker)

For plugins distributed outside WordPress.org, use
[YahnisElsts/plugin-update-checker](https://github.com/YahnisElsts/plugin-update-checker):

```php
require_once __DIR__ . '/vendor/yahnis-elsts/plugin-update-checker/plugin-update-checker.php';
use YahnisElsts\PluginUpdateChecker\v5\PucFactory;

$update_checker = PucFactory::buildUpdateChecker(
    'https://github.com/your-org/your-plugin/',
    __FILE__,
    'your-plugin-slug'
);
// Optional: set the branch for stable releases.
$update_checker->setBranch( 'main' );
// Optional: use release assets instead of source ZIP.
$update_checker->getVcsApi()->enableReleaseAssets();
```

Create GitHub releases with a ZIP asset for each version. The checker polls
GitHub's API and surfaces updates through WordPress's native update UI.

**GitHub Actions release workflow:**

```yaml
# .github/workflows/release.yml
on:
  push:
    tags: ['v*']
jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: composer install --no-dev --optimize-autoloader
      - run: npx wp-scripts build  # if JS/CSS build needed
      - name: Create release ZIP
        run: |
          mkdir -p dist
          rsync -av --exclude-from=.distignore ./ dist/your-plugin/
          cd dist && zip -r ../your-plugin.zip your-plugin/
      - uses: softprops/action-gh-release@v2
        with:
          files: your-plugin.zip
```
