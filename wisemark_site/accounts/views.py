import json
import logging
import math
import random
import string

import stripe
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.mail import EmailMultiAlternatives, get_connection
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from datetime import timedelta

logger = logging.getLogger(__name__)

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.authtoken.models import Token

from .models import Account, SignOnCode

User = get_user_model()

CODE_LENGTH = 6
CODE_TTL_MINUTES = 10
BETA_CODE = 'WM1994'


def _stripe_metadata_dict(metadata):
    """Stripe returns metadata as StripeObject; use a real dict for .get() / validation."""
    if metadata is None:
        return {}
    if isinstance(metadata, dict):
        return metadata
    to_dict = getattr(metadata, 'to_dict', None)
    if callable(to_dict):
        try:
            return dict(to_dict(recursive=False))
        except (TypeError, ValueError):
            pass
    try:
        return {k: metadata[k] for k in metadata}
    except (KeyError, TypeError, AttributeError):
        return {}


def _stripe_price_id_and_mode():
    """Return (price_id_str, mode) for the configured product, or (None, None) if misconfigured."""
    stripe.api_key = settings.STRIPE_SK
    product = stripe.Product.retrieve(settings.STRIPE_PRODUCT_ID)
    price_id = product.default_price
    if not price_id:
        prices = stripe.Price.list(product=settings.STRIPE_PRODUCT_ID, active=True, limit=1)
        if not prices.data:
            return None, None
        price_id = prices.data[0].id
    price_obj = stripe.Price.retrieve(price_id) if isinstance(price_id, str) else price_id
    pid = price_id if isinstance(price_id, str) else price_id.id
    mode = 'subscription' if getattr(price_obj, 'type', None) == 'recurring' else 'payment'
    return pid, mode


def _attach_stripe_session_to_account(session, user):
    """Persist Stripe customer / subscription ids from a Checkout session."""
    account, _ = Account.objects.get_or_create(user=user)
    cid = session.customer
    if isinstance(cid, dict):
        cid = cid.get('id')
    sub_id = session.subscription
    if isinstance(sub_id, dict):
        sub_id = sub_id.get('id')
    elif sub_id is not None and not isinstance(sub_id, str) and hasattr(sub_id, 'id'):
        sub_id = sub_id.id
    updates = []
    if cid:
        account.stripe_customer_id = cid
        updates.append('stripe_customer_id')
    if sub_id:
        account.stripe_subscription_id = sub_id
        updates.append('stripe_subscription_id')
    if updates:
        account.save(update_fields=updates)


def _billing_payload(account):
    if not account:
        return {
            'account_type': None,
            'trial_expires_at': None,
            'trial_days_remaining': None,
            'has_recurring_subscription': False,
            'subscription_cancel_at_period_end': False,
            'plan_allows_app_use': False,
            'trial_expired': False,
        }
    trial_days = None
    if account.account_type == Account.TRIAL and account.trial_expires_at:
        delta = account.trial_expires_at - timezone.now()
        trial_days = max(0, int(math.ceil(delta.total_seconds() / 86400)))
    has_sub = bool(account.stripe_subscription_id)
    return {
        'account_type': account.account_type,
        'trial_expires_at': account.trial_expires_at.isoformat() if account.trial_expires_at else None,
        'trial_days_remaining': trial_days,
        'has_recurring_subscription': has_sub,
        'subscription_cancel_at_period_end': account.subscription_cancel_at_period_end,
        'plan_allows_app_use': account.plan_allows_app_use(),
        'trial_expired': account.is_trial_expired(),
    }


def _generate_code():
    return ''.join(random.choices(string.digits, k=CODE_LENGTH))


