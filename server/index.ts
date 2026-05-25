import { createApp, log } from "./app";

(async () => {
  const { httpServer } = await createApp();

  const port = parseInt(process.env.PORT || "5000", 10);
  const host = process.env.REPL_ID ? "0.0.0.0" : "localhost";
  httpServer.listen(
    {
      port,
      host,
    },
    () => {
      log(`serving on ${host}:${port}`);
    },
  );
})();
