import { getContrastText, getReadableColor } from "../utils/slideColors";

function SlidePreview({
  title,
  subtitle,
  items = [],
  isCover = false,
  footer = "",
  roman = "",
  themeColor = "wine",
  slideFormat = "widescreen",
  useBullets = false,
  startNumber = 1,
  fontSettings = {},
  slideDesign = "classic",
  slideBackground = "#FFFFFF",
  hideHeader = false,
  titleColor = "#000000",
  headingColor = "#000000",
  romanColorMode = "theme",
  customRomanColor = "#000000",
  markerColorMode = "theme",
  customMarkerColor = "#000000",
}) {
  const typography = {
    coverTitle: { fontFace: "Calibri", fontSize: 80 },
    reference: { fontFace: "Calibri", fontSize: 32 },
    heading: { fontFace: "Calibri", fontSize: 40 },
    content: { fontFace: "Calibri", fontSize: 32 },
    footer: { fontFace: "Calibri", fontSize: 14 },
    ...fontSettings,
  };

  const previewFontSize = (type, scale) =>
    `${typography[type].fontSize * scale}px`;
  const THEMES = {
    wine: {
      dark: "#7B1F1F",
      accent: "#9B2C2C",
      text: "#8B1A1A",
    },

    blue: {
      dark: "#1E3A8A",
      accent: "#2563EB",
      text: "#1D4ED8",
    },
    green: {
      dark: "#166534",
      accent: "#22C55E",
      text: "#15803D",
    },

    purple: {
      dark: "#6B21A8",
      accent: "#9333EA",
      text: "#7E22CE",
    },

    gray: {
      dark: "#6B7280",
      accent: "#9CA3AF",
      text: "#4B5563",
    },

    black: {
      dark: "#000000",
      accent: "#333333",
      text: "#666666",
    },

    brown: {
      dark: "#64483c",
      accent: "#8B5E3C",
      text: "#7B4B3A",
    },
  };

  const colors = themeColor.startsWith("#")
    ? { dark: themeColor, accent: themeColor, text: themeColor }
    : THEMES[themeColor] || THEMES.wine;
  const palette = slideDesign === "formal"
    ? { dark: "#334155", accent: "#64748B", text: "#334155" }
    : colors;
  const textColor = getContrastText(slideBackground);
  const accentColor = getReadableColor(slideBackground, palette.text);
  const romanColor = romanColorMode === "custom"
    ? customRomanColor
    : romanColorMode === "black"
      ? "#000000"
      : accentColor;
  const markerColor = markerColorMode === "custom"
    ? customMarkerColor
    : markerColorMode === "black"
      ? "#000000"
      : accentColor;
  const mutedTextColor = getReadableColor(slideBackground, textColor === "#FFFFFF" ? "#E5E7EB" : "#666666");

  const isWidescreen =
    slideFormat ===
    "widescreen";

  const slideRatio =
    slideFormat ===
      "widescreen"
      ? 16 / 9
      : 4 / 3;

  const slideStyle = {
    width: "100%",
    aspectRatio:
      slideRatio,

    maxWidth:
      slideFormat ===
        "widescreen"
        ? "950px"
        : "720px",

    margin:
      "0 auto",
    borderTop: slideDesign === "classic"
      ? undefined
      : `8px solid ${palette.dark}`,
    backgroundColor: slideBackground,
    color: textColor,
  };
  return (
    <div
      className={`slide-preview slide-design-${slideDesign}`}
      style={slideStyle}
    >

      {/* Barra lateral */}
      {/* {isCover && (
        <>
          <div
            className="accent-bar"
            style={{
              background:
                colors.dark,
            }}
          ></div>

          <div
            className="accent-bar2"
            style={{
              background:
                colors.accent,
            }}
          ></div>
        </>
      )} */}

      {/* PORTADA */}
      {isCover ? (
        <div className="slide-body cover-body">
          <h1
            className="slide-title"
            style={{
              fontFamily: typography.coverTitle.fontFace,
              fontSize: previewFontSize("coverTitle", 0.5),
              color: titleColor,
              whiteSpace: "pre-line",
            }}
          >
            {title}
          </h1>

          <p
            className="slide-reference"
            style={{
              fontFamily: typography.reference.fontFace,
              fontSize: previewFontSize("reference", 0.75),
              color: mutedTextColor,
            }}
          >
            {subtitle}
          </p>
        </div>
      ) : (
        <>
          {!hideHeader && (
            <>
              {/* Título */}
              <div className="slide-header">
                <h2
                  className="slide-section-title"
                  style={{
                    fontFamily: typography.heading.fontFace,
                    fontSize: previewFontSize("heading", 0.55),
                    color: headingColor,
                  }}
                >
                  {roman && (
                    <span
                      className="roman"
                      style={{
                        color: romanColor,
                      }}
                    >
                      {roman}.
                    </span>
                  )}{" "}

                  {title}
                </h2>
              </div>

              <div
                className="divider"
                style={{
                  background:
                    accentColor,
                }}
              ></div>
            </>
          )}

          {/* Contenido */}
          <div className="slide-content">
            {items.map((item, index) => item === null ? (
              <div
                key={index}
                className="slide-item slide-item-spacer"
                aria-hidden="true"
              />
            ) : (
              <div
                key={index}
                className="slide-item"
              >
                {item?.bullet ? (
                  <span
                    className="bullet"
                    style={{
                      color: markerColor,
                      fontFamily: typography.content.fontFace,
                      fontSize: previewFontSize("content", 0.56),
                    }}
                  >
                    •
                  </span>
                ) : typeof item?.number === "number" && (
                  <span
                    className="number"
                    style={{
                      color: markerColor,
                      fontFamily: typography.content.fontFace,
                      fontSize: previewFontSize("content", 0.56),
                    }}
                  >
                    {item?.number ?? startNumber + index}.
                  </span>

                )}

                <div
                  className="item-body"
                  style={{
                    fontFamily: typography.content.fontFace,
                    fontSize: previewFontSize("content", 0.56),
                    color: textColor,
                  }}
                >
                  <div>
                    {typeof item === "string"
                      ? item
                      : item.text}
                  </div>

                  {item.children?.length > 0 &&
                    item.children.map((child) => (
                      <div
                        key={child.letter}
                        className="sub-item"
                      >
                        <span
                          className="sub-letter"
                          style={{
                            color: accentColor,
                            fontFamily: typography.content.fontFace,
                            fontSize: previewFontSize("content", 0.56),
                          }}
                        >
                          {child.letter})
                        </span>

                        <span
                          className="sub-text"
                          style={{
                            fontFamily: typography.content.fontFace,
                            fontSize: previewFontSize("content", 0.56),
                            color: textColor,
                          }}
                        >
                          {child.text}
                        </span>
                      </div>
                    ))
                  }
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Footer */}
      <div
        className="slide-footer"
        style={{
          background:
            palette.dark,
          fontFamily: typography.footer.fontFace,
          fontSize: previewFontSize("footer", 0.7),
          color: getContrastText(palette.dark),
        }}
      >
        {footer}
      </div>
    </div>
  );
}

export default SlidePreview;
