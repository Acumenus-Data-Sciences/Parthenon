# Forgot Password Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Forgot password?" link to the login page that opens a modal to request a temp password reset via email.

**Architecture:** Reuses existing temp-password-via-email pattern from registration. New `forgotPassword()` method on `AuthController` generates a temp password, revokes existing tokens, emails via `TempPasswordMail`, and sets `must_change_password = true`. Frontend adds a glassmorphic modal triggered from the login form.

**Tech Stack:** Laravel 11 (PHP 8.4), React 19, TypeScript, Axios, Lucide icons

**Spec:** `docs/superpowers/specs/2026-03-13-forgot-password-design.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `backend/app/Http/Controllers/Api/V1/AuthController.php` | Add `forgotPassword()` method |
| Modify | `backend/routes/api.php` | Add `POST /auth/forgot-password` route |
| Create | `frontend/src/features/auth/components/ForgotPasswordModal.tsx` | Modal component |
| Modify | `frontend/src/features/auth/pages/LoginPage.tsx` | Add link + modal state |
| Modify | `.claude/rules/auth-system.md` | Document new endpoint |

---

## Chunk 1: Backend

### Task 1: Add `forgotPassword()` to AuthController

**Files:**
- Modify: `backend/app/Http/Controllers/Api/V1/AuthController.php:120-127` (insert before `logout()`)

- [ ] **Step 1: Add the `forgotPassword()` method**

Insert this method before `logout()` (after `changePassword()`, around line 120):

```php
public function forgotPassword(Request $request): JsonResponse
{
    $request->validate([
        'email' => 'required|string|email',
    ]);

    $email = strtolower(trim($request->string('email')));
    $user = User::where('email', $email)->first();

    if ($user) {
        $tempPassword = $this->generateTempPassword();

        $user->update([
            'password' => Hash::make($tempPassword),
            'must_change_password' => true,
        ]);

        // Revoke all existing sessions
        $user->tokens()->delete();

        // Audit log (without temp password on success path)
        logger()->info('Password reset requested', [
            'user_id' => $user->id,
            'email' => $user->email,
        ]);

        try {
            Mail::to($user->email)->send(new TempPasswordMail($user->name, $tempPassword));
        } catch (\Throwable $e) {
            logger()->warning('Failed to send password reset email', [
                'user_id' => $user->id,
                'email' => $user->email,
                'temp_password' => $tempPassword,
                'error' => $e->getMessage(),
            ]);
        }
    }

    return response()->json([
        'message' => 'If an account exists with that email, a new temporary password has been sent.',
    ]);
}
```

- [ ] **Step 2: Verify no syntax errors**

Run: `docker compose exec php php -l app/Http/Controllers/Api/V1/AuthController.php`
Expected: `No syntax errors detected`

### Task 2: Add the route

**Files:**
- Modify: `backend/routes/api.php:95` (insert after the register route)

- [ ] **Step 3: Add forgot-password route**

Insert after line 95 (`Route::post('/auth/register', ...)`):

```php
Route::post('/auth/forgot-password', [AuthController::class, 'forgotPassword'])->middleware('throttle:3,15');
```

- [ ] **Step 4: Verify routes register**

Run: `docker compose exec php php artisan route:list --path=auth`
Expected: Shows `POST api/v1/auth/forgot-password` in the output

- [ ] **Step 5: Test the endpoint manually**

Run: `curl -s -X POST http://localhost:8082/api/v1/auth/forgot-password -H 'Content-Type: application/json' -d '{"email":"nonexistent@test.com"}' | python3 -m json.tool`
Expected: `{ "message": "If an account exists with that email, a new temporary password has been sent." }` with 200 status

- [ ] **Step 6: Commit backend changes**

```bash
git add backend/app/Http/Controllers/Api/V1/AuthController.php backend/routes/api.php
git commit -m "feat: add forgot-password endpoint to AuthController"
```

---

## Chunk 2: Frontend

### Task 3: Create ForgotPasswordModal

**Files:**
- Create: `frontend/src/features/auth/components/ForgotPasswordModal.tsx`

- [ ] **Step 7: Create the modal component**

