import type { Jurisdiction, RequestType } from "@/db/schema";

export type SystemTemplate = {
  key: string;
  jurisdiction: Jurisdiction;
  kind: "request" | "reminder" | "escalation";
  requestType: RequestType | null;
  language: "de" | "en";
  name: string;
  subject: string;
  body: string;
};

const SIG_DE = `Freundliche Grüsse

{{signature}}
{{senderEmail}}`;

const SIG_EN = `Kind regards,

{{signature}}
{{senderEmail}}`;

const IDENT_DE = `Zur Identifikation meiner Person und der mich betreffenden Datensätze:
Name: {{fullName}}
Weitere Namensvarianten:
{{aliases}}
Geburtsdatum: {{birthDate}}
Adressen (aktuell und frühere):
{{addresses}}
E-Mail-Adressen:
{{emails}}
Telefonnummern:
{{phones}}`;

const IDENT_EN = `To identify me and the records relating to me:
Name: {{fullName}}
Other name variants:
{{aliases}}
Date of birth: {{birthDate}}
Addresses (current and previous):
{{addresses}}
E-mail addresses:
{{emails}}
Phone numbers:
{{phones}}`;

const NO_ID_DE = `Bitte beachten Sie, dass ich keine Ausweiskopie beilege. Die oben genannten Angaben genügen zur Identifikation; sollten Sie begründete Zweifel an meiner Identität haben, nennen Sie mir bitte konkret, welche zusätzlichen Angaben Sie benötigen (vgl. Art. 12 Abs. 6 DSGVO bzw. das Verhältnismässigkeitsprinzip). Ich widerspreche einer Verwendung dieser Anfrage zu anderen Zwecken als zu deren Bearbeitung.`;

const NO_ID_DSG_DE = `Bitte beachten Sie, dass ich keine Ausweiskopie beilege. Die oben genannten Angaben genügen zur Identifikation; sollten Sie begründete Zweifel an meiner Identität haben, nennen Sie mir bitte konkret, welche zusätzlichen Angaben Sie benötigen (Grundsatz der Verhältnismässigkeit, Art. 6 Abs. 2 DSG). Ich widerspreche einer Verwendung dieser Anfrage zu anderen Zwecken als zu deren Bearbeitung.`;

const NO_ID_DSG_EN = `Please note that I am not attaching a copy of an identity document. The information above is sufficient to identify me; if you have reasonable doubts about my identity, please state specifically which additional information you require (principle of proportionality, Art. 6 para. 2 FADP). I object to any use of this request for purposes other than processing it.`;

const NO_ID_EN = `Please note that I am not attaching a copy of an identity document. The information above is sufficient to identify me; if you have reasonable doubts about my identity, please state specifically which additional information you require (cf. Art. 12(6) GDPR and the principle of proportionality). I object to any use of this request for purposes other than processing it.`;

