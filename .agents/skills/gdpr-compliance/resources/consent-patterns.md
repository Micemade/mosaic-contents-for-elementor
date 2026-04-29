# Consent Patterns — GDPR Code Examples

This file contains implementation patterns for consent collection, storage, withdrawal, double opt-in, cookie consent banners, consent API endpoints, and validation-before-processing guards.

## 1. Granular Consent Form (HTML)

Consent checkboxes must NEVER be pre-checked. Each purpose requires a separate checkbox.

```html
<form id="registration-form" method="POST" action="/api/register">
  <label for="email">Email address *</label>
  <input type="email" id="email" name="email" required>

  <label for="name">Name *</label>
  <input type="text" id="name" name="name" required>

  <!-- Each consent purpose is a separate, unchecked checkbox -->
  <fieldset>
    <legend>Consent preferences</legend>

    <label>
      <input type="checkbox" name="consent_terms" value="1" required>
      I agree to the <a href="/terms" target="_blank">Terms of Service</a> *
    </label>

    <label>
      <input type="checkbox" name="consent_privacy" value="1" required>
      I have read the <a href="/privacy" target="_blank">Privacy Policy</a> *
    </label>

    <label>
      <input type="checkbox" name="consent_marketing" value="0">
      I agree to receive marketing emails (optional)
    </label>

    <label>
      <input type="checkbox" name="consent_analytics" value="0">
      I agree to analytics tracking for service improvement (optional)
    </label>
  </fieldset>

  <button type="submit">Create Account</button>
</form>
```

## 2. Consent Storage Schema (SQL)

```sql
CREATE TABLE user_consents (
    id            BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id       BIGINT NOT NULL REFERENCES users(id),
    purpose       VARCHAR(50) NOT NULL,   -- 'marketing', 'analytics', 'third_party_sharing'
    granted       BOOLEAN NOT NULL,
    consent_text  TEXT NOT NULL,           -- exact wording shown to user
    policy_version VARCHAR(20) NOT NULL,  -- 'v2.3' — links consent to specific policy
    ip_address    VARCHAR(45),            -- IPv4 or IPv6
    user_agent    TEXT,
    created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    withdrawn_at  TIMESTAMP NULL,
    INDEX idx_user_purpose (user_id, purpose),
    INDEX idx_purpose_granted (purpose, granted)
);
```

## 3. Recording Consent (PHP)

```php
function recordConsent(int $userId, string $purpose, bool $granted, string $policyVersion): void
{
    $stmt = $pdo->prepare('
        INSERT INTO user_consents (user_id, purpose, granted, consent_text, policy_version, ip_address, user_agent)
        VALUES (:user_id, :purpose, :granted, :consent_text, :policy_version, :ip_address, :user_agent)
    ');
    $stmt->execute([
        'user_id'        => $userId,
        'purpose'        => $purpose,
        'granted'        => $granted ? 1 : 0,
        'consent_text'   => getConsentTextForPurpose($purpose, $policyVersion),
        'policy_version' => $policyVersion,
        'ip_address'     => $_SERVER['REMOTE_ADDR'] ?? null,
        'user_agent'     => $_SERVER['HTTP_USER_AGENT'] ?? null,
    ]);
}
```

## 4. Consent Withdrawal (Python)

```python
def withdraw_consent(user_id: int, purpose: str) -> None:
    """Withdraw consent for a specific purpose. Must be as easy as granting it."""
    db.execute(
        """
        UPDATE user_consents
        SET withdrawn_at = NOW(), granted = FALSE
        WHERE user_id = %s AND purpose = %s AND granted = TRUE AND withdrawn_at IS NULL
        """,
        (user_id, purpose),
    )
    # Stop processing immediately upon withdrawal
    if purpose == "marketing":
        remove_from_mailing_list(user_id)
    elif purpose == "analytics":
        delete_analytics_data(user_id)
```

## 5. Double Opt-In for Email Marketing (Python)

