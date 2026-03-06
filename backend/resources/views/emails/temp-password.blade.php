<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#08080A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;color:#C5C0B8;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#08080A;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#0E0E11;border:1px solid #2A2A30;border-radius:12px;overflow:hidden;">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#0E0E11 0%,#151518 100%);padding:32px 40px;text-align:center;border-bottom:1px solid #2A2A30;">
            <!-- Crimson accent line -->
            <div style="width:48px;height:3px;background:linear-gradient(135deg,#9B1B30,#6A1220);border-radius:99px;margin:0 auto 16px;"></div>
            <div style="font-size:26px;font-weight:400;letter-spacing:-0.025em;color:#F0EDE8;">
              Parthenon
            </div>
            <div style="font-size:12px;color:#5A5650;margin-top:6px;letter-spacing:0.5px;text-transform:uppercase;">
              Unified Outcomes Research Platform
            </div>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:40px;">
            <p style="margin:0 0 16px;font-size:16px;color:#F0EDE8;">Hi {{ $userName }},</p>
            <p style="margin:0 0 24px;font-size:14px;color:#8A857D;line-height:1.6;">
              Your Parthenon account has been created. Use the temporary password below to sign in.
              You will be prompted to choose a new password immediately after logging in.
            </p>

            <!-- Temp password block -->
            <div style="background:#08080A;border:1px solid rgba(155,27,48,0.4);border-radius:8px;padding:20px 24px;margin:0 0 28px;text-align:center;">
              <div style="font-size:11px;font-weight:600;color:#5A5650;letter-spacing:0.6px;text-transform:uppercase;margin-bottom:10px;">
                Temporary Password
              </div>
              <div style="font-family:'Courier New',monospace;font-size:22px;font-weight:700;color:#C9A227;letter-spacing:0.1em;">
                {{ $tempPassword }}
              </div>
            </div>

            <p style="margin:0 0 28px;font-size:13px;color:#5A5650;line-height:1.6;">
              This password is for one-time use only. After signing in you will be required to set a permanent password.
            </p>

            <!-- CTA -->
            <div style="text-align:center;">
              <a href="{{ $appUrl }}/login" style="display:inline-block;background:linear-gradient(135deg,#9B1B30 0%,#6A1220 100%);color:#F0EDE8;text-decoration:none;font-size:14px;font-weight:600;padding:13px 32px;border-radius:8px;letter-spacing:0.3px;border:1px solid rgba(184,45,66,0.4);box-shadow:0 4px 20px rgba(155,27,48,0.4);">
                Sign in to Parthenon
              </a>
            </div>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="border-top:1px solid #2A2A30;padding:20px 40px;text-align:center;">
            <p style="margin:0;font-size:12px;color:#5A5650;line-height:1.6;">
              If you did not request this account, please ignore this email.<br>
              &copy; {{ date('Y') }} Acumenus Data Sciences
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
