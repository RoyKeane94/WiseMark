from django.conf import settings
from django.db import models


class Account(models.Model):
    """WiseMark account: one per user, used for auth and profile."""

    TRIAL = 'trial'
    PAID = 'paid'
    ACCOUNT_TYPE_CHOICES = [
        (TRIAL, 'Trial'),
        (PAID, 'Paid'),
    ]

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='wisemark_account',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    is_beta = models.BooleanField(
        default=False,
        help_text='True if user signed up with a sign-up code.',
    )
    account_type = models.CharField(
        max_length=10,
        choices=ACCOUNT_TYPE_CHOICES,
        default=TRIAL,
    )
    trial_expires_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text='When the trial period ends. Null for paid accounts.',
    )
    stripe_customer_id = models.CharField(max_length=255, blank=True, default='')
    stripe_subscription_id = models.CharField(max_length=255, blank=True, default='')
    subscription_cancel_at_period_end = models.BooleanField(default=False)

    class Meta:
        ordering = ['-created_at']


class SignOnCode(models.Model):
    """One-time sign-on code sent to email. No password required."""

    email = models.EmailField()
    code = models.CharField(max_length=10)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()

    class Meta:
        indexes = [
            models.Index(fields=['email', 'code']),
            models.Index(fields=['expires_at']),
        ]
