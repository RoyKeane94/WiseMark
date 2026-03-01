from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('documents', '0016_backfill_highlight_color_display_name'),
    ]

    operations = [
        migrations.AddField(
            model_name='document',
            name='deleted_at',
            field=models.DateTimeField(
                blank=True,
                help_text='When set, the PDF is soft-deleted; highlights and notes are kept for reference.',
                null=True,
            ),
        ),
    ]
