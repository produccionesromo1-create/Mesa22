export function compressImageFile(
  file: File,
  maxWidth = 800,
  maxHeight = 800,
  quality = 0.82,
  maxMB = 15
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (file.size > maxMB * 1024 * 1024) {
      reject(new Error(`El archivo seleccionado (${(file.size / (1024 * 1024)).toFixed(1)} MB) supera el límite máximo permitido de ${maxMB} MB.`));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Error al leer el archivo de imagen.'));
    reader.onload = (event) => {
      const img = new Image();
      img.onerror = () => reject(new Error('El archivo seleccionado no es una imagen válida.'));
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          if (width / height > maxWidth / maxHeight) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(event.target?.result as string);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        // Use SVG directly or JPEG for compressed raster images to guarantee light payloads for Firestore
        const isSvg = file.type === 'image/svg+xml';
        const mimeType = isSvg ? 'image/svg+xml' : 'image/jpeg';
        let dataUrl = canvas.toDataURL(mimeType, quality);

        // Safeguard: if base64 payload is still larger than 600 KB, re-compress with lower quality to ensure Firestore 1MB doc limit is respected
        if (dataUrl.length > 600 * 1024 && mimeType === 'image/jpeg') {
          dataUrl = canvas.toDataURL('image/jpeg', 0.65);
        }

        resolve(dataUrl);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}
