from fastapi import APIRouter
from fastapi.responses import HTMLResponse

router = APIRouter()

# Self-contained privacy policy served at GET /privacy so the App Store /
# TestFlight "Privacy Policy URL" can point at our own domain. Kept in sync
# with docs/privacy-policy.md. HTML is embedded (no runtime file read) so it
# works regardless of the deployment's working directory.
_PRIVACY_HTML = """<!doctype html>
<html lang="da">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Privatlivspolitik – Observationer (Classroom Log)</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
         line-height: 1.6; color: #1a1a1a; max-width: 720px; margin: 0 auto;
         padding: 2rem 1.25rem; }
  h1 { font-size: 1.5rem; margin-top: 2rem; }
  h2 { font-size: 1.15rem; margin-top: 1.75rem; }
  code { background: #f2f2f2; padding: 0.1em 0.3em; border-radius: 4px; }
  hr { border: none; border-top: 1px solid #ddd; margin: 2.5rem 0; }
  .updated { color: #666; font-size: 0.9rem; }
  a { color: #208AEF; }
</style>
</head>
<body>

<h1>Privatlivspolitik for Observationer (Classroom Log)</h1>
<p class="updated">Senest opdateret: 1. juni 2026</p>

<h2>Kort fortalt</h2>
<p>Observationer er en app til specialundervisning, hvor du noterer observationer
om dine elever ved at tale eller skrive. <strong>Dine noter, transskriberet tekst,
indstillinger og klasseliste ligger udelukkende i en lokal database på din egen
enhed.</strong> Vi har ingen brugerkonti, ingen login, ingen sporing og ingen
reklamer.</p>

<h2>Hvilke data behandler appen?</h2>
<ul>
  <li><strong>Klasseliste:</strong> de elevnavne, du selv indtaster.</li>
  <li><strong>Noter:</strong> observationer, du skriver eller indtaler.</li>
  <li><strong>Lydoptagelser:</strong> midlertidigt, mens en stemmenote bliver til tekst.</li>
  <li><strong>Indstillinger:</strong> dine valg i appen.</li>
</ul>
<p>Appen indsamler <strong>ikke</strong> placering, kontakter, enheds-id'er,
analytics eller reklame-data.</p>

<h2>Hvor gemmes data?</h2>
<p>Klasseliste, noter, transskriberet tekst og indstillinger gemmes <strong>kun
lokalt på din enhed</strong> i en database, der ikke forlader telefonen. Hvis du
sletter appen, slettes disse data.</p>

<h2>Hvad sendes til serveren – og hvorfor?</h2>
<p>Vores server (<code>classroom-log-production.up.railway.app</code>) er en
gennemstrømnings-proxy uden database: den gemmer hverken dine noter, lyd eller
tekst. To ting forlader midlertidigt din enhed, kun for at blive behandlet:</p>
<ol>
  <li><strong>Lyd (til transskribering):</strong> Når du optager en stemmenote,
  sendes lyden krypteret (HTTPS) til serveren, som straks sender den videre til
  <strong>OpenAI (Whisper)</strong> for at omdanne den til tekst. Teksten sendes
  retur. <strong>Selve lydklippet gemmes ikke</strong> – hverken på vores server
  eller på din enhed.</li>
  <li><strong>Notetekst (til opsummering):</strong> Når du laver en opsummering,
  sendes elevens navn og den relevante notetekst til serveren, som sender det
  videre til <strong>Anthropic (Claude)</strong> for at danne et resumé. Resuméet
  sendes retur og gemmes ikke på serveren.</li>
</ol>
<p>OpenAI og Anthropic behandler oplysningerne som databehandlere under deres egne
API-vilkår. Begge angiver, at API-data som udgangspunkt ikke bruges til at træne
deres modeller. Se
<a href="https://openai.com/policies/privacy-policy">OpenAIs privatlivspolitik</a>
og <a href="https://www.anthropic.com/legal/privacy">Anthropics privatlivspolitik</a>.</p>

<h2>Følsomme data og børn</h2>
<p>Appen kan indeholde observationer om elever, herunder mindreårige. Som bruger
(lærer/skole) er du ansvarlig for at have det fornødne retsgrundlag (fx samtykke
eller anden hjemmel efter GDPR) til at behandle disse oplysninger. Data holdes
lokalt på enheden og sendes kun til serveren i det omfang, der er beskrevet ovenfor.</p>

<h2>Dine rettigheder (GDPR)</h2>
<p>Da data primært ligger lokalt på din enhed, har du fuld kontrol: du kan se,
rette og slette noter direkte i appen. For spørgsmål om indsigt, berigtigelse
eller sletning kontakt os på adressen nedenfor.</p>

<h2>Dataansvarlig og kontakt</h2>
<p>Per-Johan Meijer<br>
E-mail: <a href="mailto:pjmeijer@me.com">pjmeijer@me.com</a></p>

<hr>

<h1>Privacy Policy for Classroom Log (Observationer)</h1>
<p class="updated">Last updated: June 1, 2026</p>

<h2>In short</h2>
<p>Classroom Log is an app for special-education teaching that lets you record
observations about your students by speaking or typing. <strong>Your notes,
transcribed text, settings, and class roster are stored only in a local database
on your own device.</strong> There are no user accounts, no login, no tracking,
and no advertising.</p>

<h2>What data the app handles</h2>
<ul>
  <li><strong>Class roster:</strong> the student names you enter yourself.</li>
  <li><strong>Notes:</strong> observations you type or dictate.</li>
  <li><strong>Audio recordings:</strong> temporarily, while a voice note is turned into text.</li>
  <li><strong>Settings:</strong> your in-app choices.</li>
</ul>
<p>The app does <strong>not</strong> collect location, contacts, device
identifiers, analytics, or advertising data.</p>

<h2>Where data is stored</h2>
<p>Your roster, notes, transcribed text, and settings are stored <strong>only
locally on your device</strong> in a database that does not leave the phone.
Deleting the app deletes this data.</p>

<h2>What is sent to the server — and why</h2>
<p>Our server (<code>classroom-log-production.up.railway.app</code>) is a
pass-through proxy with no database: it does not store your notes, audio, or text.
Two things temporarily leave your device, solely to be processed:</p>
<ol>
  <li><strong>Audio (for transcription):</strong> When you record a voice note, the
  audio is sent over an encrypted connection (HTTPS) to our server, which
  immediately forwards it to <strong>OpenAI (Whisper)</strong> to convert it to
  text. The text is returned. <strong>The audio itself is not stored</strong> —
  neither on our server nor on your device.</li>
  <li><strong>Note text (for summaries):</strong> When you generate a summary, the
  student's name and the relevant note text are sent to the server, which forwards
  them to <strong>Anthropic (Claude)</strong> to produce a summary. The summary is
  returned and is not stored on the server.</li>
</ol>
<p>OpenAI and Anthropic process this data as subprocessors under their own API
terms. Both state that API data is not used to train their models by default. See
<a href="https://openai.com/policies/privacy-policy">OpenAI's privacy policy</a>
and <a href="https://www.anthropic.com/legal/privacy">Anthropic's privacy policy</a>.</p>

<h2>Sensitive data and children</h2>
<p>The app may contain observations about students, including minors. As the user
(teacher/school) you are responsible for having the necessary legal basis (e.g.
consent or another GDPR lawful basis) to process this information. Data is kept
locally on the device and sent to the server only to the extent described above.</p>

<h2>Your rights (GDPR)</h2>
<p>Because data lives primarily on your device, you have full control: you can
view, edit, and delete notes directly in the app. For requests about access,
rectification, or erasure, contact us at the address below.</p>

<h2>Data controller and contact</h2>
<p>Per-Johan Meijer<br>
Email: <a href="mailto:pjmeijer@me.com">pjmeijer@me.com</a></p>

</body>
</html>
"""


@router.get("/privacy", response_class=HTMLResponse)
async def privacy():
    return HTMLResponse(content=_PRIVACY_HTML)
