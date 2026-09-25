import httpStatus from "http-status";
import type { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync.js";
import { sendResponse } from "../../utils/sendResponse.js";
import { InvitationServices } from "./invitation.service.js";

const inviteCandidates = catchAsync(async (req: Request, res: Response) => {
  const result = await InvitationServices.inviteCandidates(
    req.user!.userId,
    req.params.id as string,
    req.body,
  );
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    message: "Invitations processed",
    data: result,
  });
});

const getAssessmentInvitations = catchAsync(
  async (req: Request, res: Response) => {
    const result = await InvitationServices.getAssessmentInvitations(
      req.params.id as string,
      req.user!.userId,
      req.query as Record<string, unknown>,
    );
    sendResponse(res, {
      statusCode: httpStatus.OK,
      message: "Invitations retrieved successfully",
      data: result.data,
      meta: result.meta,
    });
  },
);

const getMyInvitations = catchAsync(async (req: Request, res: Response) => {
  const result = await InvitationServices.getMyInvitations(
    req.user!.userId,
    req.user!.email,
    req.query as Record<string, unknown>,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: "Invitations retrieved successfully",
    data: result.data,
    meta: result.meta,
  });
});

// Public — no req.user available here.
const getInvitationPreview = catchAsync(async (req: Request, res: Response) => {
  const result = await InvitationServices.getInvitationPreview(
    req.params.token as string,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: "Invitation retrieved successfully",
    data: result,
  });
});

const acceptInvitation = catchAsync(async (req: Request, res: Response) => {
  const result = await InvitationServices.acceptInvitation(
    req.params.token as string,
    req.user!,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: "Invitation accepted successfully",
    data: result,
  });
});

export const InvitationControllers = {
  inviteCandidates,
  getAssessmentInvitations,
  getMyInvitations,
  getInvitationPreview,
  acceptInvitation,
};
