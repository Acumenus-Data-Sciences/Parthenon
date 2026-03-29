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
            <div style="font-size:14px;color:#C5C0B8;line-height:1.7;white-space:pre-line;">{!! nl2br(e($emailBody)) !!}</div>

            <div style="margin-top:32px;text-align:center;">
              <a href="{{ $appUrl }}" style="display:inline-block;background:linear-gradient(135deg,#9B1B30 0%,#6A1220 100%);color:#F0EDE8;text-decoration:none;font-size:14px;font-weight:600;padding:13px 32px;border-radius:8px;letter-spacing:0.3px;border:1px solid rgba(184,45,66,0.4);box-shadow:0 4px 20px rgba(155,27,48,0.4);">
                Open Parthenon
              </a>
            </div>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="border-top:1px solid #2A2A30;padding:20px 40px;text-align:center;">
            <p style="margin:0;font-size:12px;color:#5A5650;line-height:1.6;">
              Sent by {{ $senderName }} via Parthenon.<br>
              &copy; {{ date('Y') }} Acumenus Data Sciences
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
