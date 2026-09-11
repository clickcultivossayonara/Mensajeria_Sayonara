// Edge Function de Supabase: envia los correos de Mensajeria por SMTP
// (Microsoft 365 / Outlook, tesoreria@cultivossayonara.com.co).
//
// Como se despliega (todo por el dashboard de Supabase, sin terminal):
//   1. Supabase Dashboard -> Edge Functions -> "Deploy a new function"
//   2. Nombre de la funcion: send-mensajeria-email
//   3. Borra el codigo de ejemplo que trae y pega TODO este archivo
//   4. Deploy
//   5. Edge Functions -> send-mensajeria-email -> pestaña "Secrets" (o
//      Project Settings -> Edge Functions -> Secrets) y agrega:
//        SMTP_USER      = tesoreria@cultivossayonara.com.co
//        SMTP_PASSWORD  = la contraseña normal de ese correo
//        WEBHOOK_SECRET = una clave larga inventada por ti (no el PIN de
//                         Confirmar Pedidos, otra distinta). Sirve para que
//                         solo Supabase pueda activar esta funcion, nadie
//                         mas aunque encuentre la URL.
//
// Despues hay que crear 2 Database Webhooks (Database -> Webhooks) que
// avisen a esta funcion -- eso se explica aparte una vez la funcion este
// desplegada y probada.

import nodemailer from "npm:nodemailer@6.9.16";

const SMTP_USER = Deno.env.get("SMTP_USER")!;
const SMTP_PASSWORD = Deno.env.get("SMTP_PASSWORD")!;
const WEBHOOK_SECRET = Deno.env.get("WEBHOOK_SECRET")!;

const ESTADO_ETIQUETA: Record<string, string> = {
  pendiente: "Pendiente",
  realizado: "Realizado",
  cancelado: "Cancelado",
  pospuesta: "Pospuesta",
};

function fmtFecha(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

function fmtFechaHora(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("es-CO", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
    timeZone: "America/Bogota",
  });
}

function escHtml(s: unknown): string {
  return String(s ?? "—").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string
  ));
}

const LOGO_URL = "https://clickcultivossayonara.github.io/Mensajeria_Sayonara/logo-sayonara.png";

function plantillaBase(titulo: string, filas: [string, string | null | undefined][]): string {
  const filasHtml = filas.map(([label, valor]) => `
    <tr><td style="text-align:center; padding:10px 0 2px; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; color:#57625b; font-family:Arial,Helvetica,sans-serif;">${escHtml(label)}</td></tr>
    <tr><td style="text-align:center; padding:0 0 4px; font-size:15px; color:#1d2420; font-family:Arial,Helvetica,sans-serif;">${escHtml(valor)}</td></tr>`).join("");

  return `<!doctype html>
<html>
<body style="margin:0; padding:24px 12px; background:#f6f5f0; font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:480px; margin:0 auto;">
    <div style="text-align:center; margin-bottom:20px;">
      <div style="font-size:11px; letter-spacing:0.12em; text-transform:uppercase; color:#8a9089;">Cultivos Sayonara</div>
      <h1 style="font-size:19px; margin:6px 0 0; color:#1d2420; text-align:center;">${escHtml(titulo)}</h1>
    </div>
    <table role="presentation" width="100%" style="background:#ffffff; border:1px solid #dbdfd4; border-radius:10px; padding:18px 20px; border-collapse:collapse;">
      ${filasHtml}
    </table>
    <div style="text-align:center; margin-top:26px;">
      <img src="${LOGO_URL}" alt="Sayonara Fresh Cut Flowers" width="160" style="max-width:160px; height:auto;">
    </div>
  </div>
</body>
</html>`;
}

const transporter = nodemailer.createTransport({
  host: "smtp.office365.com",
  port: 587,
  secure: false, // el puerto 587 empieza sin cifrar y sube a TLS con STARTTLS
  requireTLS: true,
  auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
});

async function enviarCorreo(destinatario: string, asunto: string, html: string): Promise<void> {
  await transporter.sendMail({
    from: `"Mensajería Sayonara" <${SMTP_USER}>`,
    to: destinatario,
    subject: asunto,
    html,
  });
}

async function enviarNuevaSolicitud(r: Record<string, any>): Promise<void> {
  if (!r.email) return;
  const html = plantillaBase("Nueva Solicitud de Mensajería", [
    ["Fecha solicitud", fmtFechaHora(r.fecha_solicitud)],
    ["Fecha indicada", fmtFecha(r.fecha_indicada)],
    ["Solicita", r.solicita],
    ["Destino", r.destino],
    ["Dirección", r.direccion],
    ["Contenido paquete", r.contenido_paquete],
    ["Email", r.email],
  ]);
  await enviarCorreo(r.email, "Solicitud de mensajería recibida", html);
}

async function enviarActualizacion(r: Record<string, any>, actualizadoEn: string | null | undefined): Promise<void> {
  if (!r.email_solicitante) return;
  const etiqueta = ESTADO_ETIQUETA[r.estado] || r.estado;
  const html = plantillaBase("Actualización de tu Solicitud", [
    ["Fecha actualización de solicitud", fmtFechaHora(actualizadoEn)],
    ["Fecha indicada", fmtFecha(r.fecha_indicada)],
    ["Solicita", r.solicita],
    ["Destino", r.destino],
    ["Dirección", r.direccion],
    ["Contenido paquete", r.contenido_paquete],
    ["Estado", etiqueta],
    ["Observaciones", r.observaciones],
  ]);
  await enviarCorreo(r.email_solicitante, `Tu solicitud de mensajería está: ${etiqueta}`, html);
}

Deno.serve(async (req) => {
  if (req.headers.get("x-webhook-secret") !== WEBHOOK_SECRET) {
    return new Response("unauthorized", { status: 401 });
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return new Response("bad request", { status: 400 });
  }

  try {
    if (payload.table === "solicitudes_mensajeria" && payload.type === "INSERT") {
      await enviarNuevaSolicitud(payload.record);
    } else if (payload.table === "confirmacion_pedidos" && payload.type === "UPDATE") {
      const cambioEstado = payload.record?.estado !== payload.old_record?.estado;
      const cambioObs = payload.record?.observaciones !== payload.old_record?.observaciones;
      if (cambioEstado || cambioObs) {
        await enviarActualizacion(payload.record, payload.updated_at);
      }
    }
    return new Response("ok", { status: 200 });
  } catch (err) {
    console.error(err);
    return new Response("error: " + (err as Error).message, { status: 500 });
  }
});
