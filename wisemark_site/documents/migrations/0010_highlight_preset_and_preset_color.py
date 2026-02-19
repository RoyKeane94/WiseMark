# Highlight presets: system (PE, Public Markets) and user-created, linked to account

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('documents', '0009_add_document_color'),
    ]

    operations = [
        migrations.CreateModel(
            name='HighlightPreset',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=255)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('user', models.ForeignKey(
                    blank=True,
                    help_text='Null for system presets; set for user-created presets.',
                    null=True,
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='highlight_presets',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'ordering': ['name'],
            },
        ),
        migrations.CreateModel(
            name='PresetColor',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('key', models.CharField(help_text='Identifier, e.g. yellow, green, or custom_1', max_length=30)),
                ('display_name', models.CharField(max_length=255)),
                ('hex', models.CharField(help_text='Hex colour, e.g. #FBBF24', max_length=7)),
                ('sort_order', models.PositiveIntegerField(default=0)),
                ('preset', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='colors',
                    to='documents.highlightpreset',
                )),
            ],
            options={
                'ordering': ['sort_order', 'key'],
                'unique_together': {('preset', 'key')},
            },
        ),
        migrations.AddConstraint(
            model_name='highlightpreset',
            constraint=models.UniqueConstraint(
                fields=('user', 'name'),
                name='unique_preset_name_per_user',
            ),
        ),
        migrations.AddField(
            model_name='document',
            name='highlight_preset',
            field=models.ForeignKey(
                blank=True,
                help_text='Which colour preset this document uses. Null falls back to first system preset.',
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name='documents',
                to='documents.highlightpreset',
            ),
        ),
    ]
