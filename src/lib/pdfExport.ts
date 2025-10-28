import { PDFDocument, rgb } from "pdf-lib";
import { Canvas as FabricCanvas } from "fabric";

interface ExportOptions {
  canvas: FabricCanvas;
  projectName: string;
  pageNumber: number;
  totalPages: number;
  piles: any[];
  footings: any[];
  pileColors: any;
  summaryImage: string;
  summaryPosition: { x: number; y: number; width: number; height: number };
  clippingRect: { left: number; top: number; width: number; height: number };
}

export async function exportCanvasToPDF({
  canvas,
  projectName,
  pageNumber,
  totalPages,
  piles,
  footings,
  pileColors,
  summaryImage,
  summaryPosition,
  clippingRect,
}: ExportOptions): Promise<void> {
  try {
    // Create a new PDF document
    const pdfDoc = await PDFDocument.create();
    
    // Get canvas as data URL - crop to just the blueprint image
    const dataUrl = canvas.toDataURL({
      format: "png",
      quality: 1,
      multiplier: 2, // Higher resolution
      left: clippingRect.left,
      top: clippingRect.top,
      width: clippingRect.width,
      height: clippingRect.height,
    });

    // Convert data URL to bytes
    const imageBytes = await fetch(dataUrl).then((res) => res.arrayBuffer());
    
    // Embed the canvas image
    const image = await pdfDoc.embedPng(imageBytes);
    const imageDims = image.scale(1);

    // Add a page with the dimensions of the cropped image
    const page = pdfDoc.addPage([imageDims.width, imageDims.height]);
    
    // Draw the canvas image
    page.drawImage(image, {
      x: 0,
      y: 0,
      width: imageDims.width,
      height: imageDims.height,
    });

    // Embed the summary panel screenshot
    const summaryBytes = await fetch(summaryImage).then((res) => res.arrayBuffer());
    const summaryImg = await pdfDoc.embedPng(summaryBytes);
    
    // Calculate the summary position relative to the cropped area
    const summaryX = (summaryPosition.x - clippingRect.left) * 2; // Account for multiplier
    const summaryY = imageDims.height - (summaryPosition.y - clippingRect.top) * 2 - (summaryPosition.height * 2); // Flip Y and account for multiplier
    
    // Draw the summary panel on top
    page.drawImage(summaryImg, {
      x: summaryX,
      y: summaryY,
      width: summaryPosition.width * 2,
      height: summaryPosition.height * 2,
    });


    // Save the PDF
    const pdfBytes = await pdfDoc.save();
    
    // Create a blob and download
    const blob = new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${projectName}_Page${pageNumber + 1}.pdf`;
    link.click();
    
    // Clean up
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Error exporting to PDF:", error);
    throw error;
  }
}
