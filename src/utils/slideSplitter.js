function estimateLines(text, charsPerLine) {
    return text
        .split("\n")
        .reduce(
            (total, line) =>
                total + Math.max(1, Math.ceil(line.length / charsPerLine)),
            0
        );
}

export function splitContentIntoSlides(items, slideFormat) {

    const maxItems =
        slideFormat === "widescreen"
            ? 6
            : 5;

    const chunks = [];

    let current = [];
    let currentHideTitle = false;

    items.forEach(item => {

        // Salto manual
        if (item?.pageBreak) {

            if (current.length) {
                chunks.push({ items: current, hideTitle: currentHideTitle });
            }

            current = [];
            currentHideTitle = Boolean(item.hideTitle);
            return;
        }

        if (current.filter(item => item !== null).length >= maxItems) {

            chunks.push({ items: current, hideTitle: currentHideTitle });

            current = [];
            currentHideTitle = false;
        }

        current.push(item);

    });

    if (current.length) {
        chunks.push({ items: current, hideTitle: currentHideTitle });
    }

    return chunks;
}