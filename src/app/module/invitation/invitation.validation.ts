import { z } from "zod";

const inviteCandidatesSchema = z.object({
	emails: z
		.array(z.string().email("Each entry must be a valid email"))
		.min(1, "Provide at least one email")
		.max(200, "A maximum of 200 emails can be invited at once"),
});

export const InvitationValidation = {
	inviteCandidatesSchema,
};