def _get_accounts_connection():
    """Return a Django SMTP connection using the accounts@ mailbox credentials."""
    return get_connection(
        backend='django.core.mail.backends.smtp.EmailBackend',
        host=getattr(settings, 'ACCOUNTS_EMAIL_HOST', None) or settings.EMAIL_HOST,
        port=getattr(settings, 'ACCOUNTS_EMAIL_PORT', None) or settings.EMAIL_PORT,
        username=getattr(settings, 'ACCOUNTS_EMAIL_HOST_USER', None) or settings.EMAIL_HOST_USER,
        password=getattr(settings, 'ACCOUNTS_EMAIL_HOST_PASSWORD', None) or settings.EMAIL_HOST_PASSWORD,
        use_tls=getattr(settings, 'ACCOUNTS_EMAIL_USE_TLS', True),
        use_ssl=False,
    )


def _get_tb_connection():
    """Return a Django SMTP connection using TB_EMAIL (tb@wisemarkhq.com) from .env."""
    return get_connection(
        backend='django.core.mail.backends.smtp.EmailBackend',
        host=getattr(settings, 'ACCOUNTS_EMAIL_HOST', None) or settings.EMAIL_HOST,
        port=getattr(settings, 'ACCOUNTS_EMAIL_PORT', None) or settings.EMAIL_PORT,
        username=getattr(settings, 'TB_EMAIL_HOST_USER', None),
        password=getattr(settings, 'TB_EMAIL_HOST_PASSWORD', None),
        use_tls=getattr(settings, 'ACCOUNTS_EMAIL_USE_TLS', True),
        use_ssl=False,
    )


def _send_welcome_email(user):
    """Send welcome email from tb@wisemarkhq.com when a user signs up."""
    from_email = getattr(settings, 'TB_DEFAULT_FROM_EMAIL', None)
    if not from_email:
        logger.warning('TB_DEFAULT_FROM_EMAIL not set; skipping welcome email')
        return
    conn = _get_tb_connection()
    if not conn.username or not conn.password:
        logger.warning('TB_EMAIL_HOST_USER or TB_EMAIL_HOST_PASSWORD not set; skipping welcome email')
        return
    name = (user.email or '').split('@')[0].replace('.', ' ').title() or 'there'
    from_addr = f'"Tom, WiseMark" <{from_email}>'
    subject = 'Two things happen when you use WiseMark'
    plain = f"""Welcome to WiseMark!


Two things happen when you use WiseMark.

First, you read better. Knowing you're about to annotate changes how you read. You slow down in the right places. You commit to a view. The discipline of structured annotation is most of the value, WiseMark just makes it frictionless.

Second, every annotation becomes part of your proprietary dataset. In six months you'll have something no AI can generate: a structured, searchable record of your own judgment across every deal you've reviewed.

It starts with the first document. Please let me know how you get on.

Tom
Founder, WiseMark
"""
    html = f"""\
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
        <tr>
          <td style="padding:32px 36px;">
            <p style="margin:0 0 1.25rem 0;font-size:16px;line-height:1.65;color:#1e293b;">Welcome to WiseMark!</p>
            <p style="margin:0 0 1.25rem 0;font-size:16px;line-height:1.65;color:#1e293b;">Two things happen when you use WiseMark.</p>
            <p style="margin:0 0 1.25rem 0;font-size:16px;line-height:1.65;color:#1e293b;">First, you read better. <strong>Knowing you're about to annotate changes how you read.</strong> You slow down in the right places. You commit to a view. The discipline of structured annotation is most of the value, WiseMark just makes it frictionless.</p>
            <p style="margin:0 0 1.25rem 0;font-size:16px;line-height:1.65;color:#1e293b;">Second, every annotation becomes part of your proprietary dataset. In six months you'll have something no AI can generate: <strong>a structured, searchable record of your own judgment across every deal you've reviewed.</strong></p>
            <p style="margin:0 0 1.25rem 0;font-size:16px;line-height:1.65;color:#1e293b;">It starts with the first document. Please let me know how you get on.</p>
            <p style="margin:0;font-size:16px;line-height:1.65;color:#1e293b;">Tom<br>Founder, WiseMark</p>
          </td>
        </tr>
        <tr>
          <td style="background:#f8fafc;padding:16px 36px;border-top:1px solid #e2e8f0;">
            <p style="margin:0;font-size:11px;color:#94a3b8;">&copy; 2026 WiseMark &middot; wisemarkhq.com</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""
    msg = EmailMultiAlternatives(subject, plain, from_addr, [user.email])
    msg.attach_alternative(html, 'text/html')
    msg.connection = conn
    msg.send()


def _send_code_email(to_email, code, is_new_user=False):
    """Send the sign-in code via the accounts@ mailbox with a clean branded template."""
    subject = f'Your WiseMark {"sign-up" if is_new_user else "sign-in"} code'
    from_addr = f'WiseMark <{getattr(settings, "ACCOUNTS_DEFAULT_FROM_EMAIL", None) or settings.DEFAULT_FROM_EMAIL}>'

    html = f"""\
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 0;">
    <tr><td align="center">
      <table width="460" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
        <tr>
          <td style="padding:28px 32px 20px 32px;">
            <table cellpadding="0" cellspacing="0"><tr>
              <td style="width:28px;height:28px;background:#1e293b;border-radius:6px;text-align:center;vertical-align:middle;color:#ffffff;font-size:13px;font-weight:700;line-height:28px;">W</td>
              <td style="padding-left:10px;font-size:15px;font-weight:600;color:#1e293b;letter-spacing:-0.2px;">WiseMark</td>
            </tr></table>
          </td>
        </tr>
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
        <tr>
          <td style="padding:16px 32px 20px 32px;">
            <div style="background:#f1f5f9;border-radius:8px;padding:18px 0;text-align:center;letter-spacing:8px;font-size:32px;font-weight:700;color:#0f172a;font-family:'Courier New',monospace;">
              {code}
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:0 32px 28px 32px;">
            <p style="margin:0;font-size:12px;line-height:1.5;color:#94a3b8;">
              If you didn't request this code, you can safely ignore this email.
            </p>
          </td>
        </tr>
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

    msg = EmailMultiAlternatives(subject, plain, from_addr, [to_email])
    msg.attach_alternative(html, 'text/html')
    msg.connection = _get_accounts_connection()
    msg.send()


