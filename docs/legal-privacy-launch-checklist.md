# Care Harbor legal and privacy launch checklist

Updated October 21, 2026. Scope: the first Newfoundland and Labrador agency using the admin website with real records. Care Harbor is the developer's independent product; the first customer is the developer's employer, which knows about development. Ownership, the agency's PHIA status and its funding/health-authority obligations still need confirmation. Android publication is a separate release.

Use this alongside [the admin release checklist](admin-release-checklist.md) and [production safeguards](admin-production-safeguards.md). The working plan is **eight core Care Harbor documents: retain and finish the three existing legal drafts, then create five supporting documents**, plus six assessments and the launch gates below. This is the chosen organisation of the work, not a statutory document count. Agency notices and externally issued records are supporting evidence listed separately. Keep signed agreements, confidential provider evidence and privacy cases in restricted business storage, not this repository.

## Agreed launch scope (October 21)

Care Harbor focuses on scheduling and supporting care information. Funding authorization
records, allowances, expiry checks and funded/self-pay labels are retired. The agency
handles funding outside the app. Medical conditions, medications, allergies, care
instructions, agency/shift notes, per-visit progress notes and worker credential uploads
remain. This scope change does not complete the PHIA/privacy assessments or remove any
of the eight document workstreams. Agency funding-contract obligations still need review
even though the app no longer manages funding records.

## Documents already in the app

| Existing item | Location | Current status |
| --- | --- | --- |
| Privacy Policy | `/privacy`; `admin-frontend/src/routes/privacy.tsx` | Draft; operator/contact, locations, retention and other decisions remain open |
| Terms of Service | `/terms`; `admin-frontend/src/routes/terms.tsx` | Draft; commercial/legal placeholders remain |
| DPA | `/dpa`; `admin-frontend/src/routes/dpa.tsx` | Draft updated October 16 with proposed PHIA information-management clauses; Schedules A–D and professional review remain open |
| Account-deletion help | `/account-deletion` | Request guidance, not a contract or automatic deletion service; monitored contact and live process need verification |
| Legal settings and acceptance flow | `/settings/legal`, `/accept-terms` | Links and acceptance metadata, not additional agreements or proof of compliance |

The shared legal version is still `0.1-draft`. The settings cards currently say “Active” and “current”; those labels do not make the documents final. The displayed “Accepted by” name comes from the current signed-in user, so do not treat that display as verified evidence of the original signatory. Confirm and correct the acceptance record/display before relying on it for final execution.

Internal material already exists: [worker deletion runbook](../backend/ACCOUNT_DELETION.md), [production safeguards plan](admin-production-safeguards.md), [release readiness](release-readiness-2026-10-15.md), and staging test reports. These are useful inputs, not a complete privacy handbook or signed customer package.

## Eight core documents

The IDs below are the stable checklist references. A draft can be complete as a draft while its launch requirement remains open. None of D1–D8 is currently signed off as launch-ready.

