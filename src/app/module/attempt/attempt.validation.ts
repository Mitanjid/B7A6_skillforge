import { z } from "zod";

const startAttemptSchema = z.object({
  invitationId: z.string().min(1, "invitationId is required"),
});

const submitAnswerSchema = z
  .object({
    problemId: z.string().min(1, "problemId is required"),
    selectedOption: z.string().min(1).optional(),
    answerText: z.string().min(1).optional(),
  })
  .refine((data) => !!data.selectedOption || !!data.answerText, {
    message: "Provide either selectedOption (MCQ) or answerText (written)",
  });

export const AttemptValidation = {
  startAttemptSchema,
  submitAnswerSchema,
};
