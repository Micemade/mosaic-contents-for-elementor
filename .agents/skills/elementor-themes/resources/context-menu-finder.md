# Finder & Context Menu — Code Examples

### Finder: Social Media Links Category

Complete Finder category implementation with static items.

```php
class Elementor_Finder_Social_Media extends \Elementor\Core\Common\Modules\Finder\Base_Category {
    public function get_id(): string { return 'social-media'; }
    public function get_title(): string { return esc_html__( 'Social Media', 'textdomain' ); }

    public function get_category_items( array $options = [] ): array {
        return [
            'facebook' => [
                'title' => esc_html__( 'Facebook', 'textdomain' ),
                'icon' => 'facebook',
                'url' => 'https://facebook.com/',
                'keywords' => [ 'facebook', 'social', 'media' ],
            ],
            'twitter' => [
                'title' => esc_html__( 'Twitter', 'textdomain' ),
                'icon' => 'twitter',
                'url' => 'https://twitter.com/',
                'keywords' => [ 'twitter', 'social', 'media' ],
            ],
        ];
    }
}
```
