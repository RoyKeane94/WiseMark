from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0004_account_type_and_trial_expires'),
    ]

    operations = [
        migrations.AddField(
            model_name='account',
            name='stripe_customer_id',
            field=models.CharField(blank=True, default='', max_length=255),
        ),
        migrations.AddField(
            model_name='account',
            name='stripe_subscription_id',
            field=models.CharField(blank=True, default='', max_length=255),
        ),
        migrations.AddField(
            model_name='account',
            name='subscription_cancel_at_period_end',
            field=models.BooleanField(default=False),
        ),
    ]
