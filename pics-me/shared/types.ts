// Types shared by the API server and the web client.

/** Who wrote AI-assisted text: Claude, a self-hosted open model, or the built-in templates. */
export type AiSource = "claude" | "model" | "local";

export type PostKind = "photo" | "video" | "ad" | "game";
export type GameType = "slide" | "swap" | "memory" | "spot";
export type Visibility = "public" | "circle";

/**
 * Discover lenses. Each is one plain rule. Only "For you" is personal, and only when you
 * pick it: it uses your own likes, saves, comments and follows. Nothing uses watch time.
 */
export const LENSES = {
  latest: { name: "Latest", rule: "Every public post, newest first." },
  loved: { name: "Loved this week", rule: "Public posts from the last 7 days, most likes first." },
  fresh: { name: "Fresh voices", rule: "Newest posts from people with fewer than 25 followers." },
  remixes: { name: "Remixes", rule: "Videos, ads and games made in the Studio, newest first." },
  shuffle: { name: "Shuffle", rule: "Public posts in random order. No ranking at all." },
  foryou: { name: "For you", rule: "Ranked by your own likes, saves, comments and follows. Never by watch time. Only on if you pick it." },
} as const;
export type Lens = keyof typeof LENSES;

/** Pace settings. They belong to the person, not the platform, and default to calm. */
export interface Settings {
  /** Hide like and comment numbers everywhere. */
  quietCounts: boolean;
  /** Suggest a pause after this many posts (0 = never). */
  breakEvery: number;
  /** Play videos automatically when they scroll into view. */
  autoplay: boolean;
  lens: Lens;
}
export const DEFAULT_SETTINGS: Settings = { quietCounts: false, breakEvery: 30, autoplay: true, lens: "latest" };

export interface MediaDTO {
  id: string;
  kind: "image" | "video";
  w: number;
  h: number;
  /** Dominant colour, used as the instant placeholder. */
  color: string;
  /** Tiny blurred preview as a data URI. */
  ph: string;
  alt: string;
  /** Image variants (for a video these are the poster frames). */
  urls: { t: string; m: string; l: string };
  video?: { src: string; type: string; mp4?: string; duration: number };
}

export interface UserDTO {
  username: string;
  displayName: string;
  avatar: string | null;
}

export interface ProfileDTO extends UserDTO {
  bio: string;
  posts: number;
  followers: number;
  following: number;
  likes: number;
  isFollowing: boolean;
  isMe: boolean;
  /** They are in my close circle. */
  inMyCircle: boolean;
  /** I have blocked them. */
  blocked: boolean;
}

export interface NotificationDTO {
  id: number;
  kind: "like" | "comment" | "follow" | "remix" | "circle";
  actor: UserDTO;
  post: { id: string; thumb: string | null } | null;
  createdAt: number;
  read: boolean;
}

export interface ReportDTO {
  post: PostDTO;
  reasons: { by: string; reason: string; createdAt: number }[];
}

export interface PostMeta {
  game?: { type: GameType; size: number; seed?: number };
  ad?: { brand: string; headline: string; cta: string; link?: string };
  ai?: AiSource;
}

export interface PostDTO {
  id: string;
  kind: PostKind;
  caption: string;
  createdAt: number;
  author: UserDTO;
  media: MediaDTO[];
  likeCount: number;
  commentCount: number;
  remixCount: number;
  liked: boolean;
  saved: boolean;
  visibility: Visibility;
  /** Home stream only: posted since your last visit. */
  fresh?: boolean;
  /** Plain-language reason this post is in the stream you're looking at. */
  why?: string;
  allowRemix: boolean;
  remixOf: { id: string; author: string } | null;
  meta: PostMeta;
}

export interface CommentDTO {
  id: number;
  body: string;
  createdAt: number;
  author: UserDTO;
}

export interface ScoreDTO {
  user: UserDTO;
  ms: number;
  moves: number;
}

export interface Page<T> {
  items: T[];
  next: string | null;
}

export type CameraMove = "zoom-in" | "zoom-out" | "pan-left" | "pan-right" | "pan-up" | "pan-down";

export interface Storyboard {
  title: string;
  shots: { mediaIndex: number; move: CameraMove; seconds: number; text: string }[];
  caption: string;
  hashtags: string[];
  source: AiSource;
}

export type AdLayout = "bottom" | "center" | "top";

export interface AdCopy {
  headline: string;
  subhead: string;
  cta: string;
  layout: AdLayout;
  accent: string;
  caption: string;
  hashtags: string[];
  source: AiSource;
}

export interface CaptionSuggestion {
  caption: string;
  hashtags: string[];
  alt: string;
  source: AiSource;
}

export const CAMERA_MOVES: CameraMove[] = ["zoom-in", "zoom-out", "pan-left", "pan-right", "pan-up", "pan-down"];
