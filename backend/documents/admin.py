from django.contrib import admin

from .models import Document, DocumentMembership


class MembershipInline(admin.TabularInline):
    model = DocumentMembership
    extra = 0
    autocomplete_fields = ("user",)


@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display = ("title", "owner", "updated_at", "version")
    list_filter = ("updated_at",)
    search_fields = ("title", "owner__username")
    readonly_fields = ("version", "created_at", "updated_at")
    inlines = (MembershipInline,)


@admin.register(DocumentMembership)
class DocumentMembershipAdmin(admin.ModelAdmin):
    list_display = ("document", "user", "access", "updated_at")
    list_filter = ("access",)
    search_fields = ("document__title", "user__username")
