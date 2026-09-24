import { z } from "zod";

const optionSchema = z.object({
	id: z.string(),
	text: z.string(),
});

// Shape-level checks that don't need database state — reusable by both
// create and update schemas.
const optionsAreConsistent = (data: {
	options?: { id: string }[];
	correctOption?: string;
}) => {
	if (!data.options) return true;
	const ids = data.options.map((o) => o.id);
	const uniqueIds = new Set(ids);
	if (uniqueIds.size !== ids.length) return false; // duplicate option ids
	if (data.correctOption && !uniqueIds.has(data.correctOption)) return false; // correctOption not in options
	return true;
};

const createProblemSchema = z
	.object({
		title: z.string().min(3, "Title must be at least 3 characters"),
		description: z.string().min(5, "Description must be at least 5 characters"),
		type: z.enum(["MCQ", "WRITTEN"]),
		difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
		tags: z.array(z.string()).optional(),
		options: z.array(optionSchema).optional(),
		correctOption: z.string().optional(),
		marks: z.number().int().positive().optional(),
	})
	.refine(
		(data) =>
			data.type !== "MCQ" ||
			(data.options && data.options.length >= 2 && data.correctOption),
		{
			message: "MCQ problems require at least 2 options and a correctOption",
			path: ["options"],
		},
	)
	.refine(optionsAreConsistent, {
		message:
			"Option ids must be unique, and correctOption must match one of the given option ids",
		path: ["options"],
	});

const updateProblemSchema = z
	.object({
		title: z.string().min(3).optional(),
		description: z.string().min(5).optional(),
		type: z.enum(["MCQ", "WRITTEN"]).optional(),
		difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).optional(),
		tags: z.array(z.string()).optional(),
		options: z.array(optionSchema).optional(),
		correctOption: z.string().optional(),
		marks: z.number().int().positive().optional(),
	})
	// This only catches the self-contained case (options + correctOption both
	// present in *this* request). It cannot know whether the problem is
	// already MCQ in the DB when only one of the two is sent — that
	// cross-record check happens in problem.service.ts's updateProblem,
	// which has access to the existing row.
	.refine(optionsAreConsistent, {
		message:
			"Option ids must be unique, and correctOption must match one of the given option ids",
		path: ["options"],
	});

export const ProblemValidation = {
	createProblemSchema,
	updateProblemSchema,
};
