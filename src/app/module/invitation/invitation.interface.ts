export interface IInviteCandidatesPayload {
  emails: string[];
}

export type TInviteOutcome = "invited" | "reinvited" | "already_invited";

export interface IInviteResultItem {
  email: string;
  outcome: TInviteOutcome;
  linkedToAccount: boolean;
}
