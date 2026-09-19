import 'dotenv/config';

const config = {
  node_env: process.env.NODE_ENV,
  port: process.env.PORT || 5000,
  backend_url: process.env.BACKEND_URL,
  frontend_url: process.env.FRONTEND_URL,

  database_url: process.env.DATABASE_URL,

  jwt_access_secret: process.env.JWT_ACCESS_SECRET as string,
  jwt_refresh_secret: process.env.JWT_REFRESH_SECRET as string,
  jwt_access_expires_in: process.env.JWT_ACCESS_EXPIRES_IN || '1d',
  jwt_refresh_expires_in: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  bcrypt_salt_rounds: Number(process.env.BCRYPT_SALT_ROUNDS) || 10,

  admin_name: process.env.ADMIN_NAME,
  admin_email: process.env.ADMIN_EMAIL,
  admin_password: process.env.ADMIN_PASSWORD,

  tester_company_name: process.env.TESTER_COMPANY_NAME,
  tester_company_email: process.env.TESTER_COMPANY_EMAIL,
  tester_company_password: process.env.TESTER_COMPANY_PASSWORD,

  tester_candidate_name: process.env.TESTER_CANDIDATE_NAME,
  tester_candidate_email: process.env.TESTER_CANDIDATE_EMAIL,
  tester_candidate_password: process.env.TESTER_CANDIDATE_PASSWORD,

  redis_host: process.env.REDIS_HOST,
  redis_port: process.env.REDIS_PORT,
  redis_user: process.env.REDIS_USER,
  redis_password: process.env.REDIS_PASSWORD,

  smtp_user: process.env.SMTP_USER,
  smtp_password: process.env.SMTP_PASSWORD,
  email_sender: process.env.EMAIL_SENDER,

  sslcommerz_store_id: process.env.SSLCOMMERZ_STORE_ID,
  sslcommerz_store_password: process.env.SSLCOMMERZ_STORE_PASSWORD,
  sslcommerz_is_live: process.env.SSLCOMMERZ_IS_LIVE === 'true',
  sslcommerz_success_url: process.env.SSLCOMMERZ_SUCCESS_URL,
  sslcommerz_fail_url: process.env.SSLCOMMERZ_FAIL_URL,
  sslcommerz_cancel_url: process.env.SSLCOMMERZ_CANCEL_URL,

  google_client_id: process.env.GOOGLE_CLIENT_ID,

  cloudinary_cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  cloudinary_api_key: process.env.CLOUDINARY_API_KEY,
  cloudinary_api_secret: process.env.CLOUDINARY_API_SECRET,
};

export default config;
