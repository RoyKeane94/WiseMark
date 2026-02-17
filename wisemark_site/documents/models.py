from django.conf import settings
from django.db import models


class StorageLocation(models.TextChoices):
    """Where the PDF file bytes are stored. postgres = DB BLOB; s3 = object storage (future)."""
    POSTGRES = 'postgres', 'Postgres'
    S3 = 's3', 'S3'


class Project(models.Model):
    """A project (deal) that can contain multiple PDFs."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='projects',
    )
    name = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']


class Color(models.Model):
    """Global list of highlight colours. One row per colour (yellow, green, etc.)."""
    key = models.CharField(max_length=20, unique=True)
    default_name = models.CharField(max_length=255)

    class Meta:
        ordering = ['key']

    def __str__(self):
        return self.key


class Document(models.Model):
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name='documents',
    )
    pdf_hash = models.CharField(max_length=64, help_text='SHA-256 hash of the PDF file')
    filename = models.CharField(max_length=500, help_text='Display name (editable)')
    file_size = models.BigIntegerField(help_text='File size in bytes')
    storage_location = models.CharField(
        max_length=20,
        choices=StorageLocation.choices,
        default=StorageLocation.POSTGRES,
        help_text='Where the PDF bytes are stored: postgres (DB) or s3 (future).',
    )
    # Used when storage_location == postgres
    pdf_file = models.BinaryField(null=True, blank=True, help_text='PDF bytes when stored in Postgres')
    # Used when storage_location == s3 (future)
    s3_key = models.CharField(
        max_length=500,
        null=True,
        blank=True,
        help_text='Object key in S3 when storage_location is s3',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']
        unique_together = [('project', 'pdf_hash')]

    def get_pdf_bytes(self):
        """Return PDF bytes from current storage. For postgres: from pdf_file; for s3: fetch from S3 (not implemented)."""
        if self.storage_location == StorageLocation.POSTGRES and self.pdf_file:
            return bytes(self.pdf_file)
        if self.storage_location == StorageLocation.S3 and self.s3_key:
            return None
        return None


class DocumentColor(models.Model):
    """Per-document custom label for a colour. No row = use Color.default_name. X in UI deletes this row."""
    document = models.ForeignKey(Document, on_delete=models.CASCADE, related_name='document_colors')
    color = models.ForeignKey(Color, on_delete=models.CASCADE, related_name='document_colors')
    custom_name = models.CharField(max_length=255, blank=True)

    class Meta:
        unique_together = [('document', 'color')]
        ordering = ['color__key']


class Highlight(models.Model):
    document = models.ForeignKey(
        Document,
        on_delete=models.CASCADE,
        related_name='highlights',
    )
    page_number = models.PositiveIntegerField()
    position_data = models.JSONField(
        help_text='JSON containing selection range data for re-rendering',
    )
    color = models.ForeignKey(
        Color,
        on_delete=models.PROTECT,
        related_name='highlights',
    )
    highlighted_text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['page_number', 'created_at']


class Note(models.Model):
    highlight = models.OneToOneField(
        Highlight,
        on_delete=models.CASCADE,
        related_name='note',
    )
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']