@api_view(['POST'])
@permission_classes([AllowAny])
def request_code(request):
    """Send a 6-digit code to the given email. Works for both new and existing users."""
    email = (request.data.get('email') or '').strip().lower()
    intent = (request.data.get('intent') or '').strip()
    if not email:
        logger.warning('request_code 400: email required')
        return Response({'email': ['This field is required.']}, status=status.HTTP_400_BAD_REQUEST)

    user_exists = User.objects.filter(email=email).exists()

    if intent == 'login' and not user_exists:
        logger.warning('request_code 400: no account for email (login)')
        return Response(
            {'detail': 'No account found with that email. Please register first.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if intent == 'register' and user_exists:
        logger.warning('request_code 400: account already exists (register)')
        return Response(
            {'detail': 'An account with this email already exists. Please sign in instead.', 'redirect': '/login'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if intent == 'register':
        beta_code = (request.data.get('beta_code') or '').strip()
        if beta_code != BETA_CODE:
            logger.warning('request_code 400: invalid or missing sign up code (register)')
            return Response(
                {'detail': 'Invalid sign up code.', 'beta_code': ['Please enter a valid sign up code.']},
                status=status.HTTP_400_BAD_REQUEST,
            )

    SignOnCode.objects.filter(email=email).delete()

    code = _generate_code()
    SignOnCode.objects.create(
        email=email,
        code=code,
        expires_at=timezone.now() + timedelta(minutes=CODE_TTL_MINUTES),
    )

    is_new = not user_exists

    try:
        _send_code_email(email, code, is_new_user=is_new)
    except Exception as exc:
        logger.exception('Failed to send sign-in code to %s', email)
        return Response(
            {'detail': f'Failed to send email: {exc}'},
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
    beta_code = (request.data.get('beta_code') or '').strip()

    if is_new_user:
        user = User.objects.create_user(username=email, email=email, password=None)
        user.set_unusable_password()
        user.save()

    account, created = Account.objects.get_or_create(user=user)
    if is_new_user and beta_code == BETA_CODE:
        account.is_beta = True
        account.account_type = Account.TRIAL
        account.trial_expires_at = timezone.now() + timedelta(days=30)
        account.save(update_fields=['is_beta', 'account_type', 'trial_expires_at'])
    token, _ = Token.objects.get_or_create(user=user)

    if is_new_user:
        try:
            _send_welcome_email(user)
        except Exception as exc:
            logger.exception('Failed to send welcome email to %s', user.email)

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
        'is_beta': getattr(account, 'is_beta', False) if account else False,
        'account_type': getattr(account, 'account_type', None) if account else None,
        'trial_expires_at': account.trial_expires_at.isoformat() if account and account.trial_expires_at else None,
        'billing': _billing_payload(account),
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def delete_account(request):
    """Permanently delete the current user and all their data."""
    user = request.user
    user.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['POST'])
@permission_classes([AllowAny])
def report_error(request):
    """Log a user-submitted error report (reference code + message). No auth required."""
    reference_code = (request.data.get('reference_code') or '').strip() or None
    message = (request.data.get('message') or '').strip() or None
    url = (request.data.get('url') or '').strip() or None
    email = (request.data.get('email') or '').strip() or None
    if not reference_code:
        return Response(
            {'detail': 'reference_code is required.'},
            status=status.HTTP_400_BAD_REQUEST,
        )
    logger.warning(
        'User error report [%s]: message=%r url=%r email=%r',
        reference_code,
        message,
        url,
        email,
        extra={'reference_code': reference_code},
    )
    return Response({'detail': 'Report received.'}, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([AllowAny])
def create_checkout_session(request):
    """Create a Stripe Checkout session for users without a sign-up code."""
    email = (request.data.get('email') or '').strip().lower()
    if not email:
        return Response({'detail': 'Email is required.'}, status=status.HTTP_400_BAD_REQUEST)

    if User.objects.filter(email=email).exists():
        return Response(
            {'detail': 'An account with this email already exists.', 'redirect': '/login'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    price_id, mode = _stripe_price_id_and_mode()
    if not price_id:
        logger.error('No active Stripe price found for product %s', settings.STRIPE_PRODUCT_ID)
        return Response({'detail': 'Payment configuration error.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    origin = (
        request.META.get('HTTP_ORIGIN')
        or settings.SITE_URL
        or f"{request.scheme}://{request.get_host()}"
    )

    session = stripe.checkout.Session.create(
        mode=mode,
        customer_email=email,
        line_items=[{'price': price_id, 'quantity': 1}],
        success_url=f'{origin}/register/success?session_id={{CHECKOUT_SESSION_ID}}',
        cancel_url=f'{origin}/register',
        metadata={'email': email},
    )

    return Response({'checkout_url': session.url})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_upgrade_checkout_session(request):
    """Stripe Checkout for a logged-in trial user to upgrade to paid."""
    account = getattr(request.user, 'wisemark_account', None)
    if not account or account.account_type != Account.TRIAL:
        return Response(
            {'detail': 'Only trial accounts can upgrade from here.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    price_id, mode = _stripe_price_id_and_mode()
    if not price_id:
        logger.error('No active Stripe price found for product %s', settings.STRIPE_PRODUCT_ID)
        return Response({'detail': 'Payment configuration error.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    email = request.user.email.strip().lower()
    origin = (
        request.META.get('HTTP_ORIGIN')
        or settings.SITE_URL
        or f"{request.scheme}://{request.get_host()}"
    )

    session = stripe.checkout.Session.create(
        mode=mode,
        customer_email=email,
        line_items=[{'price': price_id, 'quantity': 1}],
        success_url=f'{origin}/app/settings?billing=upgrade&session_id={{CHECKOUT_SESSION_ID}}',
        cancel_url=f'{origin}/app/settings',
        metadata={
            'email': email,
            'intent': 'upgrade',
            'user_id': str(request.user.id),
        },
    )

    return Response({'checkout_url': session.url})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def verify_upgrade_session(request):
    """Complete a trial → paid upgrade after Stripe Checkout redirect."""
    session_id = (request.data.get('session_id') or '').strip()
    if not session_id:
        return Response({'detail': 'session_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

    stripe.api_key = settings.STRIPE_SK
    try:
        session = stripe.checkout.Session.retrieve(session_id, expand=['subscription'])
    except stripe.error.InvalidRequestError:
        return Response({'detail': 'Invalid checkout session.'}, status=status.HTTP_400_BAD_REQUEST)

    if session.payment_status != 'paid':
        return Response({'detail': 'Payment not completed.'}, status=status.HTTP_400_BAD_REQUEST)

    meta = _stripe_metadata_dict(session.metadata)
    if meta.get('intent') != 'upgrade' or str(meta.get('user_id')) != str(request.user.id):
        return Response({'detail': 'Invalid checkout session.'}, status=status.HTTP_400_BAD_REQUEST)

    email_session = (session.customer_email or meta.get('email') or '').strip().lower()
    if email_session != request.user.email.strip().lower():
        return Response({'detail': 'Email does not match this account.'}, status=status.HTTP_400_BAD_REQUEST)

    account = getattr(request.user, 'wisemark_account', None)
    if not account:
        return Response({'detail': 'Account not found.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    account.account_type = Account.PAID
    account.trial_expires_at = None
    account.subscription_cancel_at_period_end = False
    account.save(update_fields=['account_type', 'trial_expires_at', 'subscription_cancel_at_period_end'])
    _attach_stripe_session_to_account(session, request.user)

    return Response({'detail': 'Upgrade complete.'})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def cancel_subscription(request):
    """Cancel the Stripe subscription immediately, then delete the user and all WiseMark data."""
    user = request.user
    account = getattr(user, 'wisemark_account', None)
    if not account or not account.stripe_subscription_id:
        return Response(
            {'detail': 'No active subscription to cancel.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    stripe.api_key = settings.STRIPE_SK
    sub_id = account.stripe_subscription_id
    try:
        stripe.Subscription.cancel(sub_id)
    except stripe.error.InvalidRequestError as e:
        err = str(e).lower()
        if 'no such subscription' in err or 'could not be found' in err:
            logger.info('Stripe subscription already removed: %s', sub_id)
        elif 'canceled' in err or 'cancelled' in err or 'already been canceled' in err:
            logger.info('Stripe subscription already canceled: %s', sub_id)
        else:
            logger.warning('Stripe cancel subscription failed: %s', e)
            return Response(
                {'detail': 'Could not cancel subscription in billing. Try again or contact support.'},
                status=status.HTTP_502_BAD_GATEWAY,
            )
    except stripe.error.StripeError as e:
        logger.warning('Stripe cancel subscription failed: %s', e)
        return Response(
            {'detail': 'Could not cancel subscription. Try again or contact support.'},
            status=status.HTTP_502_BAD_GATEWAY,
        )

    user.delete()
    return Response({
        'detail': 'Your subscription was cancelled and your WiseMark account has been deleted.',
        'redirect': '/login',
    })


def _create_paid_user(email):
    """Create a paid user account after successful Stripe checkout. Returns True if a new user was created."""
    email = email.strip().lower()
    if User.objects.filter(email=email).exists():
        return False
    user = User.objects.create_user(username=email, email=email, password=None)
    user.set_unusable_password()
    user.save()
    account, _ = Account.objects.get_or_create(user=user)
    account.account_type = Account.PAID
    account.trial_expires_at = None
    account.save(update_fields=['account_type', 'trial_expires_at'])
    try:
        _send_welcome_email(user)
    except Exception:
        logger.exception('Failed to send welcome email after Stripe payment to %s', email)
    logger.info('Created paid user %s after Stripe checkout', email)
    return True


@csrf_exempt
def stripe_webhook(request):
    """Handle Stripe webhook events (plain Django view for raw body access)."""
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    payload = request.body
    sig_header = request.META.get('HTTP_STRIPE_SIGNATURE', '')
    webhook_secret = getattr(settings, 'STRIPE_WEBHOOK_SECRET', '')

    stripe.api_key = settings.STRIPE_SK

    if webhook_secret:
        try:
            event = stripe.Webhook.construct_event(payload, sig_header, webhook_secret)
        except (ValueError, stripe.error.SignatureVerificationError) as e:
            logger.warning('Stripe webhook signature verification failed: %s', e)
            return JsonResponse({'error': 'Invalid signature'}, status=400)
    else:
        try:
            event = json.loads(payload)
        except json.JSONDecodeError:
            return JsonResponse({'error': 'Invalid payload'}, status=400)

    event_type = event.get('type') if isinstance(event, dict) else event.type
    if event_type == 'checkout.session.completed':
        session_data = event['data']['object'] if isinstance(event, dict) else event.data.object
        session_id = session_data.get('id') if isinstance(session_data, dict) else getattr(session_data, 'id', None)
        meta_raw = (
            session_data.get('metadata')
            if isinstance(session_data, dict)
            else getattr(session_data, 'metadata', None)
        )
        meta = _stripe_metadata_dict(meta_raw)
        email = (
            (session_data.get('customer_email') if isinstance(session_data, dict) else getattr(session_data, 'customer_email', None))
            or meta.get('email')
        )
        if email and session_id:
            email = email.strip().lower()
            _create_paid_user(email)
            try:
                full_session = stripe.checkout.Session.retrieve(session_id, expand=['subscription'])
                user = User.objects.filter(email=email).first()
                if user:
                    _attach_stripe_session_to_account(full_session, user)
            except stripe.error.StripeError:
                logger.exception('Webhook: could not attach Stripe session %s', session_id)

    return JsonResponse({'status': 'ok'})


@api_view(['POST'])
@permission_classes([AllowAny])
def verify_checkout(request):
    """Verify a completed Stripe Checkout session and create the user account."""
    session_id = (request.data.get('session_id') or '').strip()
    if not session_id:
        return Response({'detail': 'session_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

    stripe.api_key = settings.STRIPE_SK
    try:
        session = stripe.checkout.Session.retrieve(session_id, expand=['subscription'])
    except stripe.error.InvalidRequestError:
        return Response({'detail': 'Invalid checkout session.'}, status=status.HTTP_400_BAD_REQUEST)

    if session.payment_status != 'paid':
        return Response({'detail': 'Payment not completed.'}, status=status.HTTP_400_BAD_REQUEST)

    email = session.customer_email or _stripe_metadata_dict(session.metadata).get('email')
    if not email:
        return Response({'detail': 'No email associated with this session.'}, status=status.HTTP_400_BAD_REQUEST)

    email = email.strip().lower()
    created = _create_paid_user(email)

    user = User.objects.filter(email=email).first()
    if user:
        _attach_stripe_session_to_account(session, user)

    SignOnCode.objects.filter(email=email).delete()
    code = _generate_code()
    SignOnCode.objects.create(
        email=email,
        code=code,
        expires_at=timezone.now() + timedelta(minutes=CODE_TTL_MINUTES),
    )
    try:
        _send_code_email(email, code, is_new_user=created)
    except Exception:
        logger.exception('Failed to send login code after checkout for %s', email)

    return Response({'created': created, 'email': email})