| ID and document | Purpose and essential contents | How we complete it | Status |
| --- | --- | --- | --- |
| D1 Privacy Policy | Public explanation: operator/contact, information and purposes, recipients/locations, retention, rights/complaints, tracking and changes. Distinguish agency care records from the Provider's own activities and identify applicable laws. | Update existing page from confirmed D6/D7 facts; obtain legal review; publish final version. | Existing draft |
| D2 Terms of Service | Commercial rules: service scope, fees, support/availability, responsibilities, confidentiality, IP, liability, termination and disputes. | Complete existing draft with business choices; lawyer reviews commercial provisions. | Existing draft |
| D3 DPA and Information Management Agreement | Handling agency records: PHIA roles, permitted purposes/access, written commitments, providers/transfers, security, incidents, requests, audits, retention and return/deletion. Includes Schedules A–D. | Finish updated draft and schedules using D4/D6/D7; lawyer checks PHIA requirements; agency accepts final package. | Updated draft; schedules unresolved |
| D4 Agency Order or Pilot Agreement | Identifies the specific customer/deal: legal parties, signers, start date, free/paid period, scope, pricing, support, referenced Terms/DPA versions and acceptance. | Draft after parties and commercial choices are known; align with D2/D3; both parties execute. | To create |
| D5 Employer and Software Ownership Agreement | Clarifies the employee/vendor relationship: ownership, outside work, employer resources/confidentiality, permissions and any agreed licence. | Establish facts with employer and review employment terms; lawyer advises on appropriate acknowledgement/agreement or assignment; obtain signatures where needed. | To create; facts unresolved |
| D6 Information and Provider Register | Internal inventory: data categories and necessity, flow map, users/support access, enabled providers and legal roles, countries, backups, agreements and review dates. | Inspect implementation and actual production/provider evidence; agency supplies workflow facts. Use approved extracts in D3 Schedules A/B. | To create; partial inventory in DPA |
| D7 Privacy and Security Operations Handbook | Internal procedures: privacy contact, access/confidentiality/training, requests, incidents, retention/legal holds, export/deletion, logs, device security, patching, backups/recovery and absence cover. Include case/register templates and confidentiality forms as appendices. | Adapt official NL tools and existing runbooks; agree record rules with agency/adviser; rehearse procedures. Use approved extracts in D3 Schedules C/D. | To create from existing material |
| D8 Assessment and Launch Record | A living record of A1–A6 below: scope, findings, evidence, fixes, owners, decisions, review dates, approved release and agency go/no-go. Link supporting reports rather than duplicate them. | Assemble with developer, agency and appropriate advisers. Restrict privileged advice and confidential test details separately; record only suitable summaries here. | To create from existing evidence |

D2 + D3 + D4 form the customer agreement package. D1 stays a public notice; it is not a substitute for required consent. D3's four schedules are attachments, not four extra core documents: A covers parties/services/data/access; B providers/locations; C safeguards/incidents/audits; D retention/requests/exit. Final accepted schedules must be preserved with the agreement, not silently changed when internal registers change.

D7 combines the retention policy, request procedure, incident plan, security rules and continuity procedures. D8 combines assessment findings, remediation tracking and release evidence. The existing account-deletion page remains a help page; the legal settings screen remains a UI, not another agreement.

### Supporting records and agency materials

These are collected or executed as applicable; they are not all documents we author from scratch. Record their restricted locations and completion status in D8.

- [ ] Operator registration/incorporation records, applicable tax registrations and filing arrangements. Incorporation is the recommendation, not an automatic PHIA requirement.
- [ ] Provider contracts/DPAs, relevant assurance reports and verified configuration/location evidence, indexed in D6.
- [ ] Written confidentiality commitments and training acknowledgements using D7's appendices; completion is individual, not satisfied by having a blank template.
- [ ] Insurance quotes, decision and any purchased policy/certificate. Confirm agency contractual requirements; insurance is not automatically a universal PHIA requirement.
- [ ] Agency-approved patient/worker notices, consent/representative-authority arrangements where required, and any health-authority vendor approvals. The agency owns these; Care Harbor's D1 does not replace them.
- [ ] Signatures/acceptance receipts, immutable final agreements and privacy/incident/retention case records as work occurs.

## Six assessments

Each assessment needs a named reviewer, date, scope, findings and completion evidence in D8. Existing tests or a draft policy alone do not close an assessment. These are the recommended review workstreams; specific mandatory external approvals depend on A1.

| ID | Assessment | Who contributes | Completion evidence | State |
| --- | --- | --- | --- | --- |
| A1 | Applicable law and agency obligations | Agency owner/privacy lead and NL legal adviser; developer provides service facts | Confirmed PHIA roles; PIPEDA/non-care data analysis; funding/public-body/contract restrictions; required approvals and applicable ancillary obligations | Open |
| A2 | Privacy impact assessment | Developer and agency; privacy/legal input | D6 information flows, purposes/authority/minimisation, risks to people, mitigations, residual-risk decisions and review triggers | Open |
| A3 | Provider and transfer assessment | Developer; agency/adviser confirms permitted arrangements | Enabled providers, legal roles, agreements, storage/support/backup locations and acceptable safeguards/restrictions | Partial source inventory |
| A4 | Technical security assessment | Developer and appropriately skilled technical reviewer | Tested isolation/access removal, authentication, private files, support access, logging, encryption, dependency/patching and relevant application vulnerabilities; material findings fixed/retested | Partial engineering evidence |
| A5 | Operating and recovery rehearsal | Developer and agency contact | Delivered alerts, incident exercise, monitored request channel, access/correction/export/deletion trials, database/document restore, measured recovery and absence/outage fallback | Open; partial runbooks |
| A6 | Final contract and release review | NL software/privacy lawyer for legal terms; developer and agency for readiness | D1–D7 aligned with facts/capabilities; review findings resolved; final versions accepted; training, import and actual release approved | Open |

