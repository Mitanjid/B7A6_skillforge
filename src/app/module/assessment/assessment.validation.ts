import { z } from "zod";

const createAssessmentSchema = z.object({
	title: z.string().min(3, "Title must be at least 3 characters"),
	description: z.string().optional(),
	durationMinutes: z
		.number()
		.int()
		.positive("Duration must be a positive number of minutes"),
});

const updateAssessmentSchema = z.object({
	title: z.string().min(3).optional(),
	description: z.string().optional(),
	durationMinutes: z.number().int().positive().optional(),
});

const attachProblemSchema = z.object({
	problemId: z.string().min(1, "problemId is required"),
	order: z.number().int().positive().optional(),
	marks: z.number().int().positive().optional(),
});

export const AssessmentValidation = {
	createAssessmentSchema,
	updateAssessmentSchema,
	attachProblemSchema,
};
