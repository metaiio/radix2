import { lazy, StrictMode, Suspense, useRef } from "react";
import { createRoot } from "react-dom/client";
import { AuthPage, ExplorePage, FeedPage, PostPage, ProfilePage, TagPage } from "./pages.tsx";
import { Link, SessionProvider, useLocation, useSession } from "./state.tsx";
import { Avatar, Empty, Icon, Spinner } from "./ui.tsx";
import "./styles.css";

// Creation tools are split out so the stream itself stays a small download.
const UploadPage = lazy(() => import("./Upload.tsx").then((m) => ({ default: m.UploadPage })));
const StudioPage = lazy(() => import("./Studio.tsx").then((m) => ({ default: m.StudioPage })));

function Nav({ path }: { path: string }) {
  const { user } = useSession();
  const profile = user ? `/u/${user.username}` : "/login";
  const item = (to: string, icon: string, label: string, on: boolean, extra = "") => (
    <Link to={to} className={"nav-item" + (on ? " on" : "") + extra} aria-current={on ? "page" : undefined}>
      {icon === "me" && user ? <Avatar user={user} size={26} /> : <Icon name={icon === "me" ? "user" : icon} size={26} />}
      <span>{label}</span>
    </Link>
  );
  return (
    <nav className="nav" aria-label="Main">
      <Link to="/" className="logo">pics<span>.me</span></Link>
      {item("/", "home", "Stream", path === "/" || path === "/following")}
      {item("/explore", "search", "Explore", path.startsWith("/explore") || path.startsWith("/tag/"))}
      {item("/upload", "plus", "Post", path === "/upload", " nav-post")}
      {item("/studio", "spark", "Studio", path.startsWith("/studio"), " nav-studio")}
      {item(profile, "me", user ? "Profile" : "Sign in", path === profile || path === "/signup")}
    </nav>
  );
}

function App() {
  const { path, parts, query } = useLocation();
  const [a, b] = parts;
  const onFeed = path === "/" || path === "/following";
  // Remember which feed was showing while another page covers it.
  const tab = useRef<"foryou" | "following">("foryou");
  if (onFeed) tab.current = path === "/following" ? "following" : "foryou";

  let page: React.ReactNode = null;
  if (onFeed) page = null;
  else if (a === "explore") page = <ExplorePage />;
  else if (a === "tag" && b) page = <TagPage tag={b.toLowerCase()} />;
  else if (a === "u" && b) page = <ProfilePage username={b} />;
  else if (a === "p" && b) page = <PostPage id={b} key={b} />;
  else if (a === "upload") page = <UploadPage />;
  else if (a === "studio") page = <StudioPage postId={b} />;
  else if (a === "login" || a === "signup") page = <AuthPage mode={a} next={query.get("next") ?? "/"} key={a} />;
  else page = <div className="page"><Empty title="There's nothing at this address"><Link to="/" className="btn">Back to the stream</Link></Empty></div>;

  return (
    <div className="app">
      <Nav path={path} />
      <main className="main">
        {/* The stream stays mounted so coming back lands on the same post. */}
        <FeedPage tab={tab.current} active={onFeed} />
        <Suspense fallback={<div className="page"><Spinner /></div>}>{page}</Suspense>
      </main>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SessionProvider>
      <App />
    </SessionProvider>
  </StrictMode>,
);

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => void navigator.serviceWorker.register("/sw.js").catch(() => {}));
}
