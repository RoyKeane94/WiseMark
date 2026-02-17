# Generated manually for project card colour

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('documents', '0007_color_documentcolor_highlight_color_fk'),
    ]

    operations = [
        migrations.AddField(
            model_name='project',
            name='color',
            field=models.CharField(default='#f59e0b', help_text='Hex colour for the project card accent', max_length=7),
        ),
    ]
