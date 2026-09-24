export interface ICreateAssessmentPayload {
	title: string;
	description?: string;
	durationMinutes: number;
}

export interface IUpdateAssessmentPayload {
	title?: string;
	description?: string;
	durationMinutes?: number;
}

export interface IAttachProblemPayload {
	problemId: string;
	order?: number;
	marks?: number;
}
