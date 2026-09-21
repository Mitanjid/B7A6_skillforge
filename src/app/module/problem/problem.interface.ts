export interface IOption {
  id: string;
  text: string;
}

export interface ICreateProblemPayload {
  title: string;
  description: string;
  type: "MCQ" | "WRITTEN";
  difficulty: "EASY" | "MEDIUM" | "HARD";
  tags?: string[];
  options?: IOption[];
  correctOption?: string;
  marks?: number;
}

export interface IUpdateProblemPayload {
  title?: string;
  description?: string;
  type?: "MCQ" | "WRITTEN";
  difficulty?: "EASY" | "MEDIUM" | "HARD";
  tags?: string[];
  options?: IOption[];
  correctOption?: string;
  marks?: number;
}
