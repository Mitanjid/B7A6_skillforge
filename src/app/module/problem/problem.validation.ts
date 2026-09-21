import { z } from "zod";

const optionSchema = z.object({
  id: z.string(),
  text: z.string(),
});

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
  );

const updateProblemSchema = z.object({
  title: z.string().min(3).optional(),
  description: z.string().min(5).optional(),
  type: z.enum(["MCQ", "WRITTEN"]).optional(),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).optional(),
  tags: z.array(z.string()).optional(),
  options: z.array(optionSchema).optional(),
  correctOption: z.string().optional(),
  marks: z.number().int().positive().optional(),
});

export const ProblemValidation = {
  createProblemSchema,
  updateProblemSchema,
};
