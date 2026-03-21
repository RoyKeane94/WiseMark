# Align Private Equity and Public Markets system presets with shared category labels.

from django.db import migrations


NEW_LABELS = [
    ('yellow', 'Business & Management', 0),
    ('green', 'Financials', 1),
    ('blue', 'Market', 2),
    ('pink', 'Investment Risks', 3),
    ('orange', 'Investment Highlights', 4),
]


def update_system_preset_labels(apps, schema_editor):
    HighlightPreset = apps.get_model('documents', 'HighlightPreset')
    PresetColor = apps.get_model('documents', 'PresetColor')
    for preset_name in ('Private Equity', 'Public Markets'):
        preset = HighlightPreset.objects.filter(user__isnull=True, name=preset_name).first()
        if not preset:
            continue
        for key, display_name, sort_order in NEW_LABELS:
            PresetColor.objects.filter(preset=preset, key=key).update(
                display_name=display_name,
                sort_order=sort_order,
            )


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('documents', '0018_document_public_share_token'),
    ]

    operations = [
        migrations.RunPython(update_system_preset_labels, noop_reverse),
    ]
