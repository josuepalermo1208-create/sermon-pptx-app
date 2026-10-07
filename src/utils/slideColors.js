const DEFAULT_TEXT_COLOR = "#1A1A1A";
const LIGHT_TEXT_COLOR = "#FFFFFF";

function normalizeHex(color) {
  const value = String(color || "").trim().replace(/^#/, "");
  if (/^[0-9a-f]{3}$/i.test(value)) {
    return value.split("").map((part) => part + part).join("").toUpperCase();
  }
  return /^[0-9a-f]{6}$/i.test(value) ? value.toUpperCase() : "FFFFFF";
}

function getLuminance(color) {
  const hex = normalizeHex(color);
  const channels = [0, 2, 4].map((index) => parseInt(hex.slice(index, index + 2), 16) / 255);
  const linear = channels.map((channel) => (
    channel <= 0.03928
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4
  ));
  return (0.2126 * linear[0]) + (0.7152 * linear[1]) + (0.0722 * linear[2]);
}

export function getContrastText(backgroundColor) {
  return getLuminance(backgroundColor) > 0.179
    ? DEFAULT_TEXT_COLOR
    : LIGHT_TEXT_COLOR;
}

export function getReadableColor(backgroundColor, preferredColor) {
  const contrastText = getContrastText(backgroundColor);
  const preferredContrast = getContrastRatio(backgroundColor, preferredColor);
  return preferredContrast >= 3 ? preferredColor : contrastText;
}

export function getContrastRatio(firstColor, secondColor) {
  const first = getLuminance(firstColor);
  const second = getLuminance(secondColor);
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
}

export function toPptxColor(color) {
  return normalizeHex(color);
}