import hashlib

from django.db.models import Count
from django.http import HttpResponse
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Project, Document, DocumentColor, Highlight, Note, Color, StorageLocation, HighlightPreset, PresetColor
from .serializers import (
    ProjectSerializer,
    DocumentSerializer,
    HighlightSerializer,
    HighlightPresetSerializer,
    HighlightPresetWriteSerializer,
    PresetColorSerializer,
)


def _compute_pdf_hash(file_bytes):
    return hashlib.sha256(file_bytes).hexdigest()


def _preset_queryset(request):
    """System presets (user=None) plus request.user's presets."""
    from django.db.models import Q
    return HighlightPreset.objects.filter(
        Q(user__isnull=True) | Q(user=request.user)
    ).prefetch_related('colors').order_by('name')


MAX_CUSTOM_LENSES = 3
MAX_COLORS_PER_LENS = 5


class HighlightPresetViewSet(viewsets.ModelViewSet):
    """List system + user lenses; create/update/delete user lenses only."""
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return _preset_queryset(self.request)

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return HighlightPresetWriteSerializer
        return HighlightPresetSerializer

    def perform_create(self, serializer):
        user = self.request.user
        custom_count = HighlightPreset.objects.filter(user=user).count()
        if custom_count >= MAX_CUSTOM_LENSES:
            from rest_framework.exceptions import ValidationError
            raise ValidationError({'detail': f'You can create up to {MAX_CUSTOM_LENSES} custom lenses.'})
        serializer.save(user=user)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.user_id is None:
            return Response(
                {'detail': 'System lenses cannot be deleted.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=['post'], url_path='colors')
    def add_color(self, request, pk=None):
        """Add a colour to a user-owned lens. System lenses are read-only."""
        preset = self.get_object()
        if preset.user_id is None:
            return Response(
                {'detail': 'Cannot add colours to system lenses.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        key = (request.data.get('key') or '').strip()
        display_name = (request.data.get('display_name') or '').strip()
        hex_val = (request.data.get('hex') or '').strip()
        if not key:
            return Response(
                {'key': ['This field is required.']},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not display_name:
            display_name = key
        if not hex_val or not (len(hex_val) == 7 and hex_val.startswith('#')):
            return Response(
                {'hex': ['A valid hex colour (e.g. #FBBF24) is required.']},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if preset.colors.filter(key=key).exists():
            return Response(
                {'key': [f'A colour with key "{key}" already exists in this lens.']},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if preset.colors.count() >= MAX_COLORS_PER_LENS:
            return Response(
                {'detail': f'Lenses are limited to {MAX_COLORS_PER_LENS} colours.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        sort_order = preset.colors.count()
        color = PresetColor.objects.create(
            preset=preset,
            key=key,
            display_name=display_name,
            hex=hex_val,
            sort_order=sort_order,
        )
        return Response(PresetColorSerializer(color).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['delete', 'patch'], url_path=r'colors/(?P<color_pk>[^/.]+)')
    def manage_color(self, request, pk=None, color_pk=None):
        """Update or remove a colour from a user-owned lens."""
        preset = self.get_object()
        if preset.user_id is None:
            return Response(
                {'detail': 'Cannot modify system lenses.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        color = preset.colors.filter(pk=color_pk).first()
        if not color:
            return Response({'detail': 'Colour not found.'}, status=status.HTTP_404_NOT_FOUND)
        if request.method == 'DELETE':
            color.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        display_name = request.data.get('display_name')
        if display_name is not None:
            color.display_name = str(display_name).strip() or color.display_name
            color.save(update_fields=['display_name'])
        return Response(PresetColorSerializer(color).data)


class ProjectViewSet(viewsets.ModelViewSet):
    serializer_class = ProjectSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return (
            Project.objects.filter(user=self.request.user)
            .annotate(
                document_count=Count('documents', distinct=True),
                annotation_count=Count('documents__highlights', distinct=True),
            )
        )

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class DocumentViewSet(viewsets.ModelViewSet):
    serializer_class = DocumentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = Document.objects.filter(project__user=self.request.user).annotate(
            _annotation_count=Count('highlights'),
        )
        project_id = self.request.query_params.get('project')
        if project_id:
            qs = qs.filter(project_id=project_id)
        return qs

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        from django.utils import timezone
        Document.objects.filter(pk=instance.pk).update(last_opened_at=timezone.now())
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    def perform_update(self, serializer):
        instance = serializer.save()
        # Sync DocumentColor: keys in payload stay (with optional custom_name), others removed
        if 'color_labels' in self.request.data:
            raw = self.request.data.get('color_labels')
            if isinstance(raw, dict):
                for color in Color.objects.all():
                    if color.key in raw:
                        custom_name = (raw.get(color.key) or '').strip() if isinstance(raw.get(color.key), str) else ''
                        dc, _ = DocumentColor.objects.get_or_create(document=instance, color=color, defaults={'custom_name': ''})
                        dc.custom_name = custom_name
                        dc.save()
                    else:
                        DocumentColor.objects.filter(document=instance, color=color).delete()

    def create(self, request, *args, **kwargs):
        project_id = request.data.get('project')
        uploaded_file = request.FILES.get('file')
        if not project_id:
            return Response(
                {'project': ['This field is required.']},
                status=status.HTTP_400_BAD_REQUEST,
            )
        project = Project.objects.filter(user=request.user, pk=project_id).first()
        if not project:
            return Response(
                {'project': ['Project not found.']},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if uploaded_file:
            # Multipart upload: store PDF in backend (postgres or s3)
            if not uploaded_file.name or not uploaded_file.name.lower().endswith('.pdf'):
                return Response(
                    {'detail': 'A PDF file is required.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            file_bytes = uploaded_file.read()
            pdf_hash = _compute_pdf_hash(file_bytes)
            filename = (request.data.get('filename') or uploaded_file.name).strip() or uploaded_file.name
            if not filename.lower().endswith('.pdf'):
                filename = f'{filename}.pdf'
            file_size = len(file_bytes)
            storage_location = StorageLocation.POSTGRES
            pdf_file = file_bytes
            s3_key = None
        else:
            # JSON-only (legacy): metadata only, no file stored on server
            pdf_hash = (request.data.get('pdf_hash') or '').strip()
            filename = (request.data.get('filename') or '').strip()
            file_size = request.data.get('file_size')
            if not pdf_hash or not filename:
                return Response(
                    {'detail': 'pdf_hash and filename are required when not uploading a file.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if file_size is None:
                file_size = 0
            try:
                file_size = int(file_size)
            except (TypeError, ValueError):
                file_size = 0
            storage_location = StorageLocation.POSTGRES
            pdf_file = None
            s3_key = None

        existing = Document.objects.filter(project=project, pdf_hash=pdf_hash).first()
        if existing:
            return Response(
                {'detail': 'This PDF is already in this project.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        doc_color = request.data.get('color')
        if doc_color and not (isinstance(doc_color, str) and doc_color.startswith('#') and len(doc_color) == 7):
            doc_color = None
        data = {
            'project': project_id,
            'pdf_hash': pdf_hash,
            'filename': filename,
            'color': doc_color or None,
            'file_size': file_size,
            'storage_location': storage_location,
            'pdf_file': pdf_file,
            's3_key': s3_key,
        }
        if 'highlight_preset' in request.data:
            data['highlight_preset'] = request.data.get('highlight_preset')
        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'], url_path='pdf')
    def pdf(self, request, pk=None):
        """Return the stored PDF bytes (postgres or s3)."""
        doc = self.get_object()
        pdf_bytes = doc.get_pdf_bytes()
        if not pdf_bytes:
            return Response(
                {'detail': 'PDF file is not stored on the server for this document.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        return HttpResponse(pdf_bytes, content_type='application/pdf')

    @action(detail=True, methods=['post'], url_path='upload_pdf')
    def upload_pdf(self, request, pk=None):
        """Store PDF bytes for a document that was created without them (e.g. metadata-only or legacy). File must match doc.pdf_hash."""
        doc = self.get_object()
        uploaded_file = request.FILES.get('file')
        if not uploaded_file or not (uploaded_file.name or '').lower().endswith('.pdf'):
            return Response(
                {'detail': 'A PDF file is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        file_bytes = uploaded_file.read()
        computed_hash = _compute_pdf_hash(file_bytes)
        if computed_hash != doc.pdf_hash:
            return Response(
                {'detail': 'This file does not match the original document.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        doc.pdf_file = file_bytes
        doc.storage_location = StorageLocation.POSTGRES
        doc.file_size = len(file_bytes)
        doc.save(update_fields=['pdf_file', 'storage_location', 'file_size'])
        return Response(status=status.HTTP_200_OK)

    @action(detail=True, methods=['get', 'post'], url_path='highlights')
    def highlights(self, request, pk=None):
        doc = self.get_object()
        if request.method == 'POST':
            page_number = request.data.get('page_number')
            position_data = request.data.get('position_data') or {}
            color_key = (request.data.get('color') or 'yellow').strip()
            preset = doc.get_effective_preset()
            if preset and not preset.colors.filter(key=color_key).exists():
                color_key = next((c.key for c in preset.colors.all()), 'yellow')
            legacy_color = Color.objects.filter(key=color_key).first()
            highlighted_text = (request.data.get('highlighted_text') or '').strip()
            if page_number is None:
                return Response(
                    {'detail': 'page_number is required.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            try:
                page_number = int(page_number)
            except (TypeError, ValueError):
                return Response(
                    {'detail': 'page_number must be an integer.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            highlight = Highlight.objects.create(
                document=doc,
                page_number=page_number,
                position_data=position_data,
                color=legacy_color,
                color_key=color_key,
                highlighted_text=highlighted_text or '',
            )
            comment = (request.data.get('comment') or '').strip()
            if comment:
                Note.objects.create(highlight=highlight, content=comment)
            serializer = HighlightSerializer(highlight)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        highlights = doc.highlights.all()
        serializer = HighlightSerializer(highlights, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['patch', 'delete'], url_path=r'highlights/(?P<highlight_pk>[^/.]+)')
    def update_highlight(self, request, pk=None, highlight_pk=None):
        doc = self.get_object()
        highlight = doc.highlights.filter(pk=highlight_pk).first()
        if not highlight:
            return Response({'detail': 'Highlight not found.'}, status=status.HTTP_404_NOT_FOUND)
        if request.method == 'DELETE':
            highlight.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        note_content = request.data.get('note') if 'note' in request.data else request.data.get('comment')
        if note_content is not None:
            note_content = (note_content or '').strip()
            try:
                note = highlight.note
                if note_content:
                    note.content = note_content
                    note.save()
                else:
                    note.delete()
            except Note.DoesNotExist:
                if note_content:
                    Note.objects.create(highlight=highlight, content=note_content)
        serializer = HighlightSerializer(highlight)
        return Response(serializer.data)
