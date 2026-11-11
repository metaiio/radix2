import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { GameType, MediaDTO, PostDTO, ScoreDTO } from "../../shared/types.ts";
import { api } from "./api.ts";
import { useLocation, useSession } from "./state.tsx";
import { Avatar, clock, Icon } from "./ui.tsx";

export const GAME_NAMES: Record<GameType, string> = { slide: "Slide puzzle", swap: "Tile swap", memory: "Memory match" };
export const GAME_HELP: Record<GameType, string> = {
  slide: "Slide tiles into the empty space until the picture is whole.",
  swap: "Tap two tiles to swap them. Put the picture back together.",
  memory: "Flip two cards at a time and find the matching pieces.",
};

const shuffle = <T,>(arr: T[]) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
};

/** Centre-crops the picture to a square so tiles line up on any aspect ratio. */
function useSquare(media: MediaDTO) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let made: string | null = null;
    let dead = false;
    const img = new Image();
    img.onload = () => {
      const side = Math.min(img.naturalWidth, img.naturalHeight);
      const c = document.createElement("canvas");
      c.width = c.height = Math.min(side, 900);
      c.getContext("2d")!.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, c.width, c.height);
      c.toBlob((b) => {
        if (!b || dead) return;
        made = URL.createObjectURL(b);
        setUrl(made);
      }, "image/jpeg", 0.88);
    };
    img.src = media.urls.m;
    return () => {
      dead = true;
      if (made) URL.revokeObjectURL(made);
    };
  }, [media.urls.m]);
  return url;
}

/** Background styles that show piece `index` of an n×n cut of the picture. */
const piece = (url: string, index: number, n: number) => ({
  backgroundImage: `url(${url})`,
  backgroundSize: `${n * 100}% ${n * 100}%`,
  backgroundPosition: `${((index % n) / (n - 1)) * 100}% ${(Math.floor(index / n) / (n - 1)) * 100}%`,
});

interface BoardProps {
  url: string;
  n: number;
  onMove: () => void;
  onWin: () => void;
  locked: boolean;
}

function SlideBoard({ url, n, onMove, onWin, locked }: BoardProps) {
  const blank = n * n - 1;
  // Shuffle by walking the blank around, so the puzzle is always solvable.
  const [cells, setCells] = useState(() => {
    const c = Array.from({ length: n * n }, (_, i) => i);
    let b = blank, prev = -1;
    for (let k = 0; k < n * n * 30; k++) {
      const opts = [b - n, b + n, b % n ? b - 1 : -1, b % n < n - 1 ? b + 1 : -1].filter((x) => x >= 0 && x < n * n && x !== prev);
      const to = opts[Math.floor(Math.random() * opts.length)]!;
      [c[b], c[to]] = [c[to]!, c[b]!];
      prev = b;
      b = to;
    }
    if (c.every((v, i) => v === i)) [c[blank], c[blank - 1]] = [c[blank - 1]!, c[blank]!];
    return c;
  });

  const tap = (pos: number) => {
    if (locked) return;
    const b = cells.indexOf(blank);
    const adjacent = Math.abs((pos % n) - (b % n)) + Math.abs(Math.floor(pos / n) - Math.floor(b / n)) === 1;
    if (!adjacent) return;
    const nextCells = [...cells];
    [nextCells[pos], nextCells[b]] = [nextCells[b]!, nextCells[pos]!];
    setCells(nextCells);
    onMove();
    if (nextCells.every((v, i) => v === i)) onWin();
  };

  return (
    <div className="board">
      {cells.map((tile, pos) =>
        tile === blank && !locked ? null : (
          <button
            key={tile}
            className="tile"
            data-tile={tile}
            data-pos={pos}
            aria-label={`Tile ${tile + 1}`}
            onClick={() => tap(pos)}
            style={{ ...piece(url, tile, n), width: `${100 / n}%`, height: `${100 / n}%`, transform: `translate(${(pos % n) * 100}%, ${Math.floor(pos / n) * 100}%)` }}
          />
        ),
      )}
    </div>
  );
}

function SwapBoard({ url, n, onMove, onWin, locked }: BoardProps) {
  const [cells, setCells] = useState(() => {
    const ordered = Array.from({ length: n * n }, (_, i) => i);
    let c = shuffle(ordered);
    while (c.every((v, i) => v === i)) c = shuffle(ordered);
    return c;
  });
  const [picked, setPicked] = useState<number | null>(null);

  const tap = (pos: number) => {
    if (locked) return;
    if (picked === null) return setPicked(pos);
    if (picked === pos) return setPicked(null);
    const nextCells = [...cells];
    [nextCells[pos], nextCells[picked]] = [nextCells[picked]!, nextCells[pos]!];
    setCells(nextCells);
    setPicked(null);
    onMove();
    if (nextCells.every((v, i) => v === i)) onWin();
  };

  return (
    <div className={"board" + (locked ? " solved" : "")}>
      {cells.map((tile, pos) => (
        <button
          key={tile}
          className={"tile" + (picked === pos ? " picked" : "")}
          data-tile={tile}
          data-pos={pos}
          aria-label={`Tile ${tile + 1}${picked === pos ? ", selected" : ""}`}
          onClick={() => tap(pos)}
          style={{ ...piece(url, tile, n), width: `${100 / n}%`, height: `${100 / n}%`, transform: `translate(${(pos % n) * 100}%, ${Math.floor(pos / n) * 100}%)` }}
        />
      ))}
    </div>
  );
}

