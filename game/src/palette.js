// The look plan, in one place: Sable Yard at dusk — warm amber sodium light
// against teal-grey steel, with ember for the attacking team and teal for the
// defending team. The same names are the CSS custom properties in index.html.
export const PALETTE = {
  canvas: '#0e1512',
  surface: '#1a2420',
  hairline: '#2e3d36',
  ink: '#e8e4d8',
  muted: '#8fa39a',
  accent: '#ffb02e',
  ember: '#ff5a3c',
  teal: '#2ec4b6',
  steel: '#3a4a52',
  rust: '#a65a2e',
  yard: '#232b26',
  sand: '#c9a86a',
};

export function shade(name) {
  return PALETTE[name];
}
