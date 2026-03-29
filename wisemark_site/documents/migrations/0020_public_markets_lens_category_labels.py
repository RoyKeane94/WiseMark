# Public Markets: Competitive Positioning (blue), Valuation (orange)—PE unchanged.

from django.db import migrations


def forwards(apps, schema_editor):
    HighlightPreset = apps.get_model('documents', 'HighlightPreset')
    PresetColor = apps.get_model('documents', 'PresetColor')
    preset = HighlightPreset.objects.filter(
        user__isnull=True,
        name='Public Markets',
    ).first()
    if not preset:
        return
    updates = [
        ('blue', 'Competitive Positioning', 2),
        ('orange', 'Valuation', 4),
    ]
    for key, display_name, sort_order in updates:
        PresetColor.objects.filter(preset=preset, key=key).update(
            display_name=display_name,
            sort_order=sort_order,
        )


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('documents', '0019_system_lens_default_labels'),
    ]

    operations = [
        migrations.RunPython(forwards, noop_reverse),
    ]
