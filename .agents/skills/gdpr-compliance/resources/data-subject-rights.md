# Data Subject Rights — GDPR Code Patterns

This file contains implementation patterns for all 7 data subject rights defined in GDPR Articles 15-22.

## 1. Right to Access — Art. 15

The user can request a copy of ALL personal data you hold about them. Respond within 30 days.

### Python — JSON Data Export Endpoint

```python
@app.route("/api/me/data-export", methods=["POST"])
@login_required
def export_user_data():
    user_id = current_user.id
    data = {
        "profile": db.fetch_one("SELECT name, email, created_at FROM users WHERE id = %s", (user_id,)),
        "consents": db.fetch_all(
            "SELECT purpose, granted, policy_version, created_at, withdrawn_at "
            "FROM user_consents WHERE user_id = %s ORDER BY created_at",
            (user_id,),
        ),
        "orders": db.fetch_all(
            "SELECT order_id, total, currency, created_at FROM orders WHERE user_id = %s",
            (user_id,),
        ),
        "activity_log": db.fetch_all(
            "SELECT action, ip_address, created_at FROM activity_log WHERE user_id = %s",
            (user_id,),
        ),
        "export_metadata": {
            "exported_at": datetime.utcnow().isoformat(),
            "format_version": "1.0",
        },
    }
    return jsonify(data), 200, {"Content-Disposition": "attachment; filename=my-data.json"}
```

### PHP — CSV Export

```php
function exportUserDataCsv(int $userId): void
{
    header('Content-Type: text/csv');
    header('Content-Disposition: attachment; filename="my-data.csv"');

    $output = fopen('php://output', 'w');

    // Profile
    fputcsv($output, ['Section: Profile']);
    fputcsv($output, ['Name', 'Email', 'Created At']);
    $user = $pdo->prepare('SELECT name, email, created_at FROM users WHERE id = ?');
    $user->execute([$userId]);
    fputcsv($output, $user->fetch(PDO::FETCH_NUM));

    // Consents
    fputcsv($output, []);
    fputcsv($output, ['Section: Consents']);
    fputcsv($output, ['Purpose', 'Granted', 'Policy Version', 'Created At', 'Withdrawn At']);
    $consents = $pdo->prepare('SELECT purpose, granted, policy_version, created_at, withdrawn_at FROM user_consents WHERE user_id = ?');
    $consents->execute([$userId]);
    while ($row = $consents->fetch(PDO::FETCH_NUM)) {
        fputcsv($output, $row);
    }

    fclose($output);
}
```

## 2. Right to Rectification — Art. 16

Users must be able to correct inaccurate personal data.

```python
@app.route("/api/me/profile", methods=["PATCH"])
@login_required
def update_profile():
    allowed_fields = {"name", "email", "phone", "address"}
    updates = {k: v for k, v in request.json.items() if k in allowed_fields}
    if not updates:
        return jsonify({"error": "No valid fields provided"}), 400

    # Validate before updating
    if "email" in updates and not is_valid_email(updates["email"]):
        return jsonify({"error": "Invalid email format"}), 400

    set_clause = ", ".join(f"{k} = %s" for k in updates)
    values = list(updates.values()) + [current_user.id]

    db.execute(f"UPDATE users SET {set_clause}, updated_at = NOW() WHERE id = %s", values)

    # Audit log
    db.execute(
        "INSERT INTO audit_log (user_id, action, details, created_at) VALUES (%s, 'profile_update', %s, NOW())",
        (current_user.id, json.dumps({"fields_updated": list(updates.keys())})),
    )
    return jsonify({"status": "updated"})
```

## 3. Right to Erasure / Right to be Forgotten — Art. 17

Delete personal data. Some data must be retained for legal obligations (e.g., invoices for tax law). Anonymize what you cannot delete.

### Python — Account Deletion with Selective Retention

```python
def delete_user_account(user_id: int) -> dict:
    report = {"deleted": [], "anonymized": [], "retained": []}

    # 1. Delete data with no retention requirement
    for table in ["activity_log", "sessions", "password_reset_tokens", "user_preferences"]:
        db.execute(f"DELETE FROM {table} WHERE user_id = %s", (user_id,))
        report["deleted"].append(table)

    # 2. Anonymize data tied to business records
    db.execute(
        "UPDATE orders SET user_name = 'DELETED', user_email = 'DELETED', "
        "ip_address = NULL, user_agent = NULL WHERE user_id = %s",
        (user_id,),
    )
    report["anonymized"].append("orders")

    # 3. Retain invoices for legal obligation (tax law — typically 7 years)
    db.execute(
        "UPDATE invoices SET user_name = 'DELETED', user_email = 'DELETED' WHERE user_id = %s",
        (user_id,),
    )
    report["retained"].append("invoices (anonymized, retained for tax compliance)")

    # 4. Record consent withdrawal
    db.execute(
        "UPDATE user_consents SET withdrawn_at = NOW(), granted = FALSE "
        "WHERE user_id = %s AND withdrawn_at IS NULL",
        (user_id,),
    )

    # 5. Delete the user record
    db.execute("DELETE FROM users WHERE id = %s", (user_id,))
    report["deleted"].append("users")

    # 6. Log the deletion event (without PII)
    db.execute(
        "INSERT INTO deletion_log (user_id_hash, deleted_at, report) VALUES (%s, NOW(), %s)",
        (hashlib.sha256(str(user_id).encode()).hexdigest(), json.dumps(report)),
    )

    return report
```

