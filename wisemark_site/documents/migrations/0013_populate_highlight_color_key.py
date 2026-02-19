from django.db import migrations


def forwards(apps, schema_editor):
    Highlight = apps.get_model('documents', 'Highlight')
    for h in Highlight.objects.select_related('color').all():
        if h.color_id and h.color:
            h.color_key = h.color.key
            h.save(update_fields=['color_key'])


def backwards(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ('documents', '0012_highlight_color_key'),
    ]
    operations = [
        migrations.RunPython(forwards, backwards),
    ]
