/** Display label for a cube: brand-prefixed, e.g. "GAN V100 MagLev". */
export function cubeLabel(cube: { brand?: string | null; name: string }): string {
  const brand = cube.brand?.trim();
  return brand ? `${brand} ${cube.name}` : cube.name;
}
