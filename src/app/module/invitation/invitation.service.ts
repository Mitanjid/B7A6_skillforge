import crypto from "crypto";
import path from "path";
import ejs from "ejs";
import httpStatus from "http-status";
import {
	AssessmentStatus,
	InvitationStatus,
	Role,
	type Prisma,
} from "../../../../generated/prisma/client.js";
import config from "../../config/index.js";
import type { IQuery } from "../../interfaces/index.js";
import { transporter } from "../../lib/nodemailer.js";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/AppError.js";
import { AssessmentServices } from "../assessment/assessment.service.js";
import type {
	IInviteCandidatesPayload,
	IInviteResultItem,
} from "./invitation.interface.js";

const generateToken = () => crypto.randomBytes(32).toString("hex");

const buildInviteLink = (token: string) =>
	config.frontend_url
		? `${config.frontend_url}/invitations/${token}`
		: `${config.backend_url}/api/v1/invitations/${token}`;

const sendInviteEmail = async (params: {
	email: string;
	companyName: string;
	assessmentTitle: string;
	durationMinutes: number;
	expiresAt: Date;
	token: string;
	requiresRegistration: boolean;
}) => {
	const templatePath = path.join(
		process.cwd(),
		"src/app/templates/assessment-invite.ejs",
	);
	const html = await ejs.renderFile(templatePath, {
		companyName: params.companyName,
		assessmentTitle: params.assessmentTitle,
		durationMinutes: params.durationMinutes,
		expiresAt: params.expiresAt.toDateString(),
		email: params.email,
		requiresRegistration: params.requiresRegistration,
		inviteLink: buildInviteLink(params.token),
	});

	// Best-effort — a failed invite email shouldn't fail the whole bulk invite
	// request or roll back the Invitation row that's already been created.
	try {
		await transporter.sendMail({
			from: config.email_sender,
			to: params.email,
			subject: `You're invited: ${params.assessmentTitle}`,
			html,
		});
	} catch (err) {
		console.error(`Failed to send invitation email to ${params.email}:`, err);
	}
};

const inviteCandidates = async (
	companyId: string,
	assessmentId: string,
	payload: IInviteCandidatesPayload,
): Promise<IInviteResultItem[]> => {
	const assessment = await AssessmentServices.getAssessmentById(
		assessmentId,
		companyId,
	);
	if (assessment.status !== AssessmentStatus.PUBLISHED) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Only a PUBLISHED assessment can invite candidates",
		);
	}

	const company = await prisma.user.findUnique({
		where: { id: companyId },
		include: { companyProfile: true },
	});
	const companyName = company?.companyProfile?.companyName || "A company";

	const uniqueEmails = [
		...new Set(payload.emails.map((e) => e.trim().toLowerCase())),
	];

	const expiresAt = new Date();
	expiresAt.setDate(expiresAt.getDate() + config.invitation_expiry_days);

	const results: IInviteResultItem[] = [];

	for (const email of uniqueEmails) {
		const existing = await prisma.invitation.findUnique({
			where: { assessmentId_email: { assessmentId, email } },
		});

		if (
			existing &&
			(existing.status === InvitationStatus.PENDING ||
				existing.status === InvitationStatus.ACCEPTED)
		) {
			results.push({
				email,
				outcome: "already_invited",
				linkedToAccount: !!existing.candidateId,
			});
			continue;
		}

		const candidate = await prisma.user.findUnique({ where: { email } });
		const candidateId =
			candidate && candidate.role === Role.CANDIDATE && !candidate.deletedAt
				? candidate.id
				: null;

		const token = generateToken();

		if (existing) {
			// Previously EXPIRED — refresh the same row rather than insert a
			// second one (the [assessmentId, email] unique constraint forbids that).
			await prisma.invitation.update({
				where: { id: existing.id },
				data: {
					candidateId,
					token,
					expiresAt,
					status: InvitationStatus.PENDING,
				},
			});
			results.push({
				email,
				outcome: "reinvited",
				linkedToAccount: !!candidateId,
			});
		} else {
			await prisma.invitation.create({
				data: { assessmentId, email, candidateId, token, expiresAt },
			});
			results.push({
				email,
				outcome: "invited",
				linkedToAccount: !!candidateId,
			});
		}

		await sendInviteEmail({
			email,
			companyName,
			assessmentTitle: assessment.title,
			durationMinutes: assessment.durationMinutes,
			expiresAt,
			token,
			requiresRegistration: !candidateId,
		});
	}

	return results;
};

