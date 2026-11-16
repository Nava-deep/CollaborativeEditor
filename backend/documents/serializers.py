from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from .models import Document, DocumentMembership

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("id", "username", "email")


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ("username", "email", "password")

    def validate_password(self, value):
        validate_password(value)
        return value

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)


class DocumentListSerializer(serializers.ModelSerializer):
    owner = serializers.CharField(source="owner.username", read_only=True)
    access = serializers.SerializerMethodField()

    class Meta:
        model = Document
        fields = ("id", "title", "owner", "access", "version", "created_at", "updated_at")

    def get_access(self, obj):
        if obj.owner_id == self.context["request"].user.id:
            return "owner"
        membership = next((m for m in obj.memberships.all() if m.user_id == self.context["request"].user.id), None)
        return membership.access if membership else "read"


class DocumentSerializer(serializers.ModelSerializer):
    owner = serializers.CharField(source="owner.username", read_only=True)
    access = serializers.SerializerMethodField()
    content = serializers.CharField(required=False, allow_blank=True, max_length=2_000_000)

    class Meta:
        model = Document
        fields = ("id", "title", "content", "owner", "access", "version", "created_at", "updated_at")
        read_only_fields = ("owner", "version", "created_at", "updated_at")

    def get_access(self, obj):
        if obj.owner_id == self.context["request"].user.id:
            return "owner"
        membership = next((m for m in obj.memberships.all() if m.user_id == self.context["request"].user.id), None)
        return membership.access if membership else "read"

    def update(self, instance, validated_data):
        content = validated_data.get("content", instance.content)
        if content != instance.content:
            instance.version += 1
        return super().update(instance, validated_data)


class MembershipSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)
    email = serializers.EmailField(source="user.email", read_only=True)

    class Meta:
        model = DocumentMembership
        fields = ("id", "username", "email", "access", "updated_at")


class ShareRequestSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    access = serializers.ChoiceField(choices=DocumentMembership.Access.choices)
