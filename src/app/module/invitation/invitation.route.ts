import { Router } from "express";
import { Role } from "../../../../generated/prisma/client.js";
import { auth } from "../../middleware/checkAuth.js";
import { InvitationControllers } from "./invitation.controller.js";

const router = Router();

// Must come before "/:token" or "my" would be parsed as a token.
router.get("/my", auth(Role.CANDIDATE), InvitationControllers.getMyInvitations);

// Public — lets an invite link render assessment info before login/registration.
router.get("/:token", InvitationControllers.getInvitationPreview);

router.post(
	"/:token/accept",
	auth(Role.CANDIDATE),
	InvitationControllers.acceptInvitation,
);

export const InvitationRoutes = router;
