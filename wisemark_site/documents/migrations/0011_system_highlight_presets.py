# Create default system presets: Private Equity and Public Markets (5 colours each)

from django.db import migrations


def create_system_presets(apps, schema_editor):
    HighlightPreset = apps.get_model('documents', 'HighlightPreset')
    PresetColor = apps.get_model('documents', 'PresetColor')

    pe_preset, _ = HighlightPreset.objects.get_or_create(
        name='Private Equity',
        user=None,
        defaults={'name': 'Private Equity', 'user_id': None},
    )
    pe_colors = [
        ('yellow', 'Key Metrics', '#FBBF24', 0),
        ('green', 'Competitive Advantages', '#34D399', 1),
        ('blue', 'Management Questions', '#60A5FA', 2),
        ('pink', 'Investment Risks', '#F472B6', 3),
        ('orange', 'Commercial DD', '#FB923C', 4),
    ]
    for key, display_name, hex_val, sort_order in pe_colors:
        PresetColor.objects.get_or_create(
            preset=pe_preset,
            key=key,
            defaults={'display_name': display_name, 'hex': hex_val, 'sort_order': sort_order},
        )

    pm_preset, _ = HighlightPreset.objects.get_or_create(
        name='Public Markets',
        user=None,
        defaults={'name': 'Public Markets', 'user_id': None},
    )
    pm_colors = [
        ('yellow', 'Key Metrics', '#FBBF24', 0),
        ('green', 'Thesis & Quality', '#34D399', 1),
        ('blue', 'Risks & Concerns', '#60A5FA', 2),
        ('pink', 'Valuation', '#F472B6', 3),
        ('orange', 'Catalysts', '#FB923C', 4),
    ]
    for key, display_name, hex_val, sort_order in pm_colors:
        PresetColor.objects.get_or_create(
            preset=pm_preset,
            key=key,
            defaults={'display_name': display_name, 'hex': hex_val, 'sort_order': sort_order},
        )


def reverse_system_presets(apps, schema_editor):
    Document = apps.get_model('documents', 'Document')
    HighlightPreset = apps.get_model('documents', 'HighlightPreset')
    system = HighlightPreset.objects.filter(user__isnull=True)
    Document.objects.filter(highlight_preset__in=system).update(highlight_preset=None)
    system.delete()


class Migration(migrations.Migration):

    dependencies = [
        ('documents', '0010_highlight_preset_and_preset_color'),
    ]

    operations = [
        migrations.RunPython(create_system_presets, reverse_system_presets),
    ]