```tsx
import { useState, useEffect, useRef, type FormEvent } from "react";
import { Loader2, Mail, CheckCircle, X } from "lucide-react";
import apiClient from "@/lib/api-client";
import axios from "axios";

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultEmail?: string;
}

export function ForgotPasswordModal({
  isOpen,
  onClose,
  defaultEmail = "",
}: ForgotPasswordModalProps) {
  const [email, setEmail] = useState(defaultEmail);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const autoCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync defaultEmail when modal opens
  useEffect(() => {
    if (isOpen) {
      setEmail(defaultEmail);
      setSuccess(false);
      setError("");
      setLoading(false);
    }
  }, [isOpen, defaultEmail]);

  // Auto-close after success
  useEffect(() => {
    if (success) {
      autoCloseTimer.current = setTimeout(() => {
        onClose();
      }, 5000);
    }
    return () => {
      if (autoCloseTimer.current) {
        clearTimeout(autoCloseTimer.current);
        autoCloseTimer.current = null;
      }
    };
  }, [success, onClose]);

  if (!isOpen) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await apiClient.post("/auth/forgot-password", { email });
      setSuccess(true);
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 429) {
        setError("Too many requests. Please wait and try again.");
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      onClick={loading ? undefined : onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0, 0, 0, 0.6)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 420,
          background:
            "linear-gradient(135deg, rgba(20, 20, 24, 0.98) 0%, rgba(14, 14, 17, 0.99) 100%)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: "var(--radius-xl)",
          padding: "var(--space-8)",
          boxShadow:
            "0 24px 64px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.06)",
        }}
      >
        {/* Close button */}
        {!loading && (
          <button
            type="button"
            onClick={onClose}
            style={{
              position: "absolute",
              top: 16,
              right: 16,
              background: "none",
              border: "none",
              color: "var(--text-ghost)",
              cursor: "pointer",
              padding: 4,
              display: "flex",
              transition: "color 200ms",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "var(--text-muted)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "var(--text-ghost)";
            }}
          >
            <X size={18} />
          </button>
        )}

        {success ? (
          /* ─── Success state ─── */
          <div style={{ textAlign: "center", padding: "var(--space-4) 0" }}>
            <CheckCircle
              size={48}
              style={{ color: "var(--success)", margin: "0 auto var(--space-4)" }}
            />
            <h3
              style={{
                fontFamily: "var(--font-heading)",
                fontSize: "var(--text-lg)",
                fontWeight: 600,
                color: "var(--text-primary)",
                marginBottom: "var(--space-2)",
              }}
            >
              Check your email
            </h3>
            <p
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "var(--text-sm)",
                color: "var(--text-muted)",
                lineHeight: 1.5,
              }}
            >
              If an account exists with that email, a new temporary password has
              been sent.
            </p>
          </div>
        ) : (
          /* ─── Form state ─── */
          <>
            <h3
              style={{
                fontFamily: "var(--font-heading)",
                fontSize: "var(--text-lg)",
                fontWeight: 600,
                color: "var(--text-primary)",
                marginBottom: "var(--space-2)",
              }}
            >
              Reset your password
            </h3>
            <p
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "var(--text-sm)",
                color: "var(--text-muted)",
                marginBottom: "var(--space-6)",
                lineHeight: 1.5,
              }}
            >
              Enter your email and we'll send you a new temporary password.
            </p>

            <form onSubmit={handleSubmit}>
              {error && (
                <div
                  style={{
                    padding: "var(--space-3)",
                    marginBottom: "var(--space-4)",
                    background: "var(--critical-bg)",
                    border: "1px solid var(--critical-border)",
                    borderRadius: "var(--radius-md)",
                    fontFamily: "var(--font-body)",
                    fontSize: "var(--text-sm)",
                    color: "var(--critical)",
                  }}
                >
                  {error}
                </div>
              )}

              <div style={{ marginBottom: "var(--space-5)" }}>
                <label
                  htmlFor="forgot-email"
                  style={{
                    display: "block",
                    fontFamily: "var(--font-body)",
                    fontSize: "var(--text-xs)",
                    fontWeight: 600,
                    color: "var(--text-muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.8px",
                    marginBottom: "var(--space-2)",
                  }}
                >
                  Email
                </label>
                <div style={{ position: "relative" }}>
                  <Mail
                    size={14}
                    style={{
                      position: "absolute",
                      left: 12,
                      top: "50%",
                      transform: "translateY(-50%)",
                      color: "var(--text-ghost)",
                      pointerEvents: "none",
                    }}
                  />
                  <input
                    id="forgot-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="you@example.com"
                    autoFocus
                    style={{
                      width: "100%",
                      padding: "10px 12px 10px 36px",
                      fontFamily: "var(--font-body)",
                      fontSize: "var(--text-base)",
                      color: "var(--text-primary)",
                      background: "rgba(0, 0, 0, 0.35)",
                      border: "1px solid var(--border-default)",
                      borderRadius: "var(--radius-md)",
                      outline: "none",
                      transition: "border-color 200ms, box-shadow 200ms",
                      boxSizing: "border-box",
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = "var(--accent)";
                      e.currentTarget.style.boxShadow = "var(--focus-ring)";
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = "var(--border-default)";
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "var(--space-2)",
                  padding: "11px 0",
                  fontFamily: "var(--font-body)",
                  fontSize: "var(--text-base)",
                  fontWeight: 600,
                  color: "#fff",
                  background: "var(--gradient-crimson)",
                  border: "1px solid var(--primary-light)",
                  borderRadius: "var(--radius-md)",
                  cursor: loading ? "not-allowed" : "pointer",
                  opacity: loading ? 0.6 : 1,
                  transition:
                    "opacity 200ms, box-shadow 200ms, transform 100ms",
                  boxShadow: "0 4px 20px var(--primary-glow)",
                  letterSpacing: "0.3px",
                }}
                onMouseEnter={(e) => {
                  if (!loading) {
                    e.currentTarget.style.boxShadow =
                      "0 6px 28px var(--primary-glow)";
                    e.currentTarget.style.transform = "translateY(-1px)";
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow =
                    "0 4px 20px var(--primary-glow)";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                {loading ? (
                  <>
                    <Loader2
                      size={16}
                      style={{ animation: "spin 1s linear infinite" }}
                    />
                    Sending...
                  </>
                ) : (
                  "Send temporary password"
                )}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Verify TypeScript compiles**

Run: `cd /home/smudoshi/Github/Parthenon/frontend && npx tsc --noEmit --pretty 2>&1 | grep -i "ForgotPasswordModal" || echo "No errors for ForgotPasswordModal"`
Expected: No type errors

### Task 4: Add link and modal to LoginPage

**Files:**
- Modify: `frontend/src/features/auth/pages/LoginPage.tsx`

- [ ] **Step 9: Add import for ForgotPasswordModal**

At line 6 (after `ConstellationBackground` import), add:

```tsx
import { ForgotPasswordModal } from "../components/ForgotPasswordModal";
```

- [ ] **Step 10: Add modal state**

Inside the `LoginPage` component, after the `loading` state declaration (line 19), add:

```tsx
const [forgotOpen, setForgotOpen] = useState(false);
```

- [ ] **Step 11: Add "Forgot password?" link**

Replace the password field wrapper (the `<div style={{ marginBottom: "var(--space-6)" }}>` that contains the password label + input, lines 566-624) — change only the `marginBottom` from `var(--space-6)` to `var(--space-3)` on line 566.

Then insert this block after the password field div closes (after line 624), before the demo credentials button:

```tsx
            {/* Forgot password link */}
            <div
              style={{
                textAlign: "right",
                marginBottom: "var(--space-4)",
              }}
            >
              <button
                type="button"
                onClick={() => setForgotOpen(true)}
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  fontFamily: "var(--font-body)",
                  fontSize: "var(--text-sm)",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                  transition: "color 200ms",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "var(--accent)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "var(--text-muted)";
                }}
              >
                Forgot password?
              </button>
            </div>
