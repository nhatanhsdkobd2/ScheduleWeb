import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";

export type EntityUpdatedPayload =
  | { type: "tasks"; taskIds: string[] }
  | { type: "members" }
  | { type: "projects" };

let io: Server | null = null;

export function attachSocketIo(
  httpServer: HttpServer,
  corsOrigin: boolean | string | string[],
): Server {
  io = new Server(httpServer, {
    path: "/socket.io",
    cors: {
      origin: corsOrigin === true ? true : corsOrigin,
      methods: ["GET", "POST"],
    },
  });
  return io;
}

export function emitEntityUpdated(payload: EntityUpdatedPayload): void {
  io?.emit("entity:updated", payload);
}