export const SYSTEM_TEMPLATES: SystemTemplate[] = [
  // ---------------- GDPR ----------------
  {
    key: "gdpr_erasure_de",
    jurisdiction: "gdpr",
    kind: "request",
    requestType: "erasure",
    language: "de",
    name: "DSGVO Löschung (Art. 17) – Deutsch",
    subject: "Antrag auf Löschung personenbezogener Daten gemäss Art. 17 DSGVO [{{reference}}]",
    body: `Sehr geehrte Damen und Herren,

hiermit fordere ich Sie gemäss Art. 17 DSGVO auf, sämtliche personenbezogenen Daten, die Sie über mich verarbeiten, unverzüglich zu löschen. Dies umfasst insbesondere Daten in Ihren Datenbanken, Profilen, Marketinglisten, Suchindizes und Backups sowie Daten, die Sie an Dritte weitergegeben haben.

Gleichzeitig widerspreche ich gemäss Art. 21 DSGVO jeder weiteren Verarbeitung meiner Daten, insbesondere zu Zwecken der Direktwerbung, des Profilings und des Handels mit Daten, und widerrufe allfällige Einwilligungen.

Soweit Sie meine Daten an Dritte weitergegeben haben, fordere ich Sie gemäss Art. 19 DSGVO auf, diese Empfänger über die Löschung zu informieren und mir die Empfänger mitzuteilen.

{{IDENT}}

Fundstellen meiner Daten (falls bekannt):
{{dataUrls}}

Bitte bestätigen Sie mir die vollständige Löschung schriftlich innerhalb der gesetzlichen Frist von einem Monat (Art. 12 Abs. 3 DSGVO), spätestens bis zum {{deadlineDate}}. Sollten Sie der Löschung nicht nachkommen, teilen Sie mir bitte die Gründe mit (Art. 12 Abs. 4 DSGVO). Ich behalte mir vor, mich bei der zuständigen Aufsichtsbehörde zu beschweren (Art. 77 DSGVO).

{{NO_ID}}

Bitte führen Sie die Referenz {{reference}} in Ihrer Antwort.

{{SIG}}`,
  },
  {
    key: "gdpr_erasure_en",
    jurisdiction: "gdpr",
    kind: "request",
    requestType: "erasure",
    language: "en",
    name: "GDPR Erasure (Art. 17) – English",
    subject: "Request for erasure of personal data under Art. 17 GDPR [{{reference}}]",
    body: `Dear Data Protection Officer,

Pursuant to Article 17 GDPR I hereby request that you erase without undue delay all personal data you process about me. This includes data in your databases, profiles, marketing lists, search indices and backups, as well as data you have disclosed to third parties.

At the same time I object under Article 21 GDPR to any further processing of my data, in particular for direct marketing, profiling and the sale or licensing of data, and I withdraw any consent that may have been given.

Where you have disclosed my data to third parties, I request under Article 19 GDPR that you inform those recipients of the erasure and tell me who they are.

{{IDENT}}

Where my data was found (if known):
{{dataUrls}}

Please confirm the complete erasure in writing within the statutory period of one month (Art. 12(3) GDPR), i.e. by {{deadlineDate}} at the latest. If you do not comply, please state your reasons (Art. 12(4) GDPR). I reserve the right to lodge a complaint with the competent supervisory authority (Art. 77 GDPR).

{{NO_ID}}

Please quote reference {{reference}} in your reply.

{{SIG}}`,
  },
  {
    key: "gdpr_access_de",
    jurisdiction: "gdpr",
    kind: "request",
    requestType: "access",
    language: "de",
    name: "DSGVO Auskunft (Art. 15) – Deutsch",
    subject: "Auskunftsersuchen gemäss Art. 15 DSGVO [{{reference}}]",
    body: `Sehr geehrte Damen und Herren,

gemäss Art. 15 DSGVO ersuche ich Sie um Auskunft darüber, ob und welche personenbezogenen Daten Sie über mich verarbeiten. Bitte teilen Sie mir insbesondere mit:

1. sämtliche gespeicherten Daten (vollständige Kopie, Art. 15 Abs. 3 DSGVO),
2. die Verarbeitungszwecke,
3. die Kategorien der Daten,
4. die Empfänger oder Kategorien von Empfängern, insbesondere in Drittländern,
5. die geplante Speicherdauer,
6. die Herkunft der Daten, soweit sie nicht bei mir erhoben wurden (Art. 15 Abs. 1 lit. g DSGVO),
7. das Bestehen einer automatisierten Entscheidungsfindung einschliesslich Profiling.

{{IDENT}}

Die Auskunft ist innerhalb eines Monats zu erteilen (Art. 12 Abs. 3 DSGVO), also bis spätestens {{deadlineDate}}. Bitte senden Sie die Auskunft an {{senderEmail}}.

{{NO_ID}}

Bitte führen Sie die Referenz {{reference}} in Ihrer Antwort.

{{SIG}}`,
  },
  {
    key: "gdpr_access_en",
    jurisdiction: "gdpr",
    kind: "request",
    requestType: "access",
    language: "en",
    name: "GDPR Access (Art. 15) – English",
    subject: "Data subject access request under Art. 15 GDPR [{{reference}}]",
    body: `Dear Data Protection Officer,

Pursuant to Article 15 GDPR I request confirmation whether you process personal data concerning me and, if so, access to the following:

1. a complete copy of all personal data you hold about me (Art. 15(3) GDPR),
2. the purposes of the processing,
3. the categories of data,
4. the recipients or categories of recipients, in particular in third countries,
5. the envisaged retention period,
6. the source of the data where not collected from me (Art. 15(1)(g) GDPR),
7. the existence of automated decision-making, including profiling.

{{IDENT}}

The information must be provided within one month (Art. 12(3) GDPR), i.e. by {{deadlineDate}}. Please send it to {{senderEmail}}.

{{NO_ID}}

Please quote reference {{reference}} in your reply.

{{SIG}}`,
  },
  {
    key: "gdpr_optout_de",
    jurisdiction: "gdpr",
    kind: "request",
    requestType: "optout",
    language: "de",
    name: "DSGVO Widerspruch (Art. 21) – Deutsch",
    subject: "Widerspruch gegen die Verarbeitung gemäss Art. 21 DSGVO [{{reference}}]",
    body: `Sehr geehrte Damen und Herren,

hiermit widerspreche ich gemäss Art. 21 DSGVO der Verarbeitung meiner personenbezogenen Daten, insbesondere zu Zwecken der Direktwerbung, des Profilings und der Weitergabe an Dritte. Allfällige Einwilligungen widerrufe ich.

Bitte sperren Sie meine Daten für jede weitere Verarbeitung und nehmen Sie mich in Ihre interne Sperrliste auf, damit meine Daten nicht erneut erhoben werden.

{{IDENT}}

Bitte bestätigen Sie mir die Umsetzung bis spätestens {{deadlineDate}}.

{{NO_ID}}

Bitte führen Sie die Referenz {{reference}} in Ihrer Antwort.

{{SIG}}`,
  },
  {
    key: "gdpr_optout_en",
    jurisdiction: "gdpr",
    kind: "request",
    requestType: "optout",
    language: "en",
    name: "GDPR Objection (Art. 21) – English",
    subject: "Objection to processing under Art. 21 GDPR [{{reference}}]",
    body: `Dear Data Protection Officer,

I hereby object under Article 21 GDPR to the processing of my personal data, in particular for direct marketing, profiling and disclosure to third parties. I withdraw any consent that may have been given.

Please suppress my data from any further processing and add me to your internal suppression list so that my data is not collected again.

{{IDENT}}

Please confirm implementation by {{deadlineDate}} at the latest.

{{NO_ID}}

Please quote reference {{reference}} in your reply.

{{SIG}}`,
  },

  // ---------------- CH DSG ----------------
  {
    key: "dsg_erasure_de",
    jurisdiction: "dsg",
    kind: "request",
    requestType: "erasure",
    language: "de",
    name: "CH DSG Löschung (Art. 32) – Deutsch",
    subject: "Begehren um Löschung meiner Personendaten gemäss Art. 32 DSG [{{reference}}]",
    body: `Sehr geehrte Damen und Herren,

gestützt auf das Bundesgesetz über den Datenschutz (DSG, SR 235.1) verlange ich, dass Sie sämtliche mich betreffenden Personendaten vernichten bzw. löschen (Art. 32 Abs. 2 lit. c DSG) und jede weitere Bearbeitung unterlassen (Art. 32 Abs. 2 lit. a DSG). Dies gilt insbesondere für Daten in Datenbanken, Profilen, Adress- und Marketinglisten, Suchindizes und Sicherungskopien sowie für Daten, die Sie an Dritte bekanntgegeben haben.

Ich widerspreche ausdrücklich der Bearbeitung meiner Daten zu Werbe-, Profiling- und Adresshandelszwecken (Art. 30 Abs. 2 lit. b DSG) und widerrufe allfällige Einwilligungen.

Soweit Sie meine Daten an Dritte bekanntgegeben haben, bitte ich Sie, mir diese Empfänger mitzuteilen und die Löschung an sie weiterzuleiten.

{{IDENT}}

Fundstellen meiner Daten (falls bekannt):
{{dataUrls}}

Ich bitte um schriftliche Bestätigung der vollständigen Löschung innert 30 Tagen, spätestens bis zum {{deadlineDate}}. Sollten Sie meinem Begehren nicht nachkommen, bitte ich um Begründung. Ich behalte mir vor, eine Meldung an den Eidgenössischen Datenschutz- und Öffentlichkeitsbeauftragten (EDÖB) zu erstatten und meine Ansprüche nach Art. 32 Abs. 2 DSG gerichtlich durchzusetzen.

{{NO_ID}}

Bitte führen Sie die Referenz {{reference}} in Ihrer Antwort.

{{SIG}}`,
  },
  {
    key: "dsg_erasure_en",
    jurisdiction: "dsg",
    kind: "request",
    requestType: "erasure",
    language: "en",
    name: "CH FADP Erasure (Art. 32) – English",
    subject: "Request for erasure of my personal data under Art. 32 FADP [{{reference}}]",
    body: `Dear Data Protection Officer,

Based on the Swiss Federal Act on Data Protection (FADP, SR 235.1) I request that you destroy or erase all personal data relating to me (Art. 32 para. 2 lit. c FADP) and cease any further processing (Art. 32 para. 2 lit. a FADP). This applies in particular to data in databases, profiles, address and marketing lists, search indices and backups, as well as data you have disclosed to third parties.

I expressly object to the processing of my data for advertising, profiling and address-trading purposes (Art. 30 para. 2 lit. b FADP) and withdraw any consent that may have been given.

Where you have disclosed my data to third parties, please tell me who those recipients are and forward the erasure request to them.

{{IDENT}}

Where my data was found (if known):
{{dataUrls}}

Please confirm the complete erasure in writing within 30 days, i.e. by {{deadlineDate}} at the latest. If you do not comply, please state your reasons. I reserve the right to report the matter to the Federal Data Protection and Information Commissioner (FDPIC) and to enforce my claims under Art. 32 para. 2 FADP in court.

{{NO_ID}}

Please quote reference {{reference}} in your reply.

{{SIG}}`,
  },
  {
    key: "dsg_access_de",
    jurisdiction: "dsg",
    kind: "request",
    requestType: "access",
    language: "de",
    name: "CH DSG Auskunft (Art. 25) – Deutsch",
    subject: "Auskunftsbegehren gemäss Art. 25 DSG [{{reference}}]",
    body: `Sehr geehrte Damen und Herren,

gestützt auf Art. 25 DSG ersuche ich um Auskunft, ob Sie Personendaten über mich bearbeiten, und um Mitteilung aller Informationen, die erforderlich sind, damit ich meine Rechte geltend machen kann. Insbesondere bitte ich um:

1. sämtliche bearbeiteten Personendaten als solche (vollständige Kopie),
2. den Bearbeitungszweck,
3. die Aufbewahrungsdauer bzw. die Kriterien zu ihrer Festlegung,
4. die Herkunft der Daten, soweit sie nicht bei mir beschafft wurden,
5. das Vorliegen einer automatisierten Einzelentscheidung,
6. die Empfänger oder Kategorien von Empfängern, einschliesslich Staat und Garantien bei Bekanntgabe ins Ausland.

{{IDENT}}

Die Auskunft ist gemäss Art. 25 Abs. 7 DSG innert 30 Tagen zu erteilen, also bis spätestens {{deadlineDate}}, und ist in der Regel kostenlos. Bitte senden Sie die Auskunft an {{senderEmail}}.

{{NO_ID}}

Bitte führen Sie die Referenz {{reference}} in Ihrer Antwort.

{{SIG}}`,
  },
  {
    key: "dsg_access_en",
    jurisdiction: "dsg",
    kind: "request",
    requestType: "access",
    language: "en",
    name: "CH FADP Access (Art. 25) – English",
    subject: "Request for information under Art. 25 FADP [{{reference}}]",
    body: `Dear Data Protection Officer,

Based on Art. 25 of the Swiss Federal Act on Data Protection (FADP) I request information on whether you process personal data about me and all information required for me to assert my rights, in particular:

1. all personal data processed as such (complete copy),
2. the purpose of processing,
3. the retention period or the criteria used to determine it,
4. the origin of the data where not obtained from me,
5. the existence of automated individual decision-making,
6. the recipients or categories of recipients, including the country and safeguards for disclosures abroad.

{{IDENT}}

Under Art. 25 para. 7 FADP the information must be provided within 30 days, i.e. by {{deadlineDate}}, and is generally free of charge. Please send it to {{senderEmail}}.

{{NO_ID}}

Please quote reference {{reference}} in your reply.

{{SIG}}`,
  },
  {
    key: "dsg_optout_de",
    jurisdiction: "dsg",
    kind: "request",
    requestType: "optout",
    language: "de",
    name: "CH DSG Widerspruch (Art. 30) – Deutsch",
    subject: "Widerspruch gegen die Datenbearbeitung gemäss Art. 30 DSG [{{reference}}]",
    body: `Sehr geehrte Damen und Herren,

hiermit widerspreche ich ausdrücklich der Bearbeitung meiner Personendaten, insbesondere zu Zwecken der Werbung, des Adresshandels und des Profilings (Art. 30 Abs. 2 lit. b DSG). Allfällige Einwilligungen widerrufe ich. Ich verlange, dass Sie meine Daten für jede weitere Bearbeitung sperren und mich in Ihre Sperrliste aufnehmen.

{{IDENT}}

Bitte bestätigen Sie mir die Umsetzung bis spätestens {{deadlineDate}}.

{{NO_ID}}

Bitte führen Sie die Referenz {{reference}} in Ihrer Antwort.

{{SIG}}`,
  },
  {
    key: "dsg_optout_en",
    jurisdiction: "dsg",
    kind: "request",
    requestType: "optout",
    language: "en",
    name: "CH FADP Objection (Art. 30) – English",
    subject: "Objection to data processing under Art. 30 FADP [{{reference}}]",
    body: `Dear Data Protection Officer,

I expressly object to the processing of my personal data, in particular for advertising, address trading and profiling purposes (Art. 30 para. 2 lit. b FADP). I withdraw any consent that may have been given. Please block my data from any further processing and add me to your suppression list.

{{IDENT}}

Please confirm implementation by {{deadlineDate}} at the latest.

{{NO_ID}}

Please quote reference {{reference}} in your reply.

{{SIG}}`,
  },

  // ---------------- CCPA ----------------
  {
    key: "ccpa_erasure_en",
    jurisdiction: "ccpa",
    kind: "request",
    requestType: "erasure",
    language: "en",
    name: "CCPA Request to Delete (§1798.105) – English",
    subject: "CCPA/CPRA Request to Delete Personal Information [{{reference}}]",
    body: `To whom it may concern,

Pursuant to the California Consumer Privacy Act as amended by the CPRA (Cal. Civ. Code § 1798.105) I request that you delete all personal information you have collected about me and direct any service providers, contractors and third parties to whom you have sold or shared my information to do the same.

I also exercise my rights to opt out of the sale or sharing of my personal information (§ 1798.120) and to limit the use of my sensitive personal information (§ 1798.121). Please treat this as a verifiable consumer request and add me to your suppression list so that my information is not re-collected.

Where you operate a people-search or public-records website, please remove all listings and profiles relating to me, including cached and archived copies, and suppress future listings.

{{IDENT}}

Listings/URLs where my information appears (if known):
{{dataUrls}}

Under § 1798.130(a)(2) you must confirm receipt within 10 business days and respond within 45 days, i.e. by {{deadlineDate}}. If you deny this request in whole or in part, please state the specific statutory exception you rely on. I reserve the right to file a complaint with the California Privacy Protection Agency.

Please do not require more information than is necessary to verify my identity, as prescribed by 11 CCR § 7060 et seq.

Please quote reference {{reference}} in your reply.

{{SIG_EN}}`,
  },
  {
    key: "ccpa_access_en",
    jurisdiction: "ccpa",
    kind: "request",
    requestType: "access",
    language: "en",
    name: "CCPA Request to Know (§1798.110) – English",
    subject: "CCPA/CPRA Request to Know Personal Information Collected [{{reference}}]",
    body: `To whom it may concern,

Pursuant to Cal. Civ. Code §§ 1798.100, 1798.110 and 1798.115 I request that you disclose:

1. the specific pieces of personal information you have collected about me,
2. the categories of personal information collected,
3. the categories of sources from which it was collected,
4. the business or commercial purpose for collecting, selling or sharing it,
5. the categories of third parties to whom it was disclosed, sold or shared,
6. the categories of personal information sold or shared, by recipient category.

{{IDENT}}

You must respond within 45 days (§ 1798.130(a)(2)), i.e. by {{deadlineDate}}. Please send the disclosure to {{senderEmail}}.

Please quote reference {{reference}} in your reply.

{{SIG_EN}}`,
  },
  {
    key: "ccpa_optout_en",
    jurisdiction: "ccpa",
    kind: "request",
    requestType: "optout",
    language: "en",
    name: "CCPA Opt-Out of Sale/Sharing (§1798.120) – English",
    subject: "CCPA/CPRA Request to Opt Out of Sale or Sharing [{{reference}}]",
    body: `To whom it may concern,

Pursuant to Cal. Civ. Code § 1798.120 I direct you to stop selling or sharing my personal information, and pursuant to § 1798.121 to limit the use and disclosure of my sensitive personal information. Please also add me to your internal suppression list.

{{IDENT}}

Under 11 CCR § 7026 you must comply within 15 business days, i.e. by {{deadlineDate}}, and notify all third parties to whom you sold or shared my information in the preceding 90 days.

Please quote reference {{reference}} in your reply.

{{SIG_EN}}`,
  },

  // ---------------- Reminders ----------------
  {
    key: "reminder_de",
    jurisdiction: "gdpr",
    kind: "reminder",
    requestType: null,
    language: "de",
    name: "Erinnerung / Mahnung – Deutsch",
    subject: "Erinnerung: Antrag {{reference}} vom {{sentDate}} – Frist abgelaufen",
    body: `Sehr geehrte Damen und Herren,

am {{sentDate}} habe ich Ihnen unter der Referenz {{reference}} einen Antrag betreffend meiner Personendaten zugestellt. Die gesetzliche Frist von {{deadlineDays}} Tagen ist am {{deadlineDate}} abgelaufen, ohne dass ich eine Antwort erhalten habe.

Ich fordere Sie letztmals auf, meinem Antrag innert 14 Tagen nachzukommen und mir dies schriftlich zu bestätigen. Andernfalls werde ich mich ohne weitere Ankündigung an die zuständige Aufsichtsbehörde ({{authorityName}}) wenden und rechtliche Schritte prüfen.

Zur Erinnerung die Identifikationsangaben:
{{IDENT}}

{{SIG}}`,
  },
  {
    key: "reminder_en",
    jurisdiction: "gdpr",
    kind: "reminder",
    requestType: null,
    language: "en",
    name: "Reminder – English",
    subject: "Reminder: request {{reference}} of {{sentDate}} – deadline passed",
    body: `Dear Data Protection Officer,

On {{sentDate}} I sent you a request concerning my personal data under reference {{reference}}. The statutory period of {{deadlineDays}} days expired on {{deadlineDate}} without any response from you.

I request for the last time that you comply with my request within 14 days and confirm this in writing. Otherwise I will refer the matter to the competent authority ({{authorityName}}) without further notice and consider legal action.

For your reference, my identification details:
{{IDENT}}

{{SIG}}`,
  },

  // ---------------- Escalations (documents for the user, not auto-sent) ----------------
  {
    key: "escalation_dsg_de",
    jurisdiction: "dsg",
    kind: "escalation",
    requestType: null,
    language: "de",
    name: "Meldung an den EDÖB – Deutsch",
    subject: "Meldung einer Datenschutzverletzung: {{brokerName}} (Referenz {{reference}})",
    body: `An den
Eidgenössischen Datenschutz- und Öffentlichkeitsbeauftragten (EDÖB)
Feldeggweg 1
3003 Bern

{{date}}

Meldung gemäss Art. 49 DSG: Missachtung von Betroffenenrechten durch {{brokerName}}

Sehr geehrte Damen und Herren,

ich melde Ihnen folgenden Sachverhalt:

Verantwortlicher: {{brokerName}}, {{brokerWebsite}}
Am {{sentDate}} habe ich beim Verantwortlichen unter der Referenz {{reference}} ein Begehren nach Art. 25/32 DSG gestellt. Die Frist von {{deadlineDays}} Tagen ist am {{deadlineDate}} abgelaufen. Trotz Mahnung ist das Begehren bis heute nicht oder nicht ausreichend beantwortet worden.

Ich ersuche Sie, den Sachverhalt zu prüfen und gegebenenfalls eine Untersuchung zu eröffnen. Die Korrespondenz lege ich bei.

Meine Angaben:
Name: {{fullName}}
Adresse:
{{addresses}}
E-Mail: {{senderEmail}}

Hinweis: Zivilrechtliche Ansprüche (Löschung, Auskunft) werde ich gegebenenfalls gestützt auf Art. 32 Abs. 2 DSG beim zuständigen Zivilgericht geltend machen.

{{SIG}}

Beilagen: Antrag vom {{sentDate}}, Erinnerung, allfällige Antworten`,
  },
  {
    key: "escalation_gdpr_de",
    jurisdiction: "gdpr",
    kind: "escalation",
    requestType: null,
    language: "de",
    name: "Beschwerde bei Aufsichtsbehörde (Art. 77 DSGVO) – Deutsch",
    subject: "Beschwerde gemäss Art. 77 DSGVO gegen {{brokerName}} (Referenz {{reference}})",
    body: `An die zuständige Datenschutz-Aufsichtsbehörde
[Name und Adresse der Behörde einsetzen – siehe {{authorityUrl}}]

{{date}}

Beschwerde gemäss Art. 77 DSGVO gegen {{brokerName}}

Sehr geehrte Damen und Herren,

hiermit lege ich Beschwerde gegen den folgenden Verantwortlichen ein:

{{brokerName}}, {{brokerWebsite}}

Sachverhalt:
Am {{sentDate}} habe ich unter der Referenz {{reference}} einen Antrag nach Art. 15/17/21 DSGVO gestellt. Die Frist nach Art. 12 Abs. 3 DSGVO ist am {{deadlineDate}} abgelaufen. Trotz Erinnerung hat der Verantwortliche nicht bzw. nicht ausreichend reagiert. Darin liegt ein Verstoss gegen Art. 12 Abs. 3 und 4 DSGVO sowie gegen die geltend gemachten Betroffenenrechte.

Ich bitte Sie, den Sachverhalt zu prüfen, den Verantwortlichen zur Erfüllung meines Antrags anzuweisen und mich über den Stand und das Ergebnis der Beschwerde zu unterrichten (Art. 77 Abs. 2 DSGVO).

Meine Angaben:
Name: {{fullName}}
Adresse:
{{addresses}}
E-Mail: {{senderEmail}}

{{SIG}}

Anlagen: Antrag vom {{sentDate}}, Erinnerung, allfällige Antworten`,
  },
  {
    key: "escalation_gdpr_en",
    jurisdiction: "gdpr",
    kind: "escalation",
    requestType: null,
    language: "en",
    name: "Complaint to supervisory authority (Art. 77 GDPR) – English",
    subject: "Complaint under Art. 77 GDPR against {{brokerName}} (reference {{reference}})",
    body: `To the competent data protection supervisory authority
[insert name and address – see {{authorityUrl}}]

{{date}}

Complaint under Article 77 GDPR against {{brokerName}}

Dear Sir or Madam,

I hereby lodge a complaint against the following controller:

{{brokerName}}, {{brokerWebsite}}

Facts:
On {{sentDate}} I submitted a request under Articles 15/17/21 GDPR under reference {{reference}}. The period under Article 12(3) GDPR expired on {{deadlineDate}}. Despite a reminder the controller has not responded, or not adequately. This constitutes an infringement of Article 12(3) and (4) GDPR and of the data subject rights I invoked.

I ask you to investigate, to order the controller to comply with my request, and to inform me of the progress and outcome of the complaint (Article 77(2) GDPR).

My details:
Name: {{fullName}}
Address:
{{addresses}}
E-mail: {{senderEmail}}

{{SIG}}

Enclosures: request of {{sentDate}}, reminder, any responses`,
  },
  {
    key: "escalation_ccpa_en",
    jurisdiction: "ccpa",
    kind: "escalation",
    requestType: null,
    language: "en",
    name: "Complaint to CPPA – English",
    subject: "CCPA complaint against {{brokerName}} (reference {{reference}})",
    body: `California Privacy Protection Agency
Online complaint form: {{authorityUrl}}

{{date}}

Complaint: failure to honour a verifiable consumer request – {{brokerName}}

Business: {{brokerName}}, {{brokerWebsite}}

Description of the violation:
On {{sentDate}} I submitted a verifiable consumer request (deletion / request to know / opt-out) under reference {{reference}} to the business's designated privacy contact. The business was required to confirm receipt within 10 business days and to respond within 45 days (Cal. Civ. Code § 1798.130(a)(2)), i.e. by {{deadlineDate}}. Despite a reminder, the business has not responded or has not complied.

Consumer details:
Name: {{fullName}}
Address:
{{addresses}}
E-mail: {{senderEmail}}

I request that the Agency investigate and take appropriate enforcement action.

Attachments: original request of {{sentDate}}, reminder, any responses

{{SIG_EN}}`,
  },
];

/** Expand the shared blocks so the stored template contains plain text only. */
export function expandSystemTemplate(t: SystemTemplate): SystemTemplate {
  const de = t.language === "de";
  const body = t.body
    .replaceAll("{{IDENT}}", de ? IDENT_DE : IDENT_EN)
    .replaceAll("{{NO_ID}}", t.jurisdiction === "dsg" ? (de ? NO_ID_DSG_DE : NO_ID_DSG_EN) : de ? NO_ID_DE : NO_ID_EN)
    .replaceAll("{{SIG_EN}}", SIG_EN)
    .replaceAll("{{SIG}}", de ? SIG_DE : SIG_EN);
  return { ...t, body };
}
