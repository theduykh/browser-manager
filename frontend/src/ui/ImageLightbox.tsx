import { useEffect } from 'react';
import { Icon } from './Icon';

interface Props {
  src: string;
  alt?: string;
  onClose: () => void;
}

// Full-screen image viewer. Close via backdrop click, the close button, or Escape.
export function ImageLightbox({ src, alt, onClose }: Props) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', k); document.body.style.overflow = prev; };
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,.85)', backdropFilter: 'blur(4px)',
        display: 'grid', placeItems: 'center', padding: 24, animation: 'fadeup var(--fast) var(--ease)', cursor: 'zoom-out',
      }}
    >
      <button
        type="button"
        onClick={onClose}
        title="Close (Esc)"
        style={{
          position: 'absolute', top: 16, right: 16, display: 'grid', placeItems: 'center', padding: 0,
          width: 38, height: 38, borderRadius: 'var(--r-sm)', background: 'rgba(8,11,18,.6)',
          border: '1px solid rgba(255,255,255,.15)', color: '#fff', cursor: 'pointer',
        }}
      >
        <Icon name="x" size={20} />
      </button>
      <img
        src={src}
        alt={alt}
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '95vw', maxHeight: '92vh', objectFit: 'contain', borderRadius: 'var(--r-md)', boxShadow: 'var(--shadow-pop)', cursor: 'default' }}
      />
    </div>
  );
}
