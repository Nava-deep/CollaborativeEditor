from django.contrib import admin
from django.shortcuts import render
from django.urls import include, path, re_path
from rest_framework.routers import DefaultRouter

from documents.views import AuthViewSet, DocumentViewSet, RegisterView

router = DefaultRouter()
router.register("documents", DocumentViewSet, basename="document")
router.register("auth", AuthViewSet, basename="auth")


def editor_app(request, **kwargs):
    return render(request, "index.html")


def service_worker(request):
    response = render(request, "sw.js", content_type="application/javascript")
    response["Service-Worker-Allowed"] = "/"
    response["Cache-Control"] = "no-cache"
    return response

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/register/", RegisterView.as_view(), name="register"),
    path("api/", include(router.urls)),
    path("sw.js", service_worker, name="service-worker"),
    re_path(r"^docs/(?P<document_id>\d+)/?$", editor_app, name="editor-app"),
    path("", editor_app, name="home"),
]
