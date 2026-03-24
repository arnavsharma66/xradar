export interface SearchParams {
  mode: 'topic' | 'creator';
  username: string;
  keyword: string;
  excludeKeywords: string;
  exactPhrase: string;
  orKeywords: string;
  minLikes: number;
  minRetweets: number;
  minReplies: number;
  excludeRetweets: boolean;
  excludeReplies: boolean;
  mediaOnly: boolean;
  imagesOnly: boolean;
  videosOnly: boolean;
  linksOnly: boolean;
  sinceDate: string;
  untilDate: string;
  language: string;
}

export const DEFAULT_PARAMS: SearchParams = {
  mode: 'topic',
  username: '',
  keyword: '',
  excludeKeywords: '',
  exactPhrase: '',
  orKeywords: '',
  minLikes: 0,
  minRetweets: 0,
  minReplies: 0,
  excludeRetweets: false,
  excludeReplies: false,
  mediaOnly: false,
  imagesOnly: false,
  videosOnly: false,
  linksOnly: false,
  sinceDate: '',
  untilDate: '',
  language: '',
};

export function buildSearchQuery(params: SearchParams): string {
  const parts: string[] = [];

  // Mode-specific primary input
  if (params.mode === 'creator' && params.username.trim()) {
    const handle = params.username.trim().replace(/^@/, '');
    parts.push(`from:${handle}`);
  }

  if (params.keyword.trim()) {
    parts.push(params.keyword.trim());
  }

  // Exact phrase
  if (params.exactPhrase.trim()) {
    parts.push(`"${params.exactPhrase.trim()}"`);
  }

  // OR keywords
  if (params.orKeywords.trim()) {
    const orTerms = params.orKeywords
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    if (orTerms.length > 1) {
      parts.push(`(${orTerms.join(' OR ')})`);
    } else if (orTerms.length === 1) {
      parts.push(orTerms[0]);
    }
  }

  // Exclude keywords
  if (params.excludeKeywords.trim()) {
    const excluded = params.excludeKeywords
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    excluded.forEach((kw) => parts.push(`-${kw}`));
  }

  // Engagement thresholds
  if (params.minLikes > 0) parts.push(`min_faves:${params.minLikes}`);
  if (params.minRetweets > 0) parts.push(`min_retweets:${params.minRetweets}`);
  if (params.minReplies > 0) parts.push(`min_replies:${params.minReplies}`);

  // Filters
  if (params.excludeRetweets) parts.push('-filter:nativeretweets');
  if (params.excludeReplies) parts.push('-filter:replies');

  // Media filters — mutual exclusion
  if (params.imagesOnly) {
    parts.push('filter:images');
  } else if (params.videosOnly) {
    parts.push('filter:videos');
  } else if (params.linksOnly) {
    parts.push('filter:links');
  } else if (params.mediaOnly) {
    parts.push('filter:media');
  }

  // Date range
  if (params.sinceDate) parts.push(`since:${params.sinceDate}`);
  if (params.untilDate) parts.push(`until:${params.untilDate}`);

  // Language
  if (params.language) parts.push(`lang:${params.language}`);

  return parts.join(' ');
}

export function buildSearchUrl(query: string): string {
  if (!query.trim()) return '';
  return `https://x.com/search?q=${encodeURIComponent(query)}&src=typed_query&f=top`;
}
