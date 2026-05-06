# Security Analysis Report: Mosaic Contents for Elementor

**Date**: May 5, 2026  
**Plugin Version**: 0.1.0  
**Analysis Status**: Complete

---

## Executive Summary

This security analysis identified **3 critical vulnerabilities**, **2 high-severity issues**, and **4 medium-severity concerns** that require immediate attention before production deployment.

### Risk Assessment
- 🔴 **Critical Issues**: 3
- 🟠 **High Issues**: 2
- 🟡 **Medium Issues**: 4
- 🟢 **Low Issues**: 2

---

## Critical Vulnerabilities

### 1. **Unauthenticated REST API Endpoints - Post Types, Taxonomy Terms, and Post Meta**

**Severity**: 🔴 CRITICAL  
**File**: [includes/class-rest-api.php](includes/class-rest-api.php)  
**Lines**: 73, 103, 108  

#### Issue
Three REST API endpoints use `'permission_callback' => '__return_true'`, allowing **unauthenticated access** to potentially sensitive site structure and metadata:

```php
// POST TYPES ENDPOINT - Line 73
register_rest_route(
    self::NAMESPACE,
    '/post-types',
    array(
        'methods'             => 'GET',
        'callback'            => array( $this, 'get_post_types' ),
        'permission_callback' => '__return_true',  // ❌ CRITICAL
    )
);

// TAXONOMY TERMS ENDPOINT - Line 103  
register_rest_route(
    self::NAMESPACE,
    '/taxonomy-terms',
    array(
        'methods'             => 'GET',
        'callback'            => array( $this, 'get_taxonomy_terms' ),
        'permission_callback' => '__return_true',  // ❌ CRITICAL
    )
);

// POST META ENDPOINT - Line 108
register_rest_route(
    self::NAMESPACE,
    '/post-meta',
    array(
        'methods'             => 'GET',
        'callback'            => array( $this, 'get_post_meta_values' ),
        'permission_callback' => '__return_true',  // ❌ CRITICAL
    )
);
```

#### Impact
- **Information Disclosure**: Attackers can enumerate all post types, taxonomies, and terms without authentication
- **Post Meta Leakage**: Unauthenticated users can retrieve arbitrary post metadata, potentially exposing:
  - Custom fields with sensitive data
  - Internal configuration stored as meta
  - Product pricing or internal notes
- **Site Fingerprinting**: Complete site structure becomes visible to unauthenticated visitors

#### Recommendation
**MUST FIX BEFORE PRODUCTION**

Replace `'permission_callback' => '__return_true'` with:

```php
'permission_callback' => array( $this, 'check_permission' ),
```

The existing `check_permission()` method properly validates `current_user_can( 'edit_posts' )`.

---

### 2. **Unvalidated Post Meta Access - Potential Data Exposure**

