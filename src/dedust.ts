import ExpiryMap from "expiry-map";
import pMemoize from "p-memoize";
import { request } from "undici";

const fetchDedustV3Api = async <Response = unknown, Vars = unknown>(
	operationName: string,
	query: string,
	variables: Vars
): Promise<Response> => {
	const url = "https://api.dedust.io/v3/graphql";
	const response = await request(url, {
		method: "POST",
		body: JSON.stringify({
			operationName,
			query,
			variables,
		}),
		headers: {
			"Content-Type": "application/json",
		},
	});

	const json = (await response.body.json()) as { data: Response };
	return json.data;
};

export const getAllDedustAssets = pMemoize(
	async () => {
		const operationName = "GetAllAssets";
		const query =
			"query GetAllAssets { assets { type address price decimals symbol } }";

		return fetchDedustV3Api<{
			assets: {
				type: string;
				address: string;
				price: string;
				decimals: number;
				symbol: string;
			}[];
		}>(operationName, query, {});
	},
	{
		cache: new ExpiryMap(120_000),
	}
);
