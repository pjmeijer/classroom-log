# Privatlivspolitik for Observationer (Classroom Log)

**Senest opdateret: 1. juni 2026**

> Served live at https://classroom-log-production.up.railway.app/privacy
> (see `backend/app/routes/privacy.py` — keep the two in sync).
> English version below / Engelsk version nedenfor.

## Kort fortalt

Observationer er en app til specialundervisning, hvor du noterer observationer
om dine elever ved at tale eller skrive. **Dine noter, transskriberet tekst,
indstillinger og klasseliste ligger udelukkende i en lokal database på din egen
enhed.** Vi har ingen brugerkonti, ingen login, ingen sporing og ingen reklamer.

## Hvilke data behandler appen?

- **Klasseliste:** de elevnavne, du selv indtaster.
- **Noter:** observationer, du skriver eller indtaler.
- **Lydoptagelser:** midlertidigt, mens en stemmenote bliver til tekst.
- **Indstillinger:** dine valg i appen (fx server-URL, stemme til/fra).

Appen indsamler **ikke** placering, kontakter, enheds-id'er, analytics eller
reklame-data.

## Hvor gemmes data?

Klasseliste, noter, transskriberet tekst og indstillinger gemmes **kun lokalt på
din enhed** i en database, der ikke forlader telefonen. Hvis du sletter appen,
slettes disse data.

## Hvad sendes til serveren – og hvorfor?

Vores server (`classroom-log-production.up.railway.app`) er en gennemstrømnings-
proxy uden database: den gemmer hverken dine noter, lyd eller tekst. To ting
forlader midlertidigt din enhed, kun for at blive behandlet:

1. **Lyd (til transskribering):** Når du optager en stemmenote, sendes lyden
   krypteret (HTTPS) til serveren, som straks sender den videre til **OpenAI
   (Whisper)** for at omdanne den til tekst. Teksten sendes retur. **Selve
   lydklippet gemmes ikke** – hverken på vores server eller på din enhed.
2. **Notetekst (til opsummering):** Når du laver en opsummering, sendes elevens
   navn og den relevante notetekst til serveren, som sender det videre til
   **Anthropic (Claude)** for at danne et resumé. Resuméet sendes retur og gemmes
   ikke på serveren.

OpenAI og Anthropic behandler oplysningerne som databehandlere under deres egne
API-vilkår. Begge angiver, at API-data som udgangspunkt ikke bruges til at træne
deres modeller. Se [OpenAIs privatlivspolitik](https://openai.com/policies/privacy-policy)
og [Anthropics privatlivspolitik](https://www.anthropic.com/legal/privacy).

## Følsomme data og børn

Appen kan indeholde observationer om elever, herunder mindreårige. Som bruger
(lærer/skole) er du ansvarlig for at have det fornødne retsgrundlag (fx samtykke
eller anden hjemmel efter GDPR) til at behandle disse oplysninger. Data holdes
lokalt på enheden og sendes kun til serveren i det omfang, der er beskrevet ovenfor.

## Dine rettigheder (GDPR)

Da data primært ligger lokalt på din enhed, har du fuld kontrol: du kan se,
rette og slette noter direkte i appen. For spørgsmål om indsigt, berigtigelse
eller sletning kontakt os på adressen nedenfor.

## Dataansvarlig og kontakt

Per-Johan Meijer
E-mail: pjmeijer@me.com

---

# Privacy Policy for Classroom Log (Observationer)

**Last updated: June 1, 2026**

## In short

Classroom Log is an app for special-education teaching that lets you record
observations about your students by speaking or typing. **Your notes, transcribed
text, settings, and class roster are stored only in a local database on your own
device.** There are no user accounts, no login, no tracking, and no advertising.

## What data the app handles

- **Class roster:** the student names you enter yourself.
- **Notes:** observations you type or dictate.
- **Audio recordings:** temporarily, while a voice note is turned into text.
- **Settings:** your in-app choices (e.g. server URL, voice on/off).

The app does **not** collect location, contacts, device identifiers, analytics,
or advertising data.

## Where data is stored

Your roster, notes, transcribed text, and settings are stored **only locally on
your device** in a database that does not leave the phone. Deleting the app
deletes this data.

## What is sent to the server — and why

Our server (`classroom-log-production.up.railway.app`) is a pass-through proxy
with no database: it does not store your notes, audio, or text. Two things
temporarily leave your device, solely to be processed:

1. **Audio (for transcription):** When you record a voice note, the audio is sent
   over an encrypted connection (HTTPS) to our server, which immediately forwards
   it to **OpenAI (Whisper)** to convert it to text. The text is returned. **The
   audio itself is not stored** — neither on our server nor on your device.
2. **Note text (for summaries):** When you generate a summary, the student's name
   and the relevant note text are sent to the server, which forwards them to
   **Anthropic (Claude)** to produce a summary. The summary is returned and is not
   stored on the server.

OpenAI and Anthropic process this data as subprocessors under their own API terms.
Both state that API data is not used to train their models by default. See
[OpenAI's privacy policy](https://openai.com/policies/privacy-policy) and
[Anthropic's privacy policy](https://www.anthropic.com/legal/privacy).

## Sensitive data and children

The app may contain observations about students, including minors. As the user
(teacher/school) you are responsible for having the necessary legal basis (e.g.
consent or another GDPR lawful basis) to process this information. Data is kept
locally on the device and sent to the server only to the extent described above.

## Your rights (GDPR)

Because data lives primarily on your device, you have full control: you can view,
edit, and delete notes directly in the app. For requests about access,
rectification, or erasure, contact us at the address below.

## Data controller and contact

Per-Johan Meijer
Email: pjmeijer@me.com
