from django.contrib import admin
from .models import ShoppingNote, NoteRevision, Photo, UpdateRun
@admin.register(ShoppingNote)
class NoteAdmin(admin.ModelAdmin):
    list_display=('id','owner','created_at','version','deleted')
    readonly_fields=('id','owner','source_id','created_at','version','deleted')
    def has_add_permission(self,request): return False
@admin.register(NoteRevision)
class RevisionAdmin(admin.ModelAdmin):
    readonly_fields=('note','version','data')
    def has_add_permission(self,request): return False
    def has_delete_permission(self,request,obj=None): return False
@admin.register(Photo)
class PhotoAdmin(admin.ModelAdmin):
    exclude=('data',)
    readonly_fields=('id','owner','source_id','kind','sha256','width','height','created_at')
    def has_add_permission(self,request): return False


admin.site.register(UpdateRun)
