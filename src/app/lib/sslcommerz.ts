import config from "../config/index.js";

const SANDBOX_BASE_URL = "https://sandbox.sslcommerz.com";
const LIVE_BASE_URL = "https://securepay.sslcommerz.com";

const getBaseUrl = () =>
	config.sslcommerz_is_live ? LIVE_BASE_URL : SANDBOX_BASE_URL;

export interface ISSLCommerzInitPayload {
	totalAmount: number;
	currency: string;
	transactionId: string;
	successUrl: string;
	failUrl: string;
	cancelUrl: string;
	ipnUrl: string;
	customerName: string;
	customerEmail: string;
	productName: string;
}

export interface ISSLCommerzInitResponse {
	status: string; // SUCCESS | FAILED
	GatewayPageURL?: string;
	sessionkey?: string;
	failedreason?: string;
	[key: string]: unknown;
}

// Creates a payment session with SSLCommerz and returns the GatewayPageURL
// the payer should be sent to. Uses raw fetch since no sslcommerz SDK is
// installed in this project — the init API is a plain form-encoded POST.
const initiateSession = async (
	payload: ISSLCommerzInitPayload,
): Promise<ISSLCommerzInitResponse> => {
	const body = new URLSearchParams({
		store_id: config.sslcommerz_store_id as string,
		store_passwd: config.sslcommerz_store_password as string,
		total_amount: payload.totalAmount.toFixed(2),
		currency: payload.currency,
		tran_id: payload.transactionId,
		success_url: payload.successUrl,
		fail_url: payload.failUrl,
		cancel_url: payload.cancelUrl,
		ipn_url: payload.ipnUrl,
		shipping_method: "NO",
		product_name: payload.productName,
		product_category: "Service",
		product_profile: "general",
		cus_name: payload.customerName,
		cus_email: payload.customerEmail,
		// Demo-only placeholders — this schema doesn't store billing address/phone,
		// and SSLCommerz's init API requires these fields to be present.
		cus_add1: "N/A",
		cus_city: "Dhaka",
		cus_postcode: "1000",
		cus_country: "Bangladesh",
		cus_phone: "01700000000",
		ship_name: payload.customerName,
		ship_add1: "N/A",
		ship_city: "Dhaka",
		ship_postcode: "1000",
		ship_country: "Bangladesh",
	});

	const response = await fetch(`${getBaseUrl()}/gwprocess/v4/api.php`, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body,
	});

	return (await response.json()) as ISSLCommerzInitResponse;
};

export interface ISSLCommerzValidationResponse {
	status: string; // VALID | VALIDATED | INVALID_TRANSACTION | FAILED | EXPIRED
	tran_id: string;
	amount: string;
	currency_type?: string;
	[key: string]: unknown;
}

// Re-confirms a transaction server-to-server. This is the ONLY source of
// truth for marking a payment SUCCESS — browser redirect params are never
// trusted directly since they can be replayed/forged by the client.
const validateTransaction = async (
	valId: string,
): Promise<ISSLCommerzValidationResponse> => {
	const params = new URLSearchParams({
		val_id: valId,
		store_id: config.sslcommerz_store_id as string,
		store_passwd: config.sslcommerz_store_password as string,
		format: "json",
	});

	const response = await fetch(
		`${getBaseUrl()}/validator/api/validationserverAPI.php?${params.toString()}`,
	);

	return (await response.json()) as ISSLCommerzValidationResponse;
};

export const sslcommerz = { initiateSession, validateTransaction };
