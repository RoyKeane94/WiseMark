web: cd wisemark_site && python3 manage.py migrate --noinput && gunicorn wisemark_site.wsgi:application --bind 0.0.0.0:$PORT
