from django.db import models


class ContactSubmission(models.Model):
    """Contact form submission from the website."""

    name = models.CharField(max_length=255)
    email = models.EmailField()
    message = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