Ancillary screening in A1 includes ownership/employment issues, business/tax requirements, CASL if marketing, applicable accessibility and customer requirements, software/asset licences and intended medical-device scope. Android/store declarations are assessed separately when mobile is released.

## How we check items off

Use **Not started → Draft or In progress → Awaiting facts or review → Verified or Executed**. Record who owns the next action and the evidence needed to close it. An AI draft, a successful build or a provider's Canadian region does not establish legal or operational completion.

For every D/A item, D8 will retain: ID, owner, status, unresolved facts, evidence/reference, reviewer, completion date and next review trigger. Do not mark statutory obligations satisfied merely because the agency accepts a risk.

- [x] Inventory the existing three legal drafts and supporting pages/runbooks.
- [x] Update D3's proposed PHIA clauses locally, retaining draft status.
- [x] Establish stable document and assessment IDs in this checklist.
- [ ] Start D6 with the code-derived information inventory, separating verified implementation from unverified production/provider facts.
- [ ] Obtain the agency's funding/contract and privacy-contact facts for A1, and the employer/ownership facts for D5.
- [ ] Draft D7 and populate D8 from existing evidence; complete the remaining ordered work below.

## Ordered work list

### Establish the parties and rules

- [ ] Confirm software ownership and the outside-business arrangement with the employer, reviewing employment terms and development circumstances. Do not assume employer awareness settles ownership or authorises patient-data use.
- [ ] Choose the operator's legal structure. Incorporation before live agency use is the recommendation; obtain setup and ongoing accounting costs before deciding. Complete applicable registration and tax setup.
- [ ] Ask whether the agency provides private-pay care, government-funded/contracted care, or both. Name its privacy decision-maker and authorised signer; obtain relevant vendor/funding contract requirements.
- [ ] Confirm the agency's PHIA status and Care Harbor's information-manager role. Assess non-care employee/account/billing data and commercial cross-border flows separately.
- [ ] Obtain insurance quotes and document the coverage decision and any customer requirement.

### Complete facts and operating procedures

- [ ] Create the data inventory and flow map, including imports, support, logs, monitoring, billing, documents and backups. Mark unused mobile/push services as deferred for this admin release.
- [ ] Verify each enabled provider's legal entity, contracts, roles, locations, security and deletion terms. Canadian database hosting alone does not settle all locations or compliance.
- [ ] Name a privacy contact, create and test a monitored mailbox, and arrange cover when the solo operator is unavailable.
- [ ] Agree category-specific retention rules with the agency/adviser, including care history, employment/credentials, accounts, logs, request files, backups and legal holds. Avoid a single blanket deletion period.
- [ ] Complete access, correction, complaint, export and deletion procedures; specify identity/authority checks and deadlines. Test a full agency exit, not only the former-worker helper.
- [ ] Complete an incident plan with agency escalation, containment, evidence, individual/regulator notification responsibilities and an achievable contractual response commitment.
- [ ] Complete confidentiality commitments, training, support access, account removal, device handling and secure import procedures.
- [ ] Complete the PIA/security assessment and remedy priority findings. Check any required agency/health-authority assessment or approval process.

### Finalise agreements and public information

