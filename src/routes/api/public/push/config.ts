import { createFileRoute } from "@tanstack/react-router";

/** Public: exposes the VAPID public key the browser needs to subscribe. */
export const Route = createFileRoute("/api/public/push/config")({
  server: {
    handlers: {
      GET: async () => {
        const publicKey = process.env["VAPID_PUBLIC_KEY"] ?? null;
        return Response.json(
          { enabled: Boolean(publicKey), publicKey },
          { headers: { "cache-control": "public, max-age=300" } },
        );
      },
    },
  },
});
