from rest_framework import serializers
from .models import Project, Document, Highlight, Note


class ProjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Project
        fields = ['id', 'name', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class DocumentSerializer(serializers.ModelSerializer):
    project = serializers.PrimaryKeyRelatedField(queryset=Project.objects.none(), required=False)

    class Meta:
        model = Document
        fields = ['id', 'project', 'pdf_hash', 'filename', 'file_size', 'color_labels', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if 'request' in self.context:
            self.fields['project'].queryset = Project.objects.filter(user=self.context['request'].user)
        if self.instance:
            self.fields['project'].read_only = True


class NoteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Note
        fields = ['id', 'content', 'created_at', 'updated_at']


class HighlightSerializer(serializers.ModelSerializer):
    note = serializers.SerializerMethodField()

    def get_note(self, obj):
        try:
            return NoteSerializer(obj.note).data
        except Note.DoesNotExist:
            return None

    class Meta:
        model = Highlight
        fields = ['id', 'page_number', 'position_data', 'color', 'highlighted_text', 'created_at', 'updated_at', 'note']
        read_only_fields = ['id', 'created_at', 'updated_at']
