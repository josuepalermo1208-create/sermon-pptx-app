import PptxGenJS from "pptxgenjs";
import { getContrastText, getReadableColor, toPptxColor } from "./slideColors";

function splitBulletItems(items, slideFormat) {
    const maxChars =
        slideFormat === "widescreen"
            ? 52
            : 42;

    const maxHeight =
        slideFormat === "widescreen"
            ? 5.0
            : 4.5;

    const slides = [];
    let current = [];
    let currentHeight = 0;
    let currentHideTitle = false;

    items.forEach((rawItem) => {

        if (rawItem?.pageBreak) {
            if (current.length) slides.push({ items: current, hideTitle: currentHideTitle });
            current = [];
            currentHeight = 0;
            currentHideTitle = Boolean(rawItem.hideTitle);
            return;
        }

        // Linea en blanco representada como null
        if (rawItem === null) {
            const blankH = 0.20;
            if (current.length && currentHeight + blankH > maxHeight) {
                slides.push({ items: current, hideTitle: currentHideTitle });
                current = [];
                currentHeight = 0;
            }
            current.push(null);
            currentHeight += blankH;
            return;
        }

        if (!rawItem) return;

        const item = typeof rawItem === "string" ? { text: rawItem } : rawItem;

        const text = item.text || "";
        if (!text) return;

        // Estimar líneas del texto principal
        const estimatedLines = text
            .split("\n")
            .reduce((total, line) => total + Math.max(1, Math.ceil(line.length / maxChars)), 0);

        let height = Math.max(0.55, estimatedLines * 0.33);

        // Añadir estimación para los sub-items si existen
        if (item.children && item.children.length) {
            const childCharsPerLine = Math.max(10, maxChars - 8);
            const childLines = item.children.reduce((t, c) => t + Math.max(1, Math.ceil((c.text || "").length / childCharsPerLine)), 0);
            const childHeight = Math.max(0.28, childLines * 0.28);
            height += childHeight;
        }

        // Si no cabe en la diapositiva actual, crear nueva
        if (current.length && currentHeight + height > maxHeight) {
            slides.push({ items: current, hideTitle: currentHideTitle });
            current = [];
            currentHeight = 0;
            currentHideTitle = false;
        }

        current.push({ ...item, height });
        currentHeight += height;
    });

    if (current.length) slides.push({ items: current, hideTitle: currentHideTitle });
    return slides;
}

