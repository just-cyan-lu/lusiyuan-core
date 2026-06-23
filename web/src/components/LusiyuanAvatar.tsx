import { lusiyuanAvatarSrc } from "../utils/lusiyuanAvatar";

interface LusiyuanAvatarProps {
  alt?: string;
  className: string;
  fallbackText?: string;
  imgClassName?: string;
}

export function LusiyuanAvatar({
  alt = "陆思源头像",
  className,
  fallbackText = "陆",
  imgClassName = "h-full w-full object-cover",
}: LusiyuanAvatarProps) {
  return (
    <span className={className}>
      {lusiyuanAvatarSrc ? (
        <img src={lusiyuanAvatarSrc} alt={alt} className={imgClassName} />
      ) : (
        fallbackText
      )}
    </span>
  );
}
