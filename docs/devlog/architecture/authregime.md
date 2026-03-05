# Auth Regime: JWT Registration & Authentication System

A complete, self-contained authentication system for a React + Express + PostgreSQL application.
No third-party auth services required (Resend is optional, for email delivery only).

---

## Architecture Overview

```
Browser
  │
  ├─ POST /api/auth/register      ← public
  ├─ POST /api/auth/login         ← public
  │
  ├─ Authorization: Bearer <JWT>
  │
  ├─ POST /api/auth/change-password  ← requireAuth
  ├─ GET  /api/auth/me               ← requireAuth
  │
  └─ GET  /api/*                     ← requireAuth (all other routes)
       └─ GET /api/clearnetwork/*    ← requireAuth + requireAdmin
```

**Flow:**
1. Admin creates account via `seed-admin.js` (no email needed)
2. Regular users register → receive temp password by email
3. On first login, forced to change password (blocking modal)
4. JWT stored in `localStorage`, sent as `Authorization: Bearer` header on every request
5. `GET /api/auth/me` validates the stored token on app startup

---

## Stack

| Package | Purpose |
|---|---|
| `bcrypt` | Password hashing (cost factor 12) |
| `jsonwebtoken` | JWT sign/verify |
| `resend` | Transactional email (temp password delivery) |

Install in your Express server:
```bash
npm install bcrypt jsonwebtoken resend
```

---

## Database

```sql
CREATE TABLE IF NOT EXISTS users (
  id                   SERIAL PRIMARY KEY,
  email                TEXT NOT NULL UNIQUE,
  full_name            TEXT NOT NULL,
  phone                TEXT,
  password_hash        TEXT NOT NULL,
  must_change_password BOOLEAN NOT NULL DEFAULT true,
  is_active            BOOLEAN NOT NULL DEFAULT true,
  role                 TEXT NOT NULL DEFAULT 'user',   -- 'user' | 'admin'
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login           TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS users_email_idx ON users (email);
```

Run this automatically on server startup with an idempotent migration (see `server/lib/db-migrate.js`).

---

## Environment Variables

Add to your `.env`:
```
JWT_SECRET=<64-char random hex>
FROM_EMAIL=noreply@yourdomain.com
APP_URL=https://yourdomain.com
RESEND_API_KEY=<from resend.com>   # or store in .resendapikey file
```

Generate a JWT secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## File Structure

```
server/
  lib/
    db-migrate.js       ← CREATE TABLE IF NOT EXISTS on startup
    email.js            ← Resend wrapper for temp password emails
  middleware/
    auth.js             ← requireAuth, requireAdmin Express middleware
  routes/
    auth.js             ← register, login, change-password, me
scripts/
  seed-admin.js         ← interactive one-time admin creation
client/src/
  components/
    LoginPage.jsx / .module.css
    RegisterPage.jsx / .module.css
    ChangePasswordModal.jsx / .module.css
  hooks/
    useApi.js           ← injects JWT header, handles 401 globally
  App.jsx               ← auth state, token persistence, startup validation
```

---

## Server Implementation

### 1. Auto-migration (`server/lib/db-migrate.js`)

```js
import pool from '../db.js';

export async function runMigrations() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id                   SERIAL PRIMARY KEY,
      email                TEXT NOT NULL UNIQUE,
      full_name            TEXT NOT NULL,
      phone                TEXT,
      password_hash        TEXT NOT NULL,
      must_change_password BOOLEAN NOT NULL DEFAULT true,
      is_active            BOOLEAN NOT NULL DEFAULT true,
      role                 TEXT NOT NULL DEFAULT 'user',
      created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
      last_login           TIMESTAMPTZ
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS users_email_idx ON users (email);`);
  console.log('✦ users table ready');
}
```

### 2. Email (`server/lib/email.js`)

Key design: lazy Resend client instantiation — only created when a key is available, so a missing key doesn't crash the server at startup.

```js
import { Resend } from 'resend';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Read key from .resendapikey file OR env var
function loadResendKey() {
  try {
    const key = fs.readFileSync(
      path.resolve(__dirname, '../../.resendapikey'), 'utf8'
    ).trim();
    if (key) return key;
  } catch {}
  return process.env.RESEND_API_KEY || '';
}

