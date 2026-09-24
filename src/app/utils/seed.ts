import bcrypt from "bcryptjs";
import {
	AuthProvider,
	Difficulty,
	ProblemType,
	Role,
} from "../../../generated/prisma/client.js";
import config from "../config/index.js";
import { prisma } from "../lib/prisma.js";

const seedAdmin = async () => {
	if (!config.admin_email || !config.admin_password) {
		console.warn(
			"[seed] Skipping admin — ADMIN_EMAIL/ADMIN_PASSWORD not set in .env",
		);
		return;
	}

	const exists = await prisma.user.findUnique({
		where: { email: config.admin_email },
	});
	if (exists) return;

	const hashedPassword = await bcrypt.hash(
		config.admin_password,
		config.bcrypt_salt_rounds,
	);

	await prisma.user.create({
		data: {
			email: config.admin_email,
			password: hashedPassword,
			role: Role.ADMIN,
			authProvider: AuthProvider.CREDENTIAL,
			emailVerified: true,
		},
	});

	console.log(`[seed] Admin created: ${config.admin_email}`);
};

const seedTesterCompany = async () => {
	if (!config.tester_company_email || !config.tester_company_password) return;

	const exists = await prisma.user.findUnique({
		where: { email: config.tester_company_email },
	});
	if (exists) return;

	const hashedPassword = await bcrypt.hash(
		config.tester_company_password,
		config.bcrypt_salt_rounds,
	);

	await prisma.$transaction(async (tx) => {
		const newUser = await tx.user.create({
			data: {
				email: config.tester_company_email as string,
				password: hashedPassword,
				role: Role.COMPANY,
				authProvider: AuthProvider.CREDENTIAL,
				emailVerified: true,
			},
		});

		await tx.companyProfile.create({
			data: {
				userId: newUser.id,
				companyName: config.tester_company_name || "Demo Company",
			},
		});
	});

	console.log(`[seed] Demo company created: ${config.tester_company_email}`);
};

const seedTesterCandidate = async () => {
	if (!config.tester_candidate_email || !config.tester_candidate_password)
		return;

	const exists = await prisma.user.findUnique({
		where: { email: config.tester_candidate_email },
	});
	if (exists) return;

	const hashedPassword = await bcrypt.hash(
		config.tester_candidate_password,
		config.bcrypt_salt_rounds,
	);

	await prisma.$transaction(async (tx) => {
		const newUser = await tx.user.create({
			data: {
				email: config.tester_candidate_email as string,
				password: hashedPassword,
				role: Role.CANDIDATE,
				authProvider: AuthProvider.CREDENTIAL,
				emailVerified: true,
			},
		});

		await tx.candidateProfile.create({
			data: {
				userId: newUser.id,
				fullName: config.tester_candidate_name || "Demo Candidate",
				skills: ["JavaScript", "Node.js"],
			},
		});
	});

	console.log(
		`[seed] Demo candidate created: ${config.tester_candidate_email}`,
	);
};

const seedSampleProblems = async () => {
	if (!config.tester_company_email) return;

	const company = await prisma.user.findUnique({
		where: { email: config.tester_company_email },
	});
	if (!company) return;

	const existingCount = await prisma.problem.count({
		where: { companyId: company.id },
	});
	if (existingCount > 0) return;

	await prisma.problem.createMany({
		data: [
			{
				companyId: company.id,
				title: 'What does "===" check in JavaScript?',
				description:
					"Choose the correct behavior of the strict equality operator.",
				type: ProblemType.MCQ,
				difficulty: Difficulty.EASY,
				tags: ["javascript", "basics"],
				options: [
					{ id: "a", text: "Value only" },
					{ id: "b", text: "Value and type" },
					{ id: "c", text: "Type only" },
					{ id: "d", text: "Reference only" },
				],
				correctOption: "b",
				marks: 5,
			},
			{
				companyId: company.id,
				title: "Which HTTP method is idempotent?",
				description:
					"Pick the method that produces the same result no matter how many times it is called.",
				type: ProblemType.MCQ,
				difficulty: Difficulty.EASY,
				tags: ["http", "rest"],
				options: [
					{ id: "a", text: "POST" },
					{ id: "b", text: "PATCH" },
					{ id: "c", text: "PUT" },
					{ id: "d", text: "CONNECT" },
				],
				correctOption: "c",
				marks: 5,
			},
			{
				companyId: company.id,
				title: "What is the time complexity of binary search?",
				description: "Select the correct Big-O complexity.",
				type: ProblemType.MCQ,
				difficulty: Difficulty.MEDIUM,
				tags: ["algorithms", "dsa"],
				options: [
					{ id: "a", text: "O(n)" },
					{ id: "b", text: "O(n log n)" },
					{ id: "c", text: "O(log n)" },
					{ id: "d", text: "O(1)" },
				],
				correctOption: "c",
				marks: 10,
			},
			{
				companyId: company.id,
				title: "Explain database indexing",
				description:
					"In your own words, explain what a database index is and when you would use one.",
				type: ProblemType.WRITTEN,
				difficulty: Difficulty.MEDIUM,
				tags: ["database", "sql"],
				marks: 15,
			},
			{
				companyId: company.id,
				title: "Design a rate limiter",
				description:
					"Briefly describe how you would design a rate limiter for a public API.",
				type: ProblemType.WRITTEN,
				difficulty: Difficulty.HARD,
				tags: ["system-design"],
				marks: 20,
			},
		],
	});

	console.log("[seed] Sample problems created");
};

export const runSeed = async () => {
	try {
		await seedAdmin();
		await seedTesterCompany();
		await seedTesterCandidate();
		await seedSampleProblems();
	} catch (error) {
		console.error("[seed] Failed:", error);
	}
};
