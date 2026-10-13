from django.urls import path
from django.contrib import admin
from django.views.generic import RedirectView
from ledger import views as v
urlpatterns=[
 path('admin/',admin.site.urls),
 path('static/<path:path>',v.admin_static),
 path('',RedirectView.as_view(url='/app/',permanent=False)),
 path('app/',v.app_file),path('app/<path:path>',v.app_file),path('legacy/<path:path>',v.app_file),
 path('api/v1/health/',v.health),path('api/v1/auth/session/',v.session),
 path('api/v1/auth/register/',v.register),path('api/v1/auth/login/',v.sign_in),path('api/v1/auth/logout/',v.sign_out),
 path('api/v1/notes/',v.notes),path('api/v1/notes/batch/',v.batch),
 path('api/v1/notes/import/',v.import_notes),path('api/v1/notes/export/',v.export_notes),
 path('api/v1/notes/<uuid:id>/',v.note_detail),path('api/v1/notes/<uuid:id>/revisions/',v.revisions),
 path('api/v1/photos/',v.upload_photo),path('api/v1/photos/<uuid:id>/',v.photo_detail),
 path('api/v1/summary/',v.summary),path('api/v1/prices/',v.prices),
]
