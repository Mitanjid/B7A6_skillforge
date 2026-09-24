import { Router } from "express";
import { Role } from "../../../../generated/prisma/client.js";
import { auth } from "../../middleware/checkAuth.js";
import { validateRequest } from "../../middleware/validateRequest.js";
import { PaymentControllers } from "./payment.controller.js";
import { PaymentValidation } from "./payment.validation.js";

const router = Router();

router.post(
	"/initiate",
	auth(Role.COMPANY),
	validateRequest(PaymentValidation.initiatePaymentSchema),
	PaymentControllers.initiatePayment,
);

// Public — called by the SSLCommerz gateway itself, not by our API clients.
router.post("/webhook", PaymentControllers.handleGatewayCallback);

// Must come before "/:id" or "my" would be parsed as an id param.
router.get("/my", auth(Role.COMPANY), PaymentControllers.getMyPayments);
router.get(
	"/:id",
	auth(Role.COMPANY, Role.ADMIN),
	PaymentControllers.getPaymentById,
);

export const PaymentRoutes = router;
