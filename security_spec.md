# Security Specification: うおwりんご (Uowlingo) Firestore Database

## 1. Data Invariants
1. **User Identity Invariant**: A user document at `/users/{userId}` can only be created or modified if `request.auth.uid == userId` and the user's email is verified (`request.auth.token.email_verified == true`).
2. **UserId Immutability**: The `userId` field inside `/users/{userId}` cannot be changed to another user's UID or modified after creation.
3. **No Shadow Fields**: Document creations and updates must strictly contain declared schema fields with no injected malicious properties.
4. **Boundary Limits**: String fields must not exceed their declared maximum lengths (`userName` <= 30 chars, `userId` <= 128 chars, `avatarUrl` <= 100000 chars, `lastDailyDate` <= 20 chars).
5. **Type Safety & Bounds**: Numerical fields (`energy`, `streak`, `rating`, `completedSessions`, `perfectSessions`) must be numbers and non-negative.
6. **Enum Integrity**: `rankTier`, `equippedMainGoods`, and `equippedSubGoods` must strictly adhere to their defined enum values.
7. **Array Sizing**: `unlockedGoods` must be a list of strings bounded to a maximum length of 20 items.
8. **Anti-PII Leak**: No email or private credential data is exposed in public user documents.
9. **Query Enforcer**: Any `list` query must be bound by authenticated conditions without client-side delegation.
10. **Global Safety Net**: All paths not explicitly matched are strictly rejected by the default deny catch-all rule.

---

## 2. The "Dirty Dozen" Payloads (All MUST result in PERMISSION_DENIED)

1. **Unauthenticated Write Attack**: An unauthenticated user attempts to create a document at `/users/attacker123`.
2. **Identity Spoof Attack**: Authenticated user "userA" attempts to create or overwrite `/users/userB`.
3. **Unverified Email Attack**: An authenticated user with `email_verified == false` attempts to write to `/users/{userId}`.
4. **ID Poisoning / Denial-of-Wallet Attack**: An attacker attempts to target a document with an excessively long or invalid ID (e.g., a 2KB junk character string).
5. **UserId Mutation Attack**: User attempts to update their own document to change their `userId` field to someone else's UID (`incoming().userId != existing().userId`).
6. **Shadow Field Injection**: User attempts to create a document with an extra unauthorized property `isAdmin: true`.
7. **Negative Energy Exploit**: User attempts to write negative numbers for `energy: -5000` or `rating: -100`.
8. **Invalid Enum Injection**: User attempts to update `rankTier` with an invalid string `"super_god_tier"`.
9. **Array Exhaustion Attack**: User attempts to store an unbounded array of 1,000 items in `unlockedGoods`.
10. **Name Overflow Attack**: User attempts to inject a 10,000 character string into `userName`.
11. **Blanket Collection Scrape**: Unauthenticated visitor attempts a collection list on `/users`.
12. **Arbitrary Root Collection Write**: Malicious script attempts to write to `/admins/hacker` or an unknown root collection `/{document=**}`.

---

## 3. Red Team Conflict Evaluation

| Attack Vector | Vulnerability Checked | Rule Defense | Status |
|---|---|---|---|
| Identity Spoofing | Writing to another user's path or changing owner | `request.auth.uid == userId && incoming().userId == request.auth.uid` | PASS |
| Unverified Write | Writing without verified Google account | `request.auth.token.email_verified == true` | PASS |
| Shadow Field Injection | Adding unverified fields (`isAdmin`, etc.) | Blueprint validation `isValidUser(incoming())` and exact allowed keys | PASS |
| Value Poisoning | Injecting invalid types or out-of-range enums | Strict `is string`, `is number`, and enum membership checks | PASS |
| Resource Poisoning | Maliciously long document paths or strings | `isValidId(userId)` and `.size() <= MAX` on all strings | PASS |
| Catch-all Traversal | Accessing unlisted documents | `match /{document=**} { allow read, write: if false; }` | PASS |