- [ ] Finish the agency order/pilot form and Terms: scope, fees, support, downtime, confidentiality, liability, termination and disputes.
- [ ] Complete DPA Schedule A (parties, services, data, access and dates), B (providers/locations/changes), C (security, incidents and compliance reviews), D (retention, requests and exit). These are proposed attachments, not completed documents in the app.
- [ ] Have an NL health-privacy/software lawyer review the full package and applicability, including PHIA and regulations, PIPEDA where applicable, employer/IP issues and the agency's contracts. Request written corrections and remaining conditions.
- [ ] Screen other relevant launch obligations: business/tax filings, marketing/CASL if used, accessibility/customer requirements and third-party software/asset licences. Reassess medical-device rules if features move beyond administration/recordkeeping into clinical decisions. See the sources below.
- [ ] Align the Privacy Policy and agency notices with the completed facts and agreements. Confirm any required consent or representative-authority process.
- [ ] Verify all promised capabilities and response times before removing placeholders. Review final acceptance mechanics, including actual signer identity, date/version and preserved copies; correct misleading settings metadata/labels.
- [ ] Release a new reviewed legal version consistently across frontend/backend, publish final contacts and documents, and obtain authorised agency acceptance. Do not reuse `0.1-draft` as the final version or treat draft acceptance as final agreement.

### Prove readiness and start service

- [ ] Finish the security checks in the production safeguards plan, including agency isolation, appropriate authentication, private files, support access, auditability and safe telemetry.
- [ ] Demonstrate database/document restoration, delivered alerts, request handling, agency export and deletion/retention handling using fictional records.
- [ ] Agree support hours, absence cover, downtime fallback, recovery expectations and worker communication without relying on unreleased mobile features.
- [ ] Retain completed agreements and evidence; train the agency; approve the import and launch before using real records.
- [ ] Schedule ongoing access/provider/retention reviews, patching, restore exercises and assessment of material feature changes. Keep incident and request registers current.

## DPA changes completed locally

- [x] Add conditional PHIA custodian/information-manager roles and express PHIA/regulations obligations.
- [x] Add written personnel commitments, authorised support/import purposes, proposed data-use restrictions and retained agency custody/control.
- [x] Add proposed incident cooperation, request/correction handling, compliance review, provider delegation and exit provisions.
- [x] Identify four schedules with the concrete unresolved decisions; retain prominent draft status and the existing draft legal version.
- [ ] Complete the schedules, confirm the proposed commercial commitments, obtain professional review and execute the final agreement. Wording changes do not implement or verify the operational promises.

## Sources and affordable help

The legal requirement for an information-management agreement depends on the applicable roles under [PHIA, including section 22](https://www.assembly.nl.ca/legislation/sr/statutes/p07-01.htm). The [Personal Health Information Regulations](https://www.assembly.nl.ca/Legislation/sr/regulations/rc110038.htm) include the material-breach assessment factors. The checklist combines legal obligations, contract preparation and recommended release practices; it is not a claim that every row is a separately mandated statutory document.

Use the free [OIPC Information Management Agreement guidance](https://www.oipc.nl.ca/files/BestPracticesForInformationManagementAgreements.pdf), [PHIA resources and assessment tools](https://www.gov.nl.ca/hcs/phia/), [custodian checklist](https://www.oipc.nl.ca/files/PHIAComplianceChecklist-1.pdf), and [reasonable safeguards guidance](https://www.oipc.nl.ca/files/ReasonableSafeguardsGuidance.pdf). Adapt templates to the actual service. The agency can seek guidance from [OIPC Advocacy and Compliance](https://www.oipc.nl.ca/about-us/advocacy-compliance/).

For professional assistance, ask [PLIAN through the Law Society referral information](https://lsnl.ca/public/faq/) for a lawyer with relevant experience and confirm the consultation fee and review scope. An introductory consultation is not a complete contract review. Prepare the drafts and operating facts first to reduce paid discovery time.

Other applicability checks: [PIPEDA](https://www.priv.gc.ca/en/privacy-topics/privacy-laws-in-canada/the-personal-information-protection-and-electronic-documents-act-pipeda/pipeda_brief/), [employment copyright](https://laws-lois.justice.gc.ca/eng/acts/C-42/section-13.html), [NL business registry](https://www.gov.nl.ca/gs/registries/companies/corp-about/), [GST/HST](https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/when-register-charge.html), [CASL](https://crtc.gc.ca/eng/internet/anti/reg.htm), [NL accessibility](https://www.gov.nl.ca/sswb/accessibility-act/), and [Health Canada software examples](https://www.canada.ca/en/health-canada/services/drugs-health-products/medical-devices/application-information/guidance-documents/software-medical-device-guidance/examples.html).
