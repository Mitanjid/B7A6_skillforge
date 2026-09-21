import { z } from "zod";

const updateMeSchema = z.object({
  fullName: z.string().min(2, "Name must be at least 2 characters").optional(),
  phone: z.string().optional(),
  skills: z.array(z.string()).optional(),
  resumeUrl: z.url("Invalid URL").optional(),

  companyName: z
    .string()
    .min(2, "Company name must be at least 2 characters")
    .optional(),
  website: z.url("Invalid URL").optional(),
  industry: z.string().optional(),
});

export const UserValidation = {
  updateMeSchema,
};
