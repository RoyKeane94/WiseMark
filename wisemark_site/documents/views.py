import hashlib

from django.http import HttpResponse
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Project, Document, Highlight, Note, StorageLocation
from .serializers import ProjectSerializer, DocumentSerializer, HighlightSerializer


def _compute_pdf_hash(file_bytes):
    return hashlib.sha256(file_bytes).hexdigest()


class ProjectViewSet(viewsets.ModelViewSet):
    serializer_class = ProjectSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Project.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class DocumentViewSet(viewsets.ModelViewSet):
    serializer_class = DocumentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = Document.objects.filter(project__user=self.request.user)
        project_id = self.request.query_params.get('project')
        if project_id:
            qs = qs.filter(project_id=project_id)
        return qs

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
        serializer = self.get_serializer(
            data={
                'project': project_id,
                'pdf_hash': pdf_hash,
                'filename': filename,
                'file_size': file_size,
                'storage_location': storage_location,
                'pdf_file': pdf_file,
                's3_key': s3_key,
            }
        )
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

    @action(detail=True, methods=['get', 'post'], url_path='highlights')
    def highlights(self, request, pk=None):
        doc = self.get_object()
        if request.method == 'POST':
            page_number = request.data.get('page_number')
            position_data = request.data.get('position_data') or {}
            color = (request.data.get('color') or 'yellow').strip()
            if color not in dict(Highlight.COLOR_CHOICES):
                color = 'yellow'
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
                color=color,
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
