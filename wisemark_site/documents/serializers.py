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
        if not value or not getattr(value, 'pk', None):
            return {}
        # Use prefetched document_colors if available (from DocumentViewSet queryset)
        if hasattr(value, '_prefetched_objects_cache') and 'document_colors' in value._prefetched_objects_cache:
            return {dc.color.key: (dc.custom_name or '') for dc in value.document_colors.all()}
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
            'storage_location',
            'color_labels', 'highlight_preset', 'highlight_preset_detail',
            'annotation_count', 'last_opened_at',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'highlight_preset_detail', 'annotation_count', 'last_opened_at']

    def get_annotation_count(self, obj):
        if hasattr(obj, '_annotation_count'):
            return obj._annotation_count
        return obj.highlights.count()

    def _get_default_system_preset(self):
        """Cache the default system preset so we don't query once per document."""
        if not hasattr(self, '_cached_system_preset'):
            self._cached_system_preset = (
                HighlightPreset.objects.filter(user__isnull=True)
                .prefetch_related('colors')
                .order_by('name')
                .first()
            )
        return self._cached_system_preset

    def get_highlight_preset_detail(self, obj):
        """Effective preset for this document (selected or first system), with colors."""
        if not obj.pk:
            return None
        if obj.highlight_preset_id:
            preset = obj.highlight_preset
        else:
            preset = self._get_default_system_preset()
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
    color_display_name = serializers.SerializerMethodField()

    def get_note(self, obj):
        note = getattr(obj, 'note', None)
        if note is None:
            return None
        return NoteSerializer(note).data

    def get_color_display_name(self, obj):
        preset = obj.document.get_effective_preset()
        if preset:
            for c in preset.colors.all():
                if c.key == obj.color_key:
                    return c.display_name
        prev_name = (obj.color_display_name or '').strip()
        if prev_name:
            return f'{prev_name} (Deleted)'
        return 'Unknown (Deleted)'

    class Meta:
        model = Highlight
        fields = [
            'id', 'page_number', 'position_data', 'color', 'color_display_name',
            'highlighted_text', 'created_at', 'updated_at', 'note',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class LibraryHighlightSerializer(serializers.ModelSerializer):
    """Flat highlight with document + project context for the Library search page."""
    color = serializers.CharField(source='color_key')
    note = serializers.SerializerMethodField()
    document_id = serializers.IntegerField(source='document.id')
    document_name = serializers.CharField(source='document.filename')
    project_id = serializers.IntegerField(source='document.project.id')
    project_name = serializers.CharField(source='document.project.name')
    project_color = serializers.CharField(source='document.project.color')
    color_display_name = serializers.SerializerMethodField()
    color_hex = serializers.SerializerMethodField()

    def get_note(self, obj):
        note = getattr(obj, 'note', None)
        if note is None:
            return None
        return NoteSerializer(note).data

    def get_color_display_name(self, obj):
        preset = getattr(obj, '_preset', None)
        if preset:
            for c in preset.colors.all():
                if c.key == obj.color_key:
                    return c.display_name
        # Category was deleted from lens: show previous name + (Deleted)
        prev_name = (obj.color_display_name or '').strip()
        if prev_name:
            return f'{prev_name} (Deleted)'
        return 'Unknown (Deleted)'

    def get_color_hex(self, obj):
        preset = getattr(obj, '_preset', None)
        if preset:
            for c in preset.colors.all():
                if c.key == obj.color_key:
                    return c.hex
        from .models import Color as LegacyColor
        defaults = {
            'yellow': '#EAB308', 'green': '#22C55E', 'blue': '#3B82F6',
            'pink': '#EC4899', 'orange': '#F97316',
        }
        return defaults.get(obj.color_key, '#94a3b8')

    class Meta:
        model = Highlight
        fields = [
            'id', 'page_number', 'color', 'highlighted_text',
            'created_at', 'updated_at', 'note',
            'document_id', 'document_name',
            'project_id', 'project_name', 'project_color',
            'color_display_name', 'color_hex',
        ]
