from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0002_add_account'),
    ]

    operations = [
        migrations.AddField(
            model_name='account',
            name='is_beta',
            field=models.BooleanField(default=False, help_text='True if user signed up with the private beta code.'),
        ),
    ]
