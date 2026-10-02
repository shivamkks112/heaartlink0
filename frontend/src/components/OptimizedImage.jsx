import { useState, useRef } from 'react';

/**
 * OptimizedImage — Smooth blur-to-sharp loading transition
 * Renders with blur placeholder, transitions to sharp once loaded
 */
const OptimizedImage = ({ src, alt, className = '', style = {}, ...props }) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const imgRef = useRef(null);

  if (!src || error) {
    return (
      <div className={`bg-gradient-to-br from-pink-200 via-rose-200 to-orange-200 ${className}`} style={style} />
    );
  }

  return (
    <div className={`relative overflow-hidden ${className}`} style={style}>
      {/* Blurred placeholder */}
      {!loaded && (
        <div
          className="absolute inset-0 animate-pulse"
          style={{
            background: 'linear-gradient(135deg, rgba(255,182,193,0.3), rgba(255,218,185,0.3))',
          }}
        />
      )}
      <img
        ref={imgRef}
        src={src}
        alt={alt || ''}
        loading="eager"
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
        className="w-full h-full object-cover transition-all duration-500 ease-out"
        style={{
          filter: loaded ? 'none' : 'blur(12px)',
          transform: loaded ? 'scale(1)' : 'scale(1.05)',
          opacity: loaded ? 1 : 0.7,
        }}
        {...props}
      />
    </div>
  );
};

export default OptimizedImage;
