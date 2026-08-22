"use client";

import Image from "next/image";
import { type CSSProperties, useEffect, useRef, useState } from "react";
import { Chess, type Color, type PieceSymbol, type Square } from "chess.js";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  SearchIcon,
  SendIcon,
  SparklesIcon,
  XIcon,
} from "@/components/icons";
import {
  awardCardGamePoints,
  CHESS_WIN_POINTS,
} from "@/lib/card-game-rewards";

interface Props {
  onExit: () => void;
}

type Role = "w" | "b";
type GameResultReason = "checkmate" | "forfeit";
type ChatMenu = "messages" | "emojis" | null;

interface ChessPresence {
  presence_ref: string;
  playerId?: unknown;
  role?: unknown;
  joinedAt?: unknown;
}

type PieceView = { color: Color; type: PieceSymbol };

interface ChatMessage {
  id: string;
  playerId: string;
  role: Role | null;
  body: string;
  mine: boolean;
}

interface GameResult {
  id: number;
  reason: GameResultReason;
  winner: Role | null;
  loser: Role | null;
  rewardPoints: number;
}

interface MoveAnimation {
  id: number;
  from: Square;
  to: Square;
  color: Color;
  type: PieceSymbol;
}

interface GameView {
  fen: string;
  turn: Color;
  inCheck: boolean;
  isCheckmate: boolean;
  isDraw: boolean;
  isGameOver: boolean;
  pieces: Partial<Record<Square, PieceView>>;
}

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;
const RANKS = [8, 7, 6, 5, 4, 3, 2, 1] as const;
const PIECE_IMAGES: Record<Color, Record<PieceSymbol, string>> = {
  w: {
    k: "/chess/White_pieces/Sponge_King.png",
    q: "/chess/White_pieces/Sandy_Queen.png",
    r: "/chess/White_pieces/MrCrabs_Rook.png",
    b: "/chess/White_pieces/Squidward_Bishop.png",
    n: "/chess/White_pieces/Patrick_knight.png",
    p: "/chess/White_pieces/Snail_Pawn.png",
  },
  b: {
    k: "/chess/Black_pieces/Sponge_King.png",
    q: "/chess/Black_pieces/Sandy_Queen.png",
    r: "/chess/Black_pieces/MrCrabs_Rook.png",
    b: "/chess/Black_pieces/Squidward_Bishop.png",
    n: "/chess/Black_pieces/Patrick_knight.png",
    p: "/chess/Black_pieces/Snail_Pawn.png",
  },
};
const PIECE_GALLERY = (["w", "b"] as const).flatMap((color) =>
  (["k", "q", "r", "b", "n", "p"] as const).map((type) => ({
    color,
    type,
  })),
);
const PIECE_NAMES: Record<PieceSymbol, string> = {
  k: "SpongeBob King",
  q: "Sandy Queen",
  r: "Mr. Krabs Rook",
  b: "Squidward Bishop",
  n: "Patrick Knight",
  p: "Gary Pawn",
};
const CHESS_CHANNEL = "broomer-chess:single-table";
const CHAT_MAX_LENGTH = 120;
const CHAT_MAX_MESSAGES = 8;
const MOVE_ANIMATION_MS = 420;
const QUICK_CHAT_MESSAGES = [
  "Nice move",
  "Your turn",
  "Wait",
  "Good game",
] as const;
const QUICK_CHAT_EMOJIS = ["😂", "😭", "💀", "👏", "🔥", "🤝"] as const;

function createGameView(game: Chess): GameView {
  const pieces: Partial<Record<Square, PieceView>> = {};

  for (const file of FILES) {
    for (const rank of RANKS) {
      const square = `${file}${rank}` as Square;
      const piece = game.get(square);
      if (piece) pieces[square] = piece;
    }
  }

  return {
    fen: game.fen(),
    turn: game.turn(),
    inCheck: game.inCheck(),
    isCheckmate: game.isCheckmate(),
    isDraw: game.isDraw(),
    isGameOver: game.isGameOver(),
    pieces,
  };
}

