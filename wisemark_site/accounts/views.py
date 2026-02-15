from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.authtoken.models import Token

from .models import Account

User = get_user_model()


@api_view(['POST'])
@permission_classes([AllowAny])
def register(request):
    data = request.data
    email = (data.get('email') or '').strip().lower()
    password = data.get('password', '')

    if not email:
        return Response({'email': ['This field is required.']}, status=status.HTTP_400_BAD_REQUEST)
    if not password:
        return Response({'password': ['This field is required.']}, status=status.HTTP_400_BAD_REQUEST)
    if User.objects.filter(email=email).exists() or User.objects.filter(username=email).exists():
        return Response({'email': ['A user with that email already exists.']}, status=status.HTTP_400_BAD_REQUEST)

    user = User.objects.create_user(username=email, email=email, password=password)
    Account.objects.get_or_create(user=user)
    token, _ = Token.objects.get_or_create(user=user)
    return Response({'token': token.key, 'user_id': user.id}, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([AllowAny])
def login(request):
    email = (request.data.get('email') or '').strip().lower()
    password = request.data.get('password', '')

    if not email or not password:
        return Response({'detail': 'Email and password required.'}, status=status.HTTP_400_BAD_REQUEST)

    user = User.objects.filter(email=email).first() or User.objects.filter(username=email).first()
    if user is None or not user.check_password(password):
        return Response({'detail': 'Invalid credentials.'}, status=status.HTTP_401_UNAUTHORIZED)

    Account.objects.get_or_create(user=user)
    token, _ = Token.objects.get_or_create(user=user)
    return Response({'token': token.key, 'user_id': user.id})


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
