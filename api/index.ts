import { createApp } from "../server/app.js";

let appPromise: ReturnType<typeof createApp> | null = null;

async function getApp() {
  if (!appPromise) {
    appPromise = createApp({ serverless: true });
  }
  return appPromise;
}

export default async function handler(req: any, res: any) {
  const { app } = await getApp();
  return app(req, res);
}