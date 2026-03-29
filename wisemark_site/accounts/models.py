from django.conf import settings
from django.db import models
from django.utils import timezone


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

    def plan_allows_app_use(self):
        """True if user may use projects, documents, lenses, and the viewer."""
        now = timezone.now()
        if self.account_type == self.PAID:
            return True
        if self.account_type == self.TRIAL:
            if self.trial_expires_at is None:
                return True
            return self.trial_expires_at > now
        return False

    def is_trial_expired(self):
        """True only for trial accounts with a set end time that has passed."""
        if self.account_type != self.TRIAL:
            return False
        if self.trial_expires_at is None:
            return False
        return self.trial_expires_at <= timezone.now()


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