export async function generatePPTX({
    sermon,
    fileName,
    footerMsg,
    includeIntro,
    includeConclusion,
    slideFormat,
    themeColor,
    slideDesign = "classic",
    slideBackground = "#FFFFFF",
    fontSettings = {},
    sectionPointLimit = 5,
    useBullets = false,
    startNumber = 1,
    headingColor = "#000000",
    titleColor = "#000000",
    romanColorMode = "theme",
    customRomanColor = "#000000",
    markerColorMode = "theme",
    customMarkerColor = "#000000",
}) {
    const pptx = new PptxGenJS();

    let SLIDE_W;
    let SLIDE_H;

    if (slideFormat === "standard") {
        // 4:3
        SLIDE_W = 10;
        SLIDE_H = 7.5;
    } else {
        // 16:9
        SLIDE_W = 13.333;
        SLIDE_H = 7.5;
    }

    pptx.defineLayout({
        name: "CUSTOM",
        width: SLIDE_W,
        height: SLIDE_H,
    });

    pptx.layout = "CUSTOM";

    pptx.author = "React Sermon App";
    pptx.subject = sermon.title;
    pptx.title = sermon.title;
    pptx.company = "ChatGPT";
    const THEMES = {
        wine: {
            dark: "7B1F1F",
            accent: "9B2C2C",
            redText: "8B1A1A",
        },

        blue: {
            dark: "1E3A8A",
            accent: "2563EB",
            redText: "1D4ED8",
        },

        green: {
            dark: "166534",
            accent: "22C55E",
            redText: "15803D",
        },

        purple: {
            dark: "6B21A8",
            accent: "9333EA",
            redText: "7E22CE",
        },

        gray: {
            dark: "6B7280",
            accent: "9CA3AF",
            redText: "4B5563",
        },

        black: {
            dark: "000000",
            accent: "333333",
            redText: "666666",
        },

        brown: {
            dark: "64483c",
            accent: "8B5E3C",
            redText: "7B4B3A",
        },
    };

    const selectedTheme = slideDesign === "formal"
        ? {
            dark: "334155",
            redText: "334155",
        }
        : themeColor.startsWith("#")
            ? {
                dark: toPptxColor(themeColor),
                accent: toPptxColor(themeColor),
                redText: toPptxColor(themeColor),
            }
            : THEMES[themeColor] || THEMES.wine;

    const isModern = slideDesign === "modern";
    const textColor = toPptxColor(getContrastText(slideBackground));
    const titleHeadingColor = toPptxColor(headingColor);
    const coverTitleColor = toPptxColor(titleColor);
    const accentColor = toPptxColor(getReadableColor(slideBackground, `#${selectedTheme.redText}`));
    const romanMarkerColor = romanColorMode === "custom"
        ? toPptxColor(customRomanColor)
        : romanColorMode === "black"
            ? "000000"
            : accentColor;
    const listMarkerColor = markerColorMode === "custom"
        ? toPptxColor(customMarkerColor)
        : markerColorMode === "black"
            ? "000000"
            : accentColor;
    const mutedColor = toPptxColor(getReadableColor(slideBackground, textColor === "FFFFFF" ? "#E5E7EB" : "#666666"));

    const typography = {
        coverTitle: { fontFace: "Calibri", fontSize: 80 },
        reference: { fontFace: "Calibri", fontSize: 32 },
        heading: { fontFace: "Calibri", fontSize: 40 },
        content: { fontFace: "Calibri", fontSize: 32 },
        footer: { fontFace: "Calibri", fontSize: 14 },
        ...fontSettings,
    };

    const COLORS = {
        ...selectedTheme,
        white: "FFFFFF",
        text: textColor,
        gray: mutedColor,
        accent: accentColor,
        title: coverTitleColor,
        heading: titleHeadingColor,
        roman: romanMarkerColor,
        marker: listMarkerColor,
    };

    function addFooter(slide, text) {
        const normalizedText = text.replace(/\s*\n\s*/g, " ");
        slide.addShape("rect", {
            x: 0,
            y: SLIDE_H - 0.55,
            w: SLIDE_W,
            h: 0.55,
            fill: {
                color: COLORS.dark,
            },
            line: {
                color: COLORS.dark,
            },
        });

        slide.addText(normalizedText.toUpperCase(), {
            x: 0,
            y: SLIDE_H - 0.55,
            w: SLIDE_W,
            h: 0.55,
            align: "center",
            valign: "mid",
            fontFace: typography.footer.fontFace,
            fontSize: typography.footer.fontSize,
            color: COLORS.white,
            bold: true,
            margin: 0,
            charSpacing: 2,
        });
    }

    // ----------------------
    // PORTADA
    // ----------------------
    {
        const slide = pptx.addSlide();

        slide.background = {
            color: toPptxColor(slideBackground),
        };

        if (isModern) {
            slide.addShape("rect", {
                x: 0,
                y: 0,
                w: SLIDE_W,
                h: 0.18,
                fill: { color: COLORS.dark },
                line: { color: COLORS.dark },
            });
            slide.addShape("rect", {
                x: 0,
                y: 0.18,
                w: SLIDE_W,
                h: 0.04,
                fill: { color: COLORS.accent },
                line: { color: COLORS.accent },
            });
        } else {
            // Barras laterales del diseño clásico y formal.
            // slide.addShape("rect", {
            //     x: 0,
            //     y: 0,
            //     w: 0.18,
            //     h: SLIDE_H,
            //     fill: { color: COLORS.dark },
            //     line: { color: COLORS.dark },
            // });

            // slide.addShape("rect", {
            //     x: 0.22,
            //     y: 0,
            //     w: 0.08,
            //     h: SLIDE_H,
            //     fill: { color: COLORS.accent },
            //     line: { color: COLORS.accent },
            // });
        }

        // título
        const coverTitle = sermon.title || "TÍTULO";
        const coverTitleHeight = Math.max(1, coverTitle.split("\n").length * 1.15);
        slide.addText(
            coverTitle,
            {
                x: isModern ? 1.0 : 1.2,
                y: 2.1 - (coverTitleHeight - 1) / 2,
                w: SLIDE_W - 2.2,
                h: coverTitleHeight,
                fontFace: typography.coverTitle.fontFace,
                fontSize: typography.coverTitle.fontSize,
                bold: true,
                align: "center",
                color: COLORS.title,
                valign: "mid",
            }
        );

        // referencia
        slide.addText(
            sermon.reference || "",
            {
                x: 2.0,
                y: 5.2,
                w: SLIDE_W - 4,
                h: 0.4,
                align: "center",
                fontFace: typography.reference.fontFace,
                fontSize: typography.reference.fontSize,
                color: COLORS.gray,
                charSpacing: 2,
            }
        );

        addFooter(slide, footerMsg);
    }

    // ----------------------
    // INTRODUCCIÓN
    // ----------------------

    if (includeIntro && sermon.intro.length > 0) {

        const introSlides = splitBulletItems(
            sermon.intro,
            slideFormat
        );

        introSlides.forEach(({ items: itemsChunk, hideTitle }, index) => {

            const slide = pptx.addSlide();

            slide.background = {
                color: toPptxColor(slideBackground),
            };

            if (!hideTitle) {
                slide.addText(
                    "INTRODUCCIÓN",
                    {
                        x: 0.5,
                        y: 0.3,
                        w: SLIDE_W - 1,
                        h: 0.4,
                        fontFace: typography.heading.fontFace,
                        fontSize: typography.heading.fontSize,
                        bold: true,
                        color: COLORS.heading,
                    }
                );

                slide.addShape("rect", {
                    x: 0.5,
                    y: 0.9,
                    w: SLIDE_W - 1,
                    h: 0.03,
                    fill: { color: isModern ? COLORS.accent : COLORS.dark },
                    line: { color: isModern ? COLORS.accent : COLORS.dark },
                });
            }

            let y = hideTitle ? 0.35 : 1.15;

            itemsChunk.forEach(item => {

                // Espacio en blanco
                if (item === null) {
                    y += 0.20;
                    return;
                }

                const contentText = [
                    item.text,
                    ...(item.children || []).map(
                        (child) => `${child.letter}) ${child.text}`
                    ),
                ].join("\n");

                const marker = item.bullet
                    ? {
                        text: "• ",
                        options: {
                            bold: true,
                            color: COLORS.marker,
                        },
                    }
                    : typeof item.number === "number"
                        ? {
                            text: `${item.number}. `,
                            options: {
                                bold: true,
                                color: COLORS.marker,
                            },
                        }
                        : null;

                slide.addText(
                    marker
                        ? [marker, { text: contentText, options: { color: COLORS.text } }]
                        : [{ text: contentText, options: { color: COLORS.text } }],
                    {
                        x: 0.8,
                        y,
                        w: SLIDE_W - 1.4,
                        h: item.height,
                        fontFace: typography.content.fontFace,
                        fontSize: typography.content.fontSize,
                        breakLine: true,
                        margin: 0,
                    }
                );

                y += item.height + 0.24;

            });

            addFooter(
                slide,
                `TEMA: ${sermon.title}`
            );

        });
    }

    // ----------------------
    // SECCIONES
    // ----------------------

    sermon.sections.forEach((section) => {

        let currentSlide;
        let y;
        let topY;
        let bottomLimit;

        let itemNumber = 1;

        function createSectionSlide(isContinuation = false, hideTitle = false) {

            currentSlide = pptx.addSlide();

            currentSlide.background = {
                color: toPptxColor(slideBackground),
            };

            let dividerY = 0.2;

            if (!hideTitle) {
                const sectionTitle =
                    (section.num ? `${section.num}. ` : "") +
                    `${section.title}` +
                    (section.ref ? ` (${section.ref})` : "");

                const titleCharsPerLine =
                    slideFormat === "widescreen"
                        ? 38
                        : 30;

                const estimatedTitleLines =
                    Math.max(
                        1,
                        Math.ceil(
                            sectionTitle.length /
                            titleCharsPerLine
                        )
                    );

                const titleHeight =
                    Math.max(
                        0.55,
                        estimatedTitleLines * 0.38
                    );

                dividerY =
                    0.35 +
                    titleHeight +
                    0.08;

                const sectionTitleParts = section.num
                    ? [
                        {
                            text: `${section.num}. `,
                            options: {
                                bold: true,
                                color: COLORS.roman,
                            },
                        },
                        {
                            text: section.title + (section.ref ? ` (${section.ref})` : ""),
                            options: {
                                color: COLORS.heading,
                            },
                        },
                    ]
                    : [
                        {
                            text: section.title + (section.ref ? ` (${section.ref})` : ""),
                            options: {
                                color: COLORS.heading,
                                bold: true,
                            },
                        },
                    ];

                currentSlide.addText(
                    sectionTitleParts,
                    {
                        x: isModern ? 0.85 : 0.7,
                        y: 0.35,
                        w: SLIDE_W - 1,
                        h: titleHeight,
                        fontFace: typography.heading.fontFace,
                        fontSize: estimatedTitleLines > 1
                            ? Math.min(typography.heading.fontSize, 32)
                            : typography.heading.fontSize,
                        bold: true,
                        breakLine: true,
                        margin: 0,
                    }
                );

                currentSlide.addShape(
                    "rect",
                    {
                        x: 0.5,
                        y: dividerY,
                        w: SLIDE_W - 1,
                        h: 0.03,
                        fill: {
                            color: isModern ? COLORS.accent : COLORS.dark,
                        },
                        line: {
                            color: isModern ? COLORS.accent : COLORS.dark,
                        },
                    }
                );
            }

            addFooter(
                currentSlide,
                `TEMA: ${sermon.title}`
            );

            topY = hideTitle ? 0.35 : dividerY + 0.28;

            bottomLimit =
                SLIDE_H - 0.9;

            y = topY;
        }

        createSectionSlide(false);

        let hasContentOnSlide = false;
        let pointsOnSlide = 0;

        for (let i = 0; i < section.items.length; i++) {
            const item = section.items[i];

            if (item === null) {
                const blankHeight = 0.2;
                if (hasContentOnSlide && y + blankHeight > bottomLimit) {
                    createSectionSlide(true);
                    hasContentOnSlide = false;
                    pointsOnSlide = 0;
                }
                y += blankHeight;
                continue;
            }

            if (item?.pageBreak) {
                const nextRealItem = section.items.slice(i + 1).find((next) => next && !next.pageBreak);
                if (nextRealItem && hasContentOnSlide) {
                    createSectionSlide(true, Boolean(item.hideTitle));
                    hasContentOnSlide = false;
                    pointsOnSlide = 0;
                }
                continue;
            }

            // -------- texto completo --------

            const text = typeof item === "string" ? item : (item && item.text) || "";
            if (!text) continue;

            // -------- cálculo de líneas --------

            const charsPerLine =
                slideFormat === "widescreen"
                    ? 52
                    : 42;

            const estimatedLines =
                text
                    .split("\n")
                    .reduce(
                        (total, line) =>
                            total +
                            Math.ceil(
                                line.length /
                                charsPerLine
                            ),
                        0
                    );

            const textHeight =
                Math.max(
                    0.55,
                    estimatedLines * 0.33
                );

            // Estimar altura de sub-items si existen
            let childrenHeight = 0;
            if (item.children && item.children.length) {
                const childChars = Math.max(10, charsPerLine - 8);
                const childLines = item.children.reduce((t, c) => t + Math.max(1, Math.ceil((c.text || "").length / childChars)), 0);
                childrenHeight = Math.max(0.28, childLines * 0.28);
            }

            const totalHeight = textHeight + childrenHeight;

            // -------- nueva diapositiva --------

            if (
                hasContentOnSlide &&
                (
                    pointsOnSlide >= sectionPointLimit ||
                    y + totalHeight > bottomLimit
                )
            ) {
                createSectionSlide(true);
                hasContentOnSlide = false;
                pointsOnSlide = 0;
            }

            // -------- número --------
            const isBullet = item.bullet === true;
            const isNumbered = typeof item.number === "number";
            const itemNumberToShow =
                isNumbered
                    ? item.number
                    : itemNumber;

            if (isBullet || isNumbered) {
                currentSlide.addText(
                    isBullet ? "\u2022" : `${itemNumberToShow}.`,
                    {
                        x: 0.9,
                        y,
                        w: 0.35,
                        h: textHeight,

                        fontFace: typography.content.fontFace,

                        fontSize: typography.content.fontSize,

                        bold: true,

                            color: COLORS.marker,

                        margin: 0,
                    }
                );
            }

            // -------- texto principal --------

            currentSlide.addText(
                item.text,
                {
                    x: isBullet || isNumbered ? 1.35 : 0.9,
                    y,
                    w: isBullet || isNumbered ? SLIDE_W - 2 : SLIDE_W - 1.4,
                    h: textHeight,
                    fontFace: typography.content.fontFace,
                    fontSize: typography.content.fontSize,
                    color: COLORS.text,
                    breakLine: true,
                    margin: 0,
                }
            );

            y += textHeight;

            // -------- sub-items --------
            if (item.children && item.children.length) {
                const childChars = Math.max(10, charsPerLine - 8);
                item.children.forEach((child) => {
                    const childLines = Math.max(1, Math.ceil((child.text || "").length / childChars));
                    const childHeight = Math.max(0.28, childLines * 0.28);

                    currentSlide.addText(
                        [
                            { text: `${child.letter}) `, options: { bold: true, color: COLORS.text } },
                            { text: child.text, options: { color: COLORS.text } },
                        ],
                        {
                            x: 1.55,
                            y,
                            w: SLIDE_W - 2.2,
                            h: childHeight,
                            fontFace: typography.content.fontFace,
                            fontSize: typography.content.fontSize,
                            breakLine: true,
                            margin: 0,
                        }
                    );

                    y += childHeight + 0.08;
                });
            }

            y += 0.24;
            if (isNumbered) {
                itemNumber = itemNumberToShow + 1;
            }
            hasContentOnSlide = true;
            pointsOnSlide += 1;
        }
    });

    // ----------------------
    // CONCLUSIÓN
    // ----------------------
    if (includeConclusion && sermon.conclusion.length > 0) {

        const conclusionSlides = splitBulletItems(
            sermon.conclusion,
            slideFormat
        );

        conclusionSlides.forEach(({ items: itemsChunk, hideTitle }, index) => {

            const slide = pptx.addSlide();

            slide.background = {
                color: toPptxColor(slideBackground),
            };

            if (!hideTitle) {
                slide.addText(
                    "CONCLUSIÓN",
                    {
                        x: 0.5,
                        y: 0.3,
                        w: SLIDE_W - 1,
                        h: 0.4,
                        fontFace: typography.heading.fontFace,
                        fontSize: typography.heading.fontSize,
                        bold: true,
                        color: COLORS.heading,
                    }
                );

                slide.addShape("rect", {
                    x: 0.5,
                    y: 0.9,
                    w: SLIDE_W - 1,
                    h: 0.03,
                    fill: { color: COLORS.dark },
                    line: { color: COLORS.dark },
                });
            }

            let y = hideTitle ? 0.35 : 1.15;

            itemsChunk.forEach(item => {

                if (item === null) {
                    y += 0.20;
                    return;
                }

                const contentText = [
                    item.text,
                    ...(item.children || []).map(
                        (child) => `${child.letter}) ${child.text}`
                    ),
                ].join("\n");

                const marker = item.bullet
                    ? {
                        text: "• ",
                        options: {
                            bold: true,
                            color: COLORS.marker,
                        },
                    }
                    : typeof item.number === "number"
                        ? {
                            text: `${item.number}. `,
                            options: {
                                bold: true,
                                color: COLORS.marker,
                            },
                        }
                        : null;

                slide.addText(marker
                    ? [marker, { text: contentText, options: { color: COLORS.text } }]
                    : [{ text: contentText, options: { color: COLORS.text } }], {
                    x: 0.8,
                    y,
                    w: SLIDE_W - 1.4,
                    h: item.height,
                    fontFace: typography.content.fontFace,
                    fontSize: typography.content.fontSize,
                    breakLine: true,
                    margin: 0,
                });

                y += item.height + 0.24;

            });

            addFooter(
                slide,
                `TEMA: ${sermon.title}`
            );

        });

    }

    await pptx.writeFile({
        fileName: `${fileName}.pptx`,
    });
}
