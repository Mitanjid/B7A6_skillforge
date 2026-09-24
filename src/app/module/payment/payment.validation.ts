import { z } from "zod";

const initiatePaymentSchema = z.object({
	assessmentId: z.string().min(1, "assessmentId is required"),
});

export const PaymentValidation = {
	initiatePaymentSchema,
};