function getResend() {
  const key = loadResendKey();
  if (!key) throw new Error('RESEND_API_KEY not configured');
  return new Resend(key);
}

export async function sendTempPassword(toEmail, name, tempPassword) {
  const resend = getResend();
  const { error } = await resend.emails.send({
    from: process.env.FROM_EMAIL,
    to: toEmail,
    subject: 'Your access credentials',
    html: `<p>Hi ${name},</p>
           <p>Temporary password: <code>${tempPassword}</code></p>
           <p>You must change it on first login.</p>`,
  });
  if (error) throw new Error(`Email failed: ${error.message}`);
}
```

### 3. Auth Middleware (`server/middleware/auth.js`)

```js
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export function requireAuth(req, res, next) {
  const header = req.headers['authorization'] || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = {
      id: payload.id,
      email: payload.email,
      role: payload.role,
      mustChangePassword: payload.mustChangePassword,
    };
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Apply AFTER requireAuth has already run (route-level guard)
export function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  next();
}
```

### 4. Auth Routes (`server/routes/auth.js`)

#### Rate limiting (in-memory, no Redis)

```js
const loginAttempts = new Map(); // ip → { count, resetAt }

function checkRateLimit(ip) {
  const now = Date.now();
  const window = 15 * 60 * 1000; // 15 min
  const entry = loginAttempts.get(ip);

  if (!entry || now > entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + window });
    return false; // not limited
  }
  if (entry.count >= 5) return true; // limited
  entry.count++;
  return false;
}

// Clean up stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of loginAttempts) {
    if (now > entry.resetAt) loginAttempts.delete(ip);
  }
}, 5 * 60 * 1000);
```

#### Temp password generator

```js
function generateTempPassword(length = 12) {
  // Excludes ambiguous chars (0/O, 1/l/I)
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < length; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}
```

#### JWT helper

```js
function signToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      mustChangePassword: user.must_change_password,
    },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}
```

#### POST /api/auth/register

```js
router.post('/register', async (req, res) => {
  const { email, fullName, phone } = req.body || {};

  if (!email || !fullName) return res.status(400).json({ error: '...' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: '...' });

  try {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      // IMPORTANT: return same success message to prevent email enumeration
      return res.json({ message: 'Account created. Check your email.' });
    }

    const tempPassword = generateTempPassword();
    const hash = await bcrypt.hash(tempPassword, 12);

    await pool.query(
      'INSERT INTO users (email, full_name, phone, password_hash) VALUES ($1, $2, $3, $4)',
      [email.toLowerCase(), fullName.trim(), phone?.trim() || null, hash]
    );

    try {
      await sendTempPassword(email, fullName, tempPassword);
    } catch (emailErr) {
      console.error('Email send error:', emailErr.message); // non-fatal
    }

    return res.json({ message: 'Account created. Check your email.' });
  } catch (err) {
    return res.status(500).json({ error: 'Registration failed' });
  }
});
```

#### POST /api/auth/login

```js
router.post('/login', async (req, res) => {
  const ip = req.ip || 'unknown';
  if (checkRateLimit(ip)) {
    return res.status(429).json({ error: 'Too many login attempts. Try again in 15 minutes.' });
  }

  const { email, password } = req.body || {};
  const result = await pool.query(
    'SELECT * FROM users WHERE email = $1 AND is_active = true',
    [email.toLowerCase()]
  );
  const user = result.rows[0];

  // IMPORTANT: same error for "not found" and "wrong password" to prevent enumeration
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  await pool.query('UPDATE users SET last_login = now() WHERE id = $1', [user.id]);
  const token = signToken(user);

  return res.json({
    token,
    user: { id: user.id, email: user.email, fullName: user.full_name,
            role: user.role, mustChangePassword: user.must_change_password },
  });
});
```

#### POST /api/auth/change-password

```js
router.post('/change-password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (newPassword.length < 8) return res.status(400).json({ error: 'Min 8 chars' });

  const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
  const user = rows[0];

  if (!(await bcrypt.compare(currentPassword, user.password_hash))) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }
  if (await bcrypt.compare(newPassword, user.password_hash)) {
    return res.status(400).json({ error: 'New password must differ from current' });
  }

  const newHash = await bcrypt.hash(newPassword, 12);
  await pool.query(
    'UPDATE users SET password_hash = $1, must_change_password = false WHERE id = $2',
    [newHash, user.id]
  );

  // Return new JWT with mustChangePassword=false so client updates without re-login
  const token = signToken({ ...user, password_hash: newHash, must_change_password: false });
  return res.json({ token, user: { ...user, mustChangePassword: false } });
});
```

#### GET /api/auth/me

```js
router.get('/me', requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id, email, full_name, phone, role, must_change_password FROM users WHERE id = $1',
    [req.user.id]
  );
  const u = rows[0];
  return res.json({ id: u.id, email: u.email, fullName: u.full_name,
                    phone: u.phone, role: u.role, mustChangePassword: u.must_change_password });
});
```

### 5. Mounting Order in `server/index.js`

**Critical:** auth routes must be registered BEFORE the blanket `requireAuth` guard.
Express processes middleware in registration order — once a route sends a response, subsequent middleware doesn't run.

```js
// 1. Auth routes — public (no token needed)
app.use('/api/auth', authRouter);

