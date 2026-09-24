import httpStatus from "http-status";
import {
	AssessmentStatus,
	PaymentStatus,
	type Prisma,
	Role,
} from "../../../../generated/prisma/client.js";
import config from "../../config/index.js";
import type { IQuery } from "../../interfaces/index.js";
import { prisma } from "../../lib/prisma.js";
import { sslcommerz } from "../../lib/sslcommerz.js";
import { AppError } from "../../utils/AppError.js";
import type { IInitiatePaymentPayload } from "./payment.interface.js";

// Publish fee is derived from the assessment's totalMarks rather than a flat
// number — gives it real business meaning (a bigger assessment costs more to
// run) while staying fully configurable via env for grading/demo purposes.
const calculatePublishFee = (totalMarks: number) => {
	return (
		config.platform_publish_base_fee +
		totalMarks * config.platform_publish_fee_per_mark
	);
};

const initiatePayment = async (
	companyId: string,
	payload: IInitiatePaymentPayload,
) => {
	const assessment = await prisma.assessment.findUnique({
		where: { id: payload.assessmentId },
		include: { payment: true },
	});

	if (!assessment || assessment.deletedAt) {
		throw new AppError(httpStatus.NOT_FOUND, "Assessment not found");
	}
	if (assessment.companyId !== companyId) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"You do not have access to this assessment",
		);
	}
	if (assessment.status !== AssessmentStatus.DRAFT) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Only a DRAFT assessment can be paid for — it has already been published or closed",
		);
	}
	if (assessment.totalMarks <= 0) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Attach at least one problem before paying to publish this assessment",
		);
	}
	if (assessment.payment?.status === PaymentStatus.SUCCESS) {
		throw new AppError(
			httpStatus.CONFLICT,
			"This assessment has already been paid for",
		);
	}

	const company = await prisma.user.findUnique({
		where: { id: companyId },
		include: { companyProfile: true },
	});
	if (!company) {
		throw new AppError(httpStatus.NOT_FOUND, "Company account not found");
	}

	const amount = calculatePublishFee(assessment.totalMarks);
	const transactionId = `PAY-${assessment.id.slice(-8)}-${Date.now()}`;
	const webhookUrl = `${config.backend_url}/api/v1/payments/webhook`;

	const initResponse = await sslcommerz.initiateSession({
		totalAmount: amount,
		currency: "BDT",
		transactionId,
		// If a dedicated frontend URL is configured for these, SSLCommerz will
		// redirect the payer's browser there; otherwise fall back to our own
		// webhook, which handles both the browser redirect and the IPN call.
		successUrl: config.sslcommerz_success_url || webhookUrl,
		failUrl: config.sslcommerz_fail_url || webhookUrl,
		cancelUrl: config.sslcommerz_cancel_url || webhookUrl,
		ipnUrl: webhookUrl,
		customerName: company.companyProfile?.companyName || company.email,
		customerEmail: company.email,
		productName: `Publish fee - ${assessment.title}`,
	});

	if (initResponse.status !== "SUCCESS" || !initResponse.GatewayPageURL) {
		throw new AppError(
			httpStatus.BAD_GATEWAY,
			initResponse.failedreason ||
				"Failed to initiate payment with the payment gateway",
		);
	}

	// One Payment row per assessment (assessmentId is @unique) — a retry after
	// a FAILED/PENDING attempt reuses the row with a fresh transactionId.
	const payment = await prisma.payment.upsert({
		where: { assessmentId: assessment.id },
		create: {
			companyId,
			assessmentId: assessment.id,
			amount,
			currency: "BDT",
			status: PaymentStatus.PENDING,
			transactionId,
			gatewayResponse: initResponse as Prisma.InputJsonValue,
		},
		update: {
			amount,
			status: PaymentStatus.PENDING,
			transactionId,
			gatewayResponse: initResponse as Prisma.InputJsonValue,
		},
	});

	return {
		paymentId: payment.id,
		transactionId: payment.transactionId,
		amount: payment.amount,
		gatewayPageURL: initResponse.GatewayPageURL,
	};
};

