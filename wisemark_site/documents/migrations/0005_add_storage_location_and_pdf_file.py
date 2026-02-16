# Add storage_location (postgres | s3), pdf_file for Postgres storage, s3_key for future S3

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('documents', '0004_rename_default_to_my_first_project'),
    ]

    operations = [
        migrations.AddField(
            model_name='document',
            name='storage_location',
            field=models.CharField(
                choices=[('postgres', 'Postgres'), ('s3', 'S3')],
                default='postgres',
                help_text='Where the PDF bytes are stored: postgres (DB) or s3 (future).',
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name='document',
            name='pdf_file',
            field=models.BinaryField(blank=True, help_text='PDF bytes when stored in Postgres', null=True),
        ),
        migrations.AddField(
            model_name='document',
            name='s3_key',
            field=models.CharField(
                blank=True,
                help_text='Object key in S3 when storage_location is s3',
                max_length=500,
                null=True,
            ),
        ),
    ]
