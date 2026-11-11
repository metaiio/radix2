import { useCallback, useEffect, useRef, useState } from "react";
import type { PostDTO, ProfileDTO, UserDTO } from "../../shared/types.ts";
import { api, ApiError } from "./api.ts";
import { Feed } from "./Feed.tsx";
import { goBack, Link, navigate, refreshFeeds, useFeedVersion, useSession } from "./state.tsx";
import { shrinkForUpload } from "./studio/render.ts";
import { Avatar, compact, Empty, Icon, PageHeader, PostGrid, Sentinel, Sheet, Spinner } from "./ui.tsx";

const errText = (err: unknown, fallback: string) => (err instanceof ApiError ? err.message : fallback);

// ---- home feed -------------------------------------------------------------

export function FeedPage({ tab, active }: { tab: "foryou" | "following"; active: boolean }) {
  const { user, ready } = useSession();
  const load = useCallback((cursor: string | null) => api.feed(tab, cursor), [tab]);
  const needsAuth = tab === "following" && ready && !user;
  const version = useFeedVersion();

  return (
    <div className="feed-page" hidden={!active}>
      <nav className="feed-tabs" aria-label="Feeds">
        <Link to="/" className={tab === "foryou" ? "on" : ""}>For you</Link>
        <Link to="/following" className={tab === "following" ? "on" : ""}>Following</Link>
      </nav>
      {needsAuth ? (
        <div className="feed"><div className="feed-msg">
          <Empty title="See pictures from people you follow">
            <Link to="/login?next=/following" className="btn">Sign in</Link>
          </Empty>
        </div></div>
      ) : ready && (
        <Feed
          load={load}
          active={active}
          feedKey={`${tab}:${user?.username ?? ""}:${version}`}
          emptyState={tab === "following" ? (
            <Empty title="Nothing here yet"><p>Follow a few people and their posts show up here.</p><Link to="/explore" className="btn">Find people</Link></Empty>
          ) : (
            <Empty title="Be the first to post"><p>The stream is empty. Share a picture to get it started.</p><Link to="/upload" className="btn btn-spark">Post a picture</Link></Empty>
          )}
        />
      )}
    </div>
  );
}

// ---- single post (followed by its remixes) ---------------------------------

export function PostPage({ id }: { id: string }) {
  const load = useCallback(async () => {
    const [{ post }, remixes] = await Promise.all([api.post(id), api.remixes(id).catch(() => ({ items: [] as PostDTO[] }))]);
    return { items: [post, ...remixes.items], next: null };
  }, [id]);
  return (
    <div className="feed-page">
      <button className="icon-btn solid feed-back" onClick={() => goBack()} aria-label="Back"><Icon name="back" /></button>
      <Feed load={load} active feedKey={id} emptyState={<Empty title="This post is gone"><Link to="/" className="btn">Back to the stream</Link></Empty>} />
    </div>
  );
}

// ---- explore + search ------------------------------------------------------

type Results = Awaited<ReturnType<typeof api.search>>;

