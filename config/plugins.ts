// config/plugins.ts

export default ({ env }) => ({
  email: {
    config: {
      // 👇 ESTE es el nombre correcto del provider
      provider: "nodemailer",

      // 👇 Aquí van los datos SMTP (host, puerto, user, pass)
      providerOptions: {
        host: env("SMTP_HOST", "smtp.gmail.com"),
        port: env.int("SMTP_PORT", 587),
        auth: {
          user: env("SMTP_USERNAME"),
          pass: env("SMTP_PASSWORD"),
        },
        // secure: true, // si usas 465 puedes activar esto
      },

      // 👇 Remitente por defecto
      settings: {
        defaultFrom: env("SMTP_FROM", "no-reply@eden.cl"),
        defaultReplyTo: env("SMTP_REPLY_TO", "no-reply@eden.cl"),
      },
    },
  },
});
