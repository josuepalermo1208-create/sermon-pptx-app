export function parseSermon(raw) {
  const lines = raw
    .split(/\r?\n/)
    .map(line => line.trim())

  const result = {
    title: "",
    reference: "",
    intro: [],
    sections: [],
    conclusion: [],
  };

  let mode = "header";
  let currentSection = null;
  let currentItem = null;
  let currentListItem = null;

  for (const line of lines) {
    const isManualSlideBreak = /^\[S\]$/i.test(line);
    const isManualSlideBreakNoTitle = /^\[SX\]$/i.test(line);
    const isTextSpace = /^\[N\]$/i.test(line);
    // Secciones delimitadas por asteriscos, por ejemplo: "* Mi sección *".
    // Los dos delimitadores son obligatorios para no confundir una viñeta
    // con el título de una sección.
    const sectionTitleMatch = line.match(
      /^\*\s*(.+?)\s*\*$/
    );

    if (sectionTitleMatch) {
      if (currentSection) {
        result.sections.push(currentSection);
      }

      currentSection = {
        num: "",
        title: sectionTitleMatch[1].trim(),
        ref: "",
        items: [],
      };

      currentItem = null;
      currentListItem = null;
      mode = "section";
      continue;
    }

    // Título
    if (
      mode === "header" &&
      !result.title &&
      /[A-ZÁÉÍÓÚÑ]{3,}/.test(line)
    ) {
      const refMatch = line.match(
        /^(.*?)\s+([\w]+[\w\s]*\d[\s:.\d,-]+)$/
      );

      if (
        refMatch &&
        refMatch[2].trim().length < 30
      ) {
        result.title = refMatch[1].trim();
        result.reference = refMatch[2].trim();
      } else {
        result.title = line;
      }

      result.title = result.title.replace(/\s*\[s\]\s*/gi, "\n").trim();

      mode = "post-title";
      continue;
    }

    // Referencia bíblica
    if (
      mode === "post-title" &&
      !result.reference &&
      /\d/.test(line) &&
      line.length < 40
    ) {
      result.reference = line;
      mode = "intro";
      continue;
    }

    if (mode === "post-title") {
      mode = "intro";
    }

    // INTRODUCCIÓN
    if (/^INTRODUCCI[ÓO]N/i.test(line)) {
      currentListItem = null;
      mode = "intro";
      continue;
    }

    // CONCLUSIÓN
    if (/^CONCLUSI[ÓO]N/i.test(line)) {
      if (currentSection) {
        result.sections.push(currentSection);
        currentSection = null;
      }

      currentListItem = null;
      mode = "conclusion";
      continue;
    }

    // Secciones romanas
    const secMatch = line.match(
      /^([IVXLCDM]+)\.\s*(.+)$/
    );

    if (secMatch) {
      if (currentSection) {
        result.sections.push(currentSection);
      }

      const secLine =
        secMatch[2].trim();

      let secTitle =
        secLine;

      let secRef = "";

      const parenMatch =
        secLine.match(
          /^(.*?)\s*\((.*?)\)\s*$/
        );

      if (parenMatch) {

        secTitle =
          parenMatch[1].trim();

        secRef =
          parenMatch[2].trim();
      }

      currentSection = {
        num: secMatch[1].toUpperCase(),
        title: secTitle,
        ref: secRef,
        items: [],
      };

      currentItem = null;
      currentListItem = null;

      mode = "section";
      continue;
    }

    // Intro
    else if (mode === "intro") {

      if (isTextSpace) {
        result.intro.push(null);
        currentListItem = null;
        continue;
      }

      if (isManualSlideBreak || isManualSlideBreakNoTitle) {
        result.intro.push({ pageBreak: true, hideTitle: isManualSlideBreakNoTitle });
        currentListItem = null;
        continue;
      }

      if (line === "") {
        continue;
      }

      const numberedMatch = line.match(/^(\d+)\.\s*(.+)$/);
      if (numberedMatch) {
        currentListItem = {
          number: Number(numberedMatch[1]),
          text: numberedMatch[2].trim(),
          children: [],
        };
        result.intro.push(currentListItem);
        continue;
      }

      const childMatch = line.match(/^\(?([a-z])(?:\)|\.)\s*(.*)$/i);
      if (childMatch && currentListItem) {
        currentListItem.children.push({
          letter: childMatch[1].toLowerCase(),
          text: childMatch[2].trim(),
        });
        continue;
      }

      const bulletMatch = line.match(/^\-\s+(.+)$/);
      result.intro.push({
        text: (bulletMatch ? bulletMatch[1] : line).trim(),
        bullet: Boolean(bulletMatch),
      });
      currentListItem = null;
    }

    // Los renglones vacíos solo separan visualmente los puntos de una
    // sección; no deben crear una diapositiva adicional.
    if (
      mode === "section" &&
      line === ""
    ) {
      continue;
    }

    // ITEMS DE LA SECCIÓN
    if (mode === "section" && currentSection) {
      if (isTextSpace) {
        currentSection.items.push(null);
        currentItem = null;
        continue;
      }

      if (isManualSlideBreak || isManualSlideBreakNoTitle) {
        currentSection.items.push({ pageBreak: true, hideTitle: isManualSlideBreakNoTitle });
        currentItem = null;
        continue;
      }

      const mainMatch = line.match(
        /^(\d+)\.\s*(.+)$/
      );
      if (mainMatch) {
        currentItem = {
          number: Number(mainMatch[1]),
          text: mainMatch[2].trim(),
          children: []
        };
        currentSection.items.push(currentItem);
        continue;
      }
      const bulletMatch = line.match(
        /^(?:-|\*|\u2022)\s+(.+)$/
      );
      if (bulletMatch) {
        currentItem = {
          bullet: true,
          text: bulletMatch[1].trim(),
          children: []
        };
        currentSection.items.push(currentItem);
        continue;
      }
      const childMatch = line.match(
        /^\(?([a-z])(?:\)|\.)\s*(.*)$/i
      );
      if (
        childMatch &&
        currentItem
      ) {
        currentItem.children.push({
          letter: childMatch[1].toLowerCase(),
          text: childMatch[2].trim()
        });
        continue;
      }

      // El texto sin marcador también pertenece a la sección, pero no debe
      // recibir viñeta ni numeración automática.
      currentItem = {
        text: line,
        children: [],
      };
      currentSection.items.push(currentItem);
    }

    // Conclusión
    else if (mode === "conclusion") {

      if (isTextSpace) {
        result.conclusion.push(null);
        currentListItem = null;
        continue;
      }

      if (isManualSlideBreak || isManualSlideBreakNoTitle) {
        result.conclusion.push({ pageBreak: true, hideTitle: isManualSlideBreakNoTitle });
        currentListItem = null;
        continue;
      }

      if (line === "") {
        continue;
      }

      const numberedMatch = line.match(/^(\d+)\.\s*(.+)$/);
      if (numberedMatch) {
        currentListItem = {
          number: Number(numberedMatch[1]),
          text: numberedMatch[2].trim(),
          children: [],
        };
        result.conclusion.push(currentListItem);
        continue;
      }

      const childMatch = line.match(/^\(?([a-z])(?:\)|\.)\s*(.*)$/i);
      if (childMatch && currentListItem) {
        currentListItem.children.push({
          letter: childMatch[1].toLowerCase(),
          text: childMatch[2].trim(),
        });
        continue;
      }

      const bulletMatch = line.match(/^\-\s+(.+)$/);
      result.conclusion.push({
        text: (bulletMatch ? bulletMatch[1] : line).trim(),
        bullet: Boolean(bulletMatch),
      });
      currentListItem = null;
    }
  }

  if (currentSection) {
    result.sections.push(currentSection);
  }

  return result;
}
