import type { Request, Response } from "express";
import httpStatus from "http-status";
import config from "../../config/index.js";
import { catchAsync } from "../../utils/catchAsync.js";
import { sendResponse } from "../../utils/sendResponse.js";
import { PaymentServices } from "./payment.service.js";

const initiatePayment = catchAsync(async (req: Request, res: Response) => {
	const result = await PaymentServices.initiatePayment(
		req.user!.userId,
		req.body,
	);
	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		message: "Payment session created successfully",
		data: result,
	});
});

// Hit by SSLCommerz itself (IPN + redirect callbacks) — not by our own API
// clients. No auth: authenticity comes from the server-to-server validate()
// call inside the service, not from who's calling this route.
const handleGatewayCallback = catchAsync(
	async (req: Request, res: Response) => {
		const payment = await PaymentServices.processGatewayCallback(req.body);

		// Once a frontend exists, SSLCommerz will redirect the payer's browser
		// straight to it (see success/fail/cancel URL config) and this branch
		// won't be hit for browser traffic — only IPN, which ignores the response.
		if (config.frontend_url) {
			const redirectUrl = `${config.frontend_url}/payments/result?status=${payment.status}&assessmentId=${payment.assessmentId}`;
			res.redirect(302, redirectUrl);
			return;
		}

		sendResponse(res, {
			statusCode: httpStatus.OK,
			message:
				payment.status === "SUCCESS"
					? "Payment verified successfully"
					: "Payment was not successful",
			data: {
				paymentId: payment.id,
				status: payment.status,
				assessmentId: payment.assessmentId,
			},
		});
	},
);

const getPaymentById = catchAsync(async (req: Request, res: Response) => {
	const result = await PaymentServices.getPaymentById(
		req.params.id as string,
		req.user!,
	);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		message: "Payment retrieved successfully",
		data: result,
	});
});

const getMyPayments = catchAsync(async (req: Request, res: Response) => {
	const result = await PaymentServices.getMyPayments(
		req.user!.userId,
		req.query as Record<string, unknown>,
	);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		message: "Payments retrieved successfully",
		data: result.data,
		meta: result.meta,
	});
});

export const PaymentControllers = {
	initiatePayment,
	handleGatewayCallback,
	getPaymentById,
	getMyPayments,
};
