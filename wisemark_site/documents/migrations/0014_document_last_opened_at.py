from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('documents', '0013_populate_highlight_color_key'),
    ]

    operations = [
        migrations.AddField(
            model_name='document',
            name='last_opened_at',
            field=models.DateTimeField(blank=True, help_text='Last time the user opened this document in the viewer', null=True),
        ),
    ]
