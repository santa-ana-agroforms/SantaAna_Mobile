import { PixelRatio, useWindowDimensions } from "react-native";

export type Breakpoint = "xs" | "sm" | "md" | "lg" | "xl";
const bp = { xs: 0, sm: 360, md: 420, lg: 520, xl: 640 };

export const useResponsive = () => {
  const { width, height } = useWindowDimensions();
  const isPortrait = height >= width;

  const breakpoint: Breakpoint =
    width >= bp.xl
      ? "xl"
      : width >= bp.lg
        ? "lg"
        : width >= bp.md
          ? "md"
          : width >= bp.sm
            ? "sm"
            : "xs";

  const base = breakpoint === "xs" ? 14 : breakpoint === "sm" ? 15 : 16;
  const rem = base * (PixelRatio.getFontScale?.() ?? 1);
  const columns =
    breakpoint === "lg" || breakpoint === "xl"
      ? 3
      : breakpoint === "xs"
        ? 1
        : 2;
  const gutter = breakpoint === "xs" ? 8 : 12;
  const scale = (n: number) => Math.round((width / 375) * n);

  return { width, height, isPortrait, breakpoint, rem, columns, gutter, scale };
};
