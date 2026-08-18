interface IconProps {
  src: string;
  className?: string;
  size?: number;
  label?: string;
}

/** Renders a stroke SVG icon from /public using currentColor via CSS mask. */
export function Icon({ src, className = '', size = 24, label }: IconProps) {
  return (
    <span
      className={`icon-mask ${className}`}
      style={{
        width: size,
        height: size,
        WebkitMaskImage: `url(${src})`,
        maskImage: `url(${src})`,
      }}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
}

interface DecorativeImageProps {
  src: string;
  className?: string;
  width?: number;
  height?: number;
}

export function DecorativeImage({
  src,
  className = '',
  width,
  height,
  loading = 'lazy',
}: DecorativeImageProps & { loading?: 'lazy' | 'eager' }) {
  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      className={className}
      width={width}
      height={height}
      loading={loading}
      decoding="async"
    />
  );
}
