from django.conf import settings
from django.db import models


class Document(models.Model):
    title = models.CharField(max_length=180, default="Untitled document")
    content = models.TextField(blank=True)
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="owned_documents")
    version = models.PositiveBigIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True, db_index=True)

    class Meta:
        ordering = ("-updated_at", "-id")
        indexes = [models.Index(fields=("owner", "-updated_at"), name="doc_owner_updated_idx")]

    def __str__(self):
        return self.title


class DocumentMembership(models.Model):
    class Access(models.TextChoices):
        READ = "read", "Can read"
        WRITE = "write", "Can write"
        FULL = "full", "Full access"
        NONE = "none", "No access"

    document = models.ForeignKey(Document, on_delete=models.CASCADE, related_name="memberships")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="document_memberships")
    access = models.CharField(max_length=8, choices=Access.choices, default=Access.READ)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=("document", "user"), name="unique_document_member")]
        indexes = [models.Index(fields=("user", "access", "document"), name="member_access_lookup_idx")]
        ordering = ("user__username",)

    def __str__(self):
        return f"{self.user} · {self.document} · {self.access}"
