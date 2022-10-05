export function getRect(myPoints) {
  let width, height;
  const firstPoint = myPoints[0];
  const secondPoint = myPoints[1];

  const wx = Math.abs(firstPoint[0] - secondPoint[0]);
  const wy = Math.abs(firstPoint[1] - secondPoint[1]);
  const hx = Math.abs(firstPoint[0] - firstPoint[2]);
  const hy = Math.abs(firstPoint[1] - firstPoint[3]);

  width = Math.sqrt(wx * wx + wy * wy);
  height = Math.sqrt(hx * hx + hy * hy);

  return { width, height };
}
