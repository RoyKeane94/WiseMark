import hashlib
import logging
import secrets

from django.db.models import Count

logger = logging.getLogger(__name__)
from django.db.models.deletion import ProtectedError
from django.utils import timezone
from django.http import HttpResponse
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response

from .models import Project, Document, DocumentColor, Highlight, Note, Color, StorageLocation, HighlightPreset, PresetColor
from . import s3_storage
from rest_framework.views import APIView

from .serializers import (
    ProjectSerializer,
    DocumentSerializer,
    HighlightSerializer,
    HighlightPresetSerializer,
    HighlightPresetWriteSerializer,
    PresetColorSerializer,
    LibraryHighlightSerializer,
)


def _compute_pdf_hash(file_bytes):
    """Canonical SHA-256 hash (lowercase hex) for PDF bytes. Use this for DB and S3 keys."""
    return hashlib.sha256(file_bytes).hexdigest().lower()


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
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError:
            return Response(
                {'detail': 'This lens cannot be deleted because it is linked to one or more PDFs. Remove the lens from those documents first.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=True, methods=['post'], url_path='colors')
    def add_color(self, request, pk=None):
        """Add a colour to a lens (system or user-owned)."""
        preset = self.get_object()
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
        """Update or remove a colour from a lens (system or user-owned)."""
        preset = self.get_object()
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
        qs = (
            Document.objects.filter(project__user=self.request.user)
            .defer('pdf_file')
            .select_related('highlight_preset', 'project')
            .prefetch_related('highlight_preset__colors', 'document_colors__color')
            .annotate(_annotation_count=Count('highlights'))
        )
        project_id = self.request.query_params.get('project')
        if project_id:
            qs = qs.filter(project_id=project_id)
        return qs

    def destroy(self, request, *args, **kwargs):
        """Soft-delete: keep document row and highlights/notes; clear PDF bytes."""
        doc = self.get_object()
        doc.deleted_at = timezone.now()
        doc.pdf_file = None
        doc.file_size = 0
        if doc.storage_location == StorageLocation.S3 and doc.s3_key:
            try:
                s3_storage.delete_pdf(doc.s3_key)
            except Exception:
                pass
        doc.storage_location = StorageLocation.POSTGRES
        doc.s3_key = None
        doc.save(update_fields=['deleted_at', 'pdf_file', 'file_size', 'storage_location', 's3_key'])
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'], url_path='remove')
    def remove(self, request, pk=None):
        """Permanently delete a removed PDF and all its highlights/notes. Only allowed when deleted_at is set."""
        doc = self.get_object()
        if not doc.deleted_at:
            return Response(
                {'detail': 'Only removed PDFs can be permanently removed. Delete the document first.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        doc.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

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
            if s3_storage.is_s3_configured():
                s3_key = s3_storage.upload_pdf_bytes(pdf_hash, file_bytes)
                storage_location = StorageLocation.S3
                pdf_file = None
            else:
                logger.warning(
                    "S3 not configured (AWS_STORAGE_BUCKET_NAME unset); storing PDF in Postgres. "
                    "Set AWS_STORAGE_BUCKET_NAME (and AWS credentials) to use S3."
                )
                storage_location = StorageLocation.POSTGRES
                pdf_file = file_bytes
                s3_key = None
        else:
            # JSON-only (legacy): metadata only, no file stored on server.
            # Normalize client-supplied hash so it matches S3 key format (lowercase hex).
            pdf_hash = (request.data.get('pdf_hash') or '').strip().lower()
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
        if doc.deleted_at:
            return Response(
                {'detail': 'This PDF has been deleted.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        pdf_bytes = doc.get_pdf_bytes()
        if not pdf_bytes:
            if doc.storage_location == StorageLocation.S3 and doc.s3_key:
                return Response(
                    {'detail': 'PDF could not be retrieved from S3. Check server logs and S3 credentials/bucket.'},
                    status=status.HTTP_503_SERVICE_UNAVAILABLE,
                )
            return Response(
                {'detail': 'PDF file is not stored on the server for this document.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        return HttpResponse(pdf_bytes, content_type='application/pdf')

    @action(detail=True, methods=['post'], url_path='upload_pdf')
    def upload_pdf(self, request, pk=None):
        """Store PDF bytes for a document that was created without them (e.g. metadata-only or legacy). File must match doc.pdf_hash."""
        doc = self.get_object()
        if doc.deleted_at:
            return Response(
                {'detail': 'This PDF has been deleted. Highlights and notes are kept for reference.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        uploaded_file = request.FILES.get('file')
        if not uploaded_file or not (uploaded_file.name or '').lower().endswith('.pdf'):
            return Response(
                {'detail': 'A PDF file is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        file_bytes = uploaded_file.read()
        computed_hash = _compute_pdf_hash(file_bytes)
        doc_hash_normalized = (doc.pdf_hash or "").strip().lower()
        if computed_hash != doc_hash_normalized:
            return Response(
                {'detail': 'This file does not match the original document.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        file_size = len(file_bytes)
        if s3_storage.is_s3_configured():
            s3_key = s3_storage.upload_pdf_bytes(computed_hash, file_bytes)
            doc.storage_location = StorageLocation.S3
            doc.s3_key = s3_key
            doc.pdf_file = None
            doc.pdf_hash = computed_hash
            doc.file_size = file_size
            doc.save(update_fields=['pdf_file', 'storage_location', 's3_key', 'pdf_hash', 'file_size'])
        else:
            logger.warning(
                "S3 not configured (AWS_STORAGE_BUCKET_NAME unset); storing PDF in Postgres. "
                "Set AWS_STORAGE_BUCKET_NAME (and AWS credentials) to use S3."
            )
            doc.pdf_file = file_bytes
            doc.storage_location = StorageLocation.POSTGRES
            doc.s3_key = None
            doc.file_size = file_size
            doc.save(update_fields=['pdf_file', 'storage_location', 's3_key', 'file_size'])
        return Response(status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='share')
    def share(self, request, pk=None):
        """Generate (or return existing) public read-only share link for this document's summary."""
        doc = self.get_object()
        if not doc.public_share_token:
            doc.public_share_token = secrets.token_urlsafe(32)
            doc.save(update_fields=['public_share_token'])
        share_path = f'/share/{doc.public_share_token}/summary'
        share_url = request.build_absolute_uri(share_path)
        return Response({'share_url': share_url}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get', 'post'], url_path='highlights')
    def highlights(self, request, pk=None):
        doc = self.get_object()
        if request.method == 'POST':
            page_number = request.data.get('page_number')
            position_data = request.data.get('position_data') or {}
            color_key = (request.data.get('color') or 'yellow').strip()
            preset = doc.get_effective_preset()
            color_display_name = None
            if preset:
                pc = preset.colors.filter(key=color_key).first()
                if pc:
                    color_display_name = pc.display_name
                elif not preset.colors.filter(key=color_key).exists():
                    color_key = next((c.key for c in preset.colors.all()), 'yellow')
                    pc = preset.colors.filter(key=color_key).first()
                    if pc:
                        color_display_name = pc.display_name
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
                color_display_name=color_display_name,
                highlighted_text=highlighted_text or '',
            )
            comment = (request.data.get('comment') or '').strip()
            if comment:
                Note.objects.create(highlight=highlight, content=comment)
            serializer = HighlightSerializer(highlight)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        highlights = doc.highlights.select_related('note').all()
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


class LibraryView(APIView):
    """Return all highlights for the user across all documents, with document/project context."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Single query: highlights with document, project, note (avoids N+1 on these)
        highlights = list(
            Highlight.objects
            .filter(document__project__user=request.user)
            .select_related('document__project', 'note')
            .order_by('-created_at')
        )

        # Batch-fetch all presets (with colors) in 1–2 queries instead of 1 per unique preset
        preset_ids = set()
        need_system = False
        for h in highlights:
            pid = h.document.highlight_preset_id
            if pid:
                preset_ids.add(pid)
            else:
                need_system = True

        preset_map = {}
        if preset_ids:
            for p in HighlightPreset.objects.filter(pk__in=preset_ids).prefetch_related('colors'):
                preset_map[p.id] = p
        if need_system:
            sp = HighlightPreset.objects.filter(user__isnull=True).prefetch_related('colors').order_by('name').first()
            if sp:
                preset_map['_system'] = sp

        for h in highlights:
            pid = h.document.highlight_preset_id
            h._preset = preset_map.get(pid) or preset_map.get('_system')

        serializer = LibraryHighlightSerializer(highlights, many=True)

        projects = list(
            Project.objects.filter(user=request.user)
            .annotate(
                document_count=Count('documents', distinct=True),
                annotation_count=Count('documents__highlights', distinct=True),
            )
            .values('id', 'name', 'color', 'document_count', 'annotation_count')
        )

        return Response({
            'highlights': serializer.data,
            'projects': projects,
            'total_highlights': len(serializer.data),
        })


class PublicDocumentSummaryView(APIView):
    """Public, read-only view of a shared document and its highlights, addressed by opaque token."""

    permission_classes = [AllowAny]

    def get(self, request, token):
        doc = Document.objects.filter(public_share_token=token, deleted_at__isnull=True).first()
        if not doc:
            return Response({'detail': 'Public document not found.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = DocumentSerializer(doc, context={'request': request})
        highlights = doc.highlights.select_related('note').all()
        highlights_data = HighlightSerializer(highlights, many=True).data
        return Response(
            {
                'document': serializer.data,
                'highlights': highlights_data,
            },
            status=status.HTTP_200_OK,
        )


class PublicDocumentPdfView(APIView):
    """Public, read-only: return PDF bytes for a shared document by token."""

    permission_classes = [AllowAny]

    def get(self, request, token):
        doc = Document.objects.filter(public_share_token=token, deleted_at__isnull=True).first()
        if not doc:
            return Response({'detail': 'Public document not found.'}, status=status.HTTP_404_NOT_FOUND)
        pdf_bytes = doc.get_pdf_bytes()
        if not pdf_bytes:
            if doc.storage_location == StorageLocation.S3 and doc.s3_key:
                return Response(
                    {'detail': 'PDF could not be retrieved from storage.'},
                    status=status.HTTP_503_SERVICE_UNAVAILABLE,
                )
            return Response(
                {'detail': 'PDF is not available for this shared document.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        return HttpResponse(pdf_bytes, content_type='application/pdf')
