import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { parseSermon } from "./utils/sermonParser";
import { generatePPTX } from "./utils/pptGenerator";
import SlidePreview from "./components/SlidePreview";
import { exportSlidesAsImages } from "./utils/imageExporter";
import { splitContentIntoSlides } from "./utils/slideSplitter";

// Presets for slide backgrounds
const SLIDE_BACKGROUND_PRESETS = [
  { name: "Blanco", value: "#FFFFFF" },
  { name: "Gris claro", value: "#E5E7EB" },
  { name: "Gris", value: "#A1A1A1" },
  { name: "Azul tenue", value: "#DCE6F1" },
  { name: "Crema", value: "#F5F1E8" },
  { name: "Carbón", value: "#262626" },
];

const THEME_TITLE_COLORS = {
  wine: "#7B1F1F",
  blue: "#1E3A8A",
  green: "#166534",
  purple: "#6B21A8",
  gray: "#6B7280",
  black: "#000000",
  brown: "#64483C",
};

// Default font settings for different slide elements
const DEFAULT_FONT_SETTINGS = {
  coverTitle: { fontFace: "Calibri", fontSize: 80 },
  reference: { fontFace: "Calibri", fontSize: 32 },
  heading: { fontFace: "Calibri", fontSize: 40 },
  content: { fontFace: "Calibri", fontSize: 32 },
  footer: { fontFace: "Calibri", fontSize: 14 },
};

// Default limits for the number of points per section based on slide format
const DEFAULT_SECTION_POINT_LIMITS = {
  widescreen: 5,
  standard: 8,
};

