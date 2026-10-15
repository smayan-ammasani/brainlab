// Simple statistics.

export function mean(values) {
  if (values.length === 0) return NaN;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

// Mean absolute deviation: the average distance of each value from the mean.
export function meanAbsDev(values) {
  const m = mean(values);
  return mean(values.map((v) => Math.abs(v - m)));
}
