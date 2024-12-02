import { Address } from "@ton/core";
import pMemoize from "p-memoize";
import ExpiryMap from "expiry-map";

import { config } from "./config";
import { rpcClient, scanAllLPHolders } from "./ton";
import { getAllDedustAssets } from "./dedust";
import {
	Pool,
	deserealizeAssetsFromCell,
} from "./wrappers";

import type { StablePool } from "./types";
import BigNumber from "bignumber.js";

export const POOLS = [
	{
		name: "3TON",
		address: config.TRITON_ADDRESS,
	},
	{
		name: "AquaUSD/USDT",
		address: config.AQUAUSD_USDT_ADDRESS,
	},
	{
		name: "DONE/USDT",
		address: config.DONE_USDT_ADDRESS,
	}
];

export const LP_METADATA = {
	symbol: "crtLP",
	name: "Crouton LP",
	decimals: 18,
	logoURI: "https://croutonfi.ams3.digitaloceanspaces.com/crouton.jpg",
};

export async function getAvailablePools(): Promise<StablePool[]> {
	return Promise.all(
		POOLS.map(async ({ name, address }) => {
			const poolData = await getPoolInfoByAddress(address);

			return {
				name,
				lpMetadata: LP_METADATA,
				...poolData,
			};
		})
	);
}

export async function getTvlByUsers() {
	const pools = await getAvailablePools();

	let totalTvl = 0;
	let users = new Map<string, string>();

	for (const pool of pools) {
		totalTvl += pool.tvlUsd;

		const lpHolders = await scanAllLPHolders(pool.address);

		for (const holder of lpHolders) {
			const balance = new BigNumber(holder.balance);
			const userTvl = balance.times(pool.tvlUsd).dividedBy(pool.totalSupply);
			const previousTvl = users.get(holder.owner) || 0;

			users.set(holder.owner, userTvl.plus(previousTvl).toFixed());
		}
	}

	return {
		totalTvl,
		users: Array.from(users.entries()).map(([address, tvlUsd]) => ({ address, tvlUsd })),
	}
}

export async function getAvailableAssets() {
	const pools = await getAvailablePools();
	const allPoolAssets = pools.flatMap((pool) => pool.assets);

	const alreadyAdded = new Set<string>();
	const uniquePoolAssets = allPoolAssets.filter((asset) => {
		if (alreadyAdded.has(asset.address)) {
			return false;
		}

		alreadyAdded.add(asset.address);

		return true;
	});

	return Promise.resolve(uniquePoolAssets);
}

const getPoolData = pMemoize(
	async (poolAddress: string) => {
		const pool = rpcClient.open(
			Pool.createFromAddress(Address.parse(poolAddress))
		);

		const poolData = await pool.getPoolData();

		return poolData;
	},
	{ cache: new ExpiryMap(3_000) }
);


export const getPoolInfoByAddress = pMemoize(
	async (poolAddress: string) => {
		const {
			factoryAddress,
			assets: serializedAssets,
			A,
			fee,
			adminFee,
			totalSupply,
		} = await getPoolData(poolAddress);

		const deserializedAssets = deserealizeAssetsFromCell(serializedAssets);
		const assets = await Promise.all(
			deserializedAssets.map(async ({ token, balance }) => {
				const address = token.jettonMasterAddress?.toString() || "";
				const metadata = await getJettonMetadata(address);

				return {
					address,
					type: token.type,
					reserve: balance.toString(),
					usdPrice: await getAssetUsdPrice(metadata.symbol), // @todo add actual price fetching here
					metadata,
				};
			})
		);

		const precisionMultiplier = 10000n;
		const tvlUsd = assets.reduce(
			(acc, { usdPrice, reserve, metadata: { decimals } }) =>
				acc +
				(usdPrice *
					Number(
						(BigInt(reserve) * precisionMultiplier) / 10n ** BigInt(decimals)
					)) /
				Number(precisionMultiplier),
			0
		);

		return {
			address: poolAddress,
			factory: factoryAddress.toString(),
			A: A.toString(),
			fee: fee.toString(),
			devFee: adminFee.toString(),
			tvlUsd,
			totalSupply: totalSupply.toString(),
			assets,
		};
	},
	{ cache: new ExpiryMap(60_000) }
);

