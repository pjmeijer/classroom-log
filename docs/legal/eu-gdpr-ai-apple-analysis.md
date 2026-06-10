# Legal & compliance analysis — Classroom Log (Observationer)

> ⚠️ **This is informational research, not legal advice.** It was assembled from
> primary sources by an AI research process and must be confirmed with a
> qualified EU / Danish data-protection lawyer before you rely on it commercially —
> especially the parts touching children's and special-category data. Treat this
> as a structured starting point and checklist, not a legal opinion.

**Scope:** EU baseline (GDPR, EU AI Act) with a Denmark lens (Datatilsynet, the
Danish Data Protection Act). **Operating model assumed:** the app is sold to
schools/municipalities — the **school/municipality is the data controller**, the
**developer (Per-Johan Meijer) is the data processor**, and **OpenAI (Whisper)
and Anthropic (Claude) are sub-processors.**

**The app:** teachers record short voice notes about pupils; audio goes over HTTPS
to a stateless backend (Railway) that forwards it to OpenAI Whisper (transcription)
and Anthropic Claude (summaries) and persists nothing; all notes, transcripts,
roster, and settings live only in local SQLite on the device; no accounts.

---

## Confidence legend

Findings are labelled by how strongly they're sourced:

- **[VERIFIED]** — confirmed by an adversarial 3-vote fact-check against primary
  sources (EUR-Lex / gdpr-info, EDPB, Datatilsynet, KL). High confidence.
- **[SOURCED]** — taken directly from an authoritative primary page (Apple /
  OpenAI / Anthropic / EUR-Lex) but not independently cross-verified. Reliable for
  factual statements; re-check before relying.
- **[FLAG]** — not confirmed in this pass; reasoned from the framework. Confirm
  with counsel / the vendor.

---

## 0. Executive summary — the short version

**The good news (favorable findings):**
- The architecture is privacy-friendly by design: **local-only storage** + a
  **stateless proxy that retains nothing**. Both OpenAI and Anthropic **do not
  train on API data by default** and offer **EU data residency** + **zero-data-
  retention** options. **[SOURCED]**
- Apple's **account-deletion** requirement **does not apply** (no accounts), and
  this is **not a Kids Category** app (its users are teachers, not children). **[SOURCED]**
- The EU AI Act most likely treats this as **minimal-risk** — not "high-risk"
  education AI under Annex III, because it doesn't admit, score, place, or proctor
  students. **[SOURCED]**

**The work you must do (the real obligations):**
1. **A written Data Processing Agreement (DPA) with every school/municipality** is
   legally required. This is the single biggest "sellable to schools" gate. **[VERIFIED]**
2. **Sub-processor compliance**: sign OpenAI's and Anthropic's DPAs, disclose them
   to schools as sub-processors, and turn on **EU data residency + zero/short
   retention**. **[VERIFIED obligation / SOURCED vendor terms]**
3. **Help schools meet their controller duties**: special-education observations
   likely touch **Art 9 special-category (health/disability) data**, schools use a
   **public-task** lawful basis (not consent), and a **DPIA is likely required** —
   you (processor) must *assist*. **[VERIFIED]**
4. **Apple**: privacy policy (done), accurate **App Privacy labels**, a clear
   **microphone purpose string**, and consider operating under a **legal entity**
   rather than an individual developer account. **[SOURCED]**

---

## 1. GDPR roles & the Data Processing Agreement (Art 28)

Who is who: **School/municipality = controller** (decides why pupil data is
processed), **developer = processor** (processes on the school's documented
instructions), **OpenAI & Anthropic = sub-processors**. In Danish practice the
controller is **frequently the municipality (kommune)**, not the individual
school. **[VERIFIED]**

### Legally required — on the developer (processor)

- **A binding written DPA with each controller.** Art 28(3) requires processing to
  be governed by a contract binding on the processor; Art 28(9) requires it in
  writing (electronic form is fine). No DPA = the school cannot lawfully use you. **[VERIFIED]**
- **The DPA must contain the eight Art 28(3)(a–h) clauses** plus the processing
  details (subject matter, duration, nature, purpose, data types, categories of
  data subjects, controller rights/obligations): **[VERIFIED]**
  1. process only on the controller's **documented instructions**;
  2. ensure persons processing the data are under a **duty of confidentiality**;
  3. take **Art 32 security** measures;
  4. respect the **sub-processor** conditions (28(2)/28(4));
  5. **assist the controller** in responding to data-subject rights requests;
  6. **assist with Arts 32–36** (security, breach notification, DPIAs, prior
     consultation);
  7. **delete or return** all personal data at end of service;
  8. make available information to demonstrate compliance and allow **audits/
     inspections**.