// Handles SSLCommerz's callback — used for both the IPN (server-to-server)
// call and, until a real frontend exists, the success/fail/cancel browser
// redirects too. Never trusts the incoming body for a SUCCESS verdict: a
// val_id is only ever marked SUCCESS after an independent server-to-server
// validate() call confirms it.
const processGatewayCallback = async (body: Record<string, unknown>) => {
	const tranId = body.tran_id as string | undefined;
	const valId = body.val_id as string | undefined;
	const gatewayStatus = (body.status as string | undefined)?.toUpperCase();

	if (!tranId) {
		throw new AppError(httpStatus.BAD_REQUEST, "Missing transaction id");
	}

	const payment = await prisma.payment.findUnique({
		where: { transactionId: tranId },
	});
	if (!payment) {
		throw new AppError(
			httpStatus.NOT_FOUND,
			"Payment record not found for this transaction",
		);
	}

	// Idempotent — SSLCommerz may hit the redirect URL and the IPN URL for the
	// same transaction, and IPNs can be retried.
	if (payment.status === PaymentStatus.SUCCESS) {
		return payment;
	}

	if (gatewayStatus === "FAILED" || gatewayStatus === "CANCELLED") {
		return failPayment(
			payment.id,
			payment.companyId,
			tranId,
			body,
			gatewayStatus,
		);
	}

	if (!valId) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Missing validation id for a non-failed transaction",
		);
	}

	const validation = await sslcommerz.validateTransaction(valId);
	const isValidStatus =
		validation.status === "VALID" || validation.status === "VALIDATED";
	const amountMatches =
		Math.abs(Number(validation.amount) - Number(payment.amount)) < 1;
	const tranMatches = validation.tran_id === payment.transactionId;

	if (isValidStatus && amountMatches && tranMatches) {
		const updated = await prisma.payment.update({
			where: { id: payment.id },
			data: {
				status: PaymentStatus.SUCCESS,
				gatewayResponse: validation as unknown as Prisma.InputJsonValue,
			},
		});
		await prisma.auditLog.create({
			data: {
				userId: payment.companyId,
				action: "PAYMENT_SUCCESS",
				entityType: "Payment",
				entityId: payment.id,
				metadata: { transactionId: tranId, amount: payment.amount.toString() },
			},
		});
		return updated;
	}

	return failPayment(
		payment.id,
		payment.companyId,
		tranId,
		validation as unknown as Record<string, unknown>,
		"Validation failed",
	);
};

const failPayment = async (
	paymentId: string,
	companyId: string,
	transactionId: string,
	gatewayResponse: Record<string, unknown>,
	reason: string,
) => {
	const updated = await prisma.payment.update({
		where: { id: paymentId },
		data: {
			status: PaymentStatus.FAILED,
			gatewayResponse: gatewayResponse as Prisma.InputJsonValue,
		},
	});
	await prisma.auditLog.create({
		data: {
			userId: companyId,
			action: "PAYMENT_FAILED",
			entityType: "Payment",
			entityId: paymentId,
			metadata: { transactionId, reason },
		},
	});
	return updated;
};

const getPaymentById = async (
	id: string,
	requester: { userId: string; role: Role },
) => {
	const payment = await prisma.payment.findUnique({
		where: { id },
		include: {
			assessment: { select: { id: true, title: true, status: true } },
		},
	});
	if (!payment) {
		throw new AppError(httpStatus.NOT_FOUND, "Payment not found");
	}
	if (requester.role !== Role.ADMIN && payment.companyId !== requester.userId) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"You do not have access to this payment",
		);
	}
	return payment;
};

const getMyPayments = async (companyId: string, query: IQuery) => {
	const page = Number(query.page) || 1;
	const limit = Number(query.limit) || 10;
	const skip = (page - 1) * limit;

	const where: Prisma.PaymentWhereInput = { companyId };
	if (query.status) where.status = query.status as PaymentStatus;

	const [payments, total] = await Promise.all([
		prisma.payment.findMany({
			where,
			skip,
			take: limit,
			orderBy: { createdAt: "desc" },
			include: {
				assessment: { select: { id: true, title: true, status: true } },
			},
		}),
		prisma.payment.count({ where }),
	]);

	return {
		data: payments,
		meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
	};
};

export const PaymentServices = {
	initiatePayment,
	processGatewayCallback,
	getPaymentById,
	getMyPayments,
};
