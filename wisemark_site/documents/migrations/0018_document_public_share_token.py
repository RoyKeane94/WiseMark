from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('documents', '0017_document_deleted_at'),
    ]

    operations = [
        migrations.AddField(
            model_name='document',
            name='public_share_token',
            field=models.CharField(
                max_length=64,
                null=True,
                blank=True,
                unique=True,
                help_text='Opaque token for public, read-only sharing of this document and its notes.',
            ),
        ),
    ]

