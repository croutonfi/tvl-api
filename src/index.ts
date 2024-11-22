import { serve } from "@hono/node-server";

import { config } from "./config";
import { createApp } from "./rest";

async function main() {
	const app = createApp();

	serve(
		{
			fetch: app.fetch,
			port: config.PORT,
		},
		(ai) => {
			console.log(`Server running at ${ai.port}`);
		}
	);
}

main();
