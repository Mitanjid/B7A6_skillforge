import { OAuth2Client } from "google-auth-library";
import config from "../config/index.js";

const client = new OAuth2Client(config.google_client_id);

export const verifyGoogleIdToken = async (idToken: string) => {
	const ticket = await client.verifyIdToken({
		idToken,
		audience: config.google_client_id,
	});

	return ticket.getPayload();
};
