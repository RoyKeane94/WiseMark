from rest_framework import serializers
from .models import Project, Document, DocumentColor, Highlight, Note, Color


class ProjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Project
        fields = ['id', 'name', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class ColorLabelsField(serializers.Field):
    """Read: from DocumentColor. Write: dict of color_key -> custom_name. Uses source='*' so we get the document instance."""

    def __init__(self, **kwargs):
        kwargs.setdefault('source', '*')
        super().__init__(**kwargs)

    def to_representation(self, value):
        # value is the document instance when source='*'. Return all DocumentColor rows (key -> custom_name).
        if not value or not getattr(value, 'pk', None):
            return {}
        qs = DocumentColor.objects.filter(document=value).select_related('color')
        return {dc.color.key: (dc.custom_name or '') for dc in qs}

    def to_internal_value(self, data):
        if not isinstance(data, dict):
            return {}
        # Accept all keys with string values (including ""); payload defines which colours stay in the document.
        return {
            str(k): (str(v).strip() if isinstance(v, str) else '')
            for k, v in data.items()
            if isinstance(k, (str,))
        }


class DocumentSerializer(serializers.ModelSerializer):
    project = serializers.PrimaryKeyRelatedField(queryset=Project.objects.none(), required=False)
    color_labels = ColorLabelsField(required=False)

    class Meta:
        model = Document
        fields = [
            'id', 'project', 'pdf_hash', 'filename', 'file_size',
            'storage_location', 'pdf_file', 's3_key',
            'color_labels', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
        extra_kwargs = {
            'pdf_file': {'write_only': True, 'read_only': False},
            's3_key': {'write_only': True, 'read_only': False},
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if 'request' in self.context:
            self.fields['project'].queryset = Project.objects.filter(user=self.context['request'].user)
        if self.instance:
            self.fields['project'].read_only = True

    def update(self, instance, validated_data):
        color_labels = validated_data.pop('color_labels', None)
        if color_labels is not None:
            # Payload keys = colours that stay in the document. Others are removed.
            for color in Color.objects.all():
                if color.key in color_labels:
                    custom_name = (color_labels.get(color.key) or '').strip()
                    dc, _ = DocumentColor.objects.get_or_create(document=instance, color=color, defaults={'custom_name': ''})
                    dc.custom_name = custom_name
                    dc.save()
                else:
                    DocumentColor.objects.filter(document=instance, color=color).delete()
        return super().update(instance, validated_data)


class NoteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Note
        fields = ['id', 'content', 'created_at', 'updated_at']


class HighlightSerializer(serializers.ModelSerializer):
    color = serializers.SlugRelatedField(slug_field='key', queryset=Color.objects.all())
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
