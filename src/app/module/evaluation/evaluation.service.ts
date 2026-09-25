import httpStatus from "http-status";
import {
	AttemptStatus,
	ProblemType,
} from "../../../../generated/prisma/client.js";
import type { IQuery } from "../../interfaces/index.js";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/AppError.js";
import { AssessmentServices } from "../assessment/assessment.service.js";
import type { IEvaluateSubmissionPayload } from "./evaluation.interface.js";

const getAttemptSubmissions = async (companyId: string, attemptId: string) => {
	const attempt = await prisma.attempt.findUnique({
		where: { id: attemptId },
		include: {
			assessment: { select: { id: true, title: true, companyId: true } },
			candidate: {
				select: { id: true, email: true, candidateProfile: true },
			},
			submissions: {
				include: {
					problem: true,
					evaluatedBy: { select: { id: true, email: true } },
				},
			},
		},
	});
	if (!attempt) {
		throw new AppError(httpStatus.NOT_FOUND, "Attempt not found");
	}
	if (attempt.assessment.companyId !== companyId) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"You do not have access to this attempt",
		);
	}

	return attempt;
};

const evaluateSubmission = async (
	companyId: string,
	submissionId: string,
	payload: IEvaluateSubmissionPayload,
) => {
	const submission = await prisma.submission.findUnique({
		where: { id: submissionId },
		include: {
			problem: true,
			attempt: { include: { assessment: true } },
		},
	});
	if (!submission) {
		throw new AppError(httpStatus.NOT_FOUND, "Submission not found");
	}
	if (submission.attempt.assessment.companyId !== companyId) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"You do not have access to this submission",
		);
	}
	if (submission.problem.type !== ProblemType.WRITTEN) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"MCQ submissions are auto-graded and cannot be manually evaluated",
		);
	}
	if (submission.attempt.status === AttemptStatus.IN_PROGRESS) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"The candidate hasn't submitted this attempt yet",
		);
	}

	const assessmentProblem = await prisma.assessmentProblem.findUnique({
		where: {
			assessmentId_problemId: {
				assessmentId: submission.attempt.assessmentId,
				problemId: submission.problemId,
			},
		},
	});
	if (!assessmentProblem) {
		throw new AppError(
			httpStatus.NOT_FOUND,
			"This problem is no longer part of the assessment",
		);
	}
	if (payload.score > assessmentProblem.marks) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			`Score cannot exceed the ${assessmentProblem.marks} marks assigned to this problem`,
		);
	}

	const updatedSubmission = await prisma.$transaction(async (tx) => {
		const saved = await tx.submission.update({
			where: { id: submission.id },
			data: {
				score: payload.score,
				evaluatedById: companyId,
				evaluatedAt: new Date(),
			},
		});

		const allSubmissions = await tx.submission.findMany({
			where: { attemptId: submission.attemptId },
			include: { problem: { select: { type: true } } },
		});
		const hasPendingWritten = allSubmissions.some(
			(s) => s.problem.type === ProblemType.WRITTEN && s.score === null,
		);
		const totalScore = allSubmissions.reduce(
			(sum, s) => sum + (s.score ?? 0),
			0,
		);

		await tx.attempt.update({
			where: { id: submission.attemptId },
			data: {
				totalScore,
				status: hasPendingWritten
					? AttemptStatus.SUBMITTED
					: AttemptStatus.EVALUATED,
			},
		});

		return saved;
	});

	return updatedSubmission;
};

const getAssessmentResults = async (
	assessmentId: string,
	companyId: string,
	query: IQuery,
) => {
	// Confirms ownership (throws NOT_FOUND/FORBIDDEN as appropriate).
	await AssessmentServices.getAssessmentById(assessmentId, companyId);

	const attempts = await prisma.attempt.findMany({
		where: {
			assessmentId,
			status: { in: [AttemptStatus.SUBMITTED, AttemptStatus.EVALUATED] },
		},
		orderBy: [{ totalScore: "desc" }, { submittedAt: "asc" }],
		include: {
			candidate: {
				select: {
					id: true,
					email: true,
					candidateProfile: { select: { fullName: true } },
				},
			},
		},
	});

	const ranked = attempts.map((a, index) => ({
		rank: index + 1,
		attemptId: a.id,
		candidateId: a.candidateId,
		candidateName: a.candidate.candidateProfile?.fullName || a.candidate.email,
		candidateEmail: a.candidate.email,
		totalScore: a.totalScore,
		status: a.status,
		submittedAt: a.submittedAt,
	}));

	const page = Number(query.page) || 1;
	const limit = Number(query.limit) || 20;
	const start = (page - 1) * limit;
	const paged = ranked.slice(start, start + limit);

	return {
		data: paged,
		meta: {
			page,
			limit,
			total: ranked.length,
			totalPages: Math.ceil(ranked.length / limit),
		},
	};
};

export const EvaluationServices = {
	getAttemptSubmissions,
	evaluateSubmission,
	getAssessmentResults,
};
