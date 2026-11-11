import type {
  AdCopy, CaptionSuggestion, CommentDTO, MediaDTO, Page, PostDTO, PostKind, PostMeta, ProfileDTO, ScoreDTO, Storyboard, UserDTO,
} from "../../shared/types.ts";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      credentials: "same-origin",
      headers: body instanceof FormData || body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body instanceof FormData ? body : body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "Can't reach pics.me — check your connection and try again.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, (data as { error?: string }).error ?? "Something went wrong.");
  return data as T;
}

const get = <T,>(url: string) => request<T>("GET", url);
const post = <T,>(url: string, body: unknown = {}) => request<T>("POST", url, body);
const del = <T,>(url: string, body?: unknown) => request<T>("DELETE", url, body);
const q = (cursor?: string | null) => (cursor ? `cursor=${encodeURIComponent(cursor)}` : "");

export interface Me extends UserDTO {
  bio: string;
  email: string;
}

export interface NewPost {
  kind: PostKind;
  caption: string;
  mediaIds: string[];
  remixOf?: string;
  allowRemix?: boolean;
  meta?: PostMeta;
}

export const api = {
  me: () => get<{ user: Me | null; ai: "claude" | "local" }>("/api/me"),
  signup: (b: { username: string; email: string; password: string }) => post<{ user: Me }>("/api/auth/signup", b),
  login: (b: { login: string; password: string }) => post<{ user: Me }>("/api/auth/login", b),
  logout: () => post("/api/auth/logout"),
  updateMe: (b: { displayName?: string; bio?: string; avatarMediaId?: string | null }) => request<{ user: Me }>("PATCH", "/api/me", b),
  deleteMe: (password: string) => del("/api/me", { password }),

  feed: (tab: "foryou" | "following", cursor?: string | null) => get<Page<PostDTO>>(`/api/feed?tab=${tab}&${q(cursor)}`),
  explore: () => get<{ tags: { tag: string; n: number }[]; posts: PostDTO[] }>("/api/explore"),
  search: (term: string) => get<{ users: UserDTO[]; tags: { tag: string; n: number }[]; posts: PostDTO[] }>(`/api/search?q=${encodeURIComponent(term)}`),
  tagPosts: (tag: string, cursor?: string | null) => get<Page<PostDTO>>(`/api/tags/${encodeURIComponent(tag)}/posts?${q(cursor)}`),

  profile: (username: string) => get<{ profile: ProfileDTO }>(`/api/users/${encodeURIComponent(username)}`),
  userPosts: (username: string, cursor?: string | null) => get<Page<PostDTO>>(`/api/users/${encodeURIComponent(username)}/posts?${q(cursor)}`),
  follow: (username: string, on: boolean) => request<{ following: boolean }>(on ? "POST" : "DELETE", `/api/users/${encodeURIComponent(username)}/follow`),

  post: (id: string) => get<{ post: PostDTO }>(`/api/posts/${id}`),
  createPost: (b: NewPost) => post<{ post: PostDTO }>("/api/posts", b),
  deletePost: (id: string) => del(`/api/posts/${id}`),
  like: (id: string, on: boolean) => request<{ liked: boolean; likeCount: number }>(on ? "POST" : "DELETE", `/api/posts/${id}/like`),
  comments: (id: string, cursor?: string | null) => get<Page<CommentDTO>>(`/api/posts/${id}/comments?${q(cursor)}`),
  comment: (id: string, body: string) => post<{ comment: CommentDTO; commentCount: number }>(`/api/posts/${id}/comments`, { body }),
  deleteComment: (id: number) => del(`/api/comments/${id}`),
  report: (id: string, reason: string) => post(`/api/posts/${id}/report`, { reason }),
  remixes: (id: string) => get<Page<PostDTO>>(`/api/posts/${id}/remixes`),
  scores: (id: string) => get<{ scores: ScoreDTO[] }>(`/api/posts/${id}/scores`),
  submitScore: (id: string, ms: number, moves: number) => post<{ scores: ScoreDTO[] }>(`/api/posts/${id}/scores`, { ms, moves }),

  uploadImage: (file: Blob) => {
    const form = new FormData();
    form.append("file", file, "upload");
    return post<{ media: MediaDTO }>("/api/media", form);
  },
  uploadVideo: (file: Blob, poster: Blob, info: { width: number; height: number; duration: number }) => {
    const form = new FormData();
    form.append("width", String(info.width));
    form.append("height", String(info.height));
    form.append("duration", String(info.duration));
    form.append("file", file, "video");
    form.append("poster", poster, "poster.jpg");
    return post<{ media: MediaDTO }>("/api/media", form);
  },

  aiCaption: (mediaId: string, hint = "") => post<CaptionSuggestion>("/api/ai/caption", { mediaId, hint }),
  aiAd: (b: { mediaId: string; brand: string; product: string; tone: string }) => post<AdCopy>("/api/ai/ad", b),
  aiStoryboard: (mediaIds: string[], vibe: string) => post<Storyboard>("/api/ai/storyboard", { mediaIds, vibe }),
};
