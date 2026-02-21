from django.db.models import Q
from rest_framework import serializers
from .models import Project, Document, DocumentColor, Highlight, Note, Color, HighlightPreset, PresetColor


class ProjectSerializer(serializers.ModelSerializer):
    document_count = serializers.SerializerMethodField()
    annotation_count = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = ['id', 'name', 'color', 'created_at', 'updated_at', 'document_count', 'annotation_count']
        read_only_fields = ['id', 'created_at', 'updated_at', 'document_count', 'annotation_count']

    def get_document_count(self, obj):
        return obj.document_count if hasattr(obj, 'document_count') else obj.documents.count()

    def get_annotation_count(self, obj):
        if hasattr(obj, 'annotation_count'):
            return obj.annotation_count
        from .models import Highlight
        return Highlight.objects.filter(document__project=obj).count()


class PresetColorSerializer(serializers.ModelSerializer):
    class Meta:
        model = PresetColor
        fields = ['id', 'key', 'display_name', 'hex', 'sort_order']
        read_only_fields = ['id']


class HighlightPresetSerializer(serializers.ModelSerializer):
    colors = PresetColorSerializer(many=True, read_only=True)
    is_system = serializers.SerializerMethodField()

    class Meta:
        model = HighlightPreset
        fields = ['id', 'name', 'colors', 'is_system', 'created_at']
        read_only_fields = ['id', 'created_at']

    def get_is_system(self, obj):
        return obj.user_id is None


class HighlightPresetWriteSerializer(serializers.ModelSerializer):
    """Create/update presets; optional colors list (replace on update)."""
    colors = PresetColorSerializer(many=True, required=False)

    class Meta:
        model = HighlightPreset
        fields = ['id', 'name', 'colors']
        read_only_fields = ['id']

    def create(self, validated_data):
        colors_data = validated_data.pop('colors', [])
        preset = HighlightPreset.objects.create(**validated_data)
        for i, c in enumerate(colors_data):
            PresetColor.objects.create(
                preset=preset,
                key=c['key'],
                display_name=c['display_name'],
                hex=c['hex'],
                sort_order=c.get('sort_order', i),
            )
        return preset

    def update(self, instance, validated_data):
        colors_data = validated_data.pop('colors', None)
        instance.name = validated_data.get('name', instance.name)
        instance.save()
        if colors_data is not None and instance.user_id is not None:
            # Replace colors (user presets only)
            instance.colors.all().delete()
            for i, c in enumerate(colors_data):
                PresetColor.objects.create(
                    preset=instance,
                    key=c['key'],
                    display_name=c['display_name'],
                    hex=c['hex'],
                    sort_order=c.get('sort_order', i),
                )
        return instance


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
    highlight_preset = serializers.PrimaryKeyRelatedField(
        queryset=HighlightPreset.objects.none(),
        required=False,
        allow_null=True,
    )
    highlight_preset_detail = serializers.SerializerMethodField()
    annotation_count = serializers.SerializerMethodField()

    class Meta:
        model = Document
        fields = [
            'id', 'project', 'pdf_hash', 'filename', 'color', 'file_size',
            'storage_location', 'pdf_file', 's3_key',
            'color_labels', 'highlight_preset', 'highlight_preset_detail',
            'annotation_count', 'last_opened_at',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'highlight_preset_detail', 'annotation_count', 'last_opened_at']

    def get_annotation_count(self, obj):
        if hasattr(obj, '_annotation_count'):
            return obj._annotation_count
        return obj.highlights.count()
        extra_kwargs = {
            'pdf_file': {'write_only': True, 'read_only': False},
            's3_key': {'write_only': True, 'read_only': False},
        }

    def get_highlight_preset_detail(self, obj):
        """Effective preset for this document (selected or first system), with colors."""
        preset = obj.get_effective_preset() if obj.pk else None
        if not preset:
            return None
        return {
            'id': preset.id,
            'name': preset.name,
            'colors': [
                {'key': c.key, 'display_name': c.display_name, 'hex': c.hex, 'sort_order': c.sort_order}
                for c in preset.colors.all()
            ],
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if 'request' in self.context:
            user = self.context['request'].user
            self.fields['project'].queryset = Project.objects.filter(user=user)
            # User can assign system presets (user=None) or their own presets
            self.fields['highlight_preset'].queryset = HighlightPreset.objects.filter(
                Q(user__isnull=True) | Q(user=user)
            )
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
    color = serializers.CharField(source='color_key')
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
