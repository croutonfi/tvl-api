import type { TokenType } from "./wrappers";

export type JettonMetadata = {
	symbol: string;
	name: string;
	decimals: number;
	logoURI: string;
};

export type PoolToken = {
	type: TokenType;
	address: string;
	usdPrice: number;
	reserve: string;
	metadata: JettonMetadata;
};

export type StablePool = {
	name: string;
	address: string;
	factory: string;

	/* parameters */
	A: string;
	fee: string;
	devFee: string;
	totalSupply: string;
	tvlUsd: number;

	lpMetadata: JettonMetadata;

	assets: PoolToken[];
};
