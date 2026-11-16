from channels.generic.websocket import AsyncJsonWebsocketConsumer


class DocumentConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.document_id = self.scope["url_route"]["kwargs"]["document_id"]
        self.user = None
        self.access = None
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_send(
                self.group_name,
                {"type": "presence.leave", "user_id": self.user.id, "username": self.user.username},
            )
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive_json(self, content, **kwargs):
        event_type = content.get("type")
        if self.user is None:
            if event_type == "auth":
                await self._authenticate(content.get("token", ""))
            else:
                await self.close(code=4401)
            return
        if event_type == "content.update":
            if self.access not in ("owner", "write", "full"):
                await self.send_json({"type": "permission.denied", "detail": "Your access is read only."})
                return
            from channels.db import database_sync_to_async
            from .models import Document

            text = content.get("content", "")
            if not isinstance(text, str) or len(text) > 2_000_000:
                await self.send_json({"type": "permission.denied", "detail": "Document content is invalid or too large."})
                return
            saved = await self._save_document(text, content.get("base_version"))
            if not saved:
                document = await database_sync_to_async(lambda: Document.objects.filter(pk=self.document_id).values("content", "version").first())()
                if not document:
                    await self.send_json({"type": "document.deleted"})
                    await self.close(code=4404)
                    return
                await self.send_json({"type": "content.conflict", "content": document["content"], "version": document["version"]})
                return
            await self.channel_layer.group_send(
                self.group_name,
                {
                    "type": "content.update",
                    "content": saved["content"],
                    "version": saved["version"],
                    "user_id": self.user.id,
                    "username": self.user.username,
                },
            )
        elif event_type == "cursor.update":
            await self.channel_layer.group_send(
                self.group_name,
                {
                    "type": "cursor.update",
                    "user_id": self.user.id,
                    "username": self.user.username,
                    "anchor": max(0, int(content.get("anchor", 0))),
                    "head": max(0, int(content.get("head", 0))),
                },
            )

    async def _authenticate(self, key):
        from channels.db import database_sync_to_async

        @database_sync_to_async
        def get_user_and_access():
            from rest_framework.authtoken.models import Token
            from .models import Document, DocumentMembership

            token = Token.objects.select_related("user").filter(key=key).first()
            if not token:
                return None, None, None
            user = token.user
            document = Document.objects.filter(pk=self.document_id).only("owner_id", "content", "version", "title").first()
            if not document:
                return user, None, None
            if document.owner_id == user.id:
                return user, "owner", {"content": document.content, "version": document.version, "title": document.title}
            access = DocumentMembership.objects.filter(document_id=self.document_id, user=user).values_list("access", flat=True).first()
            return user, access, {"content": document.content, "version": document.version, "title": document.title}

        user, access, snapshot = await get_user_and_access()
        if access not in ("owner", "write", "read", "full"):
            await self.send_json({"type": "auth.error", "detail": "This account cannot access the document."})
            await self.close(code=4403)
            return
        self.user = user
        self.access = access
        self.group_name = f"document_{self.document_id}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.send_json({"type": "auth.success", "access": access, "user_id": user.id, "username": user.username, **snapshot})
        await self.channel_layer.group_send(
            self.group_name,
            {"type": "presence.join", "user_id": user.id, "username": user.username},
        )
        await self.channel_layer.group_send(
            self.group_name,
            {"type": "presence.request", "requester": self.channel_name},
        )

    async def content_update(self, event):
        await self.send_json({"type": "content.update", **event})

    async def presence_join(self, event):
        await self.send_json({"type": "presence.join", **event})

    async def presence_leave(self, event):
        await self.send_json({"type": "presence.leave", **event})

    async def presence_request(self, event):
        if event.get("requester") != self.channel_name:
            await self.channel_layer.send(
                event["requester"],
                {"type": "presence.snapshot", "user_id": self.user.id, "username": self.user.username},
            )

    async def presence_snapshot(self, event):
        await self.send_json({"type": "presence.snapshot", **event})

    async def cursor_update(self, event):
        await self.send_json({"type": "cursor.update", **event})

    async def access_changed(self, event):
        if event.get("user_id") != self.user.id:
            return
        self.access = event.get("access", "none")
        await self.send_json({"type": "access.changed", "access": self.access})
        if self.access == "none":
            await self.channel_layer.group_send(
                self.group_name,
                {"type": "presence.leave", "user_id": self.user.id, "username": self.user.username},
            )
            await self.channel_layer.group_discard(self.group_name, self.channel_name)
            del self.group_name
            await self.close(code=4403)

    async def document_deleted(self, event):
        await self.send_json({"type": "document.deleted"})
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)
            del self.group_name
        await self.close(code=4404)

    async def _save_document(self, content, base_version):
        from channels.db import database_sync_to_async

        @database_sync_to_async
        def save():
            from django.db import transaction
            from .models import Document

            with transaction.atomic():
                document = Document.objects.select_for_update().filter(pk=self.document_id).only("content", "version").first()
                if not document or document.version != base_version:
                    return None
                if document.content != content:
                    document.content = content
                    document.version += 1
                    document.save(update_fields=("content", "version", "updated_at"))
                return {"content": document.content, "version": document.version}

        return await save()