```

- [ ] **Step 12: Add the modal component to the JSX**

Insert the `ForgotPasswordModal` just before the closing `</div>` of the root element (before line 764):

```tsx
      <ForgotPasswordModal
        isOpen={forgotOpen}
        onClose={() => setForgotOpen(false)}
        defaultEmail={email}
      />
```

- [ ] **Step 13: Verify TypeScript compiles**

Run: `cd /home/smudoshi/Github/Parthenon/frontend && npx tsc --noEmit`
Expected: Clean exit (no errors)

- [ ] **Step 14: Commit frontend changes**

```bash
git add frontend/src/features/auth/components/ForgotPasswordModal.tsx frontend/src/features/auth/pages/LoginPage.tsx
git commit -m "feat: add forgot password modal to login page"
```

---

## Chunk 3: Documentation & Deploy

### Task 5: Update auth-system.md

**Files:**
- Modify: `.claude/rules/auth-system.md`

- [ ] **Step 15: Add `forgotPassword()` to the endpoint list**

In the Backend (Laravel) section, after the `logout()` bullet (line 13), add:

```markdown
  - `forgotPassword()` — Public endpoint, generates new temp password, revokes tokens, emails via TempPasswordMail, sets must_change_password=true
```

In the Frontend section, after the `LoginPage.tsx` bullet (line 20), add:

```markdown
- `frontend/src/features/auth/components/ForgotPasswordModal.tsx` — Email input modal for password reset requests
```

In the Enforced Auth Flow section, after step 1 (line 34), add a new step 1b:

```markdown
1b. Existing user who forgot password clicks "Forgot password?" on login page → enters email → receives new temp password → flow continues from step 5
```

- [ ] **Step 16: Commit docs**

```bash
git add .claude/rules/auth-system.md docs/superpowers/specs/2026-03-13-forgot-password-design.md docs/superpowers/plans/2026-03-13-forgot-password.md
git commit -m "docs: add forgot-password spec, plan, and update auth-system rules"
```

### Task 6: Build & Deploy

- [ ] **Step 17: Build frontend and deploy**

Run: `cd /home/smudoshi/Github/Parthenon && ./deploy.sh`

If deploy.sh fails (Docker Desktop issue), fallback:
```bash
cd /home/smudoshi/Github/Parthenon/frontend && npx vite build
docker compose exec php kill -USR2 1
```

- [ ] **Step 18: Smoke test in browser**

Navigate to `https://parthenon.acumenus.net/login`:
1. Verify "Forgot password?" link appears below password field
2. Click it — modal should open
3. Enter an email, submit — should show success message
4. Modal should auto-close after 5 seconds
