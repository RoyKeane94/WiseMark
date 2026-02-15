from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Project, Document, Highlight, Note
from .serializers import ProjectSerializer, DocumentSerializer, HighlightSerializer


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
        pdf_hash = (request.data.get('pdf_hash') or '').strip()
        filename = request.data.get('filename') or ''
        file_size = request.data.get('file_size')
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
        if not pdf_hash or not filename:
            return Response(
                {'detail': 'pdf_hash and filename are required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if file_size is None:
            file_size = 0
        try:
            file_size = int(file_size)
        except (TypeError, ValueError):
            file_size = 0
        existing = Document.objects.filter(project=project, pdf_hash=pdf_hash).first()
        if existing:
            return Response(
                {'detail': 'This PDF is already in this project.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = self.get_serializer(
            data={'project': project_id, 'pdf_hash': pdf_hash, 'filename': filename, 'file_size': file_size}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)

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

    @action(detail=True, methods=['patch'], url_path=r'highlights/(?P<highlight_pk>[^/.]+)')
    def update_highlight(self, request, pk=None, highlight_pk=None):
        doc = self.get_object()
        highlight = doc.highlights.filter(pk=highlight_pk).first()
        if not highlight:
            return Response({'detail': 'Highlight not found.'}, status=status.HTTP_404_NOT_FOUND)
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
