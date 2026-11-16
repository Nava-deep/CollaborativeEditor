from django.contrib import admin
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from documents.views import AuthViewSet, DocumentViewSet, RegisterView

router = DefaultRouter()
router.register("documents", DocumentViewSet, basename="document")
router.register("auth", AuthViewSet, basename="auth")

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/register/", RegisterView.as_view(), name="register"),
    path("api/", include(router.urls)),
]
