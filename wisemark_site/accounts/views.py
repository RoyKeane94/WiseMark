import random
import string
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from django.conf import settings
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.authtoken.models import Token

from .models import Account, SignOnCode

User = get_user_model()

CODE_LENGTH = 6
CODE_TTL_MINUTES = 10


def _generate_code():
    return ''.join(random.choices(string.digits, k=CODE_LENGTH))


def _send_code_email(to_email, code, is_new_user=False):
    """Send the sign-in code via the accounts@ mailbox with a clean branded template."""
    subject = f'Your WiseMark {"sign-up" if is_new_user else "sign-in"} code'

    html = f"""\
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 0;">
    <tr><td align="center">
      <table width="460" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
        <!-- Header -->
        <tr>
          <td style="padding:28px 32px 20px 32px;">
            <table cellpadding="0" cellspacing="0"><tr>
              <td style="width:28px;height:28px;background:#1e293b;border-radius:6px;text-align:center;vertical-align:middle;color:#ffffff;font-size:13px;font-weight:700;line-height:28px;">W</td>
              <td style="padding-left:10px;font-size:15px;font-weight:600;color:#1e293b;letter-spacing:-0.2px;">WiseMark</td>
            </tr></table>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:0 32px 8px 32px;">
            <h1 style="margin:0 0 6px 0;font-size:20px;font-weight:600;color:#0f172a;">
              {'Welcome to WiseMark' if is_new_user else 'Sign in to WiseMark'}
            </h1>
            <p style="margin:0;font-size:14px;line-height:1.6;color:#64748b;">
              Enter the code below to {'create your account' if is_new_user else 'continue to your account'}. It expires in {CODE_TTL_MINUTES} minutes.
            </p>
          </td>
        </tr>
        <!-- Code -->
        <tr>
          <td style="padding:16px 32px 20px 32px;">
            <div style="background:#f1f5f9;border-radius:8px;padding:18px 0;text-align:center;letter-spacing:8px;font-size:32px;font-weight:700;color:#0f172a;font-family:'Courier New',monospace;">
              {code}
            </div>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:0 32px 28px 32px;">
            <p style="margin:0;font-size:12px;line-height:1.5;color:#94a3b8;">
              If you didn't request this code, you can safely ignore this email.
            </p>
          </td>
        </tr>
        <!-- Bottom bar -->
        <tr>
          <td style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e2e8f0;">
            <p style="margin:0;font-size:11px;color:#94a3b8;text-align:center;">
              &copy; 2026 WiseMark &middot; wisemarkhq.com
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""

    plain = (
        f"Your WiseMark {'sign-up' if is_new_user else 'sign-in'} code is: {code}\n\n"
        f"It expires in {CODE_TTL_MINUTES} minutes.\n\n"
        f"If you didn't request this, ignore this email."
    )

    from_addr = getattr(settings, 'ACCOUNTS_DEFAULT_FROM_EMAIL', None) or settings.DEFAULT_FROM_EMAIL
    smtp_user = getattr(settings, 'ACCOUNTS_EMAIL_HOST_USER', None) or settings.EMAIL_HOST_USER
    smtp_pass = getattr(settings, 'ACCOUNTS_EMAIL_HOST_PASSWORD', None) or settings.EMAIL_HOST_PASSWORD
    smtp_host = getattr(settings, 'ACCOUNTS_EMAIL_HOST', None) or settings.EMAIL_HOST
    smtp_port = getattr(settings, 'ACCOUNTS_EMAIL_PORT', None) or settings.EMAIL_PORT
    use_tls = getattr(settings, 'ACCOUNTS_EMAIL_USE_TLS', True)

    msg = MIMEMultipart('alternative')
    msg['Subject'] = subject
    msg['From'] = f'WiseMark <{from_addr}>'
    msg['To'] = to_email
    msg.attach(MIMEText(plain, 'plain'))
    msg.attach(MIMEText(html, 'html'))

    with smtplib.SMTP(smtp_host, smtp_port) as server:
        if use_tls:
            server.starttls()
        server.login(smtp_user, smtp_pass)
        server.sendmail(from_addr, [to_email], msg.as_string())


@api_view(['POST'])
@permission_classes([AllowAny])
def request_code(request):
    """Send a 6-digit code to the given email. Works for both new and existing users."""
    email = (request.data.get('email') or '').strip().lower()
    if not email:
        return Response({'email': ['This field is required.']}, status=status.HTTP_400_BAD_REQUEST)

    SignOnCode.objects.filter(email=email).delete()

    code = _generate_code()
    SignOnCode.objects.create(
        email=email,
        code=code,
        expires_at=timezone.now() + timedelta(minutes=CODE_TTL_MINUTES),
    )

    is_new = not User.objects.filter(email=email).exists()

    try:
        _send_code_email(email, code, is_new_user=is_new)
    except Exception:
        return Response(
            {'detail': 'Failed to send email. Please try again.'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    return Response({'detail': 'Code sent.', 'is_new_user': is_new})


@api_view(['POST'])
@permission_classes([AllowAny])
def verify_code(request):
    """Verify the code. Creates the user if they don't exist yet, then returns a token."""
    email = (request.data.get('email') or '').strip().lower()
    code = (request.data.get('code') or '').strip()

    if not email or not code:
        return Response({'detail': 'Email and code are required.'}, status=status.HTTP_400_BAD_REQUEST)

    record = SignOnCode.objects.filter(email=email, code=code).first()
    if not record:
        return Response({'detail': 'Invalid code.'}, status=status.HTTP_400_BAD_REQUEST)
    if record.expires_at < timezone.now():
        record.delete()
        return Response({'detail': 'Code has expired. Request a new one.'}, status=status.HTTP_400_BAD_REQUEST)

    record.delete()

    user = User.objects.filter(email=email).first()
    is_new_user = user is None

    if is_new_user:
        user = User.objects.create_user(username=email, email=email, password=None)
        user.set_unusable_password()
        user.save()

    Account.objects.get_or_create(user=user)
    token, _ = Token.objects.get_or_create(user=user)

    return Response({
        'token': token.key,
        'user_id': user.id,
        'is_new_user': is_new_user,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout(request):
    Token.objects.filter(user=request.user).delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def me(request):
    account = getattr(request.user, 'wisemark_account', None)
    return Response({
        'id': request.user.id,
        'username': request.user.username,
        'email': getattr(request.user, 'email', '') or '',
        'account_id': account.pk if account else None,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def delete_account(request):
    """Permanently delete the current user and all their data."""
    user = request.user
    user.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)
