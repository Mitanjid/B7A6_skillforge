export interface IStartAttemptPayload {
  invitationId: string;
}

export interface ISubmitAnswerPayload {
  problemId: string;
  selectedOption?: string;
  answerText?: string;
}
