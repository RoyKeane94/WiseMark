# Generated manually for document card colour

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('documents', '0008_add_project_color'),
    ]

    operations = [
        migrations.AddField(
            model_name='document',
            name='color',
            field=models.CharField(
                blank=True,
                help_text='Hex colour for the document card accent. Falls back to project colour if unset.',
                max_length=7,
                null=True,
            ),
        ),
    ]