- **Sub-processor authorization (Art 28(2)).** You may not use OpenAI/Anthropic
  without the controller's prior **specific or general written authorisation**.
  Under *general* authorisation you must **inform the school of any addition or
  replacement** of a sub-processor and give it a chance to **object**. **[VERIFIED]**
- **Flow-down + liability (Art 28(4)).** You must impose the **same data-protection
  obligations** on OpenAI/Anthropic by contract, and you remain **fully liable to
  the school** for their performance. (Terms need not be verbatim, but must give
  equivalent protection.) **[VERIFIED]**
- **Records of processing (Art 30(2)).** As a processor you must keep a record of
  processing activities carried out on behalf of each controller. **[FLAG — Art 30 not
  separately verified this pass, but it's standard processor duty.]**
- **You can be fined directly.** A processor can be held liable / fined for failing
  its own obligations or for acting outside the controller's lawful instructions
  (EDPB Guidelines 07/2020 §74; Arts 28(10), 82, 83). **[VERIFIED]**
- **Provide & keep updated the sub-processor identities** (name, address, contact)
  so the school has them readily available at all times — to answer access requests
  and react to breaches (EDPB Opinion 22/2024). **[VERIFIED]**

### On the school (controller) — so you can set expectations

- The school retains **ultimate responsibility** for verifying that you, OpenAI,
  and Anthropic each provide **"sufficient guarantees" (Art 28(1))** — your
  proposing the sub-processors does **not** transfer that duty; the depth of
  verification scales with risk. **[VERIFIED]**
- For transfers of audio to **US-based** OpenAI/Anthropic, the school stays bound
  by **Art 28(1)** *and* the **Chapter V transfer rules (Art 44+)**. As the data
  exporter you (processor) should **prepare the transfer documentation** (transfer
  impact assessment + supplementary measures per EDPB Recommendations 01/2020); the
  school must **assess it and be able to show it to Datatilsynet**. **[VERIFIED]**

> **Practical:** produce a **standard DPA template** (with OpenAI + Anthropic
> pre-named as sub-processors and a transfer annex) that schools can sign. This is
> the artifact procurement officers will ask for first.

---

## 2. Children's & special-category pupil data (Denmark)

- **Schools/daycare (often the municipality) are the controllers**; the governing
  law is **GDPR + the Danish Data Protection Act (databeskyttelsesloven)**. **[VERIFIED]**
- **Lawful basis is the public-task basis, not consent.** Danish public-authority
  schools **cannot** rely on legitimate-interest balancing, and should **not** rely
  on consent (power imbalance), for core pupil-data processing. The basis is
  **Art 6(1)(e)** — task in the public interest / exercise of official authority
  (*offentlig myndighedsudøvelse*). **[VERIFIED]**
- **Children get enhanced protection** because they're less aware of risks and
  their rights (Datatilsynet; GDPR Recital 38). **[VERIFIED]**
- **Special-education observations likely include Art 9 special-category data.**
  Information about a pupil's **health or disability** is sensitive Art 9 data
  (Danish guidance: a recorded absence is sensitive if it concerns the pupil's
  health). Observations in a *special-education* context will frequently reveal
  health/disability, so the school needs an **Art 9 condition in addition to the
  Art 6(1)(e) basis**. **[VERIFIED]**

> **Practical:** in your DPA / privacy materials, **assume the data is special-
> category**. That raises the bar on security (Art 32) and makes a **DPIA** very
> likely (see §6). Datatilsynet has actively audited schools' use of US cloud
> services (the Google Workspace / Chromebook decisions) — the transfer + sub-
> processor story matters to your Danish buyers specifically.

---

## 3. AI sub-processors — OpenAI (Whisper) & Anthropic (Claude)

### What the vendors actually offer **[SOURCED]**

| | OpenAI (API / Whisper) | Anthropic (Claude API) |
|---|---|---|
| Acts as processor + offers a **DPA** | Yes (Data Processing Addendum) | Yes (signable DPA via privacy.claude.com) |
| **Trains on your API data by default** | **No** ("not used to train … unless you explicitly opt in") | **No** ("by default, we will not use your inputs or outputs from our commercial products … to train") |
| Default **retention** | Up to **30 days** abuse-monitoring logs; none persisted for stateless completion calls | API: minimal by default; **feedback you submit** is stored up to 5 years |
| **Zero-Data-Retention / Modified Abuse Monitoring** | **Yes**, for approved customers (excludes content from abuse logs) | Check Anthropic Commercial Terms / Trust Center |
| **EU data residency** | **Yes** — "Europe (EEA + Switzerland)" region available (needs ZDR amendment + approval) | Check Anthropic Trust Center for EU options |

### Concrete steps to make each compliant as a sub-processor

1. **Sign both DPAs** (OpenAI DPA; Anthropic DPA) — these are your Art 28(4)
   flow-down contracts. **[VERIFIED obligation]**
2. **Turn on EU data residency** (OpenAI EEA region; check Anthropic) and **zero/
   short data retention** so audio/text isn't stored in the US. This is the
   strongest answer to Danish buyers' transfer concerns. **[SOURCED]**
3. **Confirm the cross-border transfer mechanism** for any residual US processing:
   both rely on the **EU-US Data Privacy Framework** and/or **Standard Contractual
   Clauses** in their DPAs. **[FLAG — confirm the exact mechanism and DPF
   certification on each vendor's current DPA/trust page; I could not fetch
   OpenAI's DPA text directly this pass.]**
4. **Disclose both as sub-processors** in your school DPA and keep the list current
   (Art 28(2) notify-and-object). **[VERIFIED]**
5. **Document a transfer impact assessment** (TIA) you can hand to schools. **[VERIFIED]**

> **Strong recommendation:** enabling **EU residency + ZDR on both vendors**
> collapses most of the transfer risk and is the cleanest pitch to schools.
> Verify current availability/pricing — residency may require a sales agreement.

---

## 4. EU AI Act

- **Classification: most likely _minimal-risk_, not high-risk. [SOURCED]** Annex III
  point 3 (education) makes only four kinds of education AI *high-risk*: systems
  that (a) determine **access/admission**, (b) **evaluate learning outcomes** /
  steer learning, (c) **assess the level of education** a person should get, or
  (d) **monitor/detect prohibited behaviour during tests**. A tool that only
  **transcribes voice and summarizes a teacher's own notes** — without scoring,
  ranking, admitting, placing, or proctoring pupils — does **not** fall in those
  buckets.
- **Transparency (Art 50): likely no hard obligation, but disclose anyway. [SOURCED]**
  Art 50 requires marking AI-generated/manipulated content **except** for systems
  that perform an **assistive function for standard editing** or **don't
  substantially alter the input**. Faithful transcription + summarizing the
  teacher's own notes reads as assistive. **[FLAG]** The AI-generated *summary* is
  new text, so the safest posture is to **tell users the summary is AI-generated**
  (you already do, in the onboarding copy) — cheap, and it pre-empts any argument.
- **Timeline / caveat. [FLAG]** AI Act obligations phase in through 2025–2027 and
  the high-risk rules have seen proposed deadline changes. Re-check the current
  timeline; if your product later adds any *evaluative* feature (grading,
  flagging at-risk pupils, recommending interventions), **re-assess** — that could
  push it toward high-risk.

---

## 5. Apple App Store & TestFlight

### Privacy & data **[SOURCED]**

- **Privacy policy (5.1.1(i))** — required in App Store Connect *and* in-app, must
  state what's collected, third-party sharing, retention, and how to request
  deletion. ✅ You have `/privacy`; make sure it's also linked **inside the app**.
- **Purpose strings & consent (5.1.1(ii))** — the **microphone** prompt needs a
  clear `NSMicrophoneUsageDescription` describing exactly why (e.g. "Used to record
  voice notes about students, which are transcribed to text"). Consent is required
  for collection; provide a way to withdraw.
- **Data minimization (5.1.1(iii))** — only request mic access tied to core
  functionality. ✅ Already the case.

### App Privacy "nutrition labels" — important nuance **[SOURCED]**

Apple defines **"collect"** as transmitting data off-device and **retaining it
longer than needed to service the request**. Two consequences for you:
- **On-device-only data is NOT "collected"** — your notes/roster/transcripts in
  local SQLite don't need declaring.
- **Transient, immediately-discarded** server processing is **not "collection"**
  either ("if data is sent to your servers then immediately discarded after
  servicing the request, you do not need to disclose this"). Your backend is
  stateless, so the audio/note-text forwarded to OpenAI/Anthropic **may not require
  a 'collected data' declaration** — *provided* you can stand behind "not retained"
  (turn on ZDR to make that literally true).
- **Conservative option:** if in doubt, declare **"Audio Data"** and **"Other User
  Content"** as *collected, not linked to identity, used for App Functionality*.
  Being over-inclusive is safe; under-declaring is a review/legal risk. Decide this
  deliberately and keep it consistent with your privacy policy.

### Things that **do not** apply (favorable) **[SOURCED]**

- **Account deletion (5.1.1(v))** applies only "**if your app supports account
  creation**." You have **no accounts** → **not required.**
- **Kids Category (1.3 / 5.1.4)** is for apps whose **users are children**. Your
  users are **teachers**; the app processes data *about* minors but isn't *directed
  at* child users → **not a Kids Category app.** Do **not** use "For Kids/Children"
  in metadata (reserved). Still follow heightened privacy for the children's data.

### Worth acting on **[SOURCED]**

- **Operate under a legal entity, not an individual developer account.** Guideline
  **5.1.1(ix)**: apps "in highly regulated fields … or that require sensitive user
  information **should be submitted by a legal entity** … not an individual
  developer." Selling a tool that handles **sensitive children's data** to **schools**
  points strongly toward forming a company (ApS/enkeltmandsvirksomhed → consider an
  **ApS**) and moving the Apple account + contracts under it. This also matters for
  GDPR processor liability (§1) — schools prefer to contract with an entity.
- **Contact info (1.5)** — "particularly important for apps used in the classroom."
  Keep a working support contact in the app + Support URL. ✅ (email in `/privacy`).
- **TestFlight** — external testing needs Beta App Review + your **Privacy Policy
  URL** (you have it). Keep real student data out of the beta (your test-info copy
  already tells testers to use made-up names — good).

---

## 6. DPIA, privacy policy, accessibility, ePrivacy

- **DPIA (Art 35) — very likely required, school's duty, you assist. [FLAG /
  VERIFIED-assist]** Large-scale processing of **children's** data that is **likely
  special-category** hits multiple EDPB "likely high-risk" criteria, so the school
  will probably need a **DPIA** before deployment. The DPIA is the *controller's*
  obligation, but Art 28(3)(f) makes **assisting it your contractual duty** —
  prepare a **DPIA helper pack** (data flows, sub-processors, retention, security
  measures, transfer analysis). Having this ready is a major sales accelerator.
- **Privacy-policy content. [SOURCED/FLAG]** Must satisfy GDPR Arts 13/14 (identity
  & roles, purposes & lawful basis, recipients/sub-processors, transfers + safeguards,
  retention, data-subject rights, complaint to Datatilsynet) *and* Apple 5.1.1(i).
  Your `/privacy` is a good base; for the school-sold product, align it with the DPA
  and name OpenAI/Anthropic + the transfer mechanism.
- **European Accessibility Act (EAA), in force 28 Jun 2025. [FLAG]** The EAA targets
  certain consumer products/services; a B2B/B2G tool sold to public schools may
  instead fall under the **public-sector Web Accessibility Directive** via the
  schools' procurement (EN 301 549 / WCAG 2.1 AA). Either way, **designing to WCAG
  2.1 AA** is the safe, marketable choice for an education product. Confirm exact
  applicability with counsel.
- **ePrivacy. [FLAG]** Storing data on the device's "terminal equipment" is
  generally exempt when **strictly necessary** for the service the user requested
  (which your local SQLite is), and you run **no tracking, ads, or analytics**, so
  ePrivacy is a low concern. Keep it that way (no third-party analytics SDKs).

---

## 7. Action checklist

### A. Legally required to sell to schools (do these)
- [ ] **DPA template** with each school/municipality containing all eight Art 28(3)
      clauses + processing details. **[VERIFIED]**
- [ ] **Sign OpenAI's and Anthropic's DPAs**; name both as sub-processors in your
      DPA with notify-and-object terms. **[VERIFIED]**
- [ ] **Enable EU data residency + zero/short retention** on OpenAI (and Anthropic
      if available); document it. **[SOURCED]**
- [ ] **Transfer impact assessment** (US processing) ready to hand to schools. **[VERIFIED]**
- [ ] **Records of processing (Art 30(2))** as a processor. **[FLAG]**
- [ ] **DPIA helper pack** to assist the school's DPIA. **[VERIFIED-assist]**
- [ ] **Confirm exact EU→US transfer mechanism** (DPF cert / SCCs) on each vendor's
      current DPA. **[FLAG]**

### B. Apple / app
- [ ] Microphone **purpose string** clear and specific. **[SOURCED]**
- [ ] **App Privacy labels** decided deliberately (transient-processing nuance) and
      consistent with the privacy policy. **[SOURCED]**
- [ ] Privacy-policy link **inside the app** (not just App Store Connect). **[SOURCED]**
- [ ] Keep real pupil data out of TestFlight. ✅
- [ ] Account deletion: **N/A** (no accounts). Kids Category: **N/A**. **[SOURCED]**

### C. Recommended / strategic
- [ ] **Form a legal entity (e.g. ApS)** for the Apple account, the DPAs, and
      liability — strongly advised given sensitive children's data + B2G sales.
      **[SOURCED 5.1.1(ix)]**
- [ ] Keep the **AI-generated-summary disclosure** in onboarding. **[SOURCED]**
- [ ] Design to **WCAG 2.1 AA**. **[FLAG]**
- [ ] No third-party analytics/ad SDKs (keeps ePrivacy + Kids/labels clean). **[SOURCED]**
- [ ] **Get a Danish/EU data-protection lawyer** to review the DPA template, the
      Art 9 basis, the DPIA, and the transfer story before commercial launch.

---

## Sources

**GDPR / processor obligations (primary):**
- GDPR Art 28 — https://gdpr-info.eu/art-28-gdpr/
- EDPB Guidelines 07/2020 (controller/processor) — https://www.edpb.europa.eu/system/files/2023-10/EDPB_guidelines_202007_controllerprocessor_final_en.pdf
- EDPB Opinion 22/2024 (reliance on (sub-)processors) — https://www.edpb.europa.eu/system/files/2024-10/edpb_opinion_202422_relianceonprocessors-sub-processors_en.pdf
- ICO — contract requirements — https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/accountability-and-governance/contracts-and-liabilities-between-controllers-and-processors-multi/what-needs-to-be-included-in-the-contract/

**Denmark / children & schools (primary):**
- Datatilsynet — skoler og daginstitutioner — https://www.datatilsynet.dk/regler-og-vejledning/skoler-og-daginstitutioner
- KL — elevers personoplysninger i folkeskolen (PDF) — https://www.kl.dk/media/wjtdj5sr/praktiske-spoergsmaal-og-svar-om-anvendelse-af-elevers-personoplysninger-i-foleskolen.pdf
- Danish Data Protection Act — https://www.retsinformation.dk/eli/lta/2018/502
- Datatilsynet — free-schools decision (2024) — https://www.datatilsynet.dk/afgoerelser/afgoerelser/2024/sep/datatilsynet-har-undersoegt-de-frie-grundskolers-behandling-af-personoplysninger

**AI sub-processors (primary):**
- OpenAI — API data usage & retention — https://developers.openai.com/api/docs/guides/your-data
- OpenAI — Data Processing Addendum — https://openai.com/policies/data-processing-addendum/
- Anthropic — model training / data use — https://privacy.claude.com/en/articles/7996868-is-my-data-used-for-model-training
- Anthropic — DPA — https://privacy.claude.com/en/articles/7996862-how-do-i-view-and-sign-your-data-processing-addendum-dpa

**EU AI Act:**
- Annex III — https://artificialintelligenceact.eu/annex/3/
- Article 50 (transparency) — https://artificialintelligenceact.eu/article/50/
- Article 6 (high-risk classification) — https://artificialintelligenceact.eu/article/6/

**Apple (primary):**
- App Review Guidelines — https://developer.apple.com/app-store/review/guidelines/
- App Privacy details — https://developer.apple.com/app-store/app-privacy-details/
- Offering account deletion — https://developer.apple.com/support/offering-account-deletion-in-your-app/

---

*Generated 2026-06-10 via `/deep-research` (GDPR/Danish layer adversarially
verified; AI Act / Apple / vendor layers from direct primary-source reads). Not
committed/pushed per request. Re-verify [FLAG] items and have counsel review
before commercial launch.*
