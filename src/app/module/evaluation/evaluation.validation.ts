import { z } from "zod";

const evaluateSubmissionSchema = z.object({
	score: z.number().min(0, "Score cannot be negative"),
});

export const EvaluationValidation = {
	evaluateSubmissionSchema,
};
