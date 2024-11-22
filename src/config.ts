import { z } from "zod";
import { loadConfig } from "zod-config";
import { dotEnvAdapter } from "zod-config/dotenv-adapter";
import { envAdapter } from "zod-config/env-adapter";

const schemaConfig = z.object({
	PORT: z.coerce.number(),
	RPC_URL: z
		.string(),
	TON_V4_API_URL: z
		.string(),
	TRITON_ADDRESS: z
		.string()
		.default("EQB7Orui1z_dKONoHuglvi2bMUpmD4fw0Z4C2gewD2FP0BpL"),
});

export const config = await loadConfig({
	schema: schemaConfig,
	adapters: [dotEnvAdapter({ path: ".env", silent: true }), envAdapter()],
});