// 2. Protect ALL remaining /api routes
app.use('/api', requireAuth);

// 3. Protected routes (requireAuth already ran)
app.use('/api', apiRouter);
app.use('/api/admin-only-thing', requireAdmin, adminRouter); // role check on top of auth

// 4. Run migration, then listen
runMigrations().then(() => app.listen(PORT, ...));
```

---

## Admin Seed Script (`scripts/seed-admin.js`)

Run once to create (or upsert) the admin user:

```bash
cd scripts && node seed-admin.js
```

Key design decisions:
- Uses `ON CONFLICT (email) DO UPDATE` so re-running is safe
- Sets `must_change_password = false` (admin doesn't need to go through the forced-change flow)
- Sets `role = 'admin'`
- Prompts for password with TTY echo disabled

```js
await pool.query(
  `INSERT INTO users (email, full_name, password_hash, must_change_password, role)
   VALUES ($1, $2, $3, false, 'admin')
   ON CONFLICT (email) DO UPDATE
     SET password_hash = EXCLUDED.password_hash,
         full_name = EXCLUDED.full_name,
         role = 'admin',
         must_change_password = false`,
  [email, fullName, hash]
);
```

---

## Frontend Implementation

### App.jsx — Auth State

```jsx
export default function App() {
  const [authToken, setAuthToken] = useState(() => localStorage.getItem('authToken'));
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [showRegister, setShowRegister] = useState(false);

  // Validate stored token on startup
  useEffect(() => {
    if (!authToken) { setAuthChecked(true); return; }
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${authToken}` } })
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(data => setUser(data))
      .catch(() => { localStorage.removeItem('authToken'); setAuthToken(null); })
      .finally(() => setAuthChecked(true));
  }, []);

  // Wire global logout handler (called by useApi on any 401 response)
  useEffect(() => {
    setUnauthorizedHandler(() => handleLogout());
  }, []);

  function handleLogin(token, userData) {
    localStorage.setItem('authToken', token);
    setAuthToken(token);
    setUser(userData);
  }

  function handleLogout() {
    localStorage.removeItem('authToken');
    setAuthToken(null);
    setUser(null);
  }

  function handlePasswordChanged(newToken, newUser) {
    localStorage.setItem('authToken', newToken);
    setAuthToken(newToken);
    setUser(newUser);
  }

  if (!authChecked) return <Spinner />;

  if (!user) {
    return showRegister
      ? <RegisterPage onSignIn={() => setShowRegister(false)} />
      : <LoginPage onLogin={handleLogin} onRegister={() => setShowRegister(true)} />;
  }

  return (
    <>
      {/* Blocking modal — not dismissable — until password is changed */}
      {user.mustChangePassword && (
        <ChangePasswordModal token={authToken} onSuccess={handlePasswordChanged} />
      )}
      <YourApp onLogout={handleLogout} />
    </>
  );
}
```

### useApi.js — JWT Header + Global 401 Handler

```js
let _onUnauthorized = null;
export function setUnauthorizedHandler(fn) { _onUnauthorized = fn; }

export function useApi(path, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!path) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);

    const token = localStorage.getItem('authToken');
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    fetch(`/api${path}`, { headers })
      .then(r => {
        if (r.status === 401) { _onUnauthorized?.(); throw new Error('Unauthorized'); }
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(d => { if (!cancelled) setData(d); })
      .catch(e => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, deps);

  return { data, loading, error };
}
```

### LoginPage.jsx — Key Changes from Hardcoded Auth

Replace hardcoded credential check with a real API call:

```jsx
async function handleSubmit(e) {
  e.preventDefault();
  setBusy(true);
  setError('');

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), password }),
    });
    const data = await res.json();

    if (res.status === 429) {
      setError('Too many attempts. Try again in 15 minutes.');
      setPassword('');
    } else if (!res.ok) {
      setError(data.error || 'Invalid credentials');
      setPassword('');
    } else {
      onLogin(data.token, data.user);
    }
  } catch {
    setError('Network error. Please try again.');
  } finally {
    setBusy(false);
  }
}
```

### ChangePasswordModal.jsx — Blocking Overlay

```jsx
export default function ChangePasswordModal({ token, onSuccess }) {
  // ...state...

  async function handleSubmit(e) {
    e.preventDefault();
    if (newPw !== confirmPw) return setError('Passwords do not match');
    if (newPw.length < 8) return setError('Min 8 characters');

    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error || 'Password change failed');
    } else {
      // data.token is a new JWT with mustChangePassword=false
      onSuccess(data.token, data.user);
    }
  }

  return (
    // No backdrop click handler, no close button — intentionally non-dismissable
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, /* blur backdrop */ }}>
      <div role="dialog" aria-modal="true">
        {/* form */}
      </div>
    </div>
  );
}
```

---

## Security Decisions

| Concern | Mitigation |
|---|---|
| Password storage | `bcrypt` with cost=12 — ~300ms hash time, GPU-resistant |
| Temp password exposure | Single-use: `must_change_password=true` enforced server-side; modal is non-dismissable client-side |
| Brute force | 5 req/15min per IP in-memory rate limit on login. No Redis needed for small user bases |
| Token storage | `localStorage` — acceptable for internal tools. Use `httpOnly` cookie for public-facing apps |
| Token expiry | 7-day JWT. No refresh token — simpler, acceptable for internal tools |
| Email enumeration | Registration always returns the same success message whether email is new or duplicate |
| User enumeration on login | Same `"Invalid credentials"` for wrong email AND wrong password |
| SQL injection | Parameterized queries (`$1`, `$2` placeholders) throughout |
| JWT secret | 64-char random hex in `.env`, never committed to git. Add `.env` to `.gitignore` |
| Admin privilege | `requireAdmin` middleware checks `req.user.role === 'admin'` at route level |
| Forced password change | `must_change_password` field checked both server-side (in JWT payload) and enforced client-side with blocking modal |

---

## Gotchas & Lessons Learned

**1. Express middleware order is everything**

Auth routes MUST be registered before the blanket `requireAuth` guard:
```js
app.use('/api/auth', authRouter);  // public — registered first
app.use('/api', requireAuth);      // guard — registered second
app.use('/api', apiRouter);        // protected routes
```
If you reverse the first two lines, all auth routes return 401.

**2. Resend throws on instantiation with empty key**

Don't do `const resend = new Resend(key)` at module level — if the key is missing (e.g. not yet configured), the server will crash on startup. Use a lazy factory function instead:
```js
function getResend() {
  const key = loadKey();
  if (!key) throw new Error('not configured');
  return new Resend(key);
}
```

**3. ES module dotenv loading order**

In ES modules, all `import` statements are resolved before any code runs. As long as `db.js` (or any early dependency) calls `dotenv.config()`, the env vars are available for the rest of the module graph. But to be safe, explicitly call `dotenv.config()` in any file that reads `process.env` at module load time (not just at call time).

**4. `bcrypt` is CPU-bound — use async methods**

Always `await bcrypt.compare()` and `await bcrypt.hash()`. The sync versions block Node's event loop for ~300ms per call at cost=12, which will stall all concurrent requests.

**5. JWT payload vs database**

The `mustChangePassword` flag is baked into the JWT payload at login time. When the user changes their password, issue a NEW JWT with `mustChangePassword: false` in the payload. If you rely only on the database field, the old token will still appear to require a change until it expires.

**6. The `requireAdmin` guard assumes `requireAuth` already ran**

`requireAdmin` only checks `req.user.role`. Mount it after `requireAuth` in the middleware stack:
```js
app.use('/api', requireAuth);                      // sets req.user
app.use('/api/admin', requireAdmin, adminRouter);  // checks req.user.role
```
Don't call `requireAuth` inside `requireAdmin` — it would try to read the `Authorization` header a second time (which is fine but redundant, and confusing).

**7. Password change returns a new token**

After `change-password` succeeds, return a freshly-signed JWT. Without this, the client has to re-login to get a valid token, which is bad UX. The new token carries `mustChangePassword: false`, which is what dismisses the blocking modal.

---

## Deployment Checklist

```
□ Add JWT_SECRET to .env (generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
□ Add RESEND_API_KEY to .resendapikey or .env
□ Add FROM_EMAIL and APP_URL to .env
□ Add .env and .resendapikey to .gitignore
□ Build client: cd client && npm run build
□ Restart server (migration runs automatically, creates users table)
□ Seed admin: cd scripts && node seed-admin.js
□ Verify: curl -X POST /api/auth/login -H "Content-Type: application/json" -d '{"email":"admin@you.com","password":"yourpass"}'
□ Verify: curl /api/any-protected-route  → expect 401
□ Verify: curl /api/any-protected-route -H "Authorization: Bearer <token>"  → expect data
```

---

## Adapting to Another Application

1. **Copy these files verbatim** (update import paths to match your project):
   - `server/lib/db-migrate.js`
   - `server/lib/email.js`
   - `server/middleware/auth.js`
   - `server/routes/auth.js`
   - `scripts/seed-admin.js`

2. **In your server entry point:**
   ```js
   app.use('/api/auth', authRouter);     // public
   app.use('/api', requireAuth);         // guard
   // ... your other routes ...
   runMigrations().then(() => app.listen(PORT));
   ```

3. **In your React app** — three touch points:
   - `App.jsx`: add auth state + startup token validation
   - `useApi.js` (or equivalent fetch wrapper): inject `Authorization` header, handle 401
   - `LoginPage.jsx`: call `POST /api/auth/login` instead of checking hardcoded credentials

4. **Adjust these to taste:**
   - `JWT_EXPIRY` (`'7d'` → `'24h'` for stricter security, `'30d'` for convenience)
   - `BCRYPT_ROUNDS` (`12` is a good default; increase to `13` or `14` on powerful hardware)
   - Rate limit thresholds (5 attempts / 15 min per IP)
   - Temp password character set and length (12 chars, no ambiguous characters)
   - Whether to expose a public `/register` or keep it invite-only (just remove the `RegisterPage` link from `LoginPage`)
