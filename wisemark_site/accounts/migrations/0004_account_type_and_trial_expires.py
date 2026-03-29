from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0003_account_is_beta'),
    ]

    operations = [
        migrations.AddField(
            model_name='account',
            name='account_type',
            field=models.CharField(
                choices=[('trial', 'Trial'), ('paid', 'Paid')],
                default='trial',
                max_length=10,
            ),
        ),
        migrations.AddField(
            model_name='account',
            name='trial_expires_at',
            field=models.DateTimeField(
                blank=True,
                help_text='When the trial period ends. Null for paid accounts.',
                null=True,
            ),
        ),
    ]
