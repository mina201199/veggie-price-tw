import uuid
from django.db import models
from django.conf import settings

class Photo(models.Model):
    id=models.UUIDField(primary_key=True,default=uuid.uuid4,editable=False)
    owner=models.ForeignKey(settings.AUTH_USER_MODEL,on_delete=models.CASCADE)
    source_id=models.CharField(max_length=200,null=True,blank=True)
    kind=models.CharField(max_length=12,default='其他')
    data=models.BinaryField()
    sha256=models.CharField(max_length=64)
    width=models.PositiveIntegerField()
    height=models.PositiveIntegerField()
    created_at=models.DateTimeField(auto_now_add=True)
    class Meta:
        constraints=[models.UniqueConstraint(fields=['owner','source_id'],name='unique_photo_source')]

class ShoppingNote(models.Model):
    id=models.UUIDField(primary_key=True,default=uuid.uuid4,editable=False)
    owner=models.ForeignKey(settings.AUTH_USER_MODEL,on_delete=models.CASCADE)
    source_id=models.CharField(max_length=200,null=True,blank=True)
    created_at=models.DateTimeField()
    version=models.PositiveIntegerField(default=1)
    deleted=models.BooleanField(default=False)
    class Meta:
        constraints=[models.UniqueConstraint(fields=['owner','source_id'],name='unique_note_source')]

class NoteRevision(models.Model):
    note=models.ForeignKey(ShoppingNote,on_delete=models.CASCADE,related_name='revisions')
    version=models.PositiveIntegerField()
    data=models.JSONField()
    class Meta:
        ordering=['version']
        constraints=[models.UniqueConstraint(fields=['note','version'],name='unique_note_version')]

class AuthAttempt(models.Model):
    key=models.CharField(max_length=64,unique=True)
    window=models.DateTimeField()
    count=models.PositiveIntegerField(default=0)

class UpdateRun(models.Model):
    started_at=models.DateTimeField(auto_now_add=True)
    finished_at=models.DateTimeField(null=True)
    success=models.BooleanField(default=False)
    summary=models.CharField(max_length=500,blank=True)
    snapshot_date=models.CharField(max_length=40,blank=True)
