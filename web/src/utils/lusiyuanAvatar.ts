const avatarModules = import.meta.glob<string>(
  "../assets/avatar/*.{png,jpg,jpeg,webp,avif}",
  {
    eager: true,
    import: "default",
  }
);

const avatarSources = Object.entries(avatarModules)
  .sort(([left], [right]) => left.localeCompare(right))
  .map(([, source]) => source);

export const lusiyuanAvatarSrc =
  avatarSources.length > 0
    ? avatarSources[Math.floor(Math.random() * avatarSources.length)]
    : null;