function PieceGallery({ onClose }: Readonly<{ onClose: () => void }>) {
  const [pieceIndex, setPieceIndex] = useState(0);
  const piece = PIECE_GALLERY[pieceIndex];
  const colorName = piece.color === "w" ? "White" : "Black";

  function selectColor(color: Color) {
    setPieceIndex(color === "w" ? 0 : 6);
  }

  function stepPiece(offset: number) {
    setPieceIndex(
      (current) =>
        (current + offset + PIECE_GALLERY.length) % PIECE_GALLERY.length,
    );
  }

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft") stepPiece(-1);
      if (event.key === "ArrowRight") stepPiece(1);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div
      className="chess-piece-gallery fixed inset-0 z-[95] grid place-items-center p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="piece-gallery-title"
    >
      <button
        type="button"
        aria-label="Close piece gallery"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <div className="chess-piece-gallery-panel relative flex max-h-full w-[min(94vw,44rem)] flex-col overflow-hidden">
        <header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
          <div>
            <h2
              id="piece-gallery-title"
              className="text-sm font-bold text-[#ffe29a] sm:text-base"
            >
              Piece gallery
            </h2>
            <p className="text-[10px] text-cyan-100/55 sm:text-xs">
              The live match stays connected
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close piece gallery"
            className="chess-gallery-icon-button"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </header>

        <div className="flex justify-center p-3 pb-1">
          <div
            className="chess-gallery-segments grid grid-cols-2"
            aria-label="Piece color"
          >
            {(["w", "b"] as const).map((color) => (
              <button
                key={color}
                type="button"
                aria-pressed={piece.color === color}
                onClick={() => selectColor(color)}
                className="px-5 py-1.5 text-xs font-semibold"
              >
                {color === "w" ? "White" : "Black"}
              </button>
            ))}
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center gap-1 px-2 sm:grid-cols-[3.25rem_minmax(0,1fr)_3.25rem] sm:px-4">
          <button
            type="button"
            onClick={() => stepPiece(-1)}
            aria-label="Previous piece"
            className="chess-gallery-icon-button"
          >
            <ChevronLeftIcon className="h-6 w-6" />
          </button>
          <figure className="flex min-h-0 flex-col items-center">
            <div className="chess-gallery-image relative aspect-square w-[min(52vh,25rem,100%)]">
              <Image
                key={`${piece.color}-${piece.type}`}
                src={PIECE_IMAGES[piece.color][piece.type]}
                alt={`${colorName} ${PIECE_NAMES[piece.type]}`}
                fill
                priority
                sizes="(max-width: 640px) 70vw, 400px"
                className="animate-card-in object-contain p-[3%] drop-shadow-[0_1rem_1rem_rgba(0,0,0,0.48)]"
              />
            </div>
            <figcaption className="pb-2 text-center">
              <p className="font-bold text-[#ffe29a]">
                {PIECE_NAMES[piece.type]}
              </p>
              <p className="text-xs text-cyan-100/55">{colorName} set</p>
            </figcaption>
          </figure>
          <button
            type="button"
            onClick={() => stepPiece(1)}
            aria-label="Next piece"
            className="chess-gallery-icon-button"
          >
            <ChevronRightIcon className="h-6 w-6" />
          </button>
        </div>

        <div className="chess-gallery-thumbnails grid grid-cols-6 gap-1 border-t border-white/10 p-2 sm:gap-2 sm:p-3">
          {PIECE_GALLERY.map((galleryPiece, index) =>
            galleryPiece.color === piece.color ? (
              <button
                key={`${galleryPiece.color}-${galleryPiece.type}`}
                type="button"
                aria-label={`View ${PIECE_NAMES[galleryPiece.type]}`}
                aria-pressed={pieceIndex === index}
                onClick={() => setPieceIndex(index)}
                className="relative aspect-square min-w-0 overflow-hidden"
              >
                <Image
                  src={PIECE_IMAGES[galleryPiece.color][galleryPiece.type]}
                  alt=""
                  fill
                  sizes="72px"
                  className="object-contain p-[8%]"
                />
              </button>
            ) : null,
          )}
        </div>
      </div>
    </div>
  );
}

function readBroadcastPayload(message: unknown): Record<string, unknown> {
  if (
    typeof message !== "object" ||
    message === null ||
    Array.isArray(message)
  ) {
    return {};
  }
  const record = message as Record<string, unknown>;
  const nested = record.payload;
  if (typeof nested === "object" && nested !== null && !Array.isArray(nested)) {
    return nested as Record<string, unknown>;
  }
  return record;
}

function getRoleName(role: Role | null): string {
  if (role === "w") return "White";
  if (role === "b") return "Black";
  return "Player";
}

function getOppositeRole(role: Role): Role {
  return role === "w" ? "b" : "w";
}

function normalizeChatBody(body: string): string {
  return body.replace(/\s+/g, " ").trim().slice(0, CHAT_MAX_LENGTH);
}

function isRole(value: unknown): value is Role {
  return value === "w" || value === "b";
}

function getResultText(result: GameResult, viewerRole: Role | null): string {
  if (result.reason === "checkmate") {
    if (result.winner === viewerRole) return "You win by checkmate";
    return `${getRoleName(result.winner)} wins by checkmate`;
  }

  if (result.loser === viewerRole) return "You forfeited";
  if (result.winner === viewerRole) return "You win by forfeit";
  return `${getRoleName(result.winner)} wins by forfeit`;
}

