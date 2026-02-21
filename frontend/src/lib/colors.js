export const HIGHLIGHT_COLORS = {
  yellow: { key: 'yellow', label: 'Yellow', name: 'Key Metrics', hex: '#EAB308', rgba: 'rgba(254, 243, 199, 0.5)', rgbaSoft: 'rgba(234,179,8,0.18)', rgbaHover: 'rgba(234,179,8,0.38)', solid: '#fbbf24' },
  green:  { key: 'green',  label: 'Green',  name: 'Competitive Advantages', hex: '#22C55E', rgba: 'rgba(209, 250, 229, 0.5)', rgbaSoft: 'rgba(34,197,94,0.18)', rgbaHover: 'rgba(34,197,94,0.38)', solid: '#10b981' },
  blue:   { key: 'blue',   label: 'Blue',   name: 'Management Questions', hex: '#3B82F6', rgba: 'rgba(219, 234, 254, 0.5)', rgbaSoft: 'rgba(59,130,246,0.18)', rgbaHover: 'rgba(59,130,246,0.38)', solid: '#3b82f6' },
  pink:   { key: 'pink',   label: 'Pink',   name: 'Investment Risks', hex: '#EC4899', rgba: 'rgba(252, 231, 243, 0.5)', rgbaSoft: 'rgba(236,72,153,0.18)', rgbaHover: 'rgba(236,72,153,0.38)', solid: '#ec4899' },
  orange: { key: 'orange', label: 'Orange', name: 'Commercial DD', hex: '#F97316', rgba: 'rgba(254, 215, 170, 0.5)', rgbaSoft: 'rgba(249,115,22,0.18)', rgbaHover: 'rgba(249,115,22,0.38)', solid: '#f59e0b' },
};

export const HIGHLIGHT_COLOR_KEYS = Object.keys(HIGHLIGHT_COLORS);

/** Convert #RRGGBB to rgba(r,g,b,alpha). */
export function hexToRgba(hex, alpha = 1) {
  if (!hex || !hex.startsWith('#')) return `rgba(148,163,184,${alpha})`;
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  return `rgba(${r},${g},${b},${alpha})`;
}

/**
 * Display name for a color: custom label from document, else lens display_name, else legacy default.
 * @param {string} colorKey
 * @param {Record<string, string>} [colorLabels] - document color_labels overrides
 * @param {{ key: string, display_name: string, hex: string }[]} [lensColors] - from document.highlight_preset_detail.colors
 */
export function getColorDisplayName(colorKey, colorLabels = {}, lensColors) {
  if (colorLabels && typeof colorLabels[colorKey] === 'string' && colorLabels[colorKey].trim()) {
    return colorLabels[colorKey].trim();
  }
  if (lensColors?.length) {
    const p = lensColors.find((c) => c.key === colorKey);
    if (p?.display_name) return p.display_name;
  }
  return (HIGHLIGHT_COLORS[colorKey] && HIGHLIGHT_COLORS[colorKey].name) || colorKey;
}
