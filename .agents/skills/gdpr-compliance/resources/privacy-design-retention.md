# Privacy by Design & Data Retention — GDPR Code Patterns

This file contains implementation patterns for Privacy by Design (Art. 25) and Data Retention & Deletion (Art. 5(1)(e)).

## 1. Data Minimization in Schemas (SQL)

```sql
-- BAD: collecting unnecessary data
CREATE TABLE users (
    id BIGINT PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    gender VARCHAR(20),          -- do you actually need this?
    date_of_birth DATE,          -- do you actually need this?
    social_security_number TEXT, -- almost certainly not
    mother_maiden_name TEXT,     -- no
    favorite_color VARCHAR(50),  -- no
    shoe_size INT                -- absolutely not
);

-- GOOD: collect only what is needed
CREATE TABLE users (
    id BIGINT PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

## 2. Pseudonymization (Python)

Replace direct identifiers with pseudonyms in analytics and logs.

```python
import hashlib

def pseudonymize_user_id(user_id: int, salt: str) -> str:
    """One-way hash for analytics. Store the salt separately with access controls."""
    return hashlib.sha256(f"{salt}:{user_id}".encode()).hexdigest()[:16]

def log_page_view(user_id: int, page: str) -> None:
    pseudo_id = pseudonymize_user_id(user_id, get_analytics_salt())
    db.execute(
        "INSERT INTO page_views (pseudo_user_id, page, viewed_at) VALUES (%s, %s, NOW())",
        (pseudo_id, page),
    )
    # Never log the real user_id in analytics tables
```

## 3. Encryption (Python)

```python
from cryptography.fernet import Fernet

# Encrypt PII at rest
class EncryptedField:
    def __init__(self, key: bytes):
        self.cipher = Fernet(key)

    def encrypt(self, value: str) -> str:
        return self.cipher.encrypt(value.encode()).decode()

    def decrypt(self, token: str) -> str:
        return self.cipher.decrypt(token.encode()).decode()

# Usage in model
cipher = EncryptedField(key=get_encryption_key())

def store_user(name: str, email: str, phone: str) -> None:
    db.execute(
        "INSERT INTO users (name, email, phone_encrypted) VALUES (%s, %s, %s)",
        (name, email, cipher.encrypt(phone)),
    )
```

## 4. Privacy-Friendly Defaults (JavaScript)

```javascript
// Default settings for new users — most restrictive
const DEFAULT_PRIVACY_SETTINGS = {
    profile_visibility: "private",   // not "public"
    show_email: false,               // not true
    show_activity: false,            // not true
    allow_marketing: false,          // not true
    allow_analytics: false,          // not true
    allow_third_party_sharing: false // not true
};

