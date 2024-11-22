import { z } from "zod";
import { config } from "./config";

import { TonClient4 } from "@ton/ton";
import { request } from "undici";
import pMemoize from "p-memoize";
import ExpiryMap from "expiry-map";

export const rpcClient = new TonClient4({
	endpoint: config.TON_V4_API_URL,
	timeout: 10000,
});

const jettonBalanceResponseSchema = z.object({
	jetton_wallets: z.array(
		z.object({
			address: z.string(),
			balance: z.string(),
			owner: z.string(),
			jetton: z.string(),
			last_transaction_lt: z.string(),
		})
	),
});

export const getLPHolders = async (
	poolAddress: string,
	limit = 1000,
	offset = 0
) => {
	const params = new URLSearchParams({
		jetton_address: poolAddress,
		exclude_zero_balance: "false",
		limit: limit.toString(),
		offset: offset.toString(),
	});

	const { body } = await request(
		`${config.RPC_URL}/v3/jetton/wallets?${params.toString()}`,
		{
			method: "GET"
		}
	);

	const bodyRaw = await body.json();
	const response = jettonBalanceResponseSchema.safeParse(bodyRaw);

	if (!response.success || !response.data) {
		throw new Error(
			`Failed to parse response while fetching LP holders wallets: ${bodyRaw}`
		);
	}

	return response.data.jetton_wallets;
};

export const scanAllLPHolders = pMemoize(async (poolAddress: string) => {
	let limit = 1000;
	let offset = 0;
	let holders: Awaited<ReturnType<typeof getLPHolders>> = [];

	while (true) {
		const data = await getLPHolders(poolAddress, limit, offset);

		if (data.length === 0) {
			break;
		}

		holders = holders.concat(data);
		offset += limit;
	}

	return holders;
}, {
	cache: new ExpiryMap(60_000),
});

