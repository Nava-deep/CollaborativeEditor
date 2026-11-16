from django.contrib.auth import authenticate, get_user_model
from django.db.models import Q
from rest_framework import decorators, permissions, response, status, viewsets
from rest_framework.authtoken.models import Token
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.views import APIView

from .models import Document, DocumentMembership
from .serializers import (
    DocumentListSerializer,
    DocumentSerializer,
    MembershipSerializer,
    RegisterSerializer,
    ShareRequestSerializer,
    UserSerializer,
)

User = get_user_model()


class RegisterView(APIView):
    permission_classes = (permissions.AllowAny,)

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        token, _ = Token.objects.get_or_create(user=user)
        return response.Response({"token": token.key, "user": UserSerializer(user).data}, status=status.HTTP_201_CREATED)


class AuthViewSet(viewsets.ViewSet):
    permission_classes = (permissions.AllowAny,)

    def create(self, request):
        username = request.data.get("username", "")
        password = request.data.get("password", "")
        user = authenticate(request, username=username, password=password)
        if not user:
            return response.Response({"detail": "Username or password is incorrect."}, status=status.HTTP_400_BAD_REQUEST)
        token, _ = Token.objects.get_or_create(user=user)
        return response.Response({"token": token.key, "user": UserSerializer(user).data})

    @decorators.action(detail=False, methods=("get",), permission_classes=(permissions.IsAuthenticated,))
    def me(self, request):
        return response.Response(UserSerializer(request.user).data)

    @decorators.action(detail=False, methods=("post",), permission_classes=(permissions.IsAuthenticated,))
    def logout(self, request):
        request.auth.delete()
        return response.Response(status=status.HTTP_204_NO_CONTENT)


class DocumentViewSet(viewsets.ModelViewSet):
    permission_classes = (permissions.IsAuthenticated,)

    def get_queryset(self):
        user = self.request.user
        queryset = Document.objects.filter(
            Q(owner=user) | Q(memberships__user=user, memberships__access__in=("read", "write", "full"))
        ).select_related("owner").prefetch_related("memberships")
        if self.action == "list":
            return queryset.defer("content")
        return queryset.distinct()

    def get_serializer_class(self):
        return DocumentListSerializer if self.action == "list" else DocumentSerializer

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    def _access(self, document):
        if document.owner_id == self.request.user.id:
            return "owner"
        membership = document.memberships.filter(user=self.request.user).only("access").first()
        return membership.access if membership else "none"

    def check_write_access(self, document):
        if self._access(document) not in ("owner", "write", "full"):
            raise PermissionDenied("You have read-only access to this document.")

    def check_full_access(self, document):
        if self._access(document) not in ("owner", "full"):
            raise PermissionDenied("Only the owner or a full-access collaborator can do this.")

    def update(self, request, *args, **kwargs):
        self.check_write_access(self.get_object())
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        self.check_write_access(self.get_object())
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        document = self.get_object()
        self.check_full_access(document)
        from asgiref.sync import async_to_sync
        from channels.layers import get_channel_layer

        async_to_sync(get_channel_layer().group_send)(
            f"document_{document.id}", {"type": "document.deleted"}
        )
        return super().destroy(request, *args, **kwargs)

    @decorators.action(detail=True, methods=("post",), url_path="duplicate")
    def duplicate(self, request, pk=None):
        source = self.get_object()
        self.check_write_access(source)
        clone = Document.objects.create(
            owner=request.user,
            title=f"{source.title} copy",
            content=source.content,
            version=source.version,
        )
        return response.Response(DocumentSerializer(clone, context=self.get_serializer_context()).data, status=status.HTTP_201_CREATED)

    @decorators.action(detail=True, methods=("get", "post", "delete"), url_path="share")
    def share(self, request, pk=None):
        document = self.get_object()
        self.check_full_access(document)
        if request.method == "GET":
            members = document.memberships.select_related("user").all()
            return response.Response(MembershipSerializer(members, many=True).data)

        if request.method == "DELETE":
            username = str(request.data.get("username", "")).strip()
            membership = document.memberships.select_related("user").filter(user__username__iexact=username).first()
            if not membership:
                raise ValidationError({"username": "This user does not have an explicit access entry."})
            membership.delete()
            from asgiref.sync import async_to_sync
            from channels.layers import get_channel_layer

            async_to_sync(get_channel_layer().group_send)(
                f"document_{document.id}",
                {"type": "access.changed", "user_id": membership.user_id, "access": "none"},
            )
            return response.Response(status=status.HTTP_204_NO_CONTENT)

        serializer = ShareRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        username = serializer.validated_data["username"].strip()
        access = serializer.validated_data["access"]
        try:
            user = User.objects.get(username__iexact=username)
        except User.DoesNotExist:
            raise ValidationError({"username": "No account exists with that username."})
        if user.id == document.owner_id:
            raise ValidationError({"username": "The owner already has full access."})
        membership, _ = DocumentMembership.objects.update_or_create(
            document=document,
            user=user,
            defaults={"access": access},
        )
        from asgiref.sync import async_to_sync
        from channels.layers import get_channel_layer

        async_to_sync(get_channel_layer().group_send)(
            f"document_{document.id}",
            {"type": "access.changed", "user_id": user.id, "access": access},
        )
        return response.Response(MembershipSerializer(membership).data, status=status.HTTP_200_OK)
