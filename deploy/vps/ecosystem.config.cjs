// PM2 untuk Pantau Generus di VPS. Dari folder aplikasi:
//   pm2 start deploy/vps/ecosystem.config.cjs && pm2 save && pm2 startup
// Variabel environment dibaca Next.js dari file .env.production.local di folder aplikasi.
module.exports = {
  apps: [
    {
      name: "generus",
      cwd: __dirname + "/../..",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000 -H 127.0.0.1",
      // 2 proses untuk VPS 4 vCPU; 1 bila RAM ≤ 2 GB.
      instances: 2,
      exec_mode: "cluster",
      max_memory_restart: "900M",
      env: { NODE_ENV: "production" },
      time: true,
    },
  ],
};