export const getAssetUsdPrice = async (assetSymbol: string) => {
	const { assets } = await getAllDedustAssets();
	const asset = assets.find((asset) => asset.symbol === assetSymbol);

	return parseFloat(asset?.price || "0");
};

export const getJettonMetadata = async (jettonAddress: string) => {
	switch (jettonAddress) {
		case "":
			return {
				symbol: "TON",
				name: "TON",
				decimals: 9,
				logoURI: "https://cryptologos.cc/logos/toncoin-ton-logo.png",
			};
		case "EQC98_qAmNEptUtPc7W6xdHh_ZHrBUFpw5Ft_IzNU20QAJav":
		case "EQAcXau46xjqpiflTVsZ61a06RHQoTDDbCEF-6mHdtVRv08D": // testnet testjetton
			return {
				symbol: "tsTON",
				name: "Tonstakers TON",
				decimals: 9,
				logoURI:
					"https://cache.tonapi.io/imgproxy/GjhSro_E6Qxod2SDQeDhJA_F3yARNomyZFKeKw8TVOU/rs:fill:200:200:1/g:no/aHR0cHM6Ly90b25zdGFrZXJzLmNvbS9qZXR0b24vbG9nby5zdmc.webp",
			};
		case "EQDGNSUaHLY6K7xyuaiLvE86AO1PUOR4da2umd0prbgW2oVq":
			return {
				symbol: "crTON",
				name: "Crouton TON",
				decimals: 9,
				logoURI: "https://croutonfi.ams3.digitaloceanspaces.com/crouton.jpg",
			};
		case "EQDNhy-nxYFgUqzfUzImBEP67JqsyMIcyk2S5_RwNNEYku0k":
		case "EQDsTIJp02xtWPYYpiX6iRkkB9FB5myqJq4I6UWMv4tK94Gb": // testnet testjetton
			return {
				symbol: "stTON",
				name: "Staked TON",
				decimals: 9,
				logoURI:
					"https://cache.tonapi.io/imgproxy/BBswWn_XyuF6aNntVmh-yXANFKQ_PkUpt30z-kotVvg/rs:fill:200:200:1/g:no/aHR0cHM6Ly9zdG9yYWdlLmdvb2dsZWFwaXMuY29tL21pbGtjcmVlay90b2tlbnMvc3RUT04ucG5n.webp",
			};
		case "EQAWDyxARSl3ol2G1RMLMwepr3v6Ter5ls3jiAlheKshgg0K":
			return {
				name: "AquaUSD",
				symbol: "AquaUSD",
				decimals: 6,
				logoURI: "https://cache.tonapi.io/imgproxy/ya8_uDrmedWuCUiYk6Tr5ZjkUSCmRCTsySyefHoFQQs/rs:fill:200:200:1/g:no/aHR0cHM6Ly9hcHAuYXF1YXByb3RvY29sLnh5ei9hc3NldHMvYXF1YXVzZC1pY29uLnBuZw.webp",
			};
		case "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs":
			return {
				name: "Tether USD",
				symbol: "USDT",
				decimals: 6,
				logoURI: "https://cache.tonapi.io/imgproxy/T3PB4s7oprNVaJkwqbGg54nexKE0zzKhcrPv8jcWYzU/rs:fill:200:200:1/g:no/aHR0cHM6Ly90ZXRoZXIudG8vaW1hZ2VzL2xvZ29DaXJjbGUucG5n.webp",
			};
		case "EQCgGUMB_u1Gkrskw2o407Ig8ymQmfkxWuPW2d4INuQoPFJO":
			return {
				name: "D-ONE",
				symbol: "DONE",
				decimals: 9,
				logoURI: "https://cache.tonapi.io/imgproxy/p0jkHDBb3CSRWmoiljIiHka-08W9Xbd8A6u2ng9GE64/rs:fill:200:200:1/g:no/aHR0cHM6Ly9jZG4uZGVsZWEuZmluYW5jZS9kb25lLnBuZw.webp",
			};

		default:
			throw new Error(`Unknown jetton address: ${jettonAddress}`);
	}
};

