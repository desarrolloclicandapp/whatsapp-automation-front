import React, { useLayoutEffect, useRef, useState } from 'react';
import QRCodeGenerator from 'qr.js/lib/QRCode';
import ErrorCorrectLevel from 'qr.js/lib/ErrorCorrectLevel';

/**
 * WhatsApp QR codes must always be rendered as dark modules on a light
 * background. The payload is identical in both themes; only the surrounding
 * panel may change appearance.
 *
 * The matrix is drawn directly to canvas. Rendering an SVG into an Image
 * introduced a theme-dependent color conversion in the browser, so this
 * component deliberately has no SVG or image rendering stage.
 */
export default function CanonicalQRCode({
  className = '',
  style,
  value,
  size = 256,
  level = 'L',
  title,
}) {
  const canvasRef = useRef(null);
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !value) return undefined;

    setReady(false);

    try {
      const qr = new QRCodeGenerator(-1, ErrorCorrectLevel[level] ?? ErrorCorrectLevel.L);
      qr.addData(value);
      qr.make();

      const moduleCount = qr.getModuleCount();
      const moduleSize = Math.max(1, Math.floor(size / moduleCount));
      const renderedSize = moduleCount * moduleSize;
      const offset = Math.floor((size - renderedSize) / 2);
      const context = canvas.getContext('2d', { alpha: false });
      if (!context) return undefined;

      canvas.width = size;
      canvas.height = size;
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, size, size);
      context.fillStyle = '#000000';
      context.imageSmoothingEnabled = false;

      for (let row = 0; row < moduleCount; row += 1) {
        for (let column = 0; column < moduleCount; column += 1) {
          if (qr.isDark(row, column)) {
            context.fillRect(
              offset + column * moduleSize,
              offset + row * moduleSize,
              moduleSize,
              moduleSize,
            );
          }
        }
      }

      setReady(true);
    } catch (error) {
      console.error('No se pudo generar el código QR.', error);
    }

    return undefined;
  }, [value, size, level]);

  return (
    <span
      aria-busy={!ready}
      className="inline-block"
      style={{ height: size, position: 'relative', width: size }}
    >
      <canvas
        aria-label={title || 'Código QR de WhatsApp'}
        className={`waflow-qr-canonical ${className}`.trim()}
        data-darkreader-inline-filter="none"
        height={size}
        ref={canvasRef}
        role="img"
        style={{
          ...style,
          backgroundColor: '#ffffff',
          colorScheme: 'only light',
          display: 'block',
          filter: 'none',
          forcedColorAdjust: 'none',
          height: size,
          imageRendering: 'pixelated',
          mixBlendMode: 'normal',
          width: size,
        }}
        width={size}
      />
    </span>
  );
}