**Severity**: 🔴 CRITICAL  
**File**: [includes/class-rest-api.php](includes/class-rest-api.php#L300)  
**Function**: `get_post_meta_values()`

#### Issue
The endpoint retrieves arbitrary post meta without validation:

```php
public function get_post_meta_values( WP_REST_Request $request ): WP_REST_Response {
    $post_ids  = array_filter( array_map( 'absint', explode( ',', (string) $request->get_param( 'post_ids' ) ) ) );
    $meta_keys = array_filter( array_map( 'sanitize_key', explode( ',', (string) $request->get_param( 'meta_keys' ) ) ) );

    $payload = array();

    foreach ( $post_ids as $post_id ) {
        $payload[ $post_id ] = array();

        if ( 'publish' !== get_post_status( $post_id ) ) {
            continue;
        }

        foreach ( $meta_keys as $meta_key ) {
            $value = get_post_meta( $post_id, $meta_key, true );  // ❌ No access control per meta key
            $payload[ $post_id ][ $meta_key ] = is_scalar( $value ) ? (string) $value : '';
        }
    }

    return rest_ensure_response( $payload );
}
```

#### Impact
- **Unrestricted Meta Access**: Any editor-level user (with `edit_posts` capability) can query ANY post meta from ANY published post
- **Potential Leakage**: Meta keys might contain:
  - Custom field data marked as private
  - Internal notes or configurations
  - Sensitive information not intended for this UI

#### Recommendation
**MUST FIX BEFORE PRODUCTION**

Add meta key whitelist validation:

```php
public function get_post_meta_values( WP_REST_Request $request ): WP_REST_Response {
    $post_ids  = array_filter( array_map( 'absint', explode( ',', (string) $request->get_param( 'post_ids' ) ) ) );
    $meta_keys = array_filter( array_map( 'sanitize_key', explode( ',', (string) $request->get_param( 'meta_keys' ) ) ) );
    
    // WHITELIST: Only allow specific meta keys
    $allowed_meta_keys = array(
        '_thumbnail_id',
        // Add only keys that are safe to expose
    );
    
    $meta_keys = array_intersect( $meta_keys, $allowed_meta_keys );
    
    if ( empty( $meta_keys ) ) {
        return rest_ensure_response( array() );
    }

    $payload = array();

    foreach ( $post_ids as $post_id ) {
        $payload[ $post_id ] = array();

        if ( 'publish' !== get_post_status( $post_id ) ) {
            continue;
        }

        foreach ( $meta_keys as $meta_key ) {
            $value = get_post_meta( $post_id, $meta_key, true );
            $payload[ $post_id ][ $meta_key ] = is_scalar( $value ) ? (string) $value : '';
        }
    }

    return rest_ensure_response( $payload );
}
```

---

### 3. **Improper Escaping in content_template - JavaScript Injection Risk**

**Severity**: 🔴 CRITICAL  
**File**: [includes/trait-widget-helpers.php](includes/trait-widget-helpers.php#L450)  
**Function**: `content_template()`

#### Issue
In the editor template, default values are escaped using `addslashes()` instead of proper HTML escaping:

```php
} else {
    $default_escaped = addslashes( (string) $definition['default'] );  // ❌ Wrong escaping
    $js_settings[]   = "\t{$key}: settings.{$key} || '{$default_escaped}'";
}
```

This escapes for PHP strings, not HTML/JavaScript context.

#### Impact
- **XSS Vulnerability**: If a default value contains quotes or JavaScript, it could break out of the string context
- **Potential payload**: `default": "'; alert('XSS'); //"` could execute arbitrary JavaScript

#### Example Attack Vector
```php
$definition['default'] = "x'; alert('XSS'); //"
```

Generated output:
```javascript
mc4e_field: settings.mc4e_field || 'x'; alert('XSS'); //'
```

#### Recommendation
**MUST FIX BEFORE PRODUCTION**

Replace with proper JavaScript escaping:

```php
} else {
    $default_escaped = wp_json_encode( (string) $definition['default'] );  // Use wp_json_encode
    $js_settings[]   = "\t{$key}: settings.{$key} || {$default_escaped}";
}
```

Or for safety with attribute context:

```php
} else {
    $default_json = wp_json_encode( (string) $definition['default'] );
    $js_settings[] = "\t{$key}: settings.{$key} || {$default_json}";
}
```

---

## High-Severity Issues

### 4. **Missing CSRF Protection Tokens on REST API**

**Severity**: 🟠 HIGH  
**File**: [includes/class-rest-api.php](includes/class-rest-api.php#L60)  

#### Issue
While WordPress REST API has default nonce support, it's not explicitly configured or documented in these endpoints. The permission callbacks only use `current_user_can()`.

#### Impact
- **CSRF Attacks**: Although read-only, if future write endpoints are added without explicit nonce validation, they're vulnerable
- **Defense in Depth**: Best practice to be explicit about CSRF protection

#### Recommendation
Add explicit nonce validation to endpoints that may modify data in future versions:

```php
'permission_callback' => function() {
    if ( ! current_user_can( 'edit_posts' ) ) {
        return false;
    }
    
    // Verify nonce for non-GET requests
    if ( 'GET' !== $_SERVER['REQUEST_METHOD'] ) {
        if ( ! isset( $_REQUEST['_wpnonce'] ) || 
             ! wp_verify_nonce( $_REQUEST['_wpnonce'], 'mc4e_rest_nonce' ) ) {
            return false;
        }
    }
    
    return true;
},
```

---

### 5. **WC Store API Nonce Handling - Fallback Chain Risk**

**Severity**: 🟠 HIGH  
**File**: [src/shared/components/AddToCartButton.jsx](src/shared/components/AddToCartButton.jsx#L20)  

#### Issue
The `getStoreApiNonce()` function falls back through multiple global variables without proper validation:

```javascript
const getStoreApiNonce = () => {
    // Our plugin's localized nonce (primary source)
    if (window.MC4E?.storeApiNonce) {
        return window.MC4E.storeApiNonce;
    }
    // WooCommerce Blocks middleware config
    if (window.wcBlocksMiddlewareConfig?.storeApiNonce) {
        return window.wcBlocksMiddlewareConfig.storeApiNonce;
    }
    // ... multiple fallbacks ...
    return '';  // Returns empty string if no nonce found
};
```

#### Impact
- **Inconsistent Nonce Source**: Could use outdated or incorrect nonce from wrong source
- **Expired Nonce**: Using a cached nonce from `wcBlocksMiddlewareConfig` might be expired
- **Silent Failure**: Returns empty string without indication that nonce is missing

#### Recommendation
Implement a single, reliable nonce source:

```javascript
const getStoreApiNonce = () => {
    const nonce = window.MC4E?.storeApiNonce;
    
    if (!nonce) {
        console.warn('MC4E: Store API nonce not available');
    }
    
    return nonce || '';
};

// Ensure nonce is localized properly in PHP:
// wp_localize_script( 'mc4e-script', 'MC4E', array(
//     'storeApiNonce' => wp_create_nonce( 'wc_store_api' ),
// ) );
```

---

## Medium-Severity Issues

### 6. **Missing Input Validation - Search Parameter in get_products()**

**Severity**: 🟡 MEDIUM  
**File**: [includes/class-rest-api.php](includes/class-rest-api.php#L168)  

#### Issue
The `search` parameter is sanitized but not validated for minimum length or format:

```php
public function get_products( WP_REST_Request $request ) {
    $search   = $request->get_param( 'search' );  // Sanitized but not validated
    $per_page = $request->get_param( 'per_page' ) ?? self::DEFAULT_PER_PAGE;

    // ...
    
    if ( ! empty( $search ) ) {
        $args['s'] = $search;  // Passed directly to WooCommerce query
    }
```

#### Impact
- **Performance Attack**: Very long search strings could cause database performance issues
- **Unexpected Behavior**: Single character searches might return excessive results

#### Recommendation
Add validation:

```php
$search = $request->get_param( 'search' );

// Validate search length
if ( ! empty( $search ) ) {
    if ( strlen( $search ) < 2 ) {
        return new WP_Error(
            'invalid_search',
            __( 'Search term must be at least 2 characters.', 'mosaic-contents-for-elementor' ),
            array( 'status' => 400 )
        );
    }
    
    if ( strlen( $search ) > 100 ) {
        $search = substr( $search, 0, 100 );
    }
    
    $args['s'] = $search;
}
```

---

### 7. **Insufficient Escaping in React Components - DOMPurify Setup**

**Severity**: 🟡 MEDIUM  
**File**: [src/widgets/content-layout/content-layout.jsx](src/widgets/content-layout/content-layout.jsx#L1)  

#### Issue
While DOMPurify is imported, verify it's configured with strict settings:

```javascript
import DOMPurify from 'dompurify';

// ...

const Sanitizer = DOMPurify.sanitize;

// Usage example:
name: item?.title?.rendered || '',  // Uses DOMPurify for rendering
shortDescription: item?.excerpt?.rendered || '',
```

#### Recommendation
Ensure DOMPurify is configured with strict rules:

```javascript
// Configure DOMPurify for strict sanitization
const config = {
    ALLOWED_TAGS: [ 'b', 'i', 'em', 'strong', 'br', 'p', 'a' ],
    ALLOWED_ATTR: [ 'href', 'target', 'rel' ],
    KEEP_CONTENT: true,
};

const sanitizeHtml = (html) => DOMPurify.sanitize(html, config);
```

Then apply consistently:

```javascript
name: sanitizeHtml(item?.title?.rendered) || '',
shortDescription: sanitizeHtml(item?.excerpt?.rendered) || '',
```

---

### 8. **No Rate Limiting on REST Endpoints**

**Severity**: 🟡 MEDIUM  
**File**: [includes/class-rest-api.php](includes/class-rest-api.php)  

#### Issue
REST endpoints have no rate limiting, allowing abuse through:
- Rapid requests to enumerate products
- Brute force meta key discovery
- Denial of Service through excessive searches

#### Recommendation
Implement rate limiting:

```php
public function check_permission(): bool {
    if ( ! current_user_can( 'edit_posts' ) ) {
        return false;
    }
    
    // Rate limit: max 60 requests per minute per user
    $user_id = get_current_user_id();
    $cache_key = "mc4e_api_rate_{$user_id}";
    $request_count = (int) wp_cache_get( $cache_key );
    
    if ( $request_count > 60 ) {
        return new WP_Error(
            'rest_rate_limit',
            __( 'Too many requests. Please try again later.', 'mosaic-contents-for-elementor' ),
            array( 'status' => 429 )
        );
    }
    
    wp_cache_set( $cache_key, $request_count + 1, '', MINUTE_IN_SECONDS );
    
    return true;
}
```

---

### 9. **Missing Content Security Policy (CSP) Headers**

**Severity**: 🟡 MEDIUM  
**File**: [mosaic-contents-for-elementor.php](mosaic-contents-for-elementor.php)  

#### Issue
No CSP headers defined to prevent inline script/style injection in the Elementor editor preview.

#### Recommendation
Add CSP headers in the main plugin file:

```php
// Add security headers
add_action( 'wp_headers', function( $headers ) {
    $headers['X-Content-Type-Options'] = 'nosniff';
    $headers['X-Frame-Options'] = 'SAMEORIGIN';
    
    // For Elementor editor, allow self + trusted sources
    $headers['Content-Security-Policy'] = "default-src 'self' https:; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'";
    
    return $headers;
});
```

---

## Low-Severity Issues

### 10. **Missing Security.txt Configuration**

**Severity**: 🟢 LOW  

#### Recommendation
Add security headers to help security researchers report vulnerabilities:

```php
add_action( 'wp_headers', function( $headers ) {
    $headers['X-Powered-By'] = ''; // Remove version info
    return $headers;
});
```

---

### 11. **No Security Update Notification Mechanism**

**Severity**: 🟢 LOW  

#### Recommendation
Consider implementing a security notification system that alerts plugin administrators of critical updates.

---

## Compliance Checklist

- ❌ OWASP Top 10 - A03:2021 Injection (XSS in content_template)
- ❌ OWASP Top 10 - A01:2021 Broken Access Control (open REST endpoints)
- ❌ OWASP Top 10 - A04:2021 Insecure Design (missing CSRF tokens)
- ✅ OWASP Top 10 - A06:2021 Vulnerable Components (dependencies current)
- ✅ OWASP Top 10 - A07:2021 Identification and Authentication (proper capability checks)

---

## Remediation Priority

### Phase 1: CRITICAL (Fix Before Any Production Deployment)
1. Fix REST API permission callbacks (Issue #1)
2. Add meta key whitelist validation (Issue #2)
3. Fix JavaScript escaping in content_template (Issue #3)

**Estimated Time**: 2-3 hours

### Phase 2: HIGH (Fix Before Next Release)
4. Add explicit CSRF protection (Issue #4)
5. Implement reliable nonce handling (Issue #5)

**Estimated Time**: 1-2 hours

### Phase 3: MEDIUM (Fix in Upcoming Release)
6. Add search input validation (Issue #6)
7. Configure DOMPurify strictly (Issue #7)
8. Implement rate limiting (Issue #8)

**Estimated Time**: 3-4 hours

### Phase 4: LOW (Best Practice)
9. Add CSP headers (Issue #9)
10. Add security headers (Issue #10)

**Estimated Time**: 1 hour

---

## Testing Recommendations

### Manual Security Tests
```bash
# Test open REST endpoints (before fix)
curl https://example.com/wp-json/mc4e/v1/post-types
curl https://example.com/wp-json/mc4e/v1/taxonomy-terms?taxonomy=category
curl https://example.com/wp-json/mc4e/v1/post-meta?post_ids=1,2,3&meta_keys=_price,_custom_field

# Test after fixes - should require authentication
curl -H "Authorization: Bearer $TOKEN" https://example.com/wp-json/mc4e/v1/post-types
```

### Automated Testing
- Run WordPress security plugin (Wordfence, Sucuri)
- Use OWASP ZAP for automated vulnerability scanning
- Check for XSS using Burp Suite Community

---

## References

- [WordPress Plugin Security Handbook](https://developer.wordpress.org/plugins/security/)
- [WordPress Escaping Guide](https://developer.wordpress.org/plugins/security/sanitizing-input/)
- [OWASP Top 10 2021](https://owasp.org/Top10/)
- [DOMPurify Configuration](https://github.com/cure53/DOMPurify)
- [WP REST API Security](https://developer.wordpress.org/rest-api/extending-the-rest-api/adding-custom-endpoints/)

---

## Sign-Off

This report identifies security issues that must be addressed before production deployment. The critical vulnerabilities pose immediate risk to site security and user data.

**Report Status**: Ready for Remediation  
**Next Steps**: Implement fixes in priority order, then re-run security audit
