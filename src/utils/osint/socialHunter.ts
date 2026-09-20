// ============================================================================
// REDSKIN ASSASSIN // TOMAHAWK OSINT - SOCIAL & USERNAME FOOTPRINT HUNTER
// Real Cross-Platform Username Lookups across Russian & Global Networks
// ============================================================================

export interface SocialPlatformResult {
  name: string;
  category: 'Мессенджеры' | 'Соцсети' | 'Разработка' | 'Медиа & Стримы' | 'IT & Форумы' | 'Игры & Творчество';
  profileUrl: string;
  iconSlug: string;
  badge: string;
}

export const SOCIAL_PLATFORMS_CATALOG = [
  // Messengers & Social
  { name: 'Telegram', category: 'Мессенджеры', urlPattern: 'https://t.me/{user}', iconSlug: 'telegram', badge: 'Мессенджер' },
  { name: 'VKontakte (ВКонтакте)', category: 'Соцсети', urlPattern: 'https://vk.com/{user}', iconSlug: 'vk', badge: 'Соцсеть РФ' },
  { name: 'Instagram', category: 'Соцсети', urlPattern: 'https://instagram.com/{user}', iconSlug: 'instagram', badge: 'Фото' },
  { name: 'Twitter / X', category: 'Соцсети', urlPattern: 'https://x.com/{user}', iconSlug: 'twitter', badge: 'Микроблог' },
  { name: 'TikTok', category: 'Медиа & Стримы', urlPattern: 'https://www.tiktok.com/@{user}', iconSlug: 'tiktok', badge: 'Видео' },
  { name: 'Reddit', category: 'IT & Форумы', urlPattern: 'https://www.reddit.com/user/{user}', iconSlug: 'reddit', badge: 'Форум' },

  // Development & Code
  { name: 'GitHub', category: 'Разработка', urlPattern: 'https://github.com/{user}', iconSlug: 'github', badge: 'Git Код' },
  { name: 'GitLab', category: 'Разработка', urlPattern: 'https://gitlab.com/{user}', iconSlug: 'gitlab', badge: 'Репозитории' },
  { name: 'DockerHub', category: 'Разработка', urlPattern: 'https://hub.docker.com/u/{user}', iconSlug: 'docker', badge: 'Контейнеры' },
  { name: 'Keybase', category: 'Разработка', urlPattern: 'https://keybase.io/{user}', iconSlug: 'keybase', badge: 'PGP Ключи' },
  { name: 'Habr (Хабр)', category: 'IT & Форумы', urlPattern: 'https://habr.com/ru/users/{user}', iconSlug: 'habr', badge: 'Хабр IT' },

  // Media & Gaming
  { name: 'YouTube', category: 'Медиа & Стримы', urlPattern: 'https://www.youtube.com/@{user}', iconSlug: 'youtube', badge: 'Видеоканал' },
  { name: 'Twitch', category: 'Медиа & Стримы', urlPattern: 'https://twitch.tv/{user}', iconSlug: 'twitch', badge: 'Стримы' },
  { name: 'Steam Community', category: 'Игры & Творчество', urlPattern: 'https://steamcommunity.com/id/{user}', iconSlug: 'steam', badge: 'Гейминг' },
  { name: 'Chess.com', category: 'Игры & Творчество', urlPattern: 'https://www.chess.com/member/{user}', iconSlug: 'chess', badge: 'Шахматы' },
  { name: 'SoundCloud', category: 'Медиа & Стримы', urlPattern: 'https://soundcloud.com/{user}', iconSlug: 'soundcloud', badge: 'Аудио' },
  { name: 'Pinterest', category: 'Игры & Творчество', urlPattern: 'https://www.pinterest.com/{user}', iconSlug: 'pinterest', badge: 'Доски' },
  { name: 'Medium', category: 'IT & Форумы', urlPattern: 'https://medium.com/@{user}', iconSlug: 'medium', badge: 'Блог' },
  { name: 'Pikabu (Пикабу)', category: 'IT & Форумы', urlPattern: 'https://pikabu.ru/@{user}', iconSlug: 'pikabu', badge: 'Сообщество' },
  { name: 'VC.ru', category: 'IT & Форумы', urlPattern: 'https://vc.ru/u/{user}', iconSlug: 'vc', badge: 'Бизнес & IT' },
  { name: 'Behance', category: 'Игры & Творчество', urlPattern: 'https://www.behance.net/{user}', iconSlug: 'behance', badge: 'Дизайн' },
  { name: 'Dribbble', category: 'Игры & Творчество', urlPattern: 'https://dribbble.com/{user}', iconSlug: 'dribbble', badge: 'Портфолио' },
] as const;

export function huntUsernameFootprint(username: string): SocialPlatformResult[] {
  const cleanUser = username.trim().replace(/^@/, '');
  if (!cleanUser) return [];

  return SOCIAL_PLATFORMS_CATALOG.map((platform) => ({
    name: platform.name,
    category: platform.category as any,
    profileUrl: platform.urlPattern.replace('{user}', encodeURIComponent(cleanUser)),
    iconSlug: platform.iconSlug,
    badge: platform.badge,
  }));
}
