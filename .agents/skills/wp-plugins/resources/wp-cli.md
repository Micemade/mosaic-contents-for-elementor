# WP-CLI Integration & Operations Reference

## Custom Commands

### Registering Custom Commands

```php
namespace MyAwesomePlugin\CLI;

use WP_CLI;
use WP_CLI\Utils;

class Commands {
    public static function register(): void {
        WP_CLI::add_command( 'my-plugin sync', [ self::class, 'sync' ] );
        WP_CLI::add_command( 'my-plugin cleanup', [ self::class, 'cleanup' ] );
    }

    /**
     * Sync data from external API.
     *
     * ## OPTIONS
     * [--dry-run]  : Preview changes without writing.
     * [--limit=<n>]: Max items to sync. Default 100.
     *
     * ## EXAMPLES
     *     wp my-plugin sync --dry-run
     *     wp my-plugin sync --limit=50
     */
    public static function sync( array $args, array $assoc_args ): void {
        $dry_run = Utils\get_flag_value( $assoc_args, 'dry-run', false );
        $limit   = (int) Utils\get_flag_value( $assoc_args, 'limit', 100 );

        $items    = map_fetch_items( $limit );
        $progress = Utils\make_progress_bar( 'Syncing', count( $items ) );

        foreach ( $items as $item ) {
            if ( ! $dry_run ) {
                map_process_item( $item );
            }
            $progress->tick();
        }
        $progress->finish();
        WP_CLI::success( sprintf( 'Processed %d items.', count( $items ) ) );
    }

    /**
     * Clean up stale data.
     * ## OPTIONS
     * [--yes]: Skip confirmation prompt.
     */
    public static function cleanup( array $args, array $assoc_args ): void {
        WP_CLI::confirm( 'Delete all stale records?', $assoc_args );
        global $wpdb;
        $deleted = $wpdb->query(
            "DELETE FROM {$wpdb->prefix}map_logs
             WHERE created_at < DATE_SUB(NOW(), INTERVAL 90 DAY)"
        );
        WP_CLI::success( sprintf( 'Deleted %d stale records.', $deleted ) );
    }
}
```

### wp-cli.yml

```yaml
path: /var/www/html
url: https://example.com
apache_modules: [mod_rewrite]
@staging:
  url: https://staging.example.com
```

---

## WP-CLI Operations Reference

### Search-Replace (Always Dry-Run First)

```bash
# 1. Backup.
wp db export backup.sql

# 2. Dry run — review impact.
wp search-replace 'http://old.example.com' 'https://new.example.com' --dry-run

# 3. Run for real (include non-core tables if needed).
wp search-replace 'http://old.example.com' 'https://new.example.com' \
    --all-tables-with-prefix --report-changed-only

# 4. Flush caches and rewrites.
wp cache flush
wp rewrite flush
```

Useful flags: `--dry-run`, `--precise`, `--skip-columns=guid`,
`--report-changed-only`, `--all-tables-with-prefix`.

### Other Common Operations

```bash
# Database.
wp db export backup.sql       # Backup.
wp db import backup.sql       # Restore (overwrites).
wp db optimize                # Optimize tables.

# Plugins / themes.
wp plugin list                # List with status.
wp plugin install <slug>      # Install.
wp plugin activate <slug>     # Activate.
wp plugin update --all        # Update all (avoid on prod without window).
wp theme activate <slug>

# Cron.
wp cron event list            # Show scheduled events.
wp cron event run <hook>      # Run specific event.

# Cache.
wp cache flush                # Flush object cache.
wp transient delete --all     # Delete all transients.
wp rewrite flush              # Regenerate rewrite rules.

# Multisite.
wp site list
wp option get siteurl --url=sub.example.com
wp plugin activate my-plugin --network       # Network-wide.
# Iterate: for URL in $(wp site list --field=url); do wp <cmd> --url="$URL"; done
```
