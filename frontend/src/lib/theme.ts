function hexToHSL(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export function applyMentorTheme(primaryColor: string, secondaryColor: string, accentColor?: string) {
  const root = document.documentElement;
  const primaryHSL = hexToHSL(primaryColor);
  const secondaryHSL = hexToHSL(secondaryColor);
  
  root.style.setProperty('--color-primary', primaryHSL);
  root.style.setProperty('--color-secondary', secondaryHSL);
  root.style.setProperty('--primary', primaryHSL);
  root.style.setProperty('--ring', primaryHSL);

  if (accentColor) {
    const accentHSL = hexToHSL(accentColor);
    root.style.setProperty('--color-accent', accentHSL);
  }
}

export function resetTheme() {
  const root = document.documentElement;
  root.style.removeProperty('--color-primary');
  root.style.removeProperty('--color-secondary');
  root.style.removeProperty('--color-accent');
  root.style.removeProperty('--primary');
  root.style.removeProperty('--ring');
}
