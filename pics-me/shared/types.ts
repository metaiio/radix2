// Types shared by the API server and the web client.

export type PostKind = "photo" | "video" | "ad" | "game";
export type GameType = "slide" | "swap" | "memory";

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
}

export interface PostMeta {
  game?: { type: GameType; size: number };
  ad?: { brand: string; headline: string; cta: string; link?: string };
  ai?: "claude" | "local";
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
  source: "claude" | "local";
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
  source: "claude" | "local";
}

export interface CaptionSuggestion {
  caption: string;
  hashtags: string[];
  alt: string;
  source: "claude" | "local";
}

export const CAMERA_MOVES: CameraMove[] = ["zoom-in", "zoom-out", "pan-left", "pan-right", "pan-up", "pan-down"];
