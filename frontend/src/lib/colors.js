export const HIGHLIGHT_COLORS = {
  yellow: { key: 'yellow', label: 'Yellow', name: 'Key Metrics', hex: '#EAB308', rgba: 'rgba(254, 243, 199, 0.5)', rgbaSoft: 'rgba(234,179,8,0.18)', rgbaHover: 'rgba(234,179,8,0.38)', solid: '#fbbf24' },
  green:  { key: 'green',  label: 'Green',  name: 'Competitive Advantages', hex: '#22C55E', rgba: 'rgba(209, 250, 229, 0.5)', rgbaSoft: 'rgba(34,197,94,0.18)', rgbaHover: 'rgba(34,197,94,0.38)', solid: '#10b981' },
  blue:   { key: 'blue',   label: 'Blue',   name: 'Management Questions', hex: '#3B82F6', rgba: 'rgba(219, 234, 254, 0.5)', rgbaSoft: 'rgba(59,130,246,0.18)', rgbaHover: 'rgba(59,130,246,0.38)', solid: '#3b82f6' },
  pink:   { key: 'pink',   label: 'Pink',   name: 'Investment Risks', hex: '#EC4899', rgba: 'rgba(252, 231, 243, 0.5)', rgbaSoft: 'rgba(236,72,153,0.18)', rgbaHover: 'rgba(236,72,153,0.38)', solid: '#ec4899' },
  orange: { key: 'orange', label: 'Orange', name: 'Commercial DD', hex: '#F97316', rgba: 'rgba(254, 215, 170, 0.5)', rgbaSoft: 'rgba(249,115,22,0.18)', rgbaHover: 'rgba(249,115,22,0.38)', solid: '#f59e0b' },
};

export const HIGHLIGHT_COLOR_KEYS = Object.keys(HIGHLIGHT_COLORS);

/** Display name for a color: custom label from document or default (e.g. "Commercial DD"). */
export function getColorDisplayName(colorKey, colorLabels = {}) {
  if (colorLabels && typeof colorLabels[colorKey] === 'string' && colorLabels[colorKey].trim()) {
    return colorLabels[colorKey].trim();
  }
  return (HIGHLIGHT_COLORS[colorKey] && HIGHLIGHT_COLORS[colorKey].name) || colorKey;
}
