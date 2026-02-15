# Data migration: rename project "Default" to "My First Project"

from django.db import migrations


def rename_default_projects(apps, schema_editor):
    Project = apps.get_model('documents', 'Project')
    Project.objects.filter(name='Default').update(name='My First Project')


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('documents', '0003_add_project_and_link_document'),
    ]

    operations = [
        migrations.RunPython(rename_default_projects, noop),
    ]
