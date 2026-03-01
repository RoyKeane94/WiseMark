from django.shortcuts import render, redirect
from django.contrib import messages

from .models import ContactSubmission


def security_page(request):
    return render(request, 'pages/security.html')


def privacy_page(request):
    return render(request, 'pages/privacy.html')


def contact_page(request):
    if request.method == 'POST':
        name = (request.POST.get('name') or '').strip()
        email = (request.POST.get('email') or '').strip()
        message = (request.POST.get('message') or '').strip()
        if name and email and message:
            ContactSubmission.objects.create(name=name, email=email, message=message)
            messages.success(request, 'Thanks for your message. We\'ll get back to you soon.')
            return redirect('/contact/')
        messages.error(request, 'Please fill in all fields.')
    return render(request, 'pages/contact.html')
