from django.conf import settings
from django.db import models


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


class Document(models.Model):
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name='documents',
    )
    pdf_hash = models.CharField(max_length=64, help_text='SHA-256 hash of the PDF file')
    filename = models.CharField(max_length=500, help_text='Display name (editable)')
    file_size = models.BigIntegerField(help_text='File size in bytes')
    color_labels = models.JSONField(
        default=dict,
        blank=True,
        help_text='Override topic names per color, e.g. {"orange": "Legal DD"}',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']
        unique_together = [('project', 'pdf_hash')]


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
    COLOR_CHOICES = [
        ('yellow', 'Key Metrics'),
        ('green', 'Competitive Advantages'),
        ('blue', 'Management Questions'),
        ('pink', 'Investment Risks'),
        ('orange', 'Commercial DD'),
    ]
    color = models.CharField(max_length=10, choices=COLOR_CHOICES, default='yellow')
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
