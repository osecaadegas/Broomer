"use client";

import Image from "next/image";
import { useEffect, useReducer, useRef, useState } from "react";
import { Chess, type Color, type PieceSymbol, type Square } from "chess.js";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

interface Props {
  onExit: () => void;
}

type Role = "w" | "b";

interface ChessPresence {
  presence_ref: string;
  playerId?: unknown;
  role?: unknown;
  joinedAt?: unknown;
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
const CHESS_CHANNEL = "broomer-chess:single-table";

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

function getGameStatus(game: Chess, role: Role | null, ready: boolean): string {
  if (!role) return "Finding your seat";
  if (!ready) return role === "w" ? "Waiting for Black" : "Waiting for White";
  if (game.isCheckmate()) {
    return `${game.turn() === "w" ? "Black" : "White"} wins by checkmate`;
  }
  if (game.isDraw()) return "Draw";
  const turn = game.turn() === "w" ? "White" : "Black";
  return game.inCheck() ? `${turn} is in check` : `${turn} to move`;
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
  const [role, setRole] = useState<Role | null>(null);
  const [connection, setConnection] = useState<
    "connecting" | "online" | "error"
  >("connecting");
  const [opponentReady, setOpponentReady] = useState(false);
  const [selected, setSelected] = useState<Square | null>(null);
  const [legalTargets, setLegalTargets] = useState<Square[]>([]);
  const [, forceBoardRender] = useReducer((revision) => revision + 1, 0);
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
  const playerIdRef = useRef(crypto.randomUUID());
  const joinedAtRef = useRef(Date.now());
  const roleRef = useRef<Role | null>(null);
  const seatTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const media = window.matchMedia(
      "(orientation: landscape) and (max-height: 500px)",
    );
    const updateLayout = () => setCompactLandscape(media.matches);
    media.addEventListener("change", updateLayout);
    return () => media.removeEventListener("change", updateLayout);
  }, []);

  function refreshBoard() {
    setSelected(null);
    setLegalTargets([]);
    forceBoardRender();
  }

  function send(event: string, payload: Record<string, unknown>) {
    void channelRef.current?.send({ type: "broadcast", event, payload });
  }

  useEffect(() => {
    const playerId = playerIdRef.current;
    const channel = supabase.channel(CHESS_CHANNEL, {
      config: {
        broadcast: { ack: true, self: false },
        presence: { key: playerId },
      },
    });
    channelRef.current = channel;

    function claimSeat(nextRole: Role) {
      if (roleRef.current) return;
      roleRef.current = nextRole;
      setRole(nextRole);
      void channel.track({
        playerId,
        role: nextRole,
        joinedAt: joinedAtRef.current,
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
              joinedAt: joinedAtRef.current,
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
        gameRef.current.load(payload.fen);
        setOpponentReady(true);
        setNotice(null);
        refreshBoard();
      })
      .on("broadcast", { event: "move" }, (message) => {
        const payload = readBroadcastPayload(message);
        if (payload.playerId === playerId) return;
        if (typeof payload.from !== "string" || typeof payload.to !== "string")
          return;
        try {
          gameRef.current.move({
            from: payload.from,
            to: payload.to,
            promotion: "q",
          });
          refreshBoard();
        } catch {
          send("sync-request", { playerId });
        }
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
        setNotice(null);
        refreshBoard();
      })
      .on("broadcast", { event: "resign" }, ({ payload }) => {
        if (payload.playerId === playerId) return;
        setNotice("Your opponent resigned. You win.");
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setConnection("online");
          void channel.track({
            playerId,
            role: null,
            joinedAt: joinedAtRef.current,
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
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [supabase]);

  function chooseSquare(square: Square) {
    const game = gameRef.current;
    if (!role || !opponentReady || game.isGameOver() || game.turn() !== role)
      return;
    const piece = game.get(square);

    if (!selected) {
      if (piece?.color !== role) return;
      setSelected(square);
      setLegalTargets(
        game.moves({ square, verbose: true }).map((move) => move.to),
      );
      return;
    }

    try {
      game.move({ from: selected, to: square, promotion: "q" });
      send("move", {
        playerId: playerIdRef.current,
        from: selected,
        to: square,
      });
      refreshBoard();
    } catch {
      if (piece?.color === role) {
        setSelected(square);
        setLegalTargets(
          game.moves({ square, verbose: true }).map((move) => move.to),
        );
      } else {
        setSelected(null);
        setLegalTargets([]);
      }
    }
  }

  function resetGame() {
    gameRef.current.reset();
    setNotice(null);
    send("reset", { playerId: playerIdRef.current });
    refreshBoard();
  }

  function resign() {
    send("resign", { playerId: playerIdRef.current });
    setNotice("You resigned.");
  }

  const game = gameRef.current;
  const files = role !== "b" ? FILES : [...FILES].reverse();
  const ranks = role !== "b" ? RANKS : [...RANKS].reverse();
  const canMove =
    role != null && opponentReady && game.turn() === role && !game.isGameOver();
  let playerLabel = "—";
  if (role === "w") playerLabel = "White";
  if (role === "b") playerLabel = "Black";
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
    ? "grid w-[min(calc(100vw-1.5rem),43rem)] grid-cols-[minmax(0,1fr)_7rem] grid-rows-[auto_minmax(0,1fr)] gap-x-3"
    : "flex w-full flex-col items-center justify-center";
  const statusClass = compactLandscape
    ? "col-start-1 row-start-1 mb-1 w-[min(calc(100dvh-5rem),calc(100vw-9rem),36rem)] justify-self-center"
    : "mb-2 w-[min(calc(100vw-1.5rem),36rem)] sm:w-[min(calc(100vw-2.5rem),36rem)]";
  const boardClass = compactLandscape
    ? "col-start-1 row-start-2 w-[min(calc(100dvh-5rem),calc(100vw-9rem),36rem)] justify-self-center"
    : "w-[min(calc(100vw-1.5rem),calc(100dvh-7.5rem),36rem)] sm:w-[min(calc(100vw-2.5rem),calc(100dvh-8rem),36rem)]";
  const footerClass = compactLandscape
    ? "col-start-2 row-span-2 row-start-1 mt-0 w-auto flex-col items-stretch justify-center [&>div]:flex-col [&>div]:gap-1.5"
    : "mt-2 w-[min(calc(100vw-1.5rem),36rem)] sm:w-[min(calc(100vw-2.5rem),36rem)]";

  return (
    <section className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-[#07050a] px-3 text-stone-100 sm:px-5">
      <div className={`chess-game-shell mx-auto ${shellClass}`}>
        <div
          className={`chess-game-status flex min-h-9 items-center justify-between gap-2 border-y border-white/10 py-1.5 text-xs sm:text-sm ${statusClass}`}
        >
          <div className="min-w-0">
            <p
              className={`truncate ${canMove ? "text-[#ead9ae]" : "text-stone-400"}`}
            >
              {notice ?? getGameStatus(game, role, opponentReady)}
            </p>
            <p className="mt-0.5 text-[10px] text-stone-600 sm:text-xs">
              {playerLabel} ·{" "}
              <span className={connectionClass}>{connectionLabel}</span>
            </p>
          </div>
        </div>

        <div className={`chess-board-shell relative shrink-0 ${boardClass}`}>
          <div
            className="grid aspect-square w-full grid-cols-8 grid-rows-[repeat(8,minmax(0,1fr))] border border-[#c9a84c]/35 shadow-[0_1.5rem_5rem_rgba(0,0,0,0.65)]"
            role="grid"
            aria-label="Chess board"
          >
            {ranks.flatMap((rank, rankIndex) =>
              files.map((file, fileIndex) => {
                const square = `${file}${rank}` as Square;
                const piece = game.get(square);
                const dark = (rankIndex + fileIndex) % 2 === 1;
                const target = legalTargets.includes(square);
                return (
                  <button
                    key={square}
                    type="button"
                    role="gridcell"
                    aria-label={getSquareLabel(square, piece)}
                    aria-selected={selected === square}
                    onClick={() => chooseSquare(square)}
                    className={`relative grid h-full min-h-0 w-full min-w-0 place-items-center overflow-hidden leading-none transition ${dark ? "bg-[#3a2632]" : "bg-[#bfae8e]"} ${selected === square ? "ring-4 ring-inset ring-[#e6c36c]" : ""}`}
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
                        className="pointer-events-none select-none object-contain p-[5%] drop-shadow-[0_2px_2px_rgba(0,0,0,0.55)]"
                      />
                    )}
                  </button>
                );
              }),
            )}
          </div>
        </div>

        <footer
          className={`chess-game-footer flex items-center justify-between gap-2 ${footerClass}`}
        >
          <button
            type="button"
            onClick={onExit}
            className="px-3 py-2 text-sm text-stone-500 hover:text-stone-200"
          >
            Leave room
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={resign}
              disabled={!opponentReady || game.isGameOver()}
              className="border border-white/10 px-3 py-2 text-sm text-stone-400 transition hover:border-red-700/50 hover:text-red-300 disabled:opacity-30"
            >
              Resign
            </button>
            <button
              type="button"
              onClick={resetGame}
              disabled={!opponentReady}
              className="border border-[#c9a84c]/30 px-3 py-2 text-sm text-[#d7bd7e] transition hover:border-[#c9a84c]/60 disabled:opacity-30"
            >
              New match
            </button>
          </div>
        </footer>
      </div>
    </section>
  );
}