function getCheckmateResult(game: Chess) {
  if (!game.isCheckmate()) return null;
  const loser = game.turn();
  return {
    reason: "checkmate" as const,
    winner: getOppositeRole(loser),
    loser,
  };
}

function getGameStatus(
  game: GameView,
  role: Role | null,
  ready: boolean,
): string {
  if (!role) return "Finding your seat";
  if (!ready) return role === "w" ? "Waiting for Black" : "Waiting for White";
  if (game.isCheckmate) {
    return `${game.turn === "w" ? "Black" : "White"} wins by checkmate`;
  }
  if (game.isDraw) return "Draw";
  const turn = game.turn === "w" ? "White" : "Black";
  return game.inCheck ? `${turn} is in check` : `${turn} to move`;
}

function getSquareLabel(
  square: Square,
  piece: { color: Color; type: PieceSymbol } | undefined,
): string {
  if (!piece) return `${square} empty`;
  const color = piece.color === "w" ? "white" : "black";
  return `${square} ${color} ${piece.type}`;
}

export function ChessGame({ onExit }: Readonly<Props>) {
  const [supabase] = useState(createBrowserSupabaseClient);
  const [gameView, setGameView] = useState(() =>
    createGameView(new Chess()),
  );
  const [role, setRole] = useState<Role | null>(null);
  const [chatDraft, setChatDraft] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatMenu, setChatMenu] = useState<ChatMenu>(null);
  const [connection, setConnection] = useState<
    "connecting" | "online" | "error"
  >("connecting");
  const [opponentReady, setOpponentReady] = useState(false);
  const [selected, setSelected] = useState<Square | null>(null);
  const [legalTargets, setLegalTargets] = useState<Square[]>([]);
  const [dragging, setDragging] = useState<Square | null>(null);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [moveAnimation, setMoveAnimation] = useState<MoveAnimation | null>(
    null,
  );
  const [gameResult, setGameResult] = useState<GameResult | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [compactLandscape, setCompactLandscape] = useState(() =>
    typeof window === "undefined"
      ? false
      : window.matchMedia("(orientation: landscape) and (max-height: 500px)")
          .matches,
  );
  const gameRef = useRef(new Chess());
  const channelRef = useRef<RealtimeChannel | null>(null);
  const opponentIdRef = useRef<string | null>(null);
  const playerIdRef = useRef<string | null>(null);
  const joinedAtRef = useRef<number | null>(null);
  const roleRef = useRef<Role | null>(null);
  const gameResultRef = useRef<GameResult | null>(null);
  const seatTimerRef = useRef<number | null>(null);
  const moveTimerRef = useRef<number | null>(null);
  const resultSequenceRef = useRef(0);
  const moveSequenceRef = useRef(0);
  const chatLogRef = useRef<HTMLDivElement>(null);
  const suppressClickUntilRef = useRef(0);

  useEffect(() => {
    const media = window.matchMedia(
      "(orientation: landscape) and (max-height: 500px)",
    );
    const updateLayout = () => setCompactLandscape(media.matches);
    media.addEventListener("change", updateLayout);
    return () => media.removeEventListener("change", updateLayout);
  }, []);

  useEffect(() => {
    const log = chatLogRef.current;
    if (!log) return;
    log.scrollTop = 0;
  }, [chatMessages]);

  function refreshBoard() {
    setSelected(null);
    setLegalTargets([]);
    setDragging(null);
    setGameView(createGameView(gameRef.current));
  }

  function getPlayerId() {
    playerIdRef.current ??= crypto.randomUUID();
    return playerIdRef.current;
  }

  function getJoinedAt() {
    joinedAtRef.current ??= Date.now();
    return joinedAtRef.current;
  }

  function send(event: string, payload: Record<string, unknown>) {
    void channelRef.current?.send({ type: "broadcast", event, payload });
  }

  function appendChatMessage(message: ChatMessage) {
    setChatMessages((current) =>
      [...current, message].slice(-CHAT_MAX_MESSAGES),
    );
  }

  function showGameResult(
    reason: GameResultReason,
    winner: Role | null,
    loser: Role | null,
  ) {
    if (gameResultRef.current) return;

    resultSequenceRef.current += 1;
    const rewardPoints =
      winner != null && winner === roleRef.current ? CHESS_WIN_POINTS : 0;
    if (rewardPoints > 0) awardCardGamePoints(rewardPoints);

    const nextResult = {
      id: resultSequenceRef.current,
      reason,
      winner,
      loser,
      rewardPoints,
    };
    gameResultRef.current = nextResult;
    setGameResult(nextResult);
    setNotice(null);
    setSelected(null);
    setLegalTargets([]);
    setDragging(null);
  }

  function clearGameResult() {
    gameResultRef.current = null;
    setGameResult(null);
  }

  function queueMoveAnimation(from: Square, to: Square, piece: PieceView) {
    if (moveTimerRef.current != null) {
      window.clearTimeout(moveTimerRef.current);
    }
    moveSequenceRef.current += 1;
    const nextAnimation = {
      id: moveSequenceRef.current,
      from,
      to,
      color: piece.color,
      type: piece.type,
    };
    setMoveAnimation(nextAnimation);
    moveTimerRef.current = window.setTimeout(() => {
      setMoveAnimation((current) =>
        current?.id === nextAnimation.id ? null : current,
      );
      moveTimerRef.current = null;
    }, MOVE_ANIMATION_MS);
  }

  function sendChatMessage(body: string) {
    const cleanBody = normalizeChatBody(body);
    const senderRole = roleRef.current;
    if (!cleanBody || connection !== "online" || !senderRole) return;

    const message: ChatMessage = {
      id: crypto.randomUUID(),
      playerId: getPlayerId(),
      role: senderRole,
      body: cleanBody,
      mine: true,
    };
    appendChatMessage(message);
    setChatDraft("");
    setChatMenu(null);
    send("chat", {
      id: message.id,
      playerId: message.playerId,
      role: message.role,
      body: message.body,
    });
  }

  useEffect(() => {
    const playerId = getPlayerId();
    const joinedAt = getJoinedAt();
    const channel = supabase.channel(CHESS_CHANNEL, {
      config: {
        broadcast: { ack: true, self: false },
        presence: { key: playerId },
      },
    });
    channelRef.current = channel;

    function claimSeat(nextRole: Role) {
      if (roleRef.current) return;
      const opponentRole = nextRole === "w" ? "b" : "w";
      const opponent = (
        Object.values(channel.presenceState()).flat() as ChessPresence[]
      ).find(
        (state) =>
          typeof state.playerId === "string" && state.role === opponentRole,
      );
      roleRef.current = nextRole;
      setRole(nextRole);
      setNotice(null);
      setOpponentReady(opponent != null);
      opponentIdRef.current =
        typeof opponent?.playerId === "string" ? opponent.playerId : null;
      void channel.track({
        playerId,
        role: nextRole,
        joinedAt,
      });
      if (nextRole === "b") {
        send("sync-request", { playerId });
      }
    }

    function assignAvailableSeat() {
      if (roleRef.current) return;
      const states = Object.values(
        channel.presenceState(),
      ).flat() as ChessPresence[];
      const occupied = new Set(
        states
          .filter((state) => state.playerId !== playerId)
          .map((state) => state.role)
          .filter((value): value is Role => value === "w" || value === "b"),
      );
      if (!occupied.has("w")) {
        claimSeat("w");
      } else if (!occupied.has("b")) {
        claimSeat("b");
      } else {
        setNotice("The board already has two players.");
      }
    }

    channel
      .on("presence", { event: "sync" }, () => {
        const states = Object.values(
          channel.presenceState(),
        ).flat() as ChessPresence[];
        const seated = states.filter(
          (state) =>
            typeof state.playerId === "string" &&
            (state.role === "w" || state.role === "b"),
        );

        if (roleRef.current) {
          const contenders = seated
            .filter((state) => state.role === roleRef.current)
            .sort((left, right) => {
              const leftJoined =
                typeof left.joinedAt === "number" ? left.joinedAt : 0;
              const rightJoined =
                typeof right.joinedAt === "number" ? right.joinedAt : 0;
              if (leftJoined !== rightJoined) return leftJoined - rightJoined;
              const leftId =
                typeof left.playerId === "string" ? left.playerId : "";
              const rightId =
                typeof right.playerId === "string" ? right.playerId : "";
              return leftId.localeCompare(rightId);
            });
          if (contenders[0]?.playerId !== playerId) {
            roleRef.current = null;
            setRole(null);
            setOpponentReady(false);
            void channel.track({
              playerId,
              role: null,
              joinedAt,
            });
          }
        }

        const opponents = states.filter(
          (state) =>
            typeof state.playerId === "string" && state.playerId !== playerId,
        );
        setOpponentReady(
          roleRef.current != null &&
            opponents.some(
              (state) => state.role === (roleRef.current === "w" ? "b" : "w"),
            ),
        );
        const opponent = opponents.find(
          (state) => state.role === (roleRef.current === "w" ? "b" : "w"),
        );
        opponentIdRef.current =
          typeof opponent?.playerId === "string" ? opponent.playerId : null;

        if (!roleRef.current && seatTimerRef.current == null) {
          const randomDelay =
            crypto.getRandomValues(new Uint16Array(1))[0] % 350;
          seatTimerRef.current = window.setTimeout(() => {
            seatTimerRef.current = null;
            assignAvailableSeat();
          }, 250 + randomDelay);
        }
      })
      .on("broadcast", { event: "seat" }, ({ payload }) => {
        if (
          roleRef.current !== "b" ||
          payload.playerId !== playerId ||
          typeof payload.fen !== "string"
        )
          return;
        clearGameResult();
        gameRef.current.load(payload.fen);
        setOpponentReady(true);
        setNotice(null);
        refreshBoard();
        const checkmateResult = getCheckmateResult(gameRef.current);
        if (checkmateResult) {
          showGameResult(
            checkmateResult.reason,
            checkmateResult.winner,
            checkmateResult.loser,
          );
        }
      })
      .on("broadcast", { event: "move" }, (message) => {
        const payload = readBroadcastPayload(message);
        if (payload.playerId === playerId) return;
        if (gameResultRef.current) return;
        if (typeof payload.from !== "string" || typeof payload.to !== "string")
          return;
        const from = payload.from as Square;
        const to = payload.to as Square;
        try {
          gameRef.current.move({
            from,
            to,
            promotion: "q",
          });
          const movedPiece = gameRef.current.get(to);
          if (movedPiece) queueMoveAnimation(from, to, movedPiece);
          refreshBoard();
          const checkmateResult = getCheckmateResult(gameRef.current);
          if (checkmateResult) {
            showGameResult(
              checkmateResult.reason,
              checkmateResult.winner,
              checkmateResult.loser,
            );
          }
        } catch {
          send("sync-request", { playerId });
        }
      })
      .on("broadcast", { event: "chat" }, (message) => {
        const payload = readBroadcastPayload(message);
        if (payload.playerId === playerId) return;
        if (
          typeof payload.playerId !== "string" ||
          typeof payload.body !== "string"
        )
          return;
        const body = normalizeChatBody(payload.body);
        if (!body) return;
        appendChatMessage({
          id:
            typeof payload.id === "string"
              ? payload.id
              : crypto.randomUUID(),
          playerId: payload.playerId,
          role: isRole(payload.role) ? payload.role : null,
          body,
          mine: false,
        });
      })
      .on("broadcast", { event: "sync-request" }, ({ payload }) => {
        if (roleRef.current !== "w" || typeof payload.playerId !== "string")
          return;
        send("seat", {
          playerId: payload.playerId,
          fen: gameRef.current.fen(),
        });
      })
      .on("broadcast", { event: "reset" }, () => {
        gameRef.current.reset();
        clearGameResult();
        setMoveAnimation(null);
        setNotice(null);
        refreshBoard();
      })
      .on("broadcast", { event: "resign" }, ({ payload }) => {
        if (payload.playerId === playerId) return;
        const winner = roleRef.current;
        const loser = isRole(payload.role)
          ? payload.role
          : winner
            ? getOppositeRole(winner)
            : null;
        showGameResult("forfeit", winner, loser);
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setConnection("online");
          void channel.track({
            playerId,
            role: null,
            joinedAt,
          });
          return;
        }
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setConnection("error");
        }
      });

    return () => {
      if (seatTimerRef.current != null) {
        window.clearTimeout(seatTimerRef.current);
      }
      if (moveTimerRef.current != null) {
        window.clearTimeout(moveTimerRef.current);
      }
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [supabase]);

  function getLegalTargets(square: Square): Square[] {
    return gameRef.current
      .moves({ square, verbose: true })
      .map((move) => move.to);
  }

  function movePiece(from: Square, to: Square): boolean {
    try {
      gameRef.current.move({ from, to, promotion: "q" });
      const movedPiece = gameRef.current.get(to);
      send("move", {
        playerId: playerIdRef.current,
        from,
        to,
      });
      if (movedPiece) queueMoveAnimation(from, to, movedPiece);
      refreshBoard();
      const checkmateResult = getCheckmateResult(gameRef.current);
      if (checkmateResult) {
        showGameResult(
          checkmateResult.reason,
          checkmateResult.winner,
          checkmateResult.loser,
        );
      }
      return true;
    } catch {
      return false;
    }
  }

  function chooseSquare(square: Square) {
    if (performance.now() < suppressClickUntilRef.current) {
      suppressClickUntilRef.current = 0;
      return;
    }

    const game = gameRef.current;
    if (
      !role ||
      !opponentReady ||
      gameResult ||
      game.isGameOver() ||
      game.turn() !== role
    )
      return;
    const piece = game.get(square);

    if (!selected) {
      if (piece?.color !== role) return;
      setSelected(square);
      setLegalTargets(getLegalTargets(square));
      return;
    }

    if (!movePiece(selected, square)) {
      if (piece?.color === role) {
        setSelected(square);
        setLegalTargets(getLegalTargets(square));
      } else {
        setSelected(null);
        setLegalTargets([]);
      }
    }
  }

  function beginDrag(square: Square) {
    const game = gameRef.current;
    const piece = game.get(square);
    if (
      !role ||
      !opponentReady ||
      gameResult ||
      game.isGameOver() ||
      game.turn() !== role ||
      piece?.color !== role
    ) {
      return;
    }

    setDragging(square);
    setSelected(square);
    setLegalTargets(getLegalTargets(square));
  }

  function finishDrag(clientX: number, clientY: number) {
    if (!dragging) return;
    const target = document
      .elementFromPoint(clientX, clientY)
      ?.closest<HTMLElement>("[data-chess-square]")
      ?.dataset.chessSquare as Square | undefined;

    if (target && target !== dragging) {
      suppressClickUntilRef.current = performance.now() + 350;
      if (!movePiece(dragging, target)) {
        setDragging(null);
      }
      return;
    }

    setDragging(null);
  }

  function resetGame() {
    gameRef.current.reset();
    clearGameResult();
    setMoveAnimation(null);
    setNotice(null);
    send("reset", { playerId: playerIdRef.current });
    refreshBoard();
  }

  function resign() {
    const loser = roleRef.current;
    if (!loser || !opponentReady || gameResult) return;
    const winner = getOppositeRole(loser);
    send("resign", { playerId: playerIdRef.current, role: loser });
    showGameResult("forfeit", winner, loser);
  }

  const files: readonly string[] = role !== "b" ? FILES : [...FILES].reverse();
  const ranks: readonly number[] = role !== "b" ? RANKS : [...RANKS].reverse();
  const canMove =
    role != null &&
    opponentReady &&
    gameView.turn === role &&
    gameResult == null &&
    !gameView.isGameOver;
  const canChat = connection === "online" && role != null;
  const resultText = gameResult ? getResultText(gameResult, role) : null;
  const statusText =
    resultText ?? notice ?? getGameStatus(gameView, role, opponentReady);
  const visibleChatMessages = [...chatMessages].reverse();
  let playerLabel = "—";
  if (role) playerLabel = getRoleName(role);
  let connectionLabel = "Connecting";
  let connectionClass = "text-stone-500";
  if (connection === "online") {
    connectionLabel = "Connected";
    connectionClass = "text-emerald-400";
  } else if (connection === "error") {
    connectionLabel = "Connection failed";
    connectionClass = "text-red-300";
  }
  const shellClass = compactLandscape
    ? "grid w-[min(calc(100vw-1.5rem),52rem)] grid-cols-[minmax(0,1fr)_12rem] grid-rows-[auto_minmax(0,1fr)] gap-x-3"
    : "flex w-fit max-w-full flex-col items-center justify-center";
  const statusClass = compactLandscape
    ? "col-start-1 row-start-1 mb-1 w-[min(calc(100dvh-5rem),calc(100vw-15rem),36rem)] justify-self-center"
    : "mb-2 w-[min(calc(100vw-1.5rem),36rem)] sm:w-[min(calc(100vw-2.5rem),36rem)]";
  const boardClass = compactLandscape
    ? "col-start-1 row-start-2 w-[min(calc(100dvh-5rem),calc(100vw-15rem),36rem)] justify-self-center"
    : "w-[min(calc(100vw-3rem),calc(100dvh-18rem),36rem)] sm:w-[min(calc(100vw-5rem),calc(100dvh-18.5rem),36rem)]";
  const sidePanelClass = compactLandscape
    ? "col-start-2 row-span-2 row-start-1 flex min-h-0 w-full flex-col justify-center gap-2"
    : "contents";
  const chatClass = compactLandscape
    ? "min-h-0 flex-1"
    : "mt-2 w-[min(calc(100vw-1.5rem),36rem)] sm:w-[min(calc(100vw-2.5rem),36rem)]";
  const footerClass = compactLandscape
    ? "mt-0 w-full flex-col items-stretch justify-center [&>div]:flex-col [&>div]:gap-1.5"
    : "mt-2 w-[min(calc(100vw-1.5rem),36rem)] sm:w-[min(calc(100vw-2.5rem),36rem)]";

  return (
    <section className="chess-game-scene chess-game-reveal fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto px-3 text-stone-100 sm:px-5">
      <div className={`chess-game-shell mx-auto ${shellClass}`}>
        <div
          className={`chess-game-status flex min-h-12 items-center justify-between gap-2 px-3 py-2 text-xs sm:text-sm ${statusClass}`}
        >
          <div className="min-w-0">
            <p
              aria-live="polite"
              className={`truncate ${canMove ? "text-[#ead9ae]" : "text-stone-400"}`}
            >
              {statusText}
            </p>
            <p className="mt-0.5 text-[10px] text-[#ebd9a8]/80 sm:text-xs">
              {playerLabel} ·{" "}
              <span className={connectionClass}>{connectionLabel}</span>
            </p>
          </div>
        </div>

        <div className={`chess-board-shell relative shrink-0 ${boardClass}`}>
          <div
            className="chess-board-grid grid aspect-square w-full touch-none grid-cols-8 grid-rows-[repeat(8,minmax(0,1fr))]"
            role="grid"
            aria-label="Chess board"
            onPointerUp={(event) => finishDrag(event.clientX, event.clientY)}
            onPointerCancel={() => setDragging(null)}
          >
            {ranks.flatMap((rank, rankIndex) =>
              files.map((file, fileIndex) => {
                const square = `${file}${rank}` as Square;
                const piece = gameView.pieces[square];
                const dark = (rankIndex + fileIndex) % 2 === 1;
                const target = legalTargets.includes(square);
                let pieceStyle: CSSProperties | undefined;
                let pieceClassName =
                  "chess-piece-image pointer-events-none select-none object-contain p-[5%] drop-shadow-[0_2px_2px_rgba(0,0,0,0.55)]";

                if (
                  piece &&
                  moveAnimation?.to === square &&
                  moveAnimation.color === piece.color &&
                  moveAnimation.type === piece.type
                ) {
                  const fromFileIndex = files.indexOf(moveAnimation.from[0]);
                  const fromRankIndex = ranks.indexOf(
                    Number(moveAnimation.from[1]),
                  );
                  if (fromFileIndex >= 0 && fromRankIndex >= 0) {
                    pieceStyle = {
                      "--chess-move-x": `${(fromFileIndex - fileIndex) * 100}%`,
                      "--chess-move-y": `${(fromRankIndex - rankIndex) * 100}%`,
                    } as CSSProperties;
                    pieceClassName += " chess-piece-moving";
                  }
                }

                return (
                  <button
                    key={square}
                    type="button"
                    role="gridcell"
                    data-chess-square={square}
                    aria-label={getSquareLabel(square, piece)}
                    aria-selected={selected === square}
                    onClick={() => chooseSquare(square)}
                    onPointerDown={(event) => {
                      if (event.button !== 0) return;
                      beginDrag(square);
                    }}
                    className={`chess-square relative grid h-full min-h-0 w-full min-w-0 place-items-center overflow-hidden leading-none transition ${dark ? "chess-square-dark" : "chess-square-light"} ${selected === square ? "ring-4 ring-inset ring-[#ffdc62]" : ""} ${dragging === square ? "cursor-grabbing" : piece?.color === role && canMove ? "cursor-grab" : "cursor-default"}`}
                  >
                    {target && (
                      <span
                        aria-hidden
                        className={`absolute h-[28%] w-[28%] rounded-full ${piece ? "border-4 border-[#e6c36c]/75" : "bg-[#e6c36c]/55"}`}
                      />
                    )}
                    {piece && (
                      <Image
                        src={PIECE_IMAGES[piece.color][piece.type]}
                        alt=""
                        fill
                        draggable={false}
                        sizes="(max-width: 640px) 12vw, 72px"
                        style={pieceStyle}
                        className={pieceClassName}
                      />
                    )}
                  </button>
                );
              }),
            )}
          </div>
        </div>

        <div className={sidePanelClass}>
          <section
            className={`chess-chat-panel flex flex-col overflow-hidden ${chatClass}`}
            aria-label="Match chat"
          >
            <div className="flex items-center justify-between gap-2 px-2.5 pt-2">
              <p className="text-[10px] font-bold uppercase text-[#ffe29a]">
                Chat
              </p>
              <p className="text-[10px] text-cyan-100/45">
                {chatMessages.length}/{CHAT_MAX_MESSAGES}
              </p>
            </div>

            <div
              ref={chatLogRef}
              className="chess-chat-log flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-2 py-1.5"
              aria-live="polite"
            >
              {chatMessages.length === 0 ? (
                <p className="chess-chat-empty grid flex-1 place-items-center text-center text-[11px]">
                  No messages yet
                </p>
              ) : (
                visibleChatMessages.map((message) => {
                  return (
                    <article
                      key={message.id}
                      className={`chess-chat-message ${message.mine ? "chess-chat-message-self" : ""}`}
                    >
                      <p className="chess-chat-author">
                        {message.mine ? "You" : getRoleName(message.role)}
                      </p>
                      <p>{message.body}</p>
                    </article>
                  );
                })
              )}
            </div>

            <form
              className="chess-chat-form relative flex items-center gap-1 px-2 pb-2"
              onSubmit={(event) => {
                event.preventDefault();
                sendChatMessage(chatDraft);
              }}
            >
              {chatMenu && (
                <div
                  className={`chess-chat-menu absolute bottom-[calc(100%+0.35rem)] right-2 z-10 grid gap-1 p-1.5 ${chatMenu === "messages" ? "chess-chat-menu-messages grid-cols-2" : "chess-chat-menu-emojis grid-cols-6"}`}
                >
                  {chatMenu === "messages"
                    ? QUICK_CHAT_MESSAGES.map((message) => (
                        <button
                          key={message}
                          type="button"
                          disabled={!canChat}
                          title={message}
                          onClick={() => sendChatMessage(message)}
                          className="truncate px-2 py-1.5 text-[10px] font-semibold transition disabled:opacity-30"
                        >
                          {message}
                        </button>
                      ))
                    : QUICK_CHAT_EMOJIS.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          disabled={!canChat}
                          aria-label={`Send ${emoji} emoji`}
                          title={`Send ${emoji}`}
                          onClick={() => sendChatMessage(emoji)}
                          className="grid h-8 place-items-center text-sm transition disabled:opacity-30"
                        >
                          {emoji}
                        </button>
                      ))}
                </div>
              )}
              <input
                type="text"
                value={chatDraft}
                maxLength={CHAT_MAX_LENGTH}
                disabled={!canChat}
                aria-label="Chat message"
                placeholder={canChat ? "Message" : "Waiting"}
                onFocus={() => setChatMenu(null)}
                onChange={(event) =>
                  setChatDraft(event.target.value.slice(0, CHAT_MAX_LENGTH))
                }
                className="min-w-0 flex-1 px-2 py-1.5 text-xs outline-none disabled:opacity-40"
              />
              <button
                type="button"
                disabled={!canChat}
                aria-label="Show quick messages"
                aria-expanded={chatMenu === "messages"}
                title="Quick messages"
                onClick={() =>
                  setChatMenu((current) =>
                    current === "messages" ? null : "messages",
                  )
                }
                className="chess-chat-tool-button grid h-8 w-8 shrink-0 place-items-center transition disabled:opacity-30"
              >
                <SparklesIcon className="h-4 w-4" />
              </button>
              <button
                type="button"
                disabled={!canChat}
                aria-label="Show quick emojis"
                aria-expanded={chatMenu === "emojis"}
                title="Quick emojis"
                onClick={() =>
                  setChatMenu((current) =>
                    current === "emojis" ? null : "emojis",
                  )
                }
                className="chess-chat-tool-button grid h-8 w-8 shrink-0 place-items-center text-sm transition disabled:opacity-30"
              >
                <span aria-hidden>☺</span>
              </button>
              <button
                type="submit"
                disabled={!canChat || normalizeChatBody(chatDraft).length === 0}
                aria-label="Send chat message"
                title="Send message"
                className="chess-chat-send grid h-8 w-8 shrink-0 place-items-center transition disabled:opacity-30"
              >
                <SendIcon className="h-4 w-4" />
              </button>
            </form>
          </section>

          <footer
            className={`chess-game-footer flex items-center justify-between gap-1 sm:gap-2 ${footerClass}`}
          >
            <button
              type="button"
              onClick={onExit}
              className="chess-leave-button whitespace-nowrap px-1.5 py-2 text-[11px] sm:px-3 sm:text-sm"
            >
              <span aria-hidden>↪</span> Leave room
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setGalleryOpen(true)}
                className="chess-action-button inline-flex items-center justify-center gap-1.5 whitespace-nowrap px-2 py-2 text-[11px] transition sm:px-3 sm:text-sm"
              >
                <SearchIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                Pieces
              </button>
              <button
                type="button"
                onClick={resign}
                disabled={
                  !opponentReady || gameView.isGameOver || gameResult != null
                }
                className="chess-action-button whitespace-nowrap px-2 py-2 text-[11px] transition disabled:opacity-30 sm:px-4 sm:text-sm"
              >
                Resign
              </button>
              <button
                type="button"
                onClick={resetGame}
                disabled={!opponentReady}
                className="chess-action-button chess-action-primary whitespace-nowrap px-2 py-2 text-[11px] transition disabled:opacity-30 sm:px-4 sm:text-sm"
              >
                New match
              </button>
            </div>
          </footer>
        </div>
      </div>
      {gameResult && (
        <div
          key={gameResult.id}
          className="chess-winner-animation pointer-events-none absolute inset-0 z-[2] grid place-items-center px-4"
          aria-live="assertive"
        >
          <div className="chess-winner-card flex flex-col items-center text-center">
            <SparklesIcon className="h-8 w-8" />
            <p>{resultText}</p>
            <span>
              {gameResult.reason === "checkmate" ? "Checkmate" : "Forfeit"}
            </span>
            {gameResult.rewardPoints > 0 && (
              <strong className="mt-2 rounded-full border border-yellow-200/40 bg-yellow-200/15 px-3 py-1 text-sm font-black text-yellow-100">
                +{gameResult.rewardPoints} points
              </strong>
            )}
          </div>
        </div>
      )}
      {galleryOpen && <PieceGallery onClose={() => setGalleryOpen(false)} />}
    </section>
  );
}