const getAssessmentInvitations = async (
	assessmentId: string,
	companyId: string,
	query: IQuery,
) => {
	// Confirms ownership (throws NOT_FOUND/FORBIDDEN as appropriate).
	await AssessmentServices.getAssessmentById(assessmentId, companyId);

	const page = Number(query.page) || 1;
	const limit = Number(query.limit) || 10;
	const skip = (page - 1) * limit;

	const where: Prisma.InvitationWhereInput = { assessmentId };
	if (query.status) where.status = query.status as InvitationStatus;

	const [invitations, total] = await Promise.all([
		prisma.invitation.findMany({
			where,
			skip,
			take: limit,
			orderBy: { createdAt: "desc" },
		}),
		prisma.invitation.count({ where }),
	]);

	return {
		data: invitations,
		meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
	};
};

const getMyInvitations = async (
	userId: string,
	userEmail: string,
	query: IQuery,
) => {
	const email = userEmail.trim().toLowerCase();
	const where: Prisma.InvitationWhereInput = {
		OR: [{ candidateId: userId }, { email }],
	};

	// Keep status accurate on read — flip anything stale before listing.
	await prisma.invitation.updateMany({
		where: {
			...where,
			status: InvitationStatus.PENDING,
			expiresAt: { lt: new Date() },
		},
		data: { status: InvitationStatus.EXPIRED },
	});

	const page = Number(query.page) || 1;
	const limit = Number(query.limit) || 10;
	const skip = (page - 1) * limit;

	const listWhere: Prisma.InvitationWhereInput = { ...where };
	if (query.status) listWhere.status = query.status as InvitationStatus;

	const [invitations, total] = await Promise.all([
		prisma.invitation.findMany({
			where: listWhere,
			skip,
			take: limit,
			orderBy: { createdAt: "desc" },
			include: {
				assessment: {
					select: { id: true, title: true, durationMinutes: true },
				},
			},
		}),
		prisma.invitation.count({ where: listWhere }),
	]);

	return {
		data: invitations,
		meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
	};
};

// Public — no auth. Lets an invite link render something useful before the
// visitor has even logged in.
const getInvitationPreview = async (token: string) => {
	const invitation = await prisma.invitation.findUnique({
		where: { token },
		include: {
			assessment: {
				select: {
					title: true,
					durationMinutes: true,
					company: { include: { companyProfile: true } },
				},
			},
		},
	});
	if (!invitation) {
		throw new AppError(httpStatus.NOT_FOUND, "Invitation not found");
	}

	let status = invitation.status;
	if (
		status === InvitationStatus.PENDING &&
		invitation.expiresAt < new Date()
	) {
		await prisma.invitation.update({
			where: { id: invitation.id },
			data: { status: InvitationStatus.EXPIRED },
		});
		status = InvitationStatus.EXPIRED;
	}

	let requiresRegistration = !invitation.candidateId;
	if (requiresRegistration) {
		// They may have registered after the invite was sent but before
		// clicking the link — recheck rather than trust the stored flag.
		const account = await prisma.user.findUnique({
			where: { email: invitation.email },
		});
		requiresRegistration = !account;
	}

	return {
		assessmentTitle: invitation.assessment.title,
		companyName:
			invitation.assessment.company.companyProfile?.companyName || "A company",
		durationMinutes: invitation.assessment.durationMinutes,
		email: invitation.email,
		status,
		expiresAt: invitation.expiresAt,
		requiresRegistration,
	};
};

const acceptInvitation = async (
	token: string,
	requester: { userId: string; email: string; role: Role },
) => {
	const invitation = await prisma.invitation.findUnique({ where: { token } });
	if (!invitation) {
		throw new AppError(httpStatus.NOT_FOUND, "Invitation not found");
	}

	if (
		invitation.status === InvitationStatus.PENDING &&
		invitation.expiresAt < new Date()
	) {
		await prisma.invitation.update({
			where: { id: invitation.id },
			data: { status: InvitationStatus.EXPIRED },
		});
		throw new AppError(httpStatus.BAD_REQUEST, "This invitation has expired");
	}
	if (invitation.status === InvitationStatus.EXPIRED) {
		throw new AppError(httpStatus.BAD_REQUEST, "This invitation has expired");
	}
	if (invitation.status === InvitationStatus.ACCEPTED) {
		if (invitation.candidateId === requester.userId) {
			return invitation; // idempotent re-accept by the same user
		}
		throw new AppError(
			httpStatus.FORBIDDEN,
			"This invitation has already been accepted",
		);
	}

	if (requester.role !== Role.CANDIDATE) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"Only candidates can accept assessment invitations",
		);
	}
	if (invitation.email !== requester.email.trim().toLowerCase()) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"This invitation was sent to a different email address",
		);
	}

	const updated = await prisma.invitation.update({
		where: { id: invitation.id },
		data: { candidateId: requester.userId, status: InvitationStatus.ACCEPTED },
	});
	return updated;
};

export const InvitationServices = {
	inviteCandidates,
	getAssessmentInvitations,
	getMyInvitations,
	getInvitationPreview,
	acceptInvitation,
};
