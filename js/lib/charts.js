// Hand-built SVG charts. Each chart is drawn at its container's real width, so
// text stays the same size on a phone and on a laptop.

const SVG_NS = 'http://www.w3.org/2000/svg';

export function svgEl(name, attrs = {}, text = null) {
  const el = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  if (text !== null) el.textContent = text;
  return el;
}

// Replaces the container's contents with an empty, labeled SVG.
export function newChart(container, height, title) {
  const width = Math.max(container.clientWidth, 260);
  const id = `${container.id}-title`;
  const svg = svgEl('svg', {
    class: 'chart', viewBox: `0 0 ${width} ${height}`, width, height, role: 'img', 'aria-labelledby': id,
  });
  svg.append(svgEl('title', { id }, title));
  container.replaceChildren(svg);
  return { svg, width };
}

// Horizontal bars. rows: [{ label, value, cls }]. format turns a value into its label.
export function drawBars(container, rows, title, format = (v) => `${Math.round(v)} ms`, max = null) {
  const rowH = 46;
  const top = 10;
  const { svg, width } = newChart(container, top * 2 + rows.length * rowH, title);
  const labelW = Math.max(...rows.map((r) => r.label.length)) * 9 + 18;
  const scaleMax = max || Math.max(...rows.map((r) => r.value), 1) * 1.25;
  rows.forEach((r, i) => {
    const y = top + i * rowH;
    // Leave about 90 px on the right for the value label.
    const w = Math.max(((width - labelW - 90) * r.value) / scaleMax, 2);
    svg.append(svgEl('text', { x: 8, y: y + 20, class: 'bar-label', 'text-anchor': 'start' }, r.label));
    svg.append(svgEl('rect', { x: labelW, y: y + 4, width: w, height: 30, rx: 4, class: r.cls }));
    svg.append(svgEl('text', { x: labelW + w + 8, y: y + 20, class: 'bar-value', 'text-anchor': 'start' }, format(r.value)));
  });
}