function App() {
  const [inputText, setInputText] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileNameEdited, setFileNameEdited] = useState(false);
  const [footerMsg, setFooterMsg] = useState(
    "FAVOR DE APAGAR O SILENCIAR SU CELULAR"
  );

  const [includeIntro, setIncludeIntro] = useState(true);
  const [includeConclusion, setIncludeConclusion] = useState(true);
  const [slideFormat, setSlideFormat] = useState("widescreen");
  const [sectionPointLimit, setSectionPointLimit] = useState(
    DEFAULT_SECTION_POINT_LIMITS.widescreen
  );
  const [themeColor, setThemeColor] = useState("wine");
  const [customThemeColor, setCustomThemeColor] = useState("#8B1A1A");
  const [headingColorMode, setHeadingColorMode] = useState("default");
  const [customHeadingColor, setCustomHeadingColor] = useState("#000000");
  const [titleColorMode, setTitleColorMode] = useState("default");
  const [customTitleColor, setCustomTitleColor] = useState("#000000");
  const [romanColorMode, setRomanColorMode] = useState("theme");
  const [customRomanColor, setCustomRomanColor] = useState("#7B1F1F");
  const [markerColorMode, setMarkerColorMode] = useState("theme");
  const [customMarkerColor, setCustomMarkerColor] = useState("#7B1F1F");
  const [slideDesign, setSlideDesign] = useState("classic");
  const [slideBackground, setSlideBackground] = useState("#FFFFFF");
  const [fontSettings, setFontSettings] = useState(DEFAULT_FONT_SETTINGS);

  const [imageFormat, setImageFormat] = useState("jpg");
  const [loadingAction, setLoadingAction] = useState(null);

  const [selectedSlides, setSelectedSlides] = useState([]);

  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showFullScreenEditor, setShowFullScreenEditor] = useState(false);
  const [showUserManual, setShowUserManual] = useState(false);
  const [showAboutDialog, setShowAboutDialog] = useState(false);
  const [legalDocument, setLegalDocument] = useState(null);
  const [showPresentation, setShowPresentation] = useState(false);
  const [presentationIndex, setPresentationIndex] = useState(0);
  const [nextPresentationIndex, setNextPresentationIndex] = useState(1);

  const slideRefs = useRef([]);
  const sermonFileInputRef = useRef(null);
  const menuRef = useRef(null);
  const presentationCurrentRef = useRef(null);
  const presentationNextRef = useRef(null);
  const externalPresentationWindowRef = useRef(null);
  const pendingTextCursorRef = useRef(null);

  useLayoutEffect(() => {
    const pendingCursor = pendingTextCursorRef.current;
    if (!pendingCursor) return;

    pendingCursor.textarea.setSelectionRange(
      pendingCursor.position,
      pendingCursor.position
    );
    pendingTextCursorRef.current = null;
  }, [inputText]);

  const handleImportText = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setInputText(await file.text());
    event.target.value = "";
  };

  const handleExportText = () => {
    const file = new Blob([inputText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${autoFileName || "sermon"}.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const handleClearText = () => {
    setInputText("");
  };

  const handleSermonTextChange = (event) => {
    const textarea = event.currentTarget;
    const value = textarea.value;

    if (event.nativeEvent.data !== "[") {
      setInputText(value);
      return;
    }

    const cursorPosition = textarea.selectionStart;
    const valueWithClosingBracket =
      `${value.slice(0, cursorPosition)}]${value.slice(cursorPosition)}`;

    pendingTextCursorRef.current = {
      textarea,
      position: cursorPosition,
    };
    setInputText(valueWithClosingBracket);
  };

  const updateFontSetting = (type, property, value) => {
    setFontSettings((current) => ({
      ...current,
      [type]: {
        ...current[type],
        [property]: property === "fontSize" ? Number(value) : value,
      },
    }));
  };

  const resetFontSettings = () => {
    setFontSettings(DEFAULT_FONT_SETTINGS);
  };

  const startPresentation = async () => {
    setPresentationIndex(0);
    setNextPresentationIndex(slides.length > 1 ? 1 : 0);
    setShowPresentation(true);
    try {
      await document.documentElement.requestFullscreen?.();
    } catch {
      // El modo presentación sigue funcionando como ventana completa si el navegador lo bloquea.
    }
  };

  const closePresentation = async () => {
    setShowPresentation(false);
    externalPresentationWindowRef.current?.close();
    externalPresentationWindowRef.current = null;
    if (document.fullscreenElement) {
      await document.exitFullscreen?.();
    }
  };

  const openExternalPresentation = () => {
    const externalWindow = window.open(
      "",
      "sermon-slides-output",
      "popup,width=1280,height=720"
    );

    if (!externalWindow) {
      alert("El navegador bloqueó la ventana de presentación. Permite ventanas emergentes para este sitio.");
      return;
    }

    externalPresentationWindowRef.current = externalWindow;
    externalWindow.document.title = "Sermon Slides - Presentación";
    externalWindow.document.body.className = "external-presentation-body";
    externalWindow.document.body.innerHTML = `
      <main class="external-presentation-main">
        <div class="external-presentation-slide"></div>
      </main>
    `;

    document.querySelectorAll("link[rel='stylesheet'], style").forEach((node) => {
      externalWindow.document.head.appendChild(node.cloneNode(true));
    });

    const initialSlide = slideRefs.current[presentationIndex];
    const externalTarget = externalWindow.document.querySelector(".external-presentation-slide");
    if (initialSlide && externalTarget) {
      externalTarget.appendChild(initialSlide.cloneNode(true));
    }

    externalWindow.addEventListener("beforeunload", () => {
      externalPresentationWindowRef.current = null;
    });
    externalWindow.focus();
  };

  const showNextSlide = () => {
    if (nextPresentationIndex === presentationIndex) return;
    setPresentationIndex(nextPresentationIndex);
    setNextPresentationIndex(
      nextPresentationIndex < slides.length - 1
        ? nextPresentationIndex + 1
        : nextPresentationIndex
    );
  };

  const sermon = parseSermon(inputText);
  const titleColor = titleColorMode === "custom"
    ? customTitleColor
    : titleColorMode === "theme"
      ? slideDesign === "formal"
        ? "#334155"
        : themeColor.startsWith("#")
          ? themeColor
          : THEME_TITLE_COLORS[themeColor] || THEME_TITLE_COLORS.wine
      : "#000000";
  const headingColor = headingColorMode === "custom"
    ? customHeadingColor
    : headingColorMode === "theme"
      ? slideDesign === "formal"
        ? "#334155"
        : themeColor.startsWith("#")
          ? themeColor
          : THEME_TITLE_COLORS[themeColor] || THEME_TITLE_COLORS.wine
      : "#000000";

  const autoFileName =
    sermon.title
      ? sermon.title
        .replace(
          /[\\/:*?"<>|]/g,
          ""
        )
        .replace(/\s+/g, " ")
        .trim()
      : "presentacion";
  const sermonTitleForFooter = sermon.title.replace(/\s*\n\s*/g, " ").trim();

  const slides = [];

  const [showMenu, setShowMenu] = useState(false);
  const [darkMode, setDarkMode] = useState(localStorage.getItem("theme") === "dark");

  useEffect(() => {
    if (
      sermon.title &&
      fileName.trim() === ""
    ) {
      setFileName(sermon.title);
    }
  }, [sermon.title]);

  useEffect(() => {
    if (darkMode) {
      document.body.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.body.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [darkMode]);

  useEffect(() => {
    if (!showFullScreenEditor) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setShowFullScreenEditor(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showFullScreenEditor]);

  useEffect(() => {
    if (!showUserManual) return undefined;

    const handleManualKeyDown = (event) => {
      if (event.key === "Escape") setShowUserManual(false);
    };

    window.addEventListener("keydown", handleManualKeyDown);
    return () => window.removeEventListener("keydown", handleManualKeyDown);
  }, [showUserManual]);

  useEffect(() => {
    if (!showAboutDialog) return undefined;

    const handleAboutKeyDown = (event) => {
      if (event.key === "Escape") setShowAboutDialog(false);
    };

    window.addEventListener("keydown", handleAboutKeyDown);
    return () => window.removeEventListener("keydown", handleAboutKeyDown);
  }, [showAboutDialog]);

  useEffect(() => {
    if (!legalDocument) return undefined;

    const handleLegalDocumentKeyDown = (event) => {
      if (event.key === "Escape") setLegalDocument(null);
    };

    window.addEventListener("keydown", handleLegalDocumentKeyDown);
    return () => window.removeEventListener("keydown", handleLegalDocumentKeyDown);
  }, [legalDocument]);

  useEffect(() => {
    if (!showMenu) return undefined;

    const handleOutsideClick = (event) => {
      if (!menuRef.current?.contains(event.target)) setShowMenu(false);
    };

    document.addEventListener("pointerdown", handleOutsideClick);
    return () => document.removeEventListener("pointerdown", handleOutsideClick);
  }, [showMenu]);

  useEffect(() => {
    if (!showPresentation) return undefined;

    const handlePresentationKeyDown = (event) => {
      if (event.key === "Escape") closePresentation();
      if (event.key === "ArrowRight" || event.key === "Enter") showNextSlide();
      if (event.key === "ArrowLeft" && presentationIndex > 0) {
        setPresentationIndex(presentationIndex - 1);
        setNextPresentationIndex(presentationIndex);
      }
    };

    window.addEventListener("keydown", handlePresentationKeyDown);
    return () => window.removeEventListener("keydown", handlePresentationKeyDown);
  }, [showPresentation, presentationIndex, nextPresentationIndex]);

  useEffect(() => {
    if (!showPresentation) return undefined;

    const renderClone = (target, source) => {
      if (!target) return;
      target.replaceChildren();
      if (source) target.appendChild(source.cloneNode(true));
    };

    renderClone(
      presentationCurrentRef.current,
      slideRefs.current[presentationIndex]
    );
    renderClone(
      presentationNextRef.current,
      slideRefs.current[nextPresentationIndex]
    );

    const externalWindow = externalPresentationWindowRef.current;
    if (externalWindow && !externalWindow.closed) {
      const externalTarget = externalWindow.document.querySelector(".external-presentation-slide");
      renderClone(externalTarget, slideRefs.current[presentationIndex]);
      externalWindow.document.title = `${presentationIndex + 1}. ${slides[presentationIndex]?.title || "Presentación"}`;
    }
  }, [showPresentation, presentationIndex, nextPresentationIndex, slides.length]);

  useEffect(() => {

    if (!fileNameEdited && sermon.title) {
      setFileName(sermon.title);
    }

  }, [sermon.title, fileNameEdited]);

  // portada
  slides.push({
    title: "Portada",
  });

  // Each preview chunk needs an entry so selection indices match its ref.
  if (
    includeIntro &&
    sermon.intro.length
  ) {
    splitContentIntoSlides(
      sermon.intro,
      slideFormat
    ).forEach((chunk, index) => {
      slides.push({
        title: `Introducción${index ? ` (${index + 1})` : ""}`,
        hideTitle: chunk.hideTitle,
      });
    });
  }

  // secciones
  sermon.sections.forEach(
    (section) => {

      const chunks =
        splitPreviewItems(
          section.items
        );

      chunks.forEach(
        (
          _,
          chunkIndex
        ) => {

          slides.push({
            title: section.num
              ? `${section.num}. ${section.title}`
              : section.title,
          });
        }
      );
    }
  );

  // Conclusion can have several chunks, just like the preview.
  if (
    includeConclusion &&
    sermon.conclusion.length
  ) {
    splitContentIntoSlides(
      sermon.conclusion,
      slideFormat
    ).forEach((chunk, index) => {
      slides.push({
        title: `Conclusión${index ? ` (${index + 1})` : ""}`,
        hideTitle: chunk.hideTitle,
      });
    });
  }

  const validateData = () => {

    if (!inputText.trim()) {
      alert("Debe ingresar el contenido del sermón.");
      return false;
    }

    if (!fileName.trim()) {
      alert("Debe escribir un nombre para el archivo.");
      return false;
    }

    return true;
  };

  const handleGenerate = async () => {
    if (loadingAction || !validateData()) return;

    setLoadingAction("pptx");
    try {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      await generatePPTX({
        sermon,
        fileName,
        footerMsg,
        includeIntro,
        includeConclusion,
        slideFormat,
        themeColor,
        titleColor,
        headingColor,
        slideDesign,
        slideBackground,
        fontSettings,
        sectionPointLimit,
        romanColorMode,
        customRomanColor,
        markerColorMode,
        customMarkerColor,
      });
    } catch (error) {
      console.error(error);
      alert("Ocurrió un error al generar el PowerPoint.");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleExportImages = async () => {
    if (loadingAction || !validateData()) return;

    if (selectedSlides.length === 0) {
      alert("Seleccione al menos una diapositiva para exportar.");
      return;
    }

    setLoadingAction("images");
    try {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      await exportSlidesAsImages({
        slideRefs,
        selectedSlides,
        format: imageFormat,
        fileName,
      });
    } catch (err) {
      console.error(err);
      alert("Ocurrió un error al exportar las imágenes.");
    } finally {
      setLoadingAction(null);
    }
  };

  function splitPreviewItems(items) {

    const chunks = [];

    let current = [];
    let currentHideTitle = false;
    let currentPointCount = 0;

    items.forEach(item => {

      // Salto manual
      if (item?.pageBreak) {

        if (current.length) {
          chunks.push({ items: current, hideTitle: currentHideTitle });
        }

        current = [];
        currentHideTitle = Boolean(item.hideTitle);
        currentPointCount = 0;
        return;
      }

      if (item === null) {
        current.push(item);
        return;
      }

      if (currentPointCount >= sectionPointLimit) {
        chunks.push({ items: current, hideTitle: currentHideTitle });
        current = [];
        currentHideTitle = false;
        currentPointCount = 0;
      }

      current.push(item);
      currentPointCount += 1;

    });

    if (current.length) {
      chunks.push({ items: current, hideTitle: currentHideTitle });
    }

    // Una sección sin puntos también debe mostrarse: el generador de PPTX
    // crea su diapositiva de título, por lo que la previsualización debe
    // conservar la misma estructura.
    return chunks.length ? chunks : [{ items: [], hideTitle: false }];
  }

  const slideCounter =
    { current: 0 };

  slideRefs.current = [];

  const allSlidesSelected =
    slides.length > 0 &&
    selectedSlides.length === slides.length;

  return (
    <div>
      <nav className="navbar">

        <div className="navbar-logo">
          Sermon Slider
        </div>

        <div className="navbar-right" ref={menuRef}>
          <button
            className="menu-btn"
            onClick={() =>
              setShowMenu(!showMenu)
            }
          >
            ☰
          </button>

          {showMenu && (
            <div className="menu-dropdown">
              <p className="menu-section-title">Apariencia</p>
              <div className="menu-item">
                <span>
                  Modo oscuro
                </span>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={darkMode}
                    onChange={() =>
                      setDarkMode(!darkMode)
                    }
                  />
                  <span className="slider"></span>
                </label>
              </div>
              <button
                type="button"
                className="manual-menu-btn"
                onClick={() => {
                  setShowUserManual(true);
                  setShowMenu(false);
                }}
              >
                <span className="manual-menu-icon" aria-hidden="true">?</span>
                Manual de uso
              </button>
              <button
                type="button"
                className="manual-menu-btn"
                onClick={() => {
                  setShowAboutDialog(true);
                  setShowMenu(false);
                }}
              >
                <span className="manual-menu-icon" aria-hidden="true">i</span>
                Acerca de
              </button>
            </div>
          )}
        </div>
      </nav>

      <main className="container">
        <section className="panel sermon-panel">
          <div className="sermon-header">
            <h2 className="panel-title">Texto del Sermón</h2>
            <div className="sermon-header-actions">
              <button type="button" className="sermon-clear-btn" onClick={handleClearText}>
                Borrar texto
              </button>
              <button type="button" className="fullscreen-editor-btn" onClick={() => setShowFullScreenEditor(true)}>
                <span aria-hidden="true">⛶</span>
              </button>
            </div>
          </div>

          <div className="settings-card">
            <textarea
              className="form-control textarea-control"
              value={inputText}
              onChange={handleSermonTextChange}
              placeholder="Pega aquí el sermón..."
            />
          </div>
          <div className="sermon-file-actions">
            <input
              ref={sermonFileInputRef}
              className="visually-hidden"
              type="file"
              accept=".txt,text/plain"
              onChange={handleImportText}
              aria-label="Seleccionar archivo de texto"
            />
            <button type="button" className="sermon-file-btn" onClick={() => sermonFileInputRef.current?.click()}>
              Importar .txt
            </button>
            <button type="button" className="sermon-file-btn" onClick={handleExportText}>
              Exportar .txt
            </button>
          </div>
        </section>

        {showFullScreenEditor && (
          <div className="fullscreen-editor" role="dialog" aria-modal="true" aria-labelledby="fullscreen-editor-title">
            <div className="fullscreen-editor-header">
              <h2 id="fullscreen-editor-title">Texto del Sermón</h2>
              <div className="fullscreen-editor-actions">
                <button type="button" className="sermon-clear-btn" onClick={handleClearText}>
                  Borrar texto
                </button>
                <button type="button" className="fullscreen-editor-close" onClick={() => setShowFullScreenEditor(false)}>
                  <span aria-hidden="true">✕</span>
                </button>
              </div>
            </div>
            <textarea
              className="form-control textarea-control fullscreen-editor-textarea"
              value={inputText}
              onChange={handleSermonTextChange}
              placeholder="Pega aquí el sermón..."
              autoFocus
            />
          </div>
        )}

        <section className="panel control-panel">
          <h2 className="panel-title">Configuración</h2>

          <div className="config-scroll">
            <div className="settings-card">
              <h3 className="card-title">
                Nombre del archivo
              </h3>

              <input
                className="form-control"
                type="text"
                value={fileName || autoFileName}
                onChange={(e) => {
                  const value = e.target.value;
                  setFileName(value);
                  setFileNameEdited(value.trim() !== "");
                }}
                placeholder="presentacion"
              />
            </div>

            <div className="settings-card">
              <h3 className="card-title">
                Mensaje inferior
              </h3>

              <input
                className="form-control"
                type="text"
                value={footerMsg}
                onChange={(e) =>
                  setFooterMsg(e.target.value)
                }
              />
            </div>

            <div className="settings-card">
              <h3 className="card-title">
                Tamaño de diapositiva
              </h3>

              <select
                className="form-control"
                value={slideFormat}
                onChange={(event) => {
                  const nextFormat = event.target.value;
                  setSlideFormat(nextFormat);
                  setSectionPointLimit(DEFAULT_SECTION_POINT_LIMITS[nextFormat]);
                }}
              >
                <option value="standard">
                  Estándar (4:3)
                </option>

                <option value="widescreen">
                  Panorámica (16:9)
                </option>
              </select>
            </div>

            <div className="settings-card">
              <h3 className="card-title">
                Contenido
              </h3>

              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={includeIntro}
                  onChange={() =>
                    setIncludeIntro(
                      !includeIntro
                    )
                  }
                />

                <span>
                  Incluir Introducción
                </span>
              </label>

              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={includeConclusion}
                  onChange={() =>
                    setIncludeConclusion(
                      !includeConclusion
                    )
                  }
                />

                <span>
                  Incluir Conclusión
                </span>
              </label>
            </div>

            <div className="settings-card section-point-limit-card">
              <h3 className="card-title">Puntos por sección</h3>
              <p className="setting-description">
                Máximo de puntos principales por diapositiva de sección.
              </p>
              <div className="section-point-limit-controls">
                <input
                  className="form-control section-point-limit-input"
                  type="number"
                  min="1"
                  max="20"
                  value={sectionPointLimit}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    if (Number.isFinite(value)) {
                      setSectionPointLimit(Math.min(20, Math.max(1, value)));
                    }
                  }}
                  aria-label="Máximo de puntos por sección"
                />
                <button
                  type="button"
                  className="reset-section-point-limit-btn"
                  onClick={() =>
                    setSectionPointLimit(
                      DEFAULT_SECTION_POINT_LIMITS[slideFormat]
                    )
                  }
                >
                  Restablecer predeterminado ({DEFAULT_SECTION_POINT_LIMITS[slideFormat]})
                </button>
              </div>
            </div>

            <div className="settings-card design-card">
              <h3 className="card-title">Diseño de diapositiva</h3>
              <div className="design-grid">
                <button
                  type="button"
                  className={`design-option ${slideDesign === "classic" ? "active" : ""}`}
                  onClick={() => setSlideDesign("classic")}
                >
                  <span className="design-swatch design-swatch-classic" />
                  <span>
                    <strong>Clásico</strong>
                    <small>Ordenado y tradicional</small>
                  </span>
                </button>
                <button
                  type="button"
                  className={`design-option ${slideDesign === "modern" ? "active" : ""}`}
                  onClick={() => setSlideDesign("modern")}
                >
                  <span className="design-swatch design-swatch-modern" />
                  <span>
                    <strong>Moderno</strong>
                    <small>Limpio y contemporáneo</small>
                  </span>
                </button>
                <button
                  type="button"
                  className={`design-option ${slideDesign === "formal" ? "active" : ""}`}
                  onClick={() => setSlideDesign("formal")}
                >
                  <span className="design-swatch design-swatch-formal" />
                  <span>
                    <strong>Formal</strong>
                    <small>Monocromático y sobrio</small>
                  </span>
                </button>
              </div>
            </div>

            {slideDesign !== "formal" && (
              <div className="settings-card">
                <h3 className="card-title">
                  Tema de color
                </h3>

                <div className="theme-grid">
                  <button type="button"
                    className={`theme-option ${themeColor === "wine"
                      ? "active"
                      : ""
                      }`}
                    onClick={() =>
                      setThemeColor("wine")
                    }
                  >
                    <span
                      className="theme-circle"
                      style={{
                        background: "#7B1F1F",
                      }}
                    />

                    Vino
                  </button>

                  <button
                    type="button"
                    className={`theme-option ${themeColor === "blue"
                      ? "active"
                      : ""
                      }`}
                    onClick={() =>
                      setThemeColor("blue")
                    }
                  >
                    <span
                      className="theme-circle"
                      style={{
                        background: "#1E3A8A",
                      }}
                    />

                    Azul
                  </button>

                  <button
                    type="button"
                    className={`theme-option ${themeColor === "green"
                      ? "active"
                      : ""
                      }`}
                    onClick={() =>
                      setThemeColor("green")
                    }
                  >
                    <span
                      className="theme-circle"
                      style={{
                        background: "#166534",
                      }}
                    />

                    Verde
                  </button>

                  <button
                    type="button"
                    className={`theme-option ${themeColor === "purple"
                      ? "active"
                      : ""
                      }`}
                    onClick={() =>
                      setThemeColor("purple")
                    }
                  >
                    <span
                      className="theme-circle"
                      style={{
                        background: "#6B21A8",
                      }}
                    />

                    Morado
                  </button>

                  <button
                    type="button"
                    className={`theme-option ${themeColor === "gray"
                      ? "active"
                      : ""
                      }`}
                    onClick={() =>
                      setThemeColor("gray")
                    }
                  >
                    <span
                      className="theme-circle"
                      style={{
                        background: "#6B7280",
                      }}
                    />

                    Gris
                  </button>

                  <button
                    type="button"
                    className={`theme-option ${themeColor === "black"
                      ? "active"
                      : ""
                      }`}
                    onClick={() =>
                      setThemeColor("black")
                    }
                  >
                    <span
                      className="theme-circle"
                      style={{
                        background: "#000000",
                      }}
                    />

                    Negro
                  </button>

                  <button
                    type="button"
                    className={`theme-option ${themeColor === "brown"
                      ? "active"
                      : ""
                      }`}
                    onClick={() =>
                      setThemeColor("brown")
                    }
                  >
                    <span
                      className="theme-circle"
                      style={{
                        background: "#64483c",
                      }}
                    />

                    Café
                  </button>

                  <label
                    className={`theme-option custom-theme-option ${themeColor === customThemeColor ? "active" : ""}`}
                  >
                    <span
                      className="theme-circle"
                      style={{ background: customThemeColor }}
                    />
                    <span>Personalizado</span>
                    <input
                      type="color"
                      value={customThemeColor}
                      onChange={(event) => {
                        const color = event.target.value.toUpperCase();
                        setCustomThemeColor(color);
                        setThemeColor(color);
                      }}
                      aria-label="Elegir tema de color personalizado"
                    />
                  </label>
                </div>
              </div>
            )}

            <div className="settings-card title-color-card">
              <h3 className="card-title">Color del título</h3>
              <select
                className="form-control"
                value={titleColorMode}
                onChange={(event) => setTitleColorMode(event.target.value)}
                aria-label="Color del título"
              >
                <option value="default">Predeterminado (negro)</option>
                <option value="theme">Color del tema</option>
                <option value="custom">Personalizado</option>
              </select>
              {titleColorMode === "custom" && (
                <label className="heading-color-picker">
                  <span>Color personalizado</span>
                  <input
                    type="color"
                    value={customTitleColor}
                    onChange={(event) => setCustomTitleColor(event.target.value.toUpperCase())}
                    aria-label="Elegir color personalizado para título"
                  />
                </label>
              )}
            </div>

            <div className="settings-card heading-color-card">
              <h3 className="card-title">Color de los encabezados</h3>
              <select
                className="form-control"
                value={headingColorMode}
                onChange={(event) => setHeadingColorMode(event.target.value)}
                aria-label="Color de los encabezados"
              >
                <option value="default">Predeterminado (negro)</option>
                <option value="theme">Color del tema</option>
                <option value="custom">Personalizado</option>
              </select>
              {headingColorMode === "custom" && (
                <label className="heading-color-picker">
                  <span>Color personalizado</span>
                  <input
                    type="color"
                    value={customHeadingColor}
                    onChange={(event) => setCustomHeadingColor(event.target.value.toUpperCase())}
                    aria-label="Elegir color personalizado para encabezados"
                  />
                </label>
              )}
            </div>

            <div className="settings-card marker-color-card">
              <h3 className="card-title">Color de números y marcadores</h3>

              <div className="marker-color-setting">
                <label className="marker-color-label" htmlFor="roman-color-mode">Números romanos</label>
                <select
                  id="roman-color-mode"
                  className="form-control"
                  value={romanColorMode}
                  onChange={(event) => setRomanColorMode(event.target.value)}
                >
                  <option value="theme">Color del tema</option>
                  <option value="black">Negro</option>
                  <option value="custom">Personalizado</option>
                </select>
                {romanColorMode === "custom" && (
                  <label className="heading-color-picker">
                    <span>Color personalizado</span>
                    <input
                      type="color"
                      value={customRomanColor}
                      onChange={(event) => setCustomRomanColor(event.target.value.toUpperCase())}
                      aria-label="Elegir color para números romanos"
                    />
                  </label>
                )}
              </div>

              <div className="marker-color-setting">
                <label className="marker-color-label" htmlFor="marker-color-mode">Numeraciones y viñetas</label>
                <select
                  id="marker-color-mode"
                  className="form-control"
                  value={markerColorMode}
                  onChange={(event) => setMarkerColorMode(event.target.value)}
                >
                  <option value="theme">Color del tema</option>
                  <option value="black">Negro</option>
                  <option value="custom">Personalizado</option>
                </select>
                {markerColorMode === "custom" && (
                  <label className="heading-color-picker">
                    <span>Color personalizado</span>
                    <input
                      type="color"
                      value={customMarkerColor}
                      onChange={(event) => setCustomMarkerColor(event.target.value.toUpperCase())}
                      aria-label="Elegir color para numeraciones y viñetas"
                    />
                  </label>
                )}
              </div>
            </div>

            <div className="settings-card slide-background-card">
              <h3 className="card-title">Fondo de diapositiva</h3>
              <div className="background-grid">
                {SLIDE_BACKGROUND_PRESETS.map((preset) => (
                  <button
                    type="button"
                    key={preset.value}
                    className={`background-option ${slideBackground === preset.value ? "active" : ""}`}
                    onClick={() => setSlideBackground(preset.value)}
                    aria-label={`Fondo ${preset.name}`}
                  >
                    <span className="background-swatch" style={{ backgroundColor: preset.value }} />
                    <span>{preset.name}</span>
                  </button>
                ))}
                <label className={`background-option custom-background-option ${!SLIDE_BACKGROUND_PRESETS.some((preset) => preset.value === slideBackground) ? "active" : ""}`}>
                  <span className="background-swatch custom-background-swatch" style={{ backgroundColor: slideBackground }} />
                  <span>Personalizado</span>
                  <input
                    type="color"
                    value={slideBackground}
                    onChange={(event) => setSlideBackground(event.target.value.toUpperCase())}
                    aria-label="Elegir fondo personalizado"
                  />
                </label>
              </div>
            </div>

            <div className="settings-card typography-card">
              <h3 className="card-title">Tipografía de diapositivas</h3>
              {[
                ["coverTitle", "Título de portada"],
                ["reference", "Referencia"],
                ["heading", "Encabezados"],
                ["content", "Contenido"],
                ["footer", "Pie de diapositiva"],
              ].map(([type, label]) => (
                <div className="typography-row" key={type}>
                  <span className="typography-label">{label}</span>
                  <select
                    className="form-control typography-font"
                    value={fontSettings[type].fontFace}
                    onChange={(event) =>
                      updateFontSetting(type, "fontFace", event.target.value)
                    }
                    aria-label={`Fuente para ${label}`}
                  >
                    <option value="Calibri">Calibri</option>
                    <option value="Arial">Arial</option>
                    <option value="Verdana">Verdana</option>
                    <option value="Georgia">Georgia</option>
                    <option value="Times New Roman">Times New Roman</option>
                  </select>
                  <input
                    className="form-control typography-size"
                    type="number"
                    min="8"
                    max="120"
                    value={fontSettings[type].fontSize}
                    onChange={(event) =>
                      updateFontSetting(type, "fontSize", event.target.value)
                    }
                    aria-label={`Tamaño para ${label}`}
                  />
                  <span className="typography-unit">pt</span>
                </div>
              ))}
              <button
                type="button"
                className="reset-typography-btn"
                onClick={resetFontSettings}
              >
                Restablecer configuración predeterminada
              </button>
            </div>
          </div>
        </section>

        <section className="panel preview-panel">
          <div className="preview-header">
            <div className="preview-title-group">
              <h2 className="panel-title">Vista previa</h2>
              <span className="slide-count">
                {slides.length} diapositivas
              </span>
            </div>
            <div className="preview-header-actions">
              <button
                type="button"
                className="sermon-file-btn"
                onClick={startPresentation}
              >
                Presentar
              </button>
            </div>
          </div>

          <div className="preview-scroll">
            <div
              className="slide-wrapper"
              ref={(el) => {
                if (el) {
                  slideRefs.current[
                    slideCounter.current++
                  ] = el;
                }
              }}
            >
              <SlidePreview
                isCover
                title={sermon.title || "TÍTULO"}
                subtitle={sermon.reference}
                titleColor={titleColor}
                headingColor={headingColor}
                romanColorMode={romanColorMode}
                customRomanColor={customRomanColor}
                markerColorMode={markerColorMode}
                customMarkerColor={customMarkerColor}
                footer={footerMsg}
                themeColor={themeColor}
                slideBackground={slideBackground}
                slideFormat={slideFormat}
                slideDesign={slideDesign}
                fontSettings={fontSettings}
              />
            </div>

            {includeIntro &&
              sermon.intro.length > 0 &&
              splitContentIntoSlides(
                sermon.intro,
                slideFormat
              ).map((chunk, index) => (
                <div
                  key={`intro-${index}`}
                  className="slide-wrapper"
                  ref={(el) => {
                    if (el) {
                      slideRefs.current[
                        slideCounter.current++
                      ] = el;
                    }
                  }}
                >
                  <SlidePreview
                    title={chunk.hideTitle ? "" : "INTRODUCCIÓN"}
                    headingColor={headingColor}
                    romanColorMode={romanColorMode}
                    customRomanColor={customRomanColor}
                    markerColorMode={markerColorMode}
                    customMarkerColor={customMarkerColor}
                    items={chunk.items}
                    hideHeader={chunk.hideTitle}
                    useBullets={true}
                    footer={`TEMA: ${sermonTitleForFooter}`}
                    themeColor={themeColor}
                    slideBackground={slideBackground}
                    slideFormat={slideFormat}
                    slideDesign={slideDesign}
                    fontSettings={fontSettings}
                  />
                </div>
              ))}

            {sermon.sections.flatMap((section) => {
              const chunks = splitPreviewItems(section.items);
              let startNumber = 1;

              return chunks.map((chunk, chunkIndex) => {
                const chunkItems = chunk.items;
                const chunkStartNumber =
                  chunkItems[0]?.number ?? startNumber;

                const slide = (
                  <div
                    key={`${section.num}-${chunkIndex}`}
                    className="slide-wrapper"
                    ref={(el) => {
                      if (el) {
                        slideRefs.current[
                          slideCounter.current++
                        ] = el;
                      }
                    }}
                  >
                    <SlidePreview
                      roman={chunk.hideTitle ? "" : section.num}
                      title={chunk.hideTitle ? "" : `${section.title}${section.ref
                        ? ` (${section.ref})`
                        : ""
                        }`}
                      headingColor={headingColor}
                      romanColorMode={romanColorMode}
                      customRomanColor={customRomanColor}
                      markerColorMode={markerColorMode}
                      customMarkerColor={customMarkerColor}
                      hideHeader={chunk.hideTitle}
                      items={chunkItems}
                      startNumber={chunkStartNumber}
                      footer={`TEMA: ${sermonTitleForFooter}`}
                      themeColor={themeColor}
                      slideBackground={slideBackground}
                      slideFormat={slideFormat}
                      slideDesign={slideDesign}
                      fontSettings={fontSettings}
                    />
                  </div>
                );

                const lastNumber = chunkItems[
                  chunkItems.length - 1
                ]?.number;
                startNumber =
                  typeof lastNumber === "number"
                    ? lastNumber + 1
                    : chunkStartNumber + chunkItems.length;

                return slide;
              });
            })}

            {includeConclusion &&
              sermon.conclusion.length > 0 &&
              splitContentIntoSlides(
                sermon.conclusion,
                slideFormat
              ).map((chunk, index) => (
                <div
                  key={`conc-${index}`}
                  className="slide-wrapper"
                  ref={(el) => {
                    if (el) {
                      slideRefs.current[
                        slideCounter.current++
                      ] = el;
                    }
                  }}
                >
                  <SlidePreview
                    title={chunk.hideTitle ? "" : "CONCLUSIÓN"}
                    headingColor={headingColor}
                    romanColorMode={romanColorMode}
                    customRomanColor={customRomanColor}
                    markerColorMode={markerColorMode}
                    customMarkerColor={customMarkerColor}
                    items={chunk.items}
                    hideHeader={chunk.hideTitle}
                    useBullets={true}
                    footer={`TEMA: ${sermonTitleForFooter}`}
                    themeColor={themeColor}
                    slideBackground={slideBackground}
                    slideFormat={slideFormat}
                    slideDesign={slideDesign}
                    fontSettings={fontSettings}
                  />
                </div>
              ))}
          </div>

          <div className="preview-actions">
            <button
              className="sermon-file-btn"
              onClick={handleGenerate}
              disabled={loadingAction !== null}
              aria-busy={loadingAction === "pptx"}
            >
              {loadingAction === "pptx" && <span className="loading-spinner" aria-hidden="true" />}
              {loadingAction === "pptx" ? "Generando PPTX..." : "Generar PPTX"}
            </button>

            <button
              className="sermon-file-btn"
              onClick={() =>
                setShowExportMenu(!showExportMenu)
              }
              disabled={loadingAction !== null}
            >
              Exportar a imágenes
            </button>
          </div>

          {showExportMenu && (
            <div
              className="modal-overlay"
              onClick={() =>
                setShowExportMenu(false)
              }
            >
              <div
                className="modal-content"
                onClick={(e) =>
                  e.stopPropagation()
                }
              >
                <div className="modal-header">
                  <h2>
                    Exportar imágenes
                  </h2>

                  <button
                    type="button"
                    className="close-btn"
                    onClick={() =>
                      setShowExportMenu(false)
                    }
                  >
                    ✕
                  </button>
                </div>

                <div className="form-group">
                  <label>
                    Formato
                  </label>

                  <select
                    className="form-control"
                    value={imageFormat}
                    onChange={(e) =>
                      setImageFormat(e.target.value)
                    }
                  >
                    <option value="jpg">
                      JPG
                    </option>
                    <option value="png">
                      PNG
                    </option>
                  </select>
                </div>

                <div className="slides-modal-list">
                  <h3>
                    Seleccionar diapositivas
                  </h3>

                  <label
                    className="checkbox-row"
                    style={{
                      fontWeight: "bold",
                      marginBottom: "10px",
                      borderBottom: "1px solid #ddd",
                      paddingBottom: "8px"
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={allSlidesSelected}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedSlides(
                            slides.map((_, index) => index)
                          );
                        } else {
                          setSelectedSlides([]);
                        }
                      }}
                    />

                    <span>Seleccionar todas</span>
                  </label>

                  {slides.map((slide, index) => (
                    <label
                      key={index}
                      className="checkbox-row"
                    >
                      <input
                        type="checkbox"
                        checked={selectedSlides.includes(index)}
                        onChange={() => {
                          setSelectedSlides((prev) =>
                            prev.includes(index)
                              ? prev.filter((x) => x !== index)
                              : [...prev, index]
                          );
                        }}
                      />

                      <span>
                        {slide.title}
                      </span>
                    </label>
                  ))}
                </div>

                <button
                  className="generate-btn"
                  onClick={handleExportImages}
                  disabled={loadingAction !== null}
                  aria-busy={loadingAction === "images"}
                >
                  {loadingAction === "images" && <span className="loading-spinner" aria-hidden="true" />}
                  {loadingAction === "images" ? "Generando imágenes..." : "Descargar imágenes"}
                </button>
              </div>
            </div>
          )}
        </section>
      </main>

      {showUserManual && (
        <div
          className="modal-overlay manual-overlay"
          onClick={() => setShowUserManual(false)}
        >
          <article
            className="modal-content user-manual"
            role="dialog"
            aria-modal="true"
            aria-labelledby="user-manual-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <span className="manual-kicker">Guía del programa</span>
                <h2 id="user-manual-title">Manual de uso</h2>
              </div>
              <button
                type="button"
                className="close-btn"
                onClick={() => setShowUserManual(false)}
                aria-label="Cerrar manual"
              >
                ✕
              </button>
            </div>

            <div className="manual-content">
              <p className="manual-intro">
                Sermon Slider convierte el texto de un sermón en diapositivas editables, imágenes o una presentación en tiempo real.
              </p>

              <section className="manual-section">
                <h3>1. Flujo de trabajo</h3>
                <p>Escribe o pega el sermón en el panel izquierdo. Revisa la vista previa de la derecha y ajusta las opciones del panel central.</p>
                <ol className="manual-list">
                  <li>Introduce el contenido o impórtalo desde un archivo `.txt`.</li>
                  <li>Configura el nombre, formato, diseño, color y tipografías.</li>
                  <li>Comprueba las diapositivas en la vista previa.</li>
                  <li>Genera un PowerPoint, exporta imágenes o inicia una presentación.</li>
                </ol>
              </section>

              <section className="manual-section">
                <h3>2. Editar el sermón</h3>
                <p>El botón de pantalla completa abre un editor amplio. Puedes borrar todo el texto, importar un `.txt` o exportar el texto actual para reutilizarlo.</p>
                <p>La aplicación actualiza la vista previa automáticamente mientras escribes.</p>
              </section>

              <section className="manual-section">
                <h3>3. Formato del contenido</h3>
                <p>La primera línea en mayúsculas se toma como título. Puedes añadir una referencia después y usar [s] para dividir el título en varias líneas.</p>
                <pre>{`TEMA DEL SERMÓN
Juan 3:16`}</pre>
                <p>En introducción y conclusión, usa guiones para crear viñetas. También puedes usar números e incisos.</p>
                <pre>{`INTRODUCCIÓN
- Primer punto
- Segundo punto
  a) Detalle del punto

CONCLUSIÓN
1. Cierre principal`}</pre>
              </section>

              <section className="manual-section">
                <h3>4. Secciones y saltos</h3>
                <p>Define una sección con asteriscos o con numeración romana. El espacio después del punto es opcional.</p>
                <pre>{`* Aplicación práctica *
1. Primer punto
2. Segundo punto
- Una viñeta
Texto normal sin marcador

I.TEXTO DEL ENCABEZADO`}</pre>
                <p>Para continuar en una nueva diapositiva con el mismo encabezado de sección, usa este marcador:</p>
                <pre>{`[S]`}</pre>
                <p>Si quieres que el contenido siga en una diapositiva sin título de sección, usa este marcador:</p>
                <pre>{`[SX]`}</pre>
                <p>Para dejar una línea de espacio en blanco en la diapositiva, escribe:</p>
                <pre>{`[N]`}</pre>
                <p>La misma lógica aplica en introducción y conclusión. Una línea vacía solo separa visualmente el contenido; no crea una nueva diapositiva.</p>
              </section>

              <section className="manual-section">
                <h3>5. Configuración</h3>
                <ul className="manual-list">
                  <li><strong>Nombre del archivo:</strong> define el nombre del archivo PPTX.</li>
                  <li><strong>Mensaje inferior:</strong> cambia el texto del pie.</li>
                  <li><strong>Tamaño de diapositiva:</strong> elige 16:9 o 4:3.</li>
                  <li><strong>Puntos por sección:</strong> limita cuántos puntos caben en una diapositiva.</li>
                  <li><strong>Diseño de diapositiva:</strong> selecciona Clásico, Moderno o Formal.</li>
                  <li><strong>Tema de color:</strong> cambia la paleta cuando el diseño lo permite.</li>
                  <li><strong>Fondo de diapositiva:</strong> elige un color sólido o define uno personalizado.</li>
                  <li><strong>Tipografía:</strong> modifica fuente y tamaño por tipo de texto.</li>
                </ul>
              </section>

              <section className="manual-section">
                <h3>6. Exportar y presentar</h3>
                <p><strong>Generar PPTX</strong> crea una presentación editable. <strong>Exportar a imágenes</strong> permite elegir formato y diapositivas concretas.</p>
                <p>Con <strong>Presentar</strong> puedes seleccionar la diapositiva actual y la próxima. Usa las flechas del teclado para avanzar y retroceder.</p>
                <p>Para proyectar en otra pantalla, entra en Presentar y pulsa <strong>Abrir segunda pantalla</strong>. Mueve la ventana que se abre al monitor secundario y controla el avance desde la ventana principal.</p>
              </section>

              <section className="manual-section">
                <h3>7. Apariencia y ayuda</h3>
                <p>Abre el menú superior derecho para activar o desactivar el modo oscuro y volver a consultar este manual.</p>
                <p>Si una diapositiva no aparece como esperas, revisa los marcadores del texto, el límite de puntos y el formato seleccionado.</p>
              </section>

              <div className="manual-tip">
                <strong>Consejo:</strong> guarda una copia del texto `.txt` antes de hacer cambios importantes y revisa siempre la vista previa antes de exportar.
              </div>
            </div>
          </article>
        </div>
      )}

      {showAboutDialog && (
        <div
          className="modal-overlay manual-overlay"
          onClick={() => setShowAboutDialog(false)}
        >
          <article
            className="modal-content user-manual"
            role="dialog"
            aria-modal="true"
            aria-labelledby="about-dialog-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <span className="manual-kicker">Información del programa</span>
                <h2 id="about-dialog-title">Acerca de</h2>
              </div>
              <button
                type="button"
                className="close-btn"
                onClick={() => setShowAboutDialog(false)}
                aria-label="Cerrar acerca de"
              >
                ✕
              </button>
            </div>

            <div className="manual-content">
              <p className="manual-intro">
                Sermon Slider ayuda a convertir el contenido de sermones en presentaciones y materiales visuales.
              </p>

              <section className="manual-section">
                <h3>Acerca de la aplicación</h3>
                <p><strong>Nombre:</strong> Sermon Slider</p>
                <p><strong>Versión:</strong> 2.1.2</p>
                <p><strong>Descripción:</strong> Una herramienta para crear presentaciones de sermones de manera sencilla y eficiente.</p>
              </section>

              <section className="manual-section">
                <h3>Créditos</h3>
                <p><strong>Desarrollado por:</strong> Josué Palermo Ríos</p>
                {/* <p><strong>Colaboradores:</strong> [Añadir colaboradores y contribuciones]</p> */}
              </section>

              <section className="manual-section">
                <h3>Contacto y derechos</h3>
                <p><strong>Contacto:</strong> josuepalermo1208@gmail.com</p>
                <p><strong>Licencia:</strong> Licensed under the MIT License</p>
                <p><strong>Copyright:</strong> &copy; 2026 Iceberg Corp. Todos los derechos reservados.</p>
              </section>
            </div>
          </article>
        </div>
      )}

      {legalDocument && (
        <div
          className="modal-overlay manual-overlay"
          onClick={() => setLegalDocument(null)}
        >
          <article
            className="modal-content user-manual"
            role="dialog"
            aria-modal="true"
            aria-labelledby="legal-document-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <span className="manual-kicker">Documento de ejemplo</span>
                <h2 id="legal-document-title">
                  {legalDocument === "terms" ? "Términos y condiciones" : "Política de privacidad"}
                </h2>
              </div>
              <button
                type="button"
                className="close-btn"
                onClick={() => setLegalDocument(null)}
                aria-label="Cerrar documento"
              >
                ✕
              </button>
            </div>

            <div className="manual-content legal-document-content">
              <p className="manual-intro">
                {legalDocument === "terms"
                  ? "Ejemplo de condiciones para el uso de Sermon Slider. Revisa y completa este texto antes de publicarlo como documento legal definitivo."
                  : "Ejemplo de aviso sobre el tratamiento de datos en Sermon Slider. Confirma que refleje el alojamiento y funcionamiento de la versión que publiques."}
              </p>

              {legalDocument === "terms" ? (
                <>
                  <section className="manual-section">
                    <h3>1. Uso de la aplicación</h3>
                    <p>Sermon Slider permite organizar texto en diapositivas y generar presentaciones, imágenes y vistas para presentar. El usuario debe revisar los archivos generados antes de utilizarlos.</p>
                  </section>
                  <section className="manual-section">
                    <h3>2. Contenido del usuario</h3>
                    <p>El usuario conserva los derechos sobre los textos y materiales que incorpora. Declara contar con los permisos necesarios y es responsable del contenido que utiliza o distribuye.</p>
                  </section>
                  <section className="manual-section">
                    <h3>3. Disponibilidad y resultados</h3>
                    <p>La aplicación se ofrece como herramienta de apoyo. La disponibilidad puede cambiar y los resultados pueden requerir corrección de formato, referencias o contenido antes de su uso.</p>
                  </section>
                  <section className="manual-section">
                    <h3>4. Contacto y vigencia</h3>
                    <p>Responsable: Iceberg. Contacto: info@iceberg.com. Última actualización: 26 de septiembre de 2026. Añade aquí las condiciones específicas aplicables en tu jurisdicción.</p>
                  </section>
                </>
              ) : (
                <>
                  <section className="manual-section">
                    <h3>1. Datos tratados</h3>
                    <p>El texto del sermón y las opciones de presentación se procesan en el navegador para mostrar la vista previa y generar archivos. El código actual no envía el texto a un servicio backend propio.</p>
                  </section>
                  <section className="manual-section">
                    <h3>2. Almacenamiento y archivos</h3>
                    <p>El texto se mantiene en memoria durante la sesión. La preferencia de tema claro u oscuro se guarda en el almacenamiento local del navegador. Los archivos exportados se descargan en el dispositivo del usuario.</p>
                  </section>
                  <section className="manual-section">
                    <h3>3. Servicios de terceros</h3>
                    <p>La interfaz solicita fuentes a Google Fonts. El navegador puede comunicar datos técnicos de conexión a ese proveedor al cargar las fuentes; consulta sus políticas para más información.</p>
                  </section>
                  <section className="manual-section">
                    <h3>4. Conservación y contacto</h3>
                    <p>El texto de la sesión deja de estar disponible al recargar o cerrar la página, salvo que el usuario lo haya exportado. Para consultas sobre privacidad: info@iceberg.com.</p>
                    <p>Responsable: Iceberg. Última actualización: 26 de septiembre de 2026.</p>
                  </section>
                </>
              )}

              <div className="manual-tip">
                <strong>Importante:</strong> este contenido es ilustrativo, no constituye asesoría legal y debe revisarse antes de publicar la aplicación.
              </div>
            </div>
          </article>
        </div>
      )}

      {showPresentation && (
        <div className="presentation-overlay" role="dialog" aria-modal="true" aria-labelledby="presentation-title">
          <header className="presentation-toolbar">
            <div>
              <span className="presentation-kicker">Modo presentación</span>
              <h2 id="presentation-title">{slides[presentationIndex]?.title}</h2>
            </div>
            <div className="presentation-toolbar-actions">
              <span className="presentation-position">
                {presentationIndex + 1} / {slides.length}
              </span>
              <button type="button" className="presentation-external" onClick={openExternalPresentation}>
                Abrir segunda pantalla
              </button>
              <button type="button" className="presentation-close" onClick={closePresentation}>
                ✕
              </button>
            </div>
          </header>

          <div className="presentation-workspace">
            <section className="presentation-stage" aria-label="Diapositiva actual">
              <span className="presentation-stage-label">En pantalla</span>
              <div className="presentation-slide presentation-slide-current" ref={presentationCurrentRef} />
            </section>

            <aside className="presentation-queue">
              <div className="presentation-queue-header">
                <div>
                  <span className="presentation-kicker">Control</span>
                  <h3>Diapositivas</h3>
                </div>
                <button
                  type="button"
                  className="presentation-next-btn"
                  onClick={showNextSlide}
                  disabled={nextPresentationIndex === presentationIndex}
                >
                  Mostrar siguiente
                </button>
              </div>

              <div className="presentation-next-preview">
                <span className="presentation-stage-label">Próxima</span>
                <div className="presentation-slide" ref={presentationNextRef} />
              </div>

              <div className="presentation-list">
                {slides.map((slide, index) => (
                  <div
                    className={`presentation-list-item ${index === presentationIndex ? "is-current" : ""} ${index === nextPresentationIndex ? "is-next" : ""}`}
                    key={`${slide.title}-${index}`}
                  >
                    <span className="presentation-list-number">{String(index + 1).padStart(2, "0")}</span>
                    <span className="presentation-list-title">{slide.title}</span>
                    <button
                      type="button"
                      className="presentation-select-btn"
                      onClick={() => setPresentationIndex(index)}
                    >
                      {index === presentationIndex ? "Actual" : "Mostrar"}
                    </button>
                    <button
                      type="button"
                      className="presentation-queue-btn"
                      onClick={() => setNextPresentationIndex(index)}
                      disabled={index === presentationIndex}
                    >
                      Siguiente
                    </button>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </div>
      )}

      <footer className="footer">
        <div className="footer-container">
          <div className="footer-left">
            <h5>App Suite</h5>
            <p>All-in-one tools for productivity and creativity.</p>
          </div>

          <div className="footer-links">
            <button type="button" className="footer-policy-button" onClick={() => setLegalDocument("terms")}>
              Términos y condiciones
            </button>
            <button type="button" className="footer-policy-button" onClick={() => setLegalDocument("privacy")}>
              Política de privacidad
            </button>
          </div>
        </div>

        <div className="footer-bottom">
          <p>&copy; 2026 Iceberg Corp. Todos los derechos reservados.</p>
        </div>
      </footer>
    </div>
  );
}

export default App;
