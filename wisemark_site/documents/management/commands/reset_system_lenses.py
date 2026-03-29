"""
Reset built-in (system) highlight lenses to the default category labels and colours.

Targets presets with user=null named "Private Equity" and "Public Markets".
Run: python manage.py reset_system_lenses [--dry-run]
"""

from django.core.management.base import BaseCommand

from documents.models import HighlightPreset, PresetColor


PRIVATE_EQUITY_COLORS = [
    ('yellow', 'Business & Management', '#FBBF24', 0),
    ('green', 'Financials', '#34D399', 1),
    ('blue', 'Market', '#60A5FA', 2),
    ('pink', 'Investment Risks', '#F472B6', 3),
    ('orange', 'Investment Highlights', '#FB923C', 4),
]

PUBLIC_MARKETS_COLORS = [
    ('yellow', 'Business & Management', '#FBBF24', 0),
    ('green', 'Financials', '#34D399', 1),
    ('blue', 'Competitive Positioning', '#60A5FA', 2),
    ('pink', 'Investment Risks', '#F472B6', 3),
    ('orange', 'Valuation', '#FB923C', 4),
]

PRESET_DEFAULT_COLORS = {
    'Private Equity': PRIVATE_EQUITY_COLORS,
    'Public Markets': PUBLIC_MARKETS_COLORS,
}

SYSTEM_PRESET_NAMES = ('Private Equity', 'Public Markets')


class Command(BaseCommand):
    help = (
        'Reset system lenses (Private Equity, Public Markets) to default highlight categories.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Print what would change without writing to the database.',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        if dry_run:
            self.stdout.write(self.style.WARNING('Dry run — no database changes.'))

        for preset_name in SYSTEM_PRESET_NAMES:
            default_colors = PRESET_DEFAULT_COLORS[preset_name]
            default_keys = {row[0] for row in default_colors}
            preset = HighlightPreset.objects.filter(
                user__isnull=True, name=preset_name
            ).first()

            if not preset:
                msg = f'System preset "{preset_name}" not found; skipping.'
                if dry_run:
                    self.stdout.write(self.style.WARNING(msg))
                else:
                    preset = HighlightPreset.objects.create(
                        name=preset_name,
                        user=None,
                    )
                    self.stdout.write(
                        self.style.SUCCESS(f'Created system preset "{preset_name}".')
                    )

            if not preset:
                continue

            for key, display_name, hex_val, sort_order in default_colors:
                existing = PresetColor.objects.filter(preset=preset, key=key).first()
                if existing:
                    same = (
                        existing.display_name == display_name
                        and existing.hex.upper() == hex_val.upper()
                        and existing.sort_order == sort_order
                    )
                    if same:
                        self.stdout.write(f'  {preset_name} / {key}: already default, OK')
                        continue
                    self.stdout.write(
                        f'  {preset_name} / {key}: '
                        f'"{existing.display_name}" -> "{display_name}"'
                    )
                else:
                    self.stdout.write(
                        f'  {preset_name} / {key}: create "{display_name}"'
                    )

                if not dry_run:
                    PresetColor.objects.update_or_create(
                        preset=preset,
                        key=key,
                        defaults={
                            'display_name': display_name,
                            'hex': hex_val,
                            'sort_order': sort_order,
                        },
                    )

            # Remove colours on this system preset that are not in the default five
            extras = PresetColor.objects.filter(preset=preset).exclude(key__in=default_keys)
            for row in extras:
                self.stdout.write(
                    self.style.WARNING(
                        f'  {preset_name}: removing extra colour key "{row.key}" '
                        f'({row.display_name})'
                    )
                )
                if not dry_run:
                    row.delete()

        if dry_run:
            self.stdout.write(self.style.WARNING('\nRun without --dry-run to apply.'))
        else:
            self.stdout.write(self.style.SUCCESS('\nSystem lenses reset to defaults.'))
