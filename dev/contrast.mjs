// Prints WCAG contrast ratios for the site's key color pairs (dev-only).
// Usage: node dev/contrast.mjs

function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const pairs = [
  ['Stroop ORANGE on stage', '#e69f00', '#1c2230'],
  ['Stroop BLUE on stage', '#56b4e9', '#1c2230'],
  ['Stroop GREEN on stage', '#009e73', '#1c2230'],
  ['Stroop PINK on stage', '#cc79a7', '#1c2230'],
  ['Stage text on stage', '#f3f5f8', '#1c2230'],
  ['Go text on go color', '#0f2230', '#8fd8ff'],
  ['Body text on page', '#1e2430', '#fbfaf7'],
  ['Muted text on page', '#4a5363', '#fbfaf7'],
  ['Muted text on white', '#4a5363', '#ffffff'],
  ['Link on page', '#075252', '#fbfaf7'],
  ['Button text on accent', '#ffffff', '#0b6e6e'],
  ['Secondary button text', '#075252', '#ffffff'],
  ['Focus ring on page', '#1a56db', '#fbfaf7'],
  ['White on blue marker', '#ffffff', '#2f5fd0'],
  ['White on orange marker', '#ffffff', '#a85c00'],
  ['Muted on accent-soft', '#4a5363', '#e2f1f0'],
  ['Text on warm-soft', '#1e2430', '#fdf3e3'],
];

for (const [name, fg, bg] of pairs) {
  console.log(`${contrast(fg, bg).toFixed(2).padStart(6)}  ${name} (${fg} on ${bg})`);
}
