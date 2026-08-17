function countStrictlyLess(sorted: number[], value: number) {
  let low = 0;
  let high = sorted.length;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (sorted[mid] < value) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }
  return low;
}

function countStrictlyGreater(sorted: number[], value: number) {
  let low = 0;
  let high = sorted.length;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (sorted[mid] <= value) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }
  return sorted.length - low;
}

export function computeCliffsDelta(segment: number[], outside: number[]) {
  if (segment.length === 0 || outside.length === 0) {
    return null;
  }

  const sortedOutside = [...outside].sort((left, right) => left - right);
  let greater = 0;
  let lesser = 0;

  for (const value of segment) {
    greater += countStrictlyLess(sortedOutside, value);
    lesser += countStrictlyGreater(sortedOutside, value);
  }

  return (greater - lesser) / (segment.length * outside.length);
}