function createUserSettings(userId) {
    return db.insert("user_settings", {
        user_id: userId,
        ...DEFAULT_PRIVACY_SETTINGS,
        created_at: new Date().toISOString()
    });
}
```

## 5. Separate Storage for Sensitive Data (SQL)

```sql
-- Main user table (non-sensitive)
CREATE TABLE users (
    id BIGINT PRIMARY KEY,
    username VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Sensitive data in separate table with stricter access controls
CREATE TABLE user_pii (
    user_id BIGINT PRIMARY KEY REFERENCES users(id),
    full_name_encrypted BLOB,
    phone_encrypted BLOB,
    address_encrypted BLOB,
    date_of_birth_encrypted BLOB,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Different database credentials for PII table access
-- Application services that do not need PII never get PII DB credentials
```

## 6. Purpose-Based Access Control (Python)

```python
class DataAccessGuard:
    PURPOSES = {
        "order_fulfillment": ["name", "email", "shipping_address"],
        "billing": ["name", "email", "billing_address", "tax_id"],
        "support": ["name", "email"],
        "analytics": ["pseudo_user_id"],  # no PII
        "marketing": ["email"],  # only if consent granted
    }

    @staticmethod
    def get_allowed_fields(purpose: str) -> list:
        return DataAccessGuard.PURPOSES.get(purpose, [])

    @staticmethod
    def fetch_user_data(user_id: int, purpose: str) -> dict:
        allowed = DataAccessGuard.get_allowed_fields(purpose)
        if not allowed:
            raise PermissionError(f"Unknown purpose: {purpose}")

        if purpose == "marketing":
            if not has_active_consent(user_id, "marketing"):
                raise PermissionError("User has not consented to marketing")

        columns = ", ".join(allowed)
        return db.fetch_one(f"SELECT {columns} FROM users WHERE id = %s", (user_id,))
```

---

## 7. Retention Policy Definition (Python)

```python
RETENTION_POLICIES = {
    "sessions":             {"days": 30,   "action": "delete"},
    "activity_log":         {"days": 90,   "action": "delete"},
    "analytics_events":     {"days": 365,  "action": "anonymize"},
    "support_tickets":      {"days": 730,  "action": "anonymize"},  # 2 years
    "invoices":             {"days": 2555, "action": "retain"},     # 7 years (tax law)
    "deleted_user_backups": {"days": 30,   "action": "delete"},
    "consent_records":      {"days": 2555, "action": "retain"},     # 7 years (accountability)
    "password_reset_tokens":{"days": 1,    "action": "delete"},
}
```

## 8. Automated Cleanup Job (Python)

```python
def run_retention_cleanup():
    """Run daily via cron or scheduled task."""
    for data_type, policy in RETENTION_POLICIES.items():
        cutoff = datetime.utcnow() - timedelta(days=policy["days"])

        if policy["action"] == "delete":
            count = db.execute(
                f"DELETE FROM {data_type} WHERE created_at < %s", (cutoff,)
            )
            log_retention_action(data_type, "deleted", count)

        elif policy["action"] == "anonymize":
            count = db.execute(
                f"UPDATE {data_type} SET user_id = NULL, ip_address = NULL, "
                f"user_agent = NULL WHERE created_at < %s AND user_id IS NOT NULL",
                (cutoff,),
            )
            log_retention_action(data_type, "anonymized", count)

        # "retain" action: do nothing — data is kept for legal obligation
```

## 9. Soft Delete vs Hard Delete vs Anonymization (Python)

```python
# SOFT DELETE — marks as deleted but data remains (use for grace period)
def soft_delete_user(user_id: int) -> None:
    db.execute(
        "UPDATE users SET deleted_at = NOW(), email = CONCAT('deleted_', id, '@removed.invalid') "
        "WHERE id = %s",
        (user_id,),
    )
    # Schedule hard delete after 30-day grace period
    schedule_job("hard_delete_user", user_id=user_id, run_at=datetime.utcnow() + timedelta(days=30))

# HARD DELETE — permanent removal
def hard_delete_user(user_id: int) -> None:
    for table in ["sessions", "activity_log", "user_preferences", "password_resets"]:
        db.execute(f"DELETE FROM {table} WHERE user_id = %s", (user_id,))
    db.execute("DELETE FROM users WHERE id = %s", (user_id,))

# ANONYMIZE — remove PII but keep the record for analytics/business
def anonymize_user(user_id: int) -> None:
    db.execute(
        "UPDATE users SET name = 'Anonymous', email = CONCAT('anon_', id, '@removed.invalid'), "
        "phone = NULL, address = NULL, ip_address = NULL WHERE id = %s",
        (user_id,),
    )
```

## 10. Anonymization Patterns (SQL)

```sql
-- Replace PII with non-identifying values
UPDATE orders SET
    customer_name = CONCAT('Customer_', MD5(customer_name)),
    customer_email = CONCAT(MD5(customer_email), '@anon.invalid'),
    shipping_address = NULL,
    phone = NULL,
    ip_address = NULL
WHERE user_id = ? AND created_at < DATE_SUB(NOW(), INTERVAL 2 YEAR);

-- For aggregate analytics, remove the ability to re-identify
UPDATE analytics_events SET
    user_id = NULL,
    ip_address = NULL,
    user_agent = NULL,
    session_id = NULL
WHERE created_at < DATE_SUB(NOW(), INTERVAL 1 YEAR);
```
