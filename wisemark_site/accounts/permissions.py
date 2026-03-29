from rest_framework.permissions import BasePermission


class HasActivePlanAccess(BasePermission):
    """Paid users, or trial users whose trial has not ended."""

    message = 'Your trial has ended. Upgrade to continue using WiseMark.'

    def has_permission(self, request, view):
        user = getattr(request, 'user', None)
        if not user or not user.is_authenticated:
            return False
        account = getattr(user, 'wisemark_account', None)
        if not account:
            return False
        return account.plan_allows_app_use()
