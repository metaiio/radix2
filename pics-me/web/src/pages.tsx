import { useCallback, useEffect, useRef, useState } from "react";
import { LENSES, type Lens, type NotificationDTO, type PostDTO, type ProfileDTO, type ReportDTO, type UserDTO } from "../../shared/types.ts";
import { api, ApiError } from "./api.ts";
import { Feed } from "./Feed.tsx";
import { goBack, Link, navigate, refreshFeeds, useFeedVersion, useSession } from "./state.tsx";
import { shrinkForUpload } from "./studio/render.ts";
import { ago, Avatar, compact, Empty, Icon, PageHeader, Picture, PostGrid, Sentinel, Sheet, Spinner } from "./ui.tsx";

const errText = (err: unknown, fallback: string) => (err instanceof ApiError ? err.message : fallback);
const LENS_IDS = Object.keys(LENSES) as Lens[];

// ---- the stream ------------------------------------------------------------

export function FeedPage({ tab, active }: { tab: "home" | "discover"; active: boolean }) {
  const { user, ready, settings, updateSettings } = useSession();
  const version = useFeedVersion();
  const [picking, setPicking] = useState(false);
  const lens = settings.lens;
  const loadHome = useCallback((cursor: string | null) => api.home(cursor), []);
  const loadDiscover = useCallback((cursor: string | null) => api.discover(lens, cursor), [lens]);

  return (
    <div className="feed-page" hidden={!active}>
      <nav className="feed-tabs" aria-label="Streams">
        <span className="feed-tabs-side" />
        <Link to={user ? "/" : "/login?next=/"} className={tab === "home" ? "on" : ""}>Following</Link>
        <Link to="/discover" className={tab === "discover" ? "on" : ""}>Discover</Link>
        <span className="feed-tabs-side">
          {user && (
            <Link to="/activity" className="icon-btn bell" aria-label={user.unread ? `Activity, ${user.unread} new` : "Activity"}>
              <Icon name="bell" size={24} />
              {user.unread > 0 && <i />}
            </Link>
          )}
        </span>
      </nav>

      {tab === "discover" && (
        <button className="lens-pill" onClick={() => setPicking(true)} aria-label={`Showing ${LENSES[lens].name}. Change what Discover shows`}>
          <Icon name="sliders" size={15} /> {LENSES[lens].name}
        </button>
      )}

      {!ready ? null : tab === "home" ? (
        !user ? (
          <div className="feed"><div className="feed-msg">
            <Empty title="Your people, in order">
              <p>Sign in to see posts from the people you follow — newest first, nothing inserted.</p>
              <Link to="/login?next=/" className="btn">Sign in</Link>
            </Empty>
          </div></div>
        ) : (
          <Feed
            load={loadHome}
            active={active}
            breaks
            feedKey={`home:${user.username}:${version}`}
            emptyState={<Empty title="Nothing here yet"><p>This stream only shows people you follow. Find a few in Discover.</p><Link to="/discover" className="btn">Open Discover</Link></Empty>}
            endState={<>
              <span className="marker-icon"><Icon name="check" size={34} /></span>
              <h2>That's everything</h2>
              <p>You've seen every post from the people you follow.</p>
              <div className="marker-actions"><Link to="/discover" className="btn">Go to Discover</Link><Link to="/upload" className="btn btn-ghost">Post a picture</Link></div>
            </>}
          />
        )
      ) : (
        <Feed
          load={loadDiscover}
          active={active}
          breaks
          feedKey={`discover:${lens}:${user?.username ?? ""}:${version}`}
          emptyState={
            <Empty title={`Nothing in ${LENSES[lens].name} right now`}>
              <p>{LENSES[lens].rule}</p>
              {lens !== "latest" ? <button className="btn" onClick={() => updateSettings({ lens: "latest" })}>Show Latest instead</button> : <Link to="/upload" className="btn btn-spark">Post the first picture</Link>}
            </Empty>
          }
          endState={<>
            <span className="marker-icon"><Icon name="check" size={34} /></span>
            <h2>End of {LENSES[lens].name}</h2>
            <p>{LENSES[lens].rule} You've reached the bottom of it.</p>
            <div className="marker-actions"><button className="btn" onClick={() => setPicking(true)}>Try another view</button></div>
          </>}
        />
      )}

      {picking && (
        <Sheet title="What Discover shows" onClose={() => setPicking(false)}>
          <div className="sheet-pad stack">
            <p className="muted">You choose the rule. None of these use what you've watched, liked or lingered on.</p>
            <div className="choice-list" role="radiogroup">
              {LENS_IDS.map((id) => (
                <button key={id} role="radio" aria-checked={lens === id} className={"choice" + (lens === id ? " on" : "")} onClick={() => (updateSettings({ lens: id }), setPicking(false))}>
                  <strong>{LENSES[id].name}</strong>
                  <small>{LENSES[id].rule}</small>
                </button>
              ))}
            </div>
            <Link to="/about" className="tag">How the stream works</Link>
          </div>
        </Sheet>
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
          {data.tags.length > 0 && <><h3 className="section-title">Tags from the last two weeks</h3><TagChips tags={data.tags} /></>}
          <h3 className="section-title">Most liked</h3>
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

function UserList({ users, action }: { users: UserDTO[]; action?: (u: UserDTO) => React.ReactNode }) {
  return (
    <div className="user-list">
      {users.map((u) => (
        <div key={u.username} className="user-row">
          <Link to={`/u/${u.username}`} className="user-row-main">
            <Avatar user={u} size={44} />
            <span><strong>{u.displayName}</strong><small>@{u.username}</small></span>
          </Link>
          {action?.(u)}
        </div>
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
  const [menu, setMenu] = useState(false);
  const [tab, setTab] = useState<"posts" | "saved">("posts");
  const loadPosts = useCallback((cursor: string | null) => api.userPosts(username, cursor), [username]);
  const loadSaved = useCallback((cursor: string | null) => api.saved(cursor), []);

  const refresh = useCallback(() => {
    api.profile(username).then((r) => setProfile(r.profile)).catch((err) => setError(errText(err, "Couldn't load this profile.")));
  }, [username]);

  useEffect(() => {
    setProfile(null);
    setError("");
    setTab("posts");
    refresh();
  }, [refresh, user?.username]);

  if (error) return <div className="page"><PageHeader title="Profile" /><Empty title={error}><Link to="/" className="btn">Back to the stream</Link></Empty></div>;
  if (!profile) return <div className="page"><Spinner /></div>;

  const act = async (optimistic: Partial<ProfileDTO>, call: () => Promise<unknown>, done?: string) => {
    if (!requireAuth()) return;
    setProfile({ ...profile, ...optimistic });
    try {
      await call();
      if (done) toast(done);
      refresh();
    } catch (err) {
      toast(errText(err, "That didn't work. Try again."));
      refresh();
    }
  };

  return (
    <div className="page page-wide">
      <PageHeader
        title={`@${profile.username}`}
        right={profile.isMe
          ? <Link to="/settings" className="icon-btn" aria-label="Settings"><Icon name="sliders" /></Link>
          : <button className="icon-btn" onClick={() => setMenu(true)} aria-label="More options"><Icon name="more" /></button>}
      />
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
          ) : profile.blocked ? (
            <button className="btn btn-ghost" onClick={() => void act({ blocked: false }, () => api.block(profile.username, false), "Unblocked")}>Unblock</button>
          ) : (
            <div className="row-wrap">
              <button
                className={"btn" + (profile.isFollowing ? " btn-ghost" : "")}
                onClick={() => void act({ isFollowing: !profile.isFollowing, followers: profile.followers + (profile.isFollowing ? -1 : 1) }, () => api.follow(profile.username, !profile.isFollowing).then(refreshFeeds))}
              >
                {profile.isFollowing ? "Following" : "Follow"}
              </button>
              <button
                className={"btn btn-ghost" + (profile.inMyCircle ? " on" : "")}
                aria-pressed={profile.inMyCircle}
                onClick={() => void act({ inMyCircle: !profile.inMyCircle }, () => api.setCircle(profile.username, !profile.inMyCircle), profile.inMyCircle ? "Removed from your close circle" : "Added — they'll see your circle posts")}
              >
                <Icon name="lock" size={16} /> {profile.inMyCircle ? "In your circle" : "Add to circle"}
              </button>
            </div>
          )}
        </div>
      </section>

      {profile.isMe && (
        <div className="seg" role="tablist">
          <button role="tab" aria-selected={tab === "posts"} className={tab === "posts" ? "on" : ""} onClick={() => setTab("posts")}><Icon name="image" size={18} /> Posts</button>
          <button role="tab" aria-selected={tab === "saved"} className={tab === "saved" ? "on" : ""} onClick={() => setTab("saved")}><Icon name="bookmark" size={18} /> Saved</button>
        </div>
      )}

      {profile.blocked ? (
        <Empty title={`You've blocked @${profile.username}`}><p>You don't see each other's posts or comments.</p></Empty>
      ) : tab === "saved" ? (
        <PagedGrid load={loadSaved} resetKey="saved" empty={<Empty title="Nothing saved yet"><p>Tap Save on a post to keep it here. Only you can see this list.</p></Empty>} />
      ) : (
        <PagedGrid
          load={loadPosts}
          resetKey={username}
          empty={profile.isMe ? (
            <Empty title="Your pictures will live here"><Link to="/upload" className="btn btn-spark">Post your first picture</Link></Empty>
          ) : (
            <Empty title="No posts yet" />
          )}
        />
      )}

      {editing && <EditProfile profile={profile} onClose={() => setEditing(false)} onSaved={refresh} />}
      {menu && (
        <Sheet title={`@${profile.username}`} onClose={() => setMenu(false)}>
          <div className="menu">
            <button onClick={async () => {
              setMenu(false);
              try {
                await navigator.clipboard.writeText(`${location.origin}/u/${profile.username}`);
                toast("Profile link copied");
              } catch { /* clipboard unavailable */ }
            }}><Icon name="link" size={20} /> Copy profile link</button>
            {!profile.blocked && (
              <button className="danger" onClick={() => {
                setMenu(false);
                if (confirm(`Block @${profile.username}? You won't see each other's posts or comments.`)) void act({ blocked: true, isFollowing: false, inMyCircle: false }, () => api.block(profile.username, true).then(refreshFeeds), "Blocked");
              }}><Icon name="shield" size={20} /> Block</button>
            )}
          </div>
        </Sheet>
      )}
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
      </div>
    </Sheet>
  );
}

// ---- activity --------------------------------------------------------------

const ACTIVITY: Record<NotificationDTO["kind"], string> = {
  like: "liked your post",
  comment: "commented on your post",
  follow: "started following you",
  remix: "remixed your post in the Studio",
  circle: "added you to their close circle",
};

export function ActivityPage() {
  const { user, ready, requireAuth, refreshMe } = useSession();
  const [items, setItems] = useState<NotificationDTO[] | null>(null);

  useEffect(() => {
    if (ready && !user) requireAuth();
  }, [ready, user, requireAuth]);
  useEffect(() => {
    if (!user?.username) return;
    api.notifications().then((r) => (setItems(r.items), refreshMe())).catch(() => setItems([]));
  }, [user?.username, refreshMe]);

  return (
    <div className="page">
      <PageHeader title="Activity" />
      {items === null ? <Spinner /> : items.length === 0 ? (
        <Empty title="No activity yet"><p>Likes, comments, follows and remixes of your posts show up here. We never send nudges to pull you back in.</p></Empty>
      ) : (
        <div className="activity">
          {items.map((n) => (
            <Link key={n.id} to={n.post ? `/p/${n.post.id}` : `/u/${n.actor.username}`} className={"activity-row" + (n.read ? "" : " unread")}>
              <Avatar user={n.actor} size={44} />
              <span className="grow"><strong>@{n.actor.username}</strong> {ACTIVITY[n.kind]} <small>· {ago(n.createdAt)}</small></span>
              {n.post?.thumb && <img className="activity-thumb" src={n.post.thumb} alt="" loading="lazy" />}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// ---- settings --------------------------------------------------------------

function Toggle({ checked, onChange, title, children }: { checked: boolean; onChange: (v: boolean) => void; title: string; children: React.ReactNode }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span><strong>{title}</strong><small>{children}</small></span>
    </label>
  );
}

export function SettingsPage() {
  const { user, settings, updateSettings, setUser, toast } = useSession();
  const [circle, setCircle] = useState<UserDTO[] | null>(null);
  const [blocked, setBlocked] = useState<UserDTO[] | null>(null);
  const [adding, setAdding] = useState("");

  useEffect(() => {
    if (!user?.username) return;
    api.circle().then((r) => setCircle(r.members)).catch(() => setCircle([]));
    api.blocks().then((r) => setBlocked(r.users)).catch(() => setBlocked([]));
  }, [user?.username]);

  const addToCircle = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = adding.trim().replace(/^@/, "").toLowerCase();
    if (!name) return;
    try {
      await api.setCircle(name, true);
      setCircle((await api.circle()).members);
      setAdding("");
    } catch (err) {
      toast(errText(err, "Couldn't add that person."));
    }
  };

  return (
    <div className="page">
      <PageHeader title="Settings" />
      <div className="stack">
        <h3 className="section-title">Your pace</h3>
        <div className="field">
          <span>Suggest a pause</span>
          <div className="chips">
            {[0, 15, 30, 60].map((n) => (
              <button key={n} className={"chip" + (settings.breakEvery === n ? " on" : "")} aria-pressed={settings.breakEvery === n} onClick={() => updateSettings({ breakEvery: n })}>
                {n === 0 ? "Never" : `Every ${n} posts`}
              </button>
            ))}
          </div>
        </div>
        <Toggle checked={settings.quietCounts} onChange={(v) => updateSettings({ quietCounts: v })} title="Quiet counts">Hide like and comment numbers so pictures aren't a scoreboard.</Toggle>
        <Toggle checked={settings.autoplay} onChange={(v) => updateSettings({ autoplay: v })} title="Play videos automatically">Turn off to start each video yourself.</Toggle>

        {user && (
          <>
            <h3 className="section-title">Close circle</h3>
            <p className="muted">People here can see posts you share with "Close circle". They aren't told when you remove them.</p>
            <form className="row" onSubmit={addToCircle}>
              <input value={adding} onChange={(e) => setAdding(e.target.value)} placeholder="@username" aria-label="Username to add to your close circle" autoCapitalize="none" spellCheck={false} />
              <button className="btn" style={{ flex: "none" }} disabled={!adding.trim()}>Add</button>
            </form>
            {circle === null ? <Spinner /> : circle.length === 0 ? <p className="muted">No one in your circle yet.</p> : (
              <UserList users={circle} action={(u) => (
                <button className="btn btn-ghost btn-small" onClick={async () => {
                  await api.setCircle(u.username, false).catch(() => {});
                  setCircle((c) => c!.filter((x) => x.username !== u.username));
                }}>Remove</button>
              )} />
            )}

            {blocked && blocked.length > 0 && (
              <>
                <h3 className="section-title">Blocked</h3>
                <UserList users={blocked} action={(u) => (
                  <button className="btn btn-ghost btn-small" onClick={async () => {
                    await api.block(u.username, false).catch(() => {});
                    setBlocked((b) => b!.filter((x) => x.username !== u.username));
                    refreshFeeds();
                  }}>Unblock</button>
                )} />
              </>
            )}

            <h3 className="section-title">Your data</h3>
            <a className="btn btn-ghost" href="/api/me/export" download><Icon name="download" size={18} /> Download everything you've posted</a>
            <p className="muted">A ZIP with your pictures, videos, captions, comments and lists. It's yours.</p>

            <h3 className="section-title">Account</h3>
            {user.isAdmin && <Link to="/admin" className="btn btn-ghost"><Icon name="shield" size={18} /> Review reports</Link>}
            <button className="btn btn-ghost" onClick={async () => {
              await api.logout().catch(() => {});
              setUser(null);
              refreshFeeds();
              navigate("/");
            }}><Icon name="logout" size={18} /> Log out</button>
            <button className="btn btn-ghost danger" onClick={async () => {
              const password = prompt("This permanently deletes your account, posts and pictures. Enter your password to confirm.");
              if (!password) return;
              try {
                await api.deleteMe(password);
                refreshFeeds();
                setUser(null);
                navigate("/");
                toast("Your account was deleted.");
              } catch (err) {
                toast(errText(err, "Couldn't delete the account."));
              }
            }}><Icon name="trash" size={18} /> Delete account</button>
          </>
        )}
        <Link to="/about" className="tag center">How pics.me works</Link>
      </div>
    </div>
  );
}

// ---- about -----------------------------------------------------------------

export function AboutPage() {
  return (
    <div className="page">
      <PageHeader title="How pics.me works" />
      <div className="about">
        <p className="lede">Pictures from people you chose, in the order they were posted. Tools that let you make something with them. Nothing built to keep you scrolling.</p>

        <section>
          <h2><Icon name="users" /> Your people, in order</h2>
          <p>The <strong>Following</strong> stream shows posts from accounts you follow and nobody else, newest first. Nothing is inserted, promoted or reordered. When you've seen what's new, it tells you so. When you reach the bottom, it ends.</p>
        </section>

        <section>
          <h2><Icon name="sliders" /> You pick the rule</h2>
          <p><strong>Discover</strong> follows one rule at a time, and you choose which:</p>
          <ul>
            {LENS_IDS.map((id) => <li key={id}><strong>{LENSES[id].name}.</strong> {LENSES[id].rule}</li>)}
          </ul>
          <p>That is the entire system. It doesn't track what you watch, how long you pause, or what you tap, and it doesn't build a profile of you to decide what comes next. Every post can tell you why it's in front of you.</p>
        </section>

        <section>
          <h2><Icon name="eye" /> Your pace</h2>
          <p>Streams suggest a pause every so often — you set how often, or turn it off. You can hide like and comment numbers, and stop videos from playing by themselves. We don't send notifications designed to pull you back.</p>
        </section>

        <section>
          <h2><Icon name="lock" /> Close circle</h2>
          <p>Not everything is for everyone. Share a post with your close circle and only the people you picked can see it. Circle posts never appear in Discover, search or tags, and can't be remixed.</p>
        </section>

        <section>
          <h2><Icon name="spark" /> AI as a tool, clearly labeled</h2>
          <p>The Studio turns pictures into videos, ads and games. Anything made there carries a Studio label, says what it was made from, and credits the original creator. Creators can switch remixing off for any post.</p>
        </section>

        <section>
          <h2><Icon name="download" /> Yours to keep, yours to take</h2>
          <p>Location and camera metadata are stripped from every upload. You can download everything you've posted as a ZIP at any time, and deleting your account removes your posts and pictures.</p>
        </section>

        <section>
          <h2><Icon name="shield" /> People, not machines, review reports</h2>
          <p>Report a post and a person looks at it. Block someone and neither of you sees the other again.</p>
        </section>

        <p className="muted center">Designed and built in the USA.</p>
      </div>
    </div>
  );
}

// ---- moderation ------------------------------------------------------------

export function AdminPage() {
  const { user, ready } = useSession();
  const [reports, setReports] = useState<ReportDTO[] | null>(null);
  const [error, setError] = useState("");
  const { toast } = useSession();

  const load = useCallback(() => {
    api.adminReports().then((r) => setReports(r.reports)).catch(() => setError("There's nothing at this address"));
  }, []);
  useEffect(() => {
    if (ready) user?.isAdmin ? load() : setError("There's nothing at this address");
  }, [ready, user?.isAdmin, load]);

  const resolve = async (postId: string, action: "dismiss" | "remove") => {
    if (action === "remove" && !confirm("Remove this post for everyone?")) return;
    try {
      await api.adminResolve(postId, action);
      setReports((r) => r!.filter((x) => x.post.id !== postId));
      if (action === "remove") refreshFeeds();
    } catch (err) {
      toast(errText(err, "Couldn't update that report."));
    }
  };

  if (error) return <div className="page"><Empty title={error}><Link to="/" className="btn">Back to the stream</Link></Empty></div>;
  return (
    <div className="page">
      <PageHeader title="Reported posts" />
      {reports === null ? <Spinner /> : reports.length === 0 ? <Empty title="Nothing waiting for review" /> : (
        <div className="stack">
          {reports.map((r) => (
            <article key={r.post.id} className="report">
              <Link to={`/p/${r.post.id}`} className="thumb thumb-lg">{r.post.media[0] && <Picture media={r.post.media[0]} sizes="96px" />}</Link>
              <div className="grow">
                <p><strong>@{r.post.author.username}</strong> · {r.post.kind} · {ago(r.post.createdAt)}</p>
                {r.post.caption && <p className="muted">{r.post.caption.slice(0, 140)}</p>}
                <ul>{r.reasons.map((x, i) => <li key={i}>“{x.reason}” <small className="muted">— @{x.by}, {ago(x.createdAt)}</small></li>)}</ul>
                <div className="row-wrap">
                  <button className="btn btn-ghost btn-small" onClick={() => void resolve(r.post.id, "dismiss")}>Keep post</button>
                  <button className="btn btn-ghost btn-small danger" onClick={() => void resolve(r.post.id, "remove")}>Remove post</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
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
      refreshFeeds();
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
      <p className="lede">{mode === "signup" ? "Your people, in order. No feed deciding for you." : "Welcome back."}</p>
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
      <p className="muted center"><Link to="/about" className="tag">How pics.me works</Link></p>
    </div>
  );
}
