// Quick diagnostic endpoint
export default async function handler(req, res) {
  res.status(200).json({
    USE_ACCOUNT_TOKEN: process.env.USE_ACCOUNT_TOKEN,
    NODE_ENV: process.env.NODE_ENV
  });
}
