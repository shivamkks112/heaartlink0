import { useState, useRef, useEffect } from 'react';

/**
 * Lazy loaded image with placeholder and error handling
 */
const LazyImage = ({ src, alt, className = '', fallback = null, ...props }) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const imgRef = useRef(null);

  useEffect(() => {
    if (!src) { setError(true); return; }
    
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && imgRef.current) {
          imgRef.current.src = src;
          observer.disconnect();
        }
      },
      { rootMargin: '200px' }
    );

    if (imgRef.current) observer.observe(imgRef.current);
    return () => observer.disconnect();
  }, [src]);

  if (error || !src) {
    return fallback || (
      <div className={`bg-gradient-to-br from-pink-100 to-orange-100 flex items-center justify-center ${className}`} {...props}>
        <span className="text-gray-400 text-2xl">?</span>
      </div>
    );
  }

  return (
    <>
      {!loaded && (
        <div className={`bg-gray-200 animate-pulse ${className}`} {...props} />
      )}
      <img
        ref={imgRef}
        alt={alt}
        className={`${className} ${loaded ? '' : 'hidden'}`}
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
        loading="lazy"
        {...props}
      />
    </>
  );
};

export default LazyImage;
