import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export interface ExportOptions {
  type: 'pdf' | 'image' | 'html';
  title: string;
  element: HTMLElement;
}

export const exportChart = async ({ type, title, element }: ExportOptions) => {
  const canvas = await html2canvas(element);
  const imageData = canvas.toDataURL('image/png');
  const fileName = title.toLowerCase().replace(/\s+/g, '-');

  switch (type) {
    case 'pdf': {
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'px'
      });
      const imgProps = pdf.getImageProperties(imageData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      pdf.addImage(imageData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`${fileName}.pdf`);
      break;
    }

    case 'image': {
      const link = document.createElement('a');
      link.download = `${fileName}.png`;
      link.href = imageData;
      link.click();
      break;
    }

    case 'html': {
      const htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>${title}</title>
            <style>
              body { margin: 0; padding: 20px; }
              .chart-container { max-width: 800px; margin: 0 auto; }
            </style>
          </head>
          <body>
            <div class="chart-container">
              <img src="${imageData}" style="width: 100%; height: auto;" alt="${title}" />
            </div>
          </body>
        </html>
      `;
      
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const htmlLink = document.createElement('a');
      htmlLink.download = `${fileName}.html`;
      htmlLink.href = URL.createObjectURL(blob);
      htmlLink.click();
      URL.revokeObjectURL(htmlLink.href);
      break;
    }
  }
};