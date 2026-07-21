import { Resend } from "resend"

const resend = new Resend(Bun.env.resend_token);


const html = `
<p>Alert Homelab is Down</p>
<p>Reset now</p>
`

export const AlertEmail = async () => {
    const email = Bun.env.email
    console.log(email);
    if (!email) return;
    await resend.emails.send({
        from: "AlertEmail <support@nxbim.xyz>",
        to:  email,
        subject: "Alert Homelab Down",
        html,
    })
}