```python
def request_marketing_consent(email: str) -> None:
    token = secrets.token_urlsafe(32)
    db.execute(
        "INSERT INTO consent_confirmations (email, token, purpose, expires_at) "
        "VALUES (%s, %s, 'marketing', NOW() + INTERVAL 48 HOUR)",
        (email, token),
    )
    send_email(
        to=email,
        subject="Please confirm your subscription",
        body=f"Click to confirm: https://example.com/confirm-consent?token={token}",
    )

def confirm_consent(token: str) -> bool:
    row = db.fetch_one(
        "SELECT email, purpose FROM consent_confirmations "
        "WHERE token = %s AND expires_at > NOW() AND confirmed_at IS NULL",
        (token,),
    )
    if not row:
        return False
    db.execute(
        "UPDATE consent_confirmations SET confirmed_at = NOW() WHERE token = %s",
        (token,),
    )
    user = get_user_by_email(row["email"])
    record_consent(user["id"], row["purpose"], granted=True, policy_version=CURRENT_POLICY)
    return True
```

## 6. Cookie Consent Implementation (JavaScript)

```javascript
const COOKIE_CATEGORIES = {
    necessary: {
        label: "Strictly Necessary",
        description: "Required for the website to function. Cannot be disabled.",
        required: true,
        cookies: ["session_id", "csrf_token"]
    },
    analytics: {
        label: "Analytics",
        description: "Help us understand how visitors use our site.",
        required: false,
        cookies: ["_ga", "_gid"]
    },
    marketing: {
        label: "Marketing",
        description: "Used to deliver relevant advertisements.",
        required: false,
        cookies: ["_fbp", "ads_session"]
    }
};

function getConsentState() {
    const stored = getCookie("cookie_consent");
    if (!stored) return null;
    try {
        return JSON.parse(atob(stored));
    } catch {
        return null;
    }
}

function saveConsent(preferences) {
    const record = {
        categories: preferences,
        timestamp: new Date().toISOString(),
        version: PRIVACY_POLICY_VERSION
    };
    setCookie("cookie_consent", btoa(JSON.stringify(record)), 365);

    // Send to server for audit trail
    fetch("/api/consent/cookies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(record)
    });

    applyConsentPreferences(preferences);
}

function applyConsentPreferences(preferences) {
    // Load scripts only for consented categories
    if (preferences.analytics) {
        loadAnalyticsScripts();
    } else {
        removeAnalyticsCookies();
    }
    if (preferences.marketing) {
        loadMarketingScripts();
    } else {
        removeMarketingCookies();
    }
}

function removeAnalyticsCookies() {
    COOKIE_CATEGORIES.analytics.cookies.forEach(name => deleteCookie(name));
}

// Show banner only if no consent has been recorded
function initCookieBanner() {
    const consent = getConsentState();
    if (!consent) {
        showCookieBanner();  // must not block access to the site (no cookie wall)
    } else {
        applyConsentPreferences(consent.categories);
    }
}
```

## 7. Consent API Endpoints (Python)

```python
@app.route("/api/consent", methods=["POST"])
@login_required
def grant_consent():
    purpose = request.json["purpose"]
    granted = request.json["granted"]  # True or False

    recordConsent(
        user_id=current_user.id,
        purpose=purpose,
        granted=granted,
        policy_version=CURRENT_POLICY_VERSION,
    )
    return jsonify({"status": "recorded"})

@app.route("/api/consent", methods=["GET"])
@login_required
def get_consent_status():
    consents = db.fetch_all(
        """
        SELECT purpose, granted, policy_version, created_at, withdrawn_at
        FROM user_consents
        WHERE user_id = %s
        ORDER BY created_at DESC
        """,
        (current_user.id,),
    )
    # Return the latest consent per purpose
    latest = {}
    for c in consents:
        if c["purpose"] not in latest:
            latest[c["purpose"]] = c
    return jsonify({"consents": latest})

@app.route("/api/consent/withdraw", methods=["POST"])
@login_required
def withdraw():
    purpose = request.json["purpose"]
    withdraw_consent(current_user.id, purpose)
    return jsonify({"status": "withdrawn"})
```

## 8. Consent Validation Before Processing (Python)

```python
def send_marketing_email(user_id: int, campaign_id: int) -> bool:
    consent = db.fetch_one(
        "SELECT granted, withdrawn_at FROM user_consents "
        "WHERE user_id = %s AND purpose = 'marketing' AND granted = TRUE AND withdrawn_at IS NULL "
        "ORDER BY created_at DESC LIMIT 1",
        (user_id,),
    )
    if not consent:
        return False  # No valid consent — do not send

    # Proceed with sending
    queue_email(user_id, campaign_id)
    return True
```
