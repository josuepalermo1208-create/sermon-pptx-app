import * as htmlToImage from "html-to-image";
import JSZip from "jszip";
import { saveAs } from "file-saver";

export async function exportSlidesAsImages({
  slideRefs,
  selectedSlides,
  format,
  fileName,
}) {
  try {
    const zip = new JSZip();

    const folder =
      zip.folder(fileName);

    const quality =
      format === "jpg"
        ? 0.95
        : 1;

    const images = [];

    for (let i = 0; i <
      selectedSlides.length; i++) {

      const index =
        selectedSlides[i];

      const node =
        slideRefs.current[index];

      if (!node) continue;

      const dataUrl =
        format === "png"
          ? await htmlToImage
              .toPng(node, {
                pixelRatio: 5,
                cacheBust: true,
              })
          : await htmlToImage
              .toJpeg(node, {
                quality,
                pixelRatio: 5,
                cacheBust: true,
              });

      images.push({
        dataUrl,
        index,
      });
    }

    // una sola imagen
    if (images.length === 1) {
      saveAs(
        images[0].dataUrl,
        `${fileName}-slide-${
          images[0].index + 1
        }.${format}`
      );

      return;
    }

    // varias → zip
    for (const image of images) {
      const response =
        await fetch(
          image.dataUrl
        );

      const blob =
        await response.blob();

      folder.file(
        `slide-${
          image.index + 1
        }.${format}`,
        blob
      );
    }

    const content =
      await zip.generateAsync({
        type: "blob",
      });

    saveAs(
      content,
      `${fileName}.zip`
    );

  } catch (error) {
    console.error(error);
    throw error;
  }
}