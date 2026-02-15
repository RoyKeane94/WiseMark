# Generated migration: Project model and Document.project

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


def backfill_projects(apps, schema_editor):
    Document = apps.get_model('documents', 'Document')
    Project = apps.get_model('documents', 'Project')
    User = apps.get_model(*settings.AUTH_USER_MODEL.split('.'))
    for user in User.objects.all():
        docs = list(Document.objects.filter(user=user))
        if not docs:
            continue
        project = Project.objects.create(user=user, name='My First Project')
        Document.objects.filter(user=user).update(project=project)


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('documents', '0002_add_document_color_labels'),
    ]

    operations = [
        migrations.CreateModel(
            name='Project',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=255)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='projects', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-updated_at'],
            },
        ),
        migrations.AlterUniqueTogether(
            name='document',
            unique_together=set(),
        ),
        migrations.AddField(
            model_name='document',
            name='project',
            field=models.ForeignKey(null=True, on_delete=django.db.models.deletion.CASCADE, related_name='documents', to='documents.project'),
        ),
        migrations.RunPython(backfill_projects, noop),
        migrations.RemoveField(
            model_name='document',
            name='user',
        ),
        migrations.AlterField(
            model_name='document',
            name='project',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='documents', to='documents.project'),
        ),
        migrations.AlterUniqueTogether(
            name='document',
            unique_together={('project', 'pdf_hash')},
        ),
    ]
