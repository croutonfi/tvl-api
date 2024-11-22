import { Address, Builder, Cell, Slice, type ContractProvider, type Contract } from '@ton/core'

export enum TokenType {
	Jetton = 0,
	Native = 1,
}

export type Token = {
	type: TokenType;
	jettonMasterAddress?: Address;
};

export type Asset = {
	token: Token;
	precision: bigint;
	balance: bigint;
	adminFees: bigint;
};

export const storeNativeToken = (builder: Builder) => {
	return builder.storeUint(TokenType.Native, 2);
};

export const storeJettonToken =
	(jettonMasterAddress: Address) => (builder: Builder) => {
		return builder
			.storeUint(TokenType.Jetton, 2)
			.storeAddress(jettonMasterAddress);
	};

export const storeToken = (token: Token) => (builder: Builder) => {
	if (token.type === TokenType.Jetton) {
		return storeJettonToken(token.jettonMasterAddress!)(builder);
	} else if (token.type === TokenType.Native) {
		return storeNativeToken(builder);
	}

	throw new Error('Invalid token type');
};

export const loadToken = (slice: Slice): Token => {
	const tokenType = slice.loadUint(2);

	if (tokenType === TokenType.Jetton) {
		return {
			type: TokenType.Jetton,
			jettonMasterAddress: slice.loadAddress(),
		};
	} else if (tokenType === TokenType.Native) {
		return {
			type: TokenType.Native,
		};
	}

	throw new Error('Invalid token type');
};

export function deserealizeAssetsFromCell(assets: Cell): Asset[] {
	const result: Asset[] = [];
	let next: Cell | null = assets;

	while (next !== null) {
		const slice = next.beginParse();

		result.push({
			token: loadToken(slice),
			precision: slice.loadCoins(),
			balance: slice.loadCoins(),
			adminFees: slice.loadCoins(),
		});

		next = slice.loadMaybeRef();
	}

	return result;
}

export class Pool implements Contract {
	constructor(public address: Address, public code?: Cell) { }

	static createFromAddress(address: Address) {
		return new Pool(address);
	}

	async getPoolData(provider: ContractProvider) {
		const result = await provider.get('get_pool_data', []);

		return {
			factoryAddress: result.stack.readAddress(),
			contractType: result.stack.readNumber(),
			assets: result.stack.readCell(),
			rates: result.stack.readCell(),
			A: result.stack.readBigNumber(),
			fee: result.stack.readBigNumber(),
			adminFee: result.stack.readBigNumber(),
			totalSupply: result.stack.readBigNumber(),
			ratesManager: result.stack.readAddress(),
		} as const;
	}
}