export function ExplorePage() {
  const [data, setData] = useState<Awaited<ReturnType<typeof api.explore>> | null>(null);
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<Results | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    api.explore().then(setData).catch(() => setFailed(true));
  }, []);

  useEffect(() => {
    const q = term.trim();
    if (!q) return setResults(null);
    let live = true;
    const t = setTimeout(() => api.search(q).then((r) => live && setResults(r)).catch(() => {}), 220);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [term]);

  return (
    <div className="page page-wide">
      <div className="searchbar">
        <Icon name="search" size={20} />
        <input type="search" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search people, tags, captions" aria-label="Search" />
      </div>
      {results ? (
        <div className="stack">
          {results.users.length > 0 && <UserList users={results.users} />}
          {results.tags.length > 0 && <TagChips tags={results.tags} />}
          {results.posts.length > 0 && <PostGrid posts={results.posts} />}
          {!results.users.length && !results.tags.length && !results.posts.length && <Empty title={`Nothing for “${term.trim()}”`}><p>Try a different word or a #tag.</p></Empty>}
        </div>
      ) : failed ? (
        <Empty title="Couldn't load Explore"><button className="btn" onClick={() => location.reload()}>Try again</button></Empty>
      ) : !data ? (
        <Spinner />
      ) : (
        <div className="stack">
          {data.tags.length > 0 && <><h3 className="section-title">Trending tags</h3><TagChips tags={data.tags} /></>}
          <h3 className="section-title">Popular right now</h3>
          {data.posts.length ? <PostGrid posts={data.posts} /> : <Empty title="No posts yet"><Link to="/upload" className="btn btn-spark">Post the first picture</Link></Empty>}
        </div>
      )}
    </div>
  );
}

function TagChips({ tags }: { tags: { tag: string; n: number }[] }) {
  return (
    <div className="chips">
      {tags.map((t) => <Link key={t.tag} to={`/tag/${encodeURIComponent(t.tag)}`} className="chip">#{t.tag} <small>{compact(t.n)}</small></Link>)}
    </div>
  );
}

function UserList({ users }: { users: UserDTO[] }) {
  return (
    <div className="user-list">
      {users.map((u) => (
        <Link key={u.username} to={`/u/${u.username}`} className="user-row">
          <Avatar user={u} size={44} />
          <span><strong>{u.displayName}</strong><small>@{u.username}</small></span>
        </Link>
      ))}
    </div>
  );
}

/** A paged grid of posts with infinite scroll. */
function PagedGrid({ load, resetKey, empty }: { load: (cursor: string | null) => Promise<{ items: PostDTO[]; next: string | null }>; resetKey: string; empty: React.ReactNode }) {
  const [posts, setPosts] = useState<PostDTO[] | null>(null);
  const next = useRef<string | null>(null);
  const busy = useRef(false);

  const more = useCallback(async (reset = false) => {
    if (busy.current || (!reset && !next.current)) return;
    busy.current = true;
    try {
      const page = await load(reset ? null : next.current);
      next.current = page.next;
      setPosts((prev) => (reset ? page.items : [...(prev ?? []), ...page.items]));
    } catch {
      setPosts((prev) => prev ?? []);
    } finally {
      busy.current = false;
    }
  }, [load]);

  useEffect(() => {
    setPosts(null);
    next.current = null;
    busy.current = false;
    void more(true);
  }, [resetKey, more]);

  if (posts === null) return <Spinner />;
  if (!posts.length) return <>{empty}</>;
  return (
    <>
      <PostGrid posts={posts} />
      <Sentinel onHit={() => void more()} />
    </>
  );
}

export function TagPage({ tag }: { tag: string }) {
  const load = useCallback((cursor: string | null) => api.tagPosts(tag, cursor), [tag]);
  return (
    <div className="page page-wide">
      <PageHeader title={`#${tag}`} />
      <PagedGrid load={load} resetKey={tag} empty={<Empty title={`No posts tagged #${tag} yet`} />} />
    </div>
  );
}

// ---- profile ---------------------------------------------------------------

export function ProfilePage({ username }: { username: string }) {
  const { user, requireAuth, toast } = useSession();
  const [profile, setProfile] = useState<ProfileDTO | null>(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const load = useCallback((cursor: string | null) => api.userPosts(username, cursor), [username]);

  const refresh = useCallback(() => {
    api.profile(username).then((r) => setProfile(r.profile)).catch((err) => setError(errText(err, "Couldn't load this profile.")));
  }, [username]);

  useEffect(() => {
    setProfile(null);
    setError("");
    refresh();
  }, [refresh, user?.username]);

  if (error) return <div className="page"><PageHeader title="Profile" /><Empty title={error}><Link to="/" className="btn">Back to the stream</Link></Empty></div>;
  if (!profile) return <div className="page"><Spinner /></div>;

  const toggleFollow = async () => {
    if (!requireAuth()) return;
    const on = !profile.isFollowing;
    setProfile({ ...profile, isFollowing: on, followers: profile.followers + (on ? 1 : -1) });
    try {
      await api.follow(profile.username, on);
    } catch (err) {
      toast(errText(err, "Couldn't update follow."));
      refresh();
    }
  };

  return (
    <div className="page page-wide">
      <PageHeader title={`@${profile.username}`} />
      <section className="profile">
        <Avatar user={profile} size={88} />
        <div className="profile-main">
          <h2>{profile.displayName}</h2>
          {profile.bio && <p>{profile.bio}</p>}
          <dl className="stats">
            <div><dt>Posts</dt><dd>{compact(profile.posts)}</dd></div>
            <div><dt>Followers</dt><dd>{compact(profile.followers)}</dd></div>
            <div><dt>Following</dt><dd>{compact(profile.following)}</dd></div>
            <div><dt>Likes</dt><dd>{compact(profile.likes)}</dd></div>
          </dl>
          {profile.isMe ? (
            <button className="btn btn-ghost" onClick={() => setEditing(true)}><Icon name="edit" size={18} /> Edit profile</button>
          ) : (
            <button className={"btn" + (profile.isFollowing ? " btn-ghost" : "")} onClick={() => void toggleFollow()}>{profile.isFollowing ? "Following" : "Follow"}</button>
          )}
        </div>
      </section>
      <PagedGrid
        load={load}
        resetKey={username}
        empty={profile.isMe ? (
          <Empty title="Your pictures will live here"><Link to="/upload" className="btn btn-spark">Post your first picture</Link></Empty>
        ) : (
          <Empty title="No posts yet" />
        )}
      />
      {editing && <EditProfile profile={profile} onClose={() => setEditing(false)} onSaved={refresh} />}
    </div>
  );
}

function EditProfile({ profile, onClose, onSaved }: { profile: ProfileDTO; onClose: () => void; onSaved: () => void }) {
  const { setUser, toast } = useSession();
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [bio, setBio] = useState(profile.bio);
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  const save = async (extra: { avatarMediaId?: string } = {}) => {
    setBusy(true);
    try {
      const r = await api.updateMe({ displayName: displayName.trim() || profile.username, bio, ...extra });
      setUser(r.user);
      onSaved();
      return true;
    } catch (err) {
      toast(errText(err, "Couldn't save your profile."));
      return false;
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title="Edit profile" onClose={onClose}>
      <div className="stack sheet-pad">
        <input ref={file} type="file" accept="image/*" hidden onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          setBusy(true);
          try {
            const up = await api.uploadImage(await shrinkForUpload(f));
            await save({ avatarMediaId: up.media.id });
          } catch (err) {
            toast(errText(err, "Couldn't upload that picture."));
            setBusy(false);
          }
        }} />
        <button className="btn btn-ghost" disabled={busy} onClick={() => file.current?.click()}><Icon name="image" size={18} /> Change profile picture</button>
        <label className="field"><span>Name</span><input value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={40} /></label>
        <label className="field"><span>Bio</span><textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={200} rows={3} /></label>
        <button className="btn btn-wide" disabled={busy} onClick={async () => (await save()) && onClose()}>{busy ? "Saving…" : "Save"}</button>
        <hr />
        <button className="btn btn-ghost" onClick={async () => {
          await api.logout().catch(() => {});
          setUser(null);
          onClose();
          navigate("/");
        }}><Icon name="logout" size={18} /> Log out</button>
        <button className="btn btn-ghost danger" onClick={async () => {
          const password = prompt("This permanently deletes your account, posts and pictures. Enter your password to confirm.");
          if (!password) return;
          try {
            await api.deleteMe(password);
            refreshFeeds();
            setUser(null);
            onClose();
            navigate("/");
            toast("Your account was deleted.");
          } catch (err) {
            toast(errText(err, "Couldn't delete the account."));
          }
        }}><Icon name="trash" size={18} /> Delete account</button>
      </div>
    </Sheet>
  );
}

// ---- sign in / sign up -----------------------------------------------------

export function AuthPage({ mode, next }: { mode: "login" | "signup"; next: string }) {
  const { user, setUser } = useSession();
  const [form, setForm] = useState({ username: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const dest = next.startsWith("/") && !next.startsWith("//") ? next : "/";

  useEffect(() => {
    if (user) navigate(dest, { replace: true });
  }, [user, dest]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = mode === "signup" ? await api.signup(form) : await api.login({ login: form.username, password: form.password });
      setUser(r.user);
    } catch (err) {
      setError(errText(err, "Something went wrong. Try again."));
    } finally {
      setBusy(false);
    }
  };

  const other = `/${mode === "signup" ? "login" : "signup"}?next=${encodeURIComponent(dest)}`;
  return (
    <div className="page auth">
      <Link to="/" className="logo logo-big">pics<span>.me</span></Link>
      <p className="lede">{mode === "signup" ? "Share pictures. Remix them into videos, ads and games." : "Welcome back."}</p>
      <form className="stack" onSubmit={submit}>
        <label className="field">
          <span>{mode === "signup" ? "Username" : "Username or email"}</span>
          <input value={form.username} onChange={set("username")} autoComplete="username" autoCapitalize="none" spellCheck={false} required />
        </label>
        {mode === "signup" && (
          <label className="field"><span>Email</span><input type="email" value={form.email} onChange={set("email")} autoComplete="email" required /></label>
        )}
        <label className="field">
          <span>Password</span>
          <input type="password" value={form.password} onChange={set("password")} autoComplete={mode === "signup" ? "new-password" : "current-password"} minLength={mode === "signup" ? 8 : 1} required />
          {mode === "signup" && <small>At least 8 characters.</small>}
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn btn-spark btn-wide" disabled={busy}>{busy ? "One moment…" : mode === "signup" ? "Create account" : "Log in"}</button>
      </form>
      <p className="muted center">
        {mode === "signup" ? "Already have an account? " : "New to pics.me? "}
        <Link to={other} className="tag">{mode === "signup" ? "Log in" : "Create an account"}</Link>
      </p>
    </div>
  );
}