function MemoryBoard({ url, onMove, onWin, locked }: BoardProps) {
  // 8 pairs, each a different piece of a 3×3 cut of the picture.
  const cards = useMemo(() => shuffle(shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8]).slice(0, 8).flatMap((p) => [p, p])), []);
  const [open, setOpen] = useState<number[]>([]);
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const wait = useRef(0);
  useEffect(() => () => window.clearTimeout(wait.current), []);

  const tap = (i: number) => {
    if (locked || open.length === 2 || open.includes(i) || matched.has(cards[i]!)) return;
    const now = [...open, i];
    setOpen(now);
    if (now.length < 2) return;
    onMove();
    if (cards[now[0]!] === cards[now[1]!]) {
      const m = new Set(matched).add(cards[i]!);
      setMatched(m);
      setOpen([]);
      if (m.size === 8) onWin();
    } else {
      wait.current = window.setTimeout(() => setOpen([]), 750);
    }
  };

  return (
    <div className="board memory">
      {cards.map((p, i) => {
        const up = open.includes(i) || matched.has(p);
        return (
          <button key={i} className={"mcard" + (up ? " up" : "") + (matched.has(p) ? " matched" : "")} data-piece={p} onClick={() => tap(i)} aria-label={up ? `Card ${i + 1}, piece ${p + 1}` : `Card ${i + 1}, face down`}>
            <span className="mcard-back"><Icon name="spark" size={22} /></span>
            <span className="mcard-face" style={piece(url, p, 3)} />
          </button>
        );
      })}
    </div>
  );
}

/** A playable game built from one picture. Used in the feed overlay and the Studio preview. */
export function Game({ media, type, size, onWin }: { media: MediaDTO; type: GameType; size: number; onWin?: (ms: number, moves: number) => void }) {
  const url = useSquare(media);
  const [round, setRound] = useState(0);
  const [moves, setMoves] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [won, setWon] = useState(false);
  const movesRef = useRef(0);

  const startRef = useRef<number | null>(null);

  useEffect(() => {
    setMoves(0);
    movesRef.current = 0;
    startRef.current = null;
    setStartedAt(null);
    setElapsed(0);
    setWon(false);
  }, [round, type, size]);

  useEffect(() => {
    if (startedAt === null || won) return;
    const t = window.setInterval(() => setElapsed(Date.now() - startedAt), 100);
    return () => window.clearInterval(t);
  }, [startedAt, won]);

  // The clock starts on the first move.
  const move = useCallback(() => {
    movesRef.current += 1;
    setMoves(movesRef.current);
    if (startRef.current === null) {
      startRef.current = Date.now();
      setStartedAt(startRef.current);
    }
  }, []);

  const win = useCallback(() => {
    const ms = Math.max(Date.now() - (startRef.current ?? Date.now()), 300);
    setWon(true);
    setElapsed(ms);
    onWin?.(ms, Math.max(movesRef.current, 1));
  }, [onWin]);

  if (!url) return <div className="board board-loading" />;
  const Board = type === "slide" ? SlideBoard : type === "swap" ? SwapBoard : MemoryBoard;
  return (
    <div className="game">
      <div className="game-stats">
        <span><small>Time</small><b>{clock(elapsed)}</b></span>
        <span><small>Moves</small><b>{moves}</b></span>
        <button className="btn btn-ghost btn-small" onClick={() => setRound((r) => r + 1)}><Icon name="refresh" size={16} /> {won ? "Play again" : "Shuffle"}</button>
      </div>
      <Board key={`${type}-${size}-${round}`} url={url} n={size} onMove={move} onWin={win} locked={won} />
      <p className="game-help" role="status">{won ? `Solved in ${clock(elapsed)} with ${moves} moves.` : GAME_HELP[type]}</p>
    </div>
  );
}

/** Full-screen game overlay with the post's leaderboard. */
export function GamePlayer({ post, onClose }: { post: PostDTO; onClose: () => void }) {
  const { user, toast } = useSession();
  const [scores, setScores] = useState<ScoreDTO[]>([]);
  const game = post.meta.game!;
  const { path } = useLocation();
  const opened = useRef(path);

  useEffect(() => {
    api.scores(post.id).then((r) => setScores(r.scores)).catch(() => {});
  }, [post.id]);
  useEffect(() => {
    if (path !== opened.current) onClose();
  }, [path, onClose]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const onWin = useCallback((ms: number, moves: number) => {
    if (!user) return toast("Sign in to put your time on the leaderboard.");
    api.submitScore(post.id, ms, moves).then((r) => setScores(r.scores)).catch(() => toast("Couldn't save your score."));
  }, [post.id, user, toast]);

  return createPortal(
    <div className="overlay" role="dialog" aria-modal="true" aria-label={GAME_NAMES[game.type]}>
      <header className="page-head">
        <button className="icon-btn" onClick={onClose} aria-label="Close game"><Icon name="close" /></button>
        <h1>{GAME_NAMES[game.type]}</h1>
        <span className="page-head-right" />
      </header>
      <div className="overlay-body">
        <Game media={post.media[0]!} type={game.type} size={game.size} onWin={onWin} />
        <section className="leaderboard">
          <h3>Fastest times</h3>
          {scores.length === 0 ? (
            <p className="muted">No one has finished yet. Be the first.</p>
          ) : (
            <ol>
              {scores.map((s, i) => (
                <li key={s.user.username} className={s.user.username === user?.username ? "me" : ""}>
                  <span className="rank">{i + 1}</span>
                  <Avatar user={s.user} size={26} />
                  <span className="grow">@{s.user.username}</span>
                  <b>{clock(s.ms)}</b>
                  <small>{s.moves} moves</small>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>,
    document.body,
  );
}
