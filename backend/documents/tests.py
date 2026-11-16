from django.contrib.auth import get_user_model
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase
from django.urls import reverse

from .models import Document, DocumentMembership

User = get_user_model()


class DocumentAccessTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username="owner", password="safepassword123")
        self.writer = User.objects.create_user(username="writer", password="safepassword123")
        self.reader = User.objects.create_user(username="reader", password="safepassword123")
        self.blocked = User.objects.create_user(username="blocked", password="safepassword123")
        self.document = Document.objects.create(owner=self.owner, title="Planning", content="First draft")
        DocumentMembership.objects.create(document=self.document, user=self.writer, access="write")
        DocumentMembership.objects.create(document=self.document, user=self.reader, access="read")
        DocumentMembership.objects.create(document=self.document, user=self.blocked, access="none")

    def authenticate(self, user):
        token, _ = Token.objects.get_or_create(user=user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")

    def test_writer_can_read_and_update_document(self):
        self.authenticate(self.writer)
        detail = reverse("document-detail", args=(self.document.id,))
        self.assertEqual(self.client.get(detail).status_code, 200)
        updated = self.client.patch(detail, {"content": "Updated by writer"}, format="json")
        self.assertEqual(updated.status_code, 200)
        self.document.refresh_from_db()
        self.assertEqual(self.document.content, "Updated by writer")
        self.assertEqual(self.document.version, 1)

    def test_reader_can_view_but_cannot_edit(self):
        self.authenticate(self.reader)
        detail = reverse("document-detail", args=(self.document.id,))
        self.assertEqual(self.client.get(detail).status_code, 200)
        self.assertEqual(self.client.patch(detail, {"content": "No"}, format="json").status_code, 403)

    def test_no_access_membership_is_not_visible(self):
        self.authenticate(self.blocked)
        self.assertEqual(self.client.get(reverse("document-detail", args=(self.document.id,))).status_code, 404)
        self.assertEqual(self.client.get(reverse("document-list")).data["count"], 0)

    def test_only_owner_can_change_shares_and_create_documents(self):
        self.authenticate(self.writer)
        share_url = reverse("document-share", args=(self.document.id,))
        self.assertEqual(self.client.post(share_url, {"username": "reader", "access": "write"}, format="json").status_code, 403)
        created = self.client.post(reverse("document-list"), {"title": "Writer document"}, format="json")
        self.assertEqual(created.status_code, 201)
        self.assertEqual(created.data["owner"], "writer")

    def test_owner_can_remove_access(self):
        self.authenticate(self.owner)
        share_url = reverse("document-share", args=(self.document.id,))
        result = self.client.post(share_url, {"username": "reader", "access": "none"}, format="json")
        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.data["access"], "none")
        self.authenticate(self.reader)
        self.assertEqual(self.client.get(reverse("document-detail", args=(self.document.id,))).status_code, 404)

    def test_document_list_does_not_return_content(self):
        self.authenticate(self.owner)
        row = self.client.get(reverse("document-list")).data["results"][0]
        self.assertNotIn("content", row)
