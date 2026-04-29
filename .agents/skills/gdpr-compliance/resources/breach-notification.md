# Data Breach Notification — GDPR Code Patterns

This file contains implementation patterns for data breach detection, containment, notification, and logging as required by GDPR Articles 33 and 34.

## Key Requirements

- Report to supervisory authority within **72 hours** of becoming aware of a breach (Art. 33).
- Notify affected users **without undue delay** if the breach poses a **high risk** to their rights (Art. 34).
- The notification must include: nature of the breach, DPO contact details, likely consequences, and measures taken.

## 1. Incident Response Code (Python)

```python
def handle_data_breach(breach_description: str, affected_user_ids: list, severity: str) -> dict:
    breach_id = str(uuid.uuid4())
    detected_at = datetime.utcnow()

    # 1. Log the breach
    db.execute(
        "INSERT INTO breach_log (breach_id, description, severity, affected_count, detected_at) "
        "VALUES (%s, %s, %s, %s, %s)",
        (breach_id, breach_description, severity, len(affected_user_ids), detected_at),
    )

    # 2. Immediate containment — revoke all sessions for affected users
    for user_id in affected_user_ids:
        db.execute("DELETE FROM sessions WHERE user_id = %s", (user_id,))
        db.execute(
            "INSERT INTO forced_actions (user_id, action, breach_id, created_at) "
            "VALUES (%s, 'password_reset_required', %s, NOW())",
            (user_id, breach_id),
        )

    # 3. Revoke API tokens
    db.execute(
        "UPDATE api_tokens SET revoked_at = NOW() WHERE user_id IN %s AND revoked_at IS NULL",
        (tuple(affected_user_ids),),
    )

    # 4. Calculate notification deadline (72 hours from detection)
    notification_deadline = detected_at + timedelta(hours=72)

    # 5. If high severity, notify users directly
    if severity == "high":
        for user_id in affected_user_ids:
            send_breach_notification_email(user_id, breach_id, breach_description)

    return {
        "breach_id": breach_id,
        "detected_at": detected_at.isoformat(),
        "authority_notification_deadline": notification_deadline.isoformat(),
        "affected_users": len(affected_user_ids),
        "actions_taken": ["sessions_revoked", "password_reset_required", "tokens_revoked"],
    }
```

## 2. Breach Log Schema (SQL)

```sql
CREATE TABLE breach_log (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    breach_id VARCHAR(36) NOT NULL UNIQUE,
    description TEXT NOT NULL,
    severity ENUM('low', 'medium', 'high', 'critical') NOT NULL,
    affected_count INT NOT NULL,
    data_categories TEXT,              -- 'email, password_hash, name'
    detected_at TIMESTAMP NOT NULL,
    authority_notified_at TIMESTAMP NULL,
    users_notified_at TIMESTAMP NULL,
    resolution TEXT,
    resolved_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```
