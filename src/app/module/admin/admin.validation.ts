import { z } from "zod";

const updateUserStatusSchema = z.object({
	isActive: z.boolean(),
});

export const AdminValidation = {
	updateUserStatusSchema,
};
