import { describe, expect, it } from "vitest";
import { PLATES } from "./catalog";
import { PLATE_THEMES, plateTheme } from "../src/lib/plateTheme";

function luminance(hex: string): number {
  const channels = hex.slice(1).match(/.{2}/g)?.map((channel) => Number.parseInt(channel, 16) / 255) ?? [];
  const [red, green, blue] = channels.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrast(first: string, second: string): number {
  const lighter = Math.max(luminance(first), luminance(second));
  const darker = Math.min(luminance(first), luminance(second));
  return (lighter + 0.05) / (darker + 0.05);
}

describe("plate themes", () => {
  it("defines a theme for every plate in the catalog", () => {
    for (const plate of PLATES) {
      expect(PLATE_THEMES[plate.region][plate.code], plate.id).toBeDefined();
    }
  });

  it("keeps every plate label legible", () => {
    const lowContrast = PLATES.flatMap((plate) => {
      const theme = plateTheme(plate);
      const ratio = contrast(theme.foreground, theme.background);
      return ratio < 4.5 ? [`${plate.id}: ${ratio.toFixed(2)}`] : [];
    });
    expect(lowContrast).toEqual([]);
  });
});
