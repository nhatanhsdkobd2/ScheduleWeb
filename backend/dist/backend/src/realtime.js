import { Server } from "socket.io";
let io = null;
export function attachSocketIo(httpServer, corsOrigin) {
    io = new Server(httpServer, {
        path: "/socket.io",
        cors: {
            origin: corsOrigin === true ? true : corsOrigin,
            methods: ["GET", "POST"],
        },
    });
    return io;
}
export function emitEntityUpdated(payload) {
    io?.emit("entity:updated", payload);
}