### SQL — Cascading Deletion Procedure

```sql
-- Run inside a transaction
BEGIN;

DELETE FROM user_sessions WHERE user_id = ?;
DELETE FROM user_consents WHERE user_id = ?;
DELETE FROM activity_log WHERE user_id = ?;
DELETE FROM password_resets WHERE user_id = ?;
DELETE FROM user_preferences WHERE user_id = ?;

-- Anonymize order history (retained for accounting)
UPDATE orders SET
    customer_name = 'DELETED_USER',
    customer_email = NULL,
    shipping_address = NULL,
    ip_address = NULL
WHERE user_id = ?;

-- Delete the user
DELETE FROM users WHERE id = ?;

COMMIT;
```

## 4. Right to Data Portability — Art. 20

Provide data in a structured, commonly used, machine-readable format.

```python
@app.route("/api/me/portable-export", methods=["POST"])
@login_required
def portable_export():
    """Export user data in machine-readable JSON conforming to a documented schema."""
    user_id = current_user.id
    export = {
        "schema_version": "1.0",
        "exported_at": datetime.utcnow().isoformat() + "Z",
        "user": {
            "name": current_user.name,
            "email": current_user.email,
            "created_at": current_user.created_at.isoformat(),
        },
        "content": db.fetch_all(
            "SELECT title, body, created_at, updated_at FROM posts WHERE user_id = %s",
            (user_id,),
        ),
        "files": [
            {"name": f["name"], "url": generate_temp_download_url(f["path"])}
            for f in db.fetch_all("SELECT name, path FROM uploads WHERE user_id = %s", (user_id,))
        ],
    }
    return jsonify(export), 200
```

## 5. Right to Restriction of Processing — Art. 18

Allow users to pause processing of their data without deleting it.

### SQL — Schema Changes

```sql
ALTER TABLE users ADD COLUMN processing_restricted BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN restriction_reason TEXT NULL;
ALTER TABLE users ADD COLUMN restricted_at TIMESTAMP NULL;
```

### Python — Restriction Endpoint and Guard

```python
@app.route("/api/me/restrict-processing", methods=["POST"])
@login_required
def restrict_processing():
    reason = request.json.get("reason", "")
    db.execute(
        "UPDATE users SET processing_restricted = TRUE, restriction_reason = %s, "
        "restricted_at = NOW() WHERE id = %s",
        (reason, current_user.id),
    )
    return jsonify({"status": "processing_restricted"})

# Guard in every processing function
def can_process_user_data(user_id: int) -> bool:
    user = db.fetch_one("SELECT processing_restricted FROM users WHERE id = %s", (user_id,))
    if user and user["processing_restricted"]:
        return False  # Data exists but must not be processed
    return True
```

## 6. Right to Object — Art. 21

Users can object to processing based on legitimate interests, including profiling and direct marketing.

```python
@app.route("/api/me/object", methods=["POST"])
@login_required
def object_to_processing():
    purpose = request.json.get("purpose")  # 'marketing', 'profiling', 'analytics'
    if purpose not in ("marketing", "profiling", "analytics"):
        return jsonify({"error": "Invalid purpose"}), 400

    withdraw_consent(current_user.id, purpose)

    if purpose == "marketing":
        remove_from_all_mailing_lists(current_user.id)
    elif purpose == "profiling":
        delete_user_profile_scores(current_user.id)
    elif purpose == "analytics":
        anonymize_analytics_data(current_user.id)

    return jsonify({"status": f"objection_to_{purpose}_recorded"})
```

## 7. Right Not to be Subject to Automated Decision-Making — Art. 22

If you make decisions with legal or significant effects based solely on automated processing, you must offer human review.

```python
def automated_credit_decision(user_id: int) -> dict:
    score = calculate_credit_score(user_id)
    decision = "approved" if score >= 700 else "denied"

    # Store the decision with explanation
    decision_id = db.insert(
        "INSERT INTO automated_decisions "
        "(user_id, decision_type, result, score, factors, created_at) "
        "VALUES (%s, 'credit', %s, %s, %s, NOW())",
        (user_id, decision, score, json.dumps(get_scoring_factors(user_id))),
    )

    return {
        "decision": decision,
        "decision_id": decision_id,
        "explanation": f"Based on your credit score of {score}",
        "human_review_url": f"/api/decisions/{decision_id}/request-review",
    }

@app.route("/api/decisions/<int:decision_id>/request-review", methods=["POST"])
@login_required
def request_human_review(decision_id: int):
    db.execute(
        "UPDATE automated_decisions SET human_review_requested = TRUE, "
        "review_requested_at = NOW() WHERE id = %s AND user_id = %s",
        (decision_id, current_user.id),
    )
    return jsonify({"status": "review_requested", "expected_response_days": 5})
```
