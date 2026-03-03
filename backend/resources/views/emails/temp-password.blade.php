<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Parthenon credentials</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0e0e11; color: #c9c9d0; margin: 0; padding: 40px 20px; }
    .container { max-width: 520px; margin: 0 auto; background: #16161b; border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 40px; }
    h1 { color: #f4f4f6; font-size: 22px; font-weight: 600; margin: 0 0 8px; }
    p { color: #9898a8; font-size: 15px; line-height: 1.6; margin: 0 0 16px; }
    .password-box { background: #0a0a0d; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 16px 20px; font-family: 'SF Mono', 'Fira Code', monospace; font-size: 20px; letter-spacing: 2px; color: #e85d5d; margin: 24px 0; text-align: center; }
    .notice { background: rgba(232,93,93,0.08); border: 1px solid rgba(232,93,93,0.2); border-radius: 8px; padding: 14px 16px; font-size: 13px; color: #c47070; margin-top: 24px; }
    .footer { margin-top: 32px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.06); font-size: 12px; color: #555566; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Welcome to Parthenon</h1>
    <p>Hi {{ $userName }},</p>
    <p>Your account has been created. Use the temporary password below to sign in for the first time.</p>

    <div class="password-box">{{ $tempPassword }}</div>

    <p>After signing in, you will be prompted to set a new password before accessing the platform.</p>

    <div class="notice">
      This is a one-time temporary password. It cannot be used again once you have set your permanent password.
    </div>

    <p style="margin-top: 24px;">
      Sign in at: <a href="{{ $appUrl }}/login" style="color: #e85d5d;">{{ $appUrl }}/login</a>
    </p>

    <div class="footer">
      Parthenon &mdash; Unified Outcomes Research Platform<br>
      Acumenus Data Sciences
    </div>
  </div>
</body>
</html>
