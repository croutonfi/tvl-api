import { Hono } from "hono";
import { logger } from "hono/logger";
import { cors } from "hono/cors";

import {
	getAvailableAssets,
	getAvailablePools,
	getTvlByUsers,
} from "./pools";

export function createApp() {
	const app = new Hono();

	app.use(cors());
	app.use(logger());

	app.get("/", (c) => c.text("ok"));

	app.get("/assets", async (c) => {
		const assets = await getAvailableAssets();

		return c.json(assets);
	});

	app.get("/tvl/pools", async (c) => {
		const pools = await getAvailablePools();

		return c.json(pools);
	});

	app.get("/tvl/users", async (c) => {
		const pools = await getTvlByUsers();

		return c.json(pools);
	});

	return app;
}
